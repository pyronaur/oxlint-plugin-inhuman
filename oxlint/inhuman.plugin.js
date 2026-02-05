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
	"Runtime value exports (functions, classes, and const) must appear at the end of the file. Type-only exports and primitive consts are exempt.";

const NO_EXPORT_SPECIFIERS_MESSAGE =
	"Do not use `export { ... }` for local values. Export the declaration directly at the bottom of the file instead.";

const NO_EXPORT_ALIAS_MESSAGE =
	"Do not export local aliases like `export const x = y`. Export the declaration directly at the bottom of the file instead.";

const NO_DEFAULT_EXPORT_IDENTIFIER_MESSAGE =
	"Default-exported identifiers are only allowed for variables used internally. Export the declaration directly instead.";

const NO_EMPTY_WRAPPERS_MESSAGE =
	"Do not export empty wrapper functions. Export the implementation directly instead.";

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

function isPrimitiveConstExport(node) {
	if (node?.type !== "ExportNamedDeclaration") {
		return false;
	}

	if (node.source != null) {
		return false;
	}

	const declaration = node.declaration;
	if (!declaration || declaration.type !== "VariableDeclaration" || declaration.kind !== "const") {
		return false;
	}

	const declarations = declaration.declarations ?? [];
	if (declarations.length === 0) {
		return false;
	}

	return declarations.every((declarator) => {
		return declarator.id?.type === "Identifier" && isPrimitiveLiteralExpression(declarator.init);
	});
}

function isExemptExport(node, options) {
	if (isTypeOnlyExport(node)) {
		return true;
	}

	if (isPrimitiveConstExport(node)) {
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

function isExportedFunction(node) {
	const parent = node?.parent;
	if (!parent) return false;
	return parent.type === "ExportNamedDeclaration" || parent.type === "ExportDefaultDeclaration";
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
					if (isExemptExport(node, options)) continue;

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
			description:
				"Disallow exported empty wrapper functions that only pass through to another call.",
			recommended: false,
		},
		schema: [],
		messages: {
			noEmptyWrapper: NO_EMPTY_WRAPPERS_MESSAGE,
		},
	},
	create(context) {
		function checkFunctionLike(node) {
			if (!isExportedFunction(node)) {
				return;
			}

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

export default {
	meta: {
		name: "inhuman",
	},
	rules: {
		"require-guard-clauses": requireGuardClausesRule,
		"no-swallowed-catch": noSwallowedCatchRule,
		"export-code-last": exportsLastExceptTypesRule,
		"no-empty-wrappers": noEmptyWrappersRule,
		"no-switch": noBranchingPlugin.rules["no-switch"],
		"no-else": noBranchingPlugin.rules["no-else"],
	},
};
