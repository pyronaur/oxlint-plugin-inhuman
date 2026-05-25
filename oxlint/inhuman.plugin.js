/**
 * Oxlint JS plugin: inhuman
 *
 * Opinionated rules that encode "pet peeves" and push code toward
 * explicit, guard-clause-first, error-safe patterns.
 */

import noBranchingPlugin from "oxlint-plugin-no-branching";

const REQUIRE_GUARD_CLAUSE_MESSAGE =
	"Avoid wrapping the entire function body in an if. Use a guard clause / early return instead.";

const NO_SWALLOWED_CATCH_MESSAGE =
	"Do not swallow errors in catch blocks. Handle, log, rethrow, or explicitly justify it.";

const EXPORTS_LAST_EXCEPT_TYPES_MESSAGE =
	"Runtime value exports (functions, classes, and most const values) must appear at the end of the file. Type-only exports, primitive consts, and direct Zod or Effect schema exports are exempt.";

const NO_EXPORT_SPECIFIERS_MESSAGE =
	"Do not use `export { ... }` for local values. Export the declaration directly at the bottom of the file instead.";

const NO_EXPORT_ALIAS_MESSAGE =
	"Do not export local aliases like `export const x = y`. Export the original declaration directly instead.";

const NO_DEFAULT_EXPORT_IDENTIFIER_MESSAGE =
	"Default-exported identifiers are only allowed for variables used internally. Export the declaration directly instead.";

const NO_EMPTY_WRAPPERS_MESSAGE =
	"Do not write empty wrapper functions. Use the implementation directly instead.";

const NO_SINGLE_USE_LOCAL_FUNCTION_MESSAGE =
	"This local function has one return expression and is called once. Inline it at the call site or make the abstraction carry real behavior.";

const TEST_SIZE_MESSAGE =
	"This test/helper function is too large ({{lineCount}} lines). Limit is {{max}} lines.";

const DEFAULT_SINGLE_USE_LOCAL_FUNCTION_OPTIONS = {
	predicateNamePattern: "^(is|has|can|should|must|needs|will)[A-Z_]",
};

const DEFAULT_TEST_SIZE_OPTIONS = {
	calleeLimits: {
		describe: 800,
	},
	max: 100,
};

function getSourceCode(context) {
	return (
		context.sourceCode ??
		(typeof context.getSourceCode === "function" ? context.getSourceCode() : null)
	);
}

function isEarlyExitStatement(node) {
	if (!node) return false;

	if (node.type === "ReturnStatement" || node.type === "ThrowStatement") {
		return true;
	}

	if (node.type === "BlockStatement") {
		return node.body.length === 1 && isEarlyExitStatement(node.body[0]);
	}

	return false;
}

function isNegatedCondition(node) {
	return node?.type === "UnaryExpression" && node.operator === "!";
}

function isExportNode(node) {
	return (
		node?.type === "ExportAllDeclaration" ||
		node?.type === "ExportDefaultDeclaration" ||
		node?.type === "ExportNamedDeclaration"
	);
}

function unwrapExpression(node) {
	let current = node;
	// Unwrap common wrappers around call expressions.
	while (
		current &&
		(current.type === "AwaitExpression" ||
			current.type === "ChainExpression" ||
			current.type === "ParenthesizedExpression")
	) {
		current = current.type === "AwaitExpression" ? current.argument : current.expression;
	}
	return current;
}

function isFunctionExpression(node) {
	return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

function getStaticPropertyName(node) {
	if (node?.type === "Identifier") {
		return node.name;
	}

	if (node?.type === "Literal" && typeof node.value === "string") {
		return node.value;
	}

	return null;
}

function getCalleeNameCandidates(node) {
	if (!node) {
		return [];
	}

	if (node.type === "Identifier") {
		return [node.name];
	}

	if (node.type === "CallExpression") {
		return getCalleeNameCandidates(node.callee);
	}

	if (node.type === "ChainExpression" || node.type === "ParenthesizedExpression") {
		return getCalleeNameCandidates(node.expression);
	}

	if (node.type === "MemberExpression") {
		const objectNames = getCalleeNameCandidates(node.object);
		const propertyName = getStaticPropertyName(node.property);
		if (propertyName == null) {
			return objectNames;
		}

		const fullNames = objectNames.map((name) => `${name}.${propertyName}`);
		return [...fullNames, ...objectNames, propertyName];
	}

	return [];
}

function exportedVariableNames(declaration) {
	const names = [];

	for (const declarator of declaration.declarations ?? []) {
		if (declarator.id?.type === "Identifier") {
			names.push(declarator.id.name);
		}
	}

	return names;
}

function exportedNamesFromSpecifiers(node) {
	const names = [];

	for (const specifier of node.specifiers ?? []) {
		if (specifier.local?.type === "Identifier") {
			names.push(specifier.local.name);
		}
	}

	return names;
}

function collectExportedName(node, exportedNames) {
	if (node.declaration?.type === "FunctionDeclaration" && node.declaration.id != null) {
		exportedNames.add(node.declaration.id.name);
		return;
	}

	if (node.declaration?.type === "VariableDeclaration") {
		for (const name of exportedVariableNames(node.declaration)) {
			exportedNames.add(name);
		}
		return;
	}

	for (const name of exportedNamesFromSpecifiers(node)) {
		exportedNames.add(name);
	}
}

function singleReturnExpression(node) {
	if (node.body != null && node.body.type !== "BlockStatement") {
		return node.body;
	}

	if (node.body?.type !== "BlockStatement" || node.body.body.length !== 1) {
		return null;
	}

	const statement = node.body.body[0];
	if (statement.type !== "ReturnStatement") {
		return null;
	}

	return statement.argument;
}

function isDirectCallReference(reference, functionName) {
	const identifier = reference.identifier;
	const parent = identifier.parent;

	return (
		parent?.type === "CallExpression" &&
		parent.callee === identifier &&
		parent.arguments.length > 0 &&
		identifier.name === functionName
	);
}

function singleDirectCall(variable) {
	const readReferences = variable.references.filter((reference) => reference.isRead());

	if (readReferences.length !== 1) {
		return null;
	}

	return readReferences[0];
}

function shouldIgnoreFunctionName(name, predicateNamePattern) {
	return predicateNamePattern !== "" && new RegExp(predicateNamePattern, "u").test(name);
}

function getInhumanSettings(context) {
	return context.settings?.inhuman ?? {};
}

function getSingleUseLocalFunctionOptions(context) {
	const raw = context.options?.[0] ?? {};
	const settings = getInhumanSettings(context);

	return {
		predicateNamePattern:
			raw.predicateNamePattern ??
			settings.predicateNamePattern ??
			DEFAULT_SINGLE_USE_LOCAL_FUNCTION_OPTIONS.predicateNamePattern,
	};
}

function getTestSizeOptions(context) {
	const raw = context.options?.[0] ?? {};

	return {
		calleeLimits: raw.calleeLimits ?? DEFAULT_TEST_SIZE_OPTIONS.calleeLimits,
		max: raw.max ?? DEFAULT_TEST_SIZE_OPTIONS.max,
	};
}

function getFunctionLineCount(node) {
	if (!node.loc?.start || !node.loc?.end) {
		return 0;
	}

	return node.loc.end.line - node.loc.start.line + 1;
}

function getCallbackCallExpression(node) {
	const parent = node.parent;

	if (parent?.type !== "CallExpression") {
		return null;
	}

	return parent.arguments?.includes(node) ? parent : null;
}

function getTestSizeLimit(node, options) {
	const callExpression = getCallbackCallExpression(node);
	if (callExpression == null) {
		return options.max;
	}

	for (const name of getCalleeNameCandidates(callExpression.callee)) {
		const limit = options.calleeLimits[name];
		if (typeof limit === "number") {
			return limit;
		}
	}

	return options.max;
}

function isTypeOnlyExport(node) {
	if (node?.type !== "ExportNamedDeclaration") {
		return false;
	}

	// TS/ESTree: `export type { Foo } from "./x"`
	if (node.exportKind === "type") {
		return true;
	}

	// `export { type Foo } from "./x"` style
	if (Array.isArray(node.specifiers) && node.specifiers.length > 0) {
		return node.specifiers.every((specifier) => specifier.exportKind === "type");
	}

	return false;
}

function isPrimitiveLiteralExpression(node) {
	if (!node) {
		return false;
	}

	if (node.type === "ParenthesizedExpression") {
		return isPrimitiveLiteralExpression(node.expression);
	}

	if (node.type === "ChainExpression") {
		return isPrimitiveLiteralExpression(node.expression);
	}

	if (node.type === "TemplateLiteral") {
		return node.expressions.length === 0;
	}

	if (node.type === "Literal") {
		const value = node.value;
		return (
			value === null ||
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean" ||
			typeof value === "bigint"
		);
	}

	if (node.type === "UnaryExpression") {
		const arg = node.argument;

		if (node.operator === "+" || node.operator === "-" || node.operator === "~") {
			return (
				arg?.type === "Literal" && (typeof arg.value === "number" || typeof arg.value === "bigint")
			);
		}

		if (node.operator === "!") {
			return arg?.type === "Literal" && typeof arg.value === "boolean";
		}
	}

	return false;
}

function getLocalConstExportDeclarators(node) {
	if (node?.type !== "ExportNamedDeclaration") {
		return null;
	}

	if (node.source != null) {
		return null;
	}

	const declaration = node.declaration;
	if (!declaration || declaration.type !== "VariableDeclaration" || declaration.kind !== "const") {
		return null;
	}

	const declarations = declaration.declarations ?? [];
	if (declarations.length === 0) {
		return null;
	}

	return declarations;
}

function isPrimitiveConstExport(node) {
	const declarations = getLocalConstExportDeclarators(node);
	if (!declarations) {
		return false;
	}

	return declarations.every((declarator) => {
		return declarator.id?.type === "Identifier" && isPrimitiveLiteralExpression(declarator.init);
	});
}

function getSchemaNamespaceNames(program) {
	const names = new Set();

	for (const node of program.body ?? []) {
		if (node.type !== "ImportDeclaration") {
			continue;
		}

		const source = node.source?.value;

		for (const specifier of node.specifiers ?? []) {
			if (source === "zod" && specifier.type === "ImportNamespaceSpecifier") {
				names.add(specifier.local.name);
				continue;
			}

			if (source === "effect/Schema" && specifier.type === "ImportNamespaceSpecifier") {
				names.add(specifier.local.name);
				continue;
			}

			if (specifier.type !== "ImportSpecifier") {
				continue;
			}

			if (
				source === "zod" &&
				specifier.imported?.type === "Identifier" &&
				specifier.imported.name === "z"
			) {
				names.add(specifier.local.name);
				continue;
			}

			if (
				source === "effect" &&
				specifier.imported?.type === "Identifier" &&
				specifier.imported.name === "Schema"
			) {
				names.add(specifier.local.name);
			}
		}
	}

	return names;
}

function isSchemaNamespaceExpression(node, schemaNames) {
	if (!node || schemaNames.size === 0) {
		return false;
	}

	if (node.type === "Identifier") {
		return schemaNames.has(node.name);
	}

	if (node.type === "MemberExpression") {
		return isSchemaNamespaceExpression(node.object, schemaNames);
	}

	if (node.type === "CallExpression") {
		return isSchemaNamespaceExpression(node.callee, schemaNames);
	}

	if (
		node.type === "ChainExpression" ||
		node.type === "ParenthesizedExpression" ||
		node.type === "TSAsExpression" ||
		node.type === "TSSatisfiesExpression" ||
		node.type === "TSNonNullExpression" ||
		node.type === "TSTypeAssertion"
	) {
		return isSchemaNamespaceExpression(node.expression, schemaNames);
	}

	return false;
}

function isDirectSchemaExport(node, schemaNames) {
	const declarations = getLocalConstExportDeclarators(node);
	if (!declarations) {
		return false;
	}

	return declarations.every((declarator) => {
		return (
			declarator.id?.type === "Identifier" &&
			isSchemaNamespaceExpression(declarator.init, schemaNames)
		);
	});
}

function isExemptExport(node, options, schemaNames) {
	if (isTypeOnlyExport(node)) {
		return true;
	}

	if (isPrimitiveConstExport(node)) {
		return true;
	}

	if (isDirectSchemaExport(node, schemaNames)) {
		return true;
	}

	if (options?.allowReExport === true) {
		if (node.type === "ExportAllDeclaration") {
			return true;
		}

		if (node.type === "ExportNamedDeclaration" && node.source) {
			return true;
		}
	}

	return false;
}

function isLocalNamedExportList(node) {
	if (node?.type !== "ExportNamedDeclaration") {
		return false;
	}

	// `export { foo }` (no declaration, no source) is a local export list.
	if (node.declaration != null) {
		return false;
	}
	if (node.source != null) {
		return false;
	}

	return Array.isArray(node.specifiers) && node.specifiers.length > 0;
}

function isAliasLikeExpression(node) {
	if (!node) {
		return false;
	}

	if (node.type === "Identifier" || node.type === "MemberExpression") {
		return true;
	}

	if (node.type === "ChainExpression") {
		return isAliasLikeExpression(node.expression);
	}

	if (node.type === "ParenthesizedExpression") {
		return isAliasLikeExpression(node.expression);
	}

	return false;
}

function isLocalAliasExport(node) {
	if (node?.type !== "ExportNamedDeclaration") {
		return false;
	}

	const declaration = node.declaration;
	if (!declaration || declaration.type !== "VariableDeclaration") {
		return false;
	}

	// Treat `export const x = y` and `export const x = obj.y` as alias exports.
	return declaration.declarations.some((declarator) => isAliasLikeExpression(declarator.init));
}

function isDefaultIdentifierExport(node) {
	if (node?.type !== "ExportDefaultDeclaration") {
		return false;
	}

	return node.declaration?.type === "Identifier";
}

function getNodeRange(node) {
	if (!node) return null;
	if (Array.isArray(node.range) && node.range.length === 2) return node.range;
	if (typeof node.start === "number" && typeof node.end === "number") {
		return [node.start, node.end];
	}
	return null;
}

function isSameNodeLocation(left, right) {
	if (left === right) return true;
	const leftRange = getNodeRange(left);
	const rightRange = getNodeRange(right);
	if (!leftRange || !rightRange) return false;
	return leftRange[0] === rightRange[0] && leftRange[1] === rightRange[1];
}

function getVisitorKeys(sourceCode) {
	return sourceCode?.visitorKeys ?? null;
}

function collectChildNodesFromValue(value, children) {
	if (Array.isArray(value)) {
		for (const item of value) {
			if (item && typeof item.type === "string") {
				children.push(item);
			}
		}
		return;
	}
	if (value && typeof value.type === "string") {
		children.push(value);
	}
}

function getChildNodes(node, visitorKeys) {
	if (!node || typeof node.type !== "string") return [];
	const keys = visitorKeys?.[node.type];
	if (Array.isArray(keys) && keys.length > 0) {
		const children = [];
		for (const key of keys) {
			collectChildNodesFromValue(node[key], children);
		}
		return children;
	}

	const children = [];
	for (const [key, value] of Object.entries(node)) {
		if (key === "parent") continue;
		collectChildNodesFromValue(value, children);
	}
	return children;
}

function isIdentifierReference(node, parent) {
	if (!parent) return true;

	const parentType = parent.type;

	if (parentType === "VariableDeclarator") {
		return parent.init === node;
	}

	if (
		parentType === "FunctionDeclaration" ||
		parentType === "FunctionExpression" ||
		parentType === "ArrowFunctionExpression"
	) {
		if (parent.id === node) return false;
		if (Array.isArray(parent.params) && parent.params.includes(node)) return false;
		return true;
	}

	if (parentType === "ClassDeclaration" || parentType === "ClassExpression") {
		if (parent.id === node) return false;
		return true;
	}

	if (parentType === "CatchClause") {
		if (parent.param === node) return false;
		return true;
	}

	if (
		parentType === "ImportSpecifier" ||
		parentType === "ImportDefaultSpecifier" ||
		parentType === "ImportNamespaceSpecifier" ||
		parentType === "ExportSpecifier"
	) {
		return false;
	}

	if (parentType === "ExportDefaultDeclaration") {
		if (parent.declaration === node) return false;
		return true;
	}

	if (parentType === "MemberExpression") {
		if (parent.property === node && !parent.computed) return false;
		return true;
	}

	if (parentType === "Property") {
		const inPattern = parent.parent?.type === "ObjectPattern";
		if (inPattern) {
			if (parent.key === node && parent.computed) return true;
			return false;
		}
		if (parent.key === node) {
			if (parent.computed) return true;
			if (parent.shorthand) return true;
			return false;
		}
		return true;
	}

	if (parentType === "MethodDefinition") {
		if (parent.key === node && !parent.computed) return false;
		return true;
	}

	if (parentType === "PropertyDefinition" || parentType === "ClassProperty") {
		if (parent.key === node && !parent.computed) return false;
		return true;
	}

	if (
		parentType === "LabeledStatement" ||
		parentType === "BreakStatement" ||
		parentType === "ContinueStatement"
	) {
		return false;
	}

	if (parentType === "AssignmentPattern") {
		if (parent.left === node) return false;
		return true;
	}

	if (
		parentType === "RestElement" ||
		parentType === "ArrayPattern" ||
		parentType === "ObjectPattern"
	) {
		return false;
	}

	if (
		parentType === "ForInStatement" ||
		parentType === "ForOfStatement" ||
		parentType === "ForStatement"
	) {
		if (parent.left === node) return false;
		return true;
	}

	if (
		parentType === "TSAsExpression" ||
		parentType === "TSTypeAssertion" ||
		parentType === "TSNonNullExpression" ||
		parentType === "TSInstantiationExpression"
	) {
		return parent.expression === node;
	}

	if (
		parentType === "TSTypeAnnotation" ||
		parentType === "TSTypeReference" ||
		parentType === "TSQualifiedName" ||
		parentType === "TSInterfaceDeclaration" ||
		parentType === "TSTypeAliasDeclaration" ||
		parentType === "TSModuleDeclaration" ||
		parentType === "TSParameterProperty" ||
		parentType === "TSPropertySignature" ||
		parentType === "TSTypeLiteral" ||
		parentType === "TSUnionType" ||
		parentType === "TSIntersectionType" ||
		parentType === "TSLiteralType" ||
		parentType === "TSArrayType" ||
		parentType === "TSTypeOperator" ||
		parentType === "TSIndexedAccessType" ||
		parentType === "TSMappedType" ||
		parentType === "TSFunctionType" ||
		parentType === "TSConstructorType" ||
		parentType === "TSImportType"
	) {
		return false;
	}

	return true;
}

function getTopLevelDeclarationInfo(program, name) {
	const variableIds = [];
	let hasVariable = false;
	let hasFunctionOrClass = false;

	for (const node of program.body ?? []) {
		let declarationNode = node;

		if (node.type === "ExportNamedDeclaration" && node.declaration) {
			declarationNode = node.declaration;
		}

		if (declarationNode.type === "VariableDeclaration") {
			for (const declarator of declarationNode.declarations ?? []) {
				if (declarator.id?.type === "Identifier" && declarator.id.name === name) {
					hasVariable = true;
					variableIds.push(declarator.id);
				}
			}
			continue;
		}

		if (
			(declarationNode.type === "FunctionDeclaration" ||
				declarationNode.type === "ClassDeclaration") &&
			declarationNode.id?.name === name
		) {
			hasFunctionOrClass = true;
		}
	}

	return { hasVariable, hasFunctionOrClass, variableIds };
}

function isIdentifierUsedInternally(program, name, excludedNodes, sourceCode) {
	const visitorKeys = getVisitorKeys(sourceCode);
	let found = false;
	const excluded = excludedNodes ?? [];

	function isExcluded(node) {
		return excluded.some((excludedNode) => isSameNodeLocation(node, excludedNode));
	}

	function visit(node, parent) {
		if (!node || found) return;

		if (node.type === "Identifier" && node.name === name && !isExcluded(node)) {
			if (isIdentifierReference(node, parent)) {
				found = true;
				return;
			}
		}

		for (const child of getChildNodes(node, visitorKeys)) {
			visit(child, node);
			if (found) return;
		}
	}

	visit(program, null);
	return found;
}

function isAllowedDefaultIdentifierExport(node, program, sourceCode) {
	if (!isDefaultIdentifierExport(node)) {
		return false;
	}

	const identifier = node.declaration;
	const name = identifier.name;
	const scopeManager = sourceCode?.scopeManager;
	let isVariable = false;
	let isFunctionOrClass = false;
	let hasInternalUse = false;
	let declarationInfo = null;

	if (scopeManager?.globalScope) {
		const variable = scopeManager.globalScope.variables?.find((item) => item.name === name);
		if (variable) {
			const defs = variable.defs ?? [];
			isVariable = defs.some((def) => def.type === "Variable");
			isFunctionOrClass = defs.some(
				(def) => def.type === "FunctionName" || def.type === "ClassName",
			);

			for (const reference of variable.references ?? []) {
				if (!isSameNodeLocation(reference.identifier, identifier)) {
					hasInternalUse = true;
					break;
				}
			}
		}
	}

	if (!isVariable && !isFunctionOrClass) {
		declarationInfo = getTopLevelDeclarationInfo(program, name);
		isVariable = declarationInfo.hasVariable;
		isFunctionOrClass = declarationInfo.hasFunctionOrClass;
	}

	if (!hasInternalUse) {
		if (!declarationInfo) {
			declarationInfo = getTopLevelDeclarationInfo(program, name);
		}
		if (declarationInfo.hasVariable) {
			const excludedNodes = [identifier, ...declarationInfo.variableIds];
			hasInternalUse = isIdentifierUsedInternally(program, name, excludedNodes, sourceCode);
		}
	}

	if (!isVariable || isFunctionOrClass) return false;
	return hasInternalUse;
}

function getCallExpressionFromStatement(statement) {
	if (!statement) return null;

	if (statement.type === "ExpressionStatement") {
		const expr = unwrapExpression(statement.expression);
		return expr?.type === "CallExpression" ? expr : null;
	}

	if (statement.type === "ReturnStatement") {
		const expr = unwrapExpression(statement.argument);
		return expr?.type === "CallExpression" ? expr : null;
	}

	return null;
}

function isPassThroughWrapper(node, callExpression) {
	const params = node.params ?? [];
	const args = callExpression.arguments ?? [];

	// Only treat plain identifier parameters (and a single rest identifier) as pass-through.
	const paramNames = [];
	let restName = null;

	for (const param of params) {
		if (param.type === "Identifier") {
			paramNames.push(param.name);
			continue;
		}

		if (param.type === "RestElement" && param.argument?.type === "Identifier") {
			restName = param.argument.name;
			continue;
		}

		// Destructuring or other patterns are not considered "empty wrappers".
		return false;
	}

	if (restName != null) {
		// Require the rest arg to be passed through as `...rest` at the end.
		if (args.length !== paramNames.length + 1) {
			return false;
		}

		for (let i = 0; i < paramNames.length; i += 1) {
			const arg = args[i];
			if (arg?.type !== "Identifier" || arg.name !== paramNames[i]) {
				return false;
			}
		}

		const lastArg = args[args.length - 1];
		return (
			lastArg?.type === "SpreadElement" &&
			lastArg.argument?.type === "Identifier" &&
			lastArg.argument.name === restName
		);
	}

	if (args.length !== paramNames.length) {
		return false;
	}

	for (let i = 0; i < paramNames.length; i += 1) {
		const arg = args[i];
		if (arg?.type !== "Identifier" || arg.name !== paramNames[i]) {
			return false;
		}
	}

	return true;
}

function blockHasOnlyComments(block, sourceCode) {
	if (!sourceCode) {
		// Fall back to structural check only.
		return block.body.length === 0;
	}

	const text = sourceCode.getText(block);
	// Strip the outer braces and trim.
	const inner = text.slice(1, -1).trim();
	if (inner.length === 0) {
		return true;
	}

	// Remove block and line comments, then trim again.
	const withoutBlockComments = inner.replace(/\/\*[\s\S]*?\*\//g, "");
	const withoutAnyComments = withoutBlockComments.replace(/\/\/[^\n\r]*/g, "");
	return withoutAnyComments.trim().length === 0;
}

/** @type {import('eslint').Rule.RuleModule} */
const requireGuardClausesRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Require guard clauses by forbidding a single if-statement that wraps the entire function body.",
			recommended: false,
		},
		schema: [],
		messages: {
			requireGuardClause: REQUIRE_GUARD_CLAUSE_MESSAGE,
		},
	},
	create(context) {
		function checkFunctionLike(node) {
			const body = node.body;
			if (!body || body.type !== "BlockStatement") {
				return;
			}

			const statements = body.body;
			if (statements.length !== 1) {
				return;
			}

			const onlyStatement = statements[0];
			if (onlyStatement.type !== "IfStatement") {
				return;
			}

			// We only care about the "wrapper if" shape: a single if with no alternate.
			if (onlyStatement.alternate != null) {
				return;
			}

			// Allow actual guard clauses / early exits, e.g.:
			// if (!user) return;
			if (
				isEarlyExitStatement(onlyStatement.consequent) &&
				isNegatedCondition(onlyStatement.test)
			) {
				return;
			}

			context.report({ node: onlyStatement, messageId: "requireGuardClause" });
		}

		return {
			FunctionDeclaration: checkFunctionLike,
			FunctionExpression: checkFunctionLike,
			ArrowFunctionExpression: checkFunctionLike,
		};
	},
};

/** @type {import('eslint').Rule.RuleModule} */
const noSwallowedCatchRule = {
	meta: {
		type: "problem",
		docs: {
			description: "Forbid empty or comment-only catch blocks that swallow errors.",
			recommended: false,
		},
		schema: [],
		messages: {
			noSwallowedCatch: NO_SWALLOWED_CATCH_MESSAGE,
		},
	},
	create(context) {
		const sourceCode = getSourceCode(context);

		return {
			CatchClause(node) {
				const body = node.body;
				if (!body || body.type !== "BlockStatement") {
					return;
				}

				const isStructurallyEmpty = body.body.length === 0;
				if (!isStructurallyEmpty && !blockHasOnlyComments(body, sourceCode)) {
					return;
				}

				context.report({ node: body, messageId: "noSwallowedCatch" });
			},
		};
	},
};

/** @type {import('eslint').Rule.RuleModule} */
const exportsLastExceptTypesRule = {
	meta: {
		type: "layout",
		docs: {
			description:
				"Require value exports at the bottom of the file, but allow type-only exports anywhere.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					allowReExport: { type: "boolean" },
				},
				additionalProperties: false,
			},
		],
		messages: {
			exportsLast: EXPORTS_LAST_EXCEPT_TYPES_MESSAGE,
			noExportSpecifiers: NO_EXPORT_SPECIFIERS_MESSAGE,
			noExportAlias: NO_EXPORT_ALIAS_MESSAGE,
			noDefaultExportIdentifier: NO_DEFAULT_EXPORT_IDENTIFIER_MESSAGE,
		},
	},
	create(context) {
		const options = context.options?.[0] ?? {};
		const sourceCode = getSourceCode(context);

		return {
			Program(program) {
				const body = program.body ?? [];
				const schemaNames = getSchemaNamespaceNames(program);
				if (body.length === 0) return;

				// Forbid default exports that just reference an identifier.
				for (const node of body) {
					if (!isDefaultIdentifierExport(node)) continue;
					if (isAllowedDefaultIdentifierExport(node, program, sourceCode)) continue;

					context.report({
						node,
						messageId: "noDefaultExportIdentifier",
					});
				}

				// First, forbid local export lists like `export { foo }`.
				for (const node of body) {
					if (!isLocalNamedExportList(node)) continue;
					if (isTypeOnlyExport(node)) continue;

					context.report({
						node,
						messageId: "noExportSpecifiers",
					});
				}

				// Next, forbid alias exports like `export const x = y`.
				for (const node of body) {
					if (!isLocalAliasExport(node)) continue;

					context.report({
						node,
						messageId: "noExportAlias",
					});
				}

				// Find the last non-export top-level statement.
				let lastNonExportIndex = -1;
				for (let i = body.length - 1; i >= 0; i -= 1) {
					const node = body[i];
					if (!isExportNode(node)) {
						lastNonExportIndex = i;
						break;
					}
				}

				// If everything is exports, there is nothing to enforce.
				if (lastNonExportIndex === -1) return;

				// Any non-exempt export before that index is a violation.
				for (let i = 0; i < lastNonExportIndex; i += 1) {
					const node = body[i];
					if (!isExportNode(node)) continue;
					if (isLocalNamedExportList(node) && !isTypeOnlyExport(node)) continue;
					if (isLocalAliasExport(node)) continue;
					if (isExemptExport(node, options, schemaNames)) continue;

					context.report({
						node,
						messageId: "exportsLast",
					});
				}
			},
		};
	},
};

/** @type {import('eslint').Rule.RuleModule} */
const noEmptyWrappersRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow empty wrapper functions that only pass through to another call.",
			recommended: false,
		},
		schema: [],
		messages: {
			noEmptyWrapper: NO_EMPTY_WRAPPERS_MESSAGE,
		},
	},
	create(context) {
		function checkFunctionLike(node) {
			const body = node.body;
			if (!body || body.type !== "BlockStatement") {
				return;
			}

			const statements = body.body ?? [];
			if (statements.length !== 1) {
				return;
			}

			const callExpression = getCallExpressionFromStatement(statements[0]);
			if (!callExpression) {
				return;
			}

			if (!isPassThroughWrapper(node, callExpression)) {
				return;
			}

			context.report({
				node,
				messageId: "noEmptyWrapper",
			});
		}

		return {
			FunctionDeclaration: checkFunctionLike,
			FunctionExpression: checkFunctionLike,
			ArrowFunctionExpression: checkFunctionLike,
		};
	},
};

/** @type {import('eslint').Rule.RuleModule} */
const noSingleUseLocalFunctionRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow local single-expression functions that are called once.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					predicateNamePattern: { type: "string" },
				},
				additionalProperties: false,
			},
		],
		messages: {
			noSingleUseLocalFunction: NO_SINGLE_USE_LOCAL_FUNCTION_MESSAGE,
		},
	},
	create(context) {
		const options = getSingleUseLocalFunctionOptions(context);
		const candidates = [];
		const exportedNames = new Set();

		function rememberCandidate(bindingNode, id, name) {
			if (shouldIgnoreFunctionName(name, options.predicateNamePattern)) {
				return;
			}

			if (singleReturnExpression(bindingNode) == null) {
				return;
			}

			candidates.push({ bindingNode, id, name });
		}

		return {
			FunctionDeclaration(node) {
				if (node.id == null) {
					return;
				}

				rememberCandidate(node, node.id, node.id.name);
			},

			VariableDeclarator(node) {
				if (node.id?.type !== "Identifier" || !isFunctionExpression(node.init)) {
					return;
				}

				if (singleReturnExpression(node.init) == null) {
					return;
				}

				if (shouldIgnoreFunctionName(node.id.name, options.predicateNamePattern)) {
					return;
				}

				candidates.push({
					bindingNode: node,
					id: node.id,
					name: node.id.name,
				});
			},

			ExportNamedDeclaration(node) {
				collectExportedName(node, exportedNames);
			},

			"Program:exit"() {
				for (const candidate of candidates) {
					if (exportedNames.has(candidate.name)) {
						continue;
					}

					const variable = context.sourceCode
						.getDeclaredVariables(candidate.bindingNode)
						.find((declared) => declared.name === candidate.name);
					const reference = variable == null ? null : singleDirectCall(variable);
					if (reference == null || !isDirectCallReference(reference, candidate.name)) {
						continue;
					}

					context.report({
						node: candidate.id,
						messageId: "noSingleUseLocalFunction",
					});
				}
			},
		};
	},
};

/** @type {import('eslint').Rule.RuleModule} */
const testSizeRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Limit test callbacks and helpers while allowing named suite containers to have larger limits.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					calleeLimits: {
						type: "object",
						additionalProperties: { type: "number" },
					},
					max: { type: "number" },
				},
				additionalProperties: false,
			},
		],
		messages: {
			testSize: TEST_SIZE_MESSAGE,
		},
	},
	create(context) {
		const options = getTestSizeOptions(context);

		function checkFunctionLike(node) {
			const lineCount = getFunctionLineCount(node);
			if (lineCount === 0) {
				return;
			}

			const max = getTestSizeLimit(node, options);
			if (lineCount <= max) {
				return;
			}

			context.report({
				node,
				messageId: "testSize",
				data: {
					lineCount: String(lineCount),
					max: String(max),
				},
			});
		}

		return {
			FunctionDeclaration: checkFunctionLike,
			FunctionExpression: checkFunctionLike,
			ArrowFunctionExpression: checkFunctionLike,
		};
	},
};

export default {
	meta: {
		name: "inhuman",
	},
	rules: {
		"require-guard-clauses": requireGuardClausesRule,
		"no-swallowed-catch": noSwallowedCatchRule,
		"export-code-last": exportsLastExceptTypesRule,
		"no-empty-wrappers": noEmptyWrappersRule,
		"no-single-use-local-function": noSingleUseLocalFunctionRule,
		"test-size": testSizeRule,
		"no-switch": noBranchingPlugin.rules["no-switch"],
		"no-else": noBranchingPlugin.rules["no-else"],
	},
};
