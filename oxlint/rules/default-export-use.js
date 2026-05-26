import { getSourceCode } from "./ast.js";

const importExportSpecifierTypes = new Set([
	"ImportSpecifier",
	"ImportDefaultSpecifier",
	"ImportNamespaceSpecifier",
	"ExportSpecifier",
]);

const nonReferenceTypes = new Set([
	"LabeledStatement",
	"BreakStatement",
	"ContinueStatement",
	"RestElement",
	"ArrayPattern",
	"ObjectPattern",
	"TSTypeAnnotation",
	"TSTypeReference",
	"TSQualifiedName",
	"TSInterfaceDeclaration",
	"TSTypeAliasDeclaration",
	"TSModuleDeclaration",
	"TSParameterProperty",
	"TSPropertySignature",
	"TSTypeLiteral",
	"TSUnionType",
	"TSIntersectionType",
	"TSLiteralType",
	"TSArrayType",
	"TSTypeOperator",
	"TSIndexedAccessType",
	"TSMappedType",
	"TSFunctionType",
	"TSConstructorType",
	"TSImportType",
]);

function isVariableInitializerReference(node, parent) {
	return parent.init === node;
}

function isCatchParameterReference(node, parent) {
	return parent.param !== node;
}

function isAssignmentTargetReference(node, parent) {
	return parent.left !== node;
}

function isDefaultExportReference(node, parent) {
	return parent.declaration !== node;
}

function isMemberPropertyReference(node, parent) {
	return parent.property !== node || parent.computed;
}

function isClassKeyReference(node, parent) {
	return parent.key !== node || parent.computed;
}

function isLoopLeftReference(node, parent) {
	return parent.left !== node;
}

function isExpressionWrapperReference(node, parent) {
	return parent.expression === node;
}

const parentReferenceChecks = {
	VariableDeclarator: isVariableInitializerReference,
	FunctionDeclaration: isFunctionIdentifierReference,
	FunctionExpression: isFunctionIdentifierReference,
	ArrowFunctionExpression: isFunctionIdentifierReference,
	ClassDeclaration: isDeclarationIdentifierReference,
	ClassExpression: isDeclarationIdentifierReference,
	CatchClause: isCatchParameterReference,
	AssignmentPattern: isAssignmentTargetReference,
	ExportDefaultDeclaration: isDefaultExportReference,
	MemberExpression: isMemberPropertyReference,
	Property: isPropertyReference,
	ClassProperty: isClassKeyReference,
	MethodDefinition: isClassKeyReference,
	PropertyDefinition: isClassKeyReference,
	ForStatement: isLoopLeftReference,
	ForInStatement: isLoopLeftReference,
	ForOfStatement: isLoopLeftReference,
	TSAsExpression: isExpressionWrapperReference,
	TSTypeAssertion: isExpressionWrapperReference,
	TSNonNullExpression: isExpressionWrapperReference,
	TSInstantiationExpression: isExpressionWrapperReference,
};

function getNodeRange(node) {
	if (!node) {
		return null;
	}

	if (Array.isArray(node.range) && node.range.length === 2) {
		return node.range;
	}

	if (typeof node.start === "number" && typeof node.end === "number") {
		return [node.start, node.end];
	}

	return null;
}

function isSameNodeLocation(left, right) {
	if (left === right) {
		return true;
	}

	const leftRange = getNodeRange(left);
	const rightRange = getNodeRange(right);
	if (!leftRange || !rightRange) {
		return false;
	}

	return leftRange[0] === rightRange[0] && leftRange[1] === rightRange[1];
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
	if (!node || typeof node.type !== "string") {
		return [];
	}

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
		if (key !== "parent") {
			collectChildNodesFromValue(value, children);
		}
	}
	return children;
}

function isPatternPropertyReference(node, parent) {
	if (parent.parent?.type !== "ObjectPattern") {
		return true;
	}

	return parent.key === node && parent.computed;
}

function isPropertyReference(node, parent) {
	if (parent.key !== node) {
		return true;
	}

	if (parent.computed || parent.shorthand) {
		return true;
	}

	return isPatternPropertyReference(node, parent);
}

function isFunctionIdentifierReference(node, parent) {
	if (parent.id === node) {
		return false;
	}

	if (Array.isArray(parent.params) && parent.params.includes(node)) {
		return false;
	}

	return true;
}

function isDeclarationIdentifierReference(node, parent) {
	if (parent.id === node) {
		return false;
	}

	return true;
}

function isIdentifierReference(node, parent) {
	if (!parent) {
		return true;
	}

	if (importExportSpecifierTypes.has(parent.type) || nonReferenceTypes.has(parent.type)) {
		return false;
	}

	const referenceCheck = parentReferenceChecks[parent.type];
	if (referenceCheck != null) {
		return referenceCheck(node, parent);
	}

	return true;
}

function variableDeclaratorIds(declarationNode, name) {
	if (declarationNode.type !== "VariableDeclaration") {
		return [];
	}

	return (declarationNode.declarations ?? [])
		.filter((declarator) => declarator.id?.type === "Identifier" && declarator.id.name === name)
		.map((declarator) => declarator.id);
}

function declarationNodeForTopLevel(node) {
	if (node.type === "ExportNamedDeclaration" && node.declaration) {
		return node.declaration;
	}

	return node;
}

function isNamedFunctionOrClass(declarationNode, name) {
	const isSupportedDeclaration = declarationNode.type === "FunctionDeclaration"
		|| declarationNode.type === "ClassDeclaration";

	return isSupportedDeclaration && declarationNode.id?.name === name;
}

function getTopLevelDeclarationInfo(program, name) {
	const variableIds = [];
	let hasFunctionOrClass = false;

	for (const node of program.body ?? []) {
		const declarationNode = declarationNodeForTopLevel(node);
		variableIds.push(...variableDeclaratorIds(declarationNode, name));
		if (isNamedFunctionOrClass(declarationNode, name)) {
			hasFunctionOrClass = true;
		}
	}

	return {
		hasVariable: variableIds.length > 0,
		hasFunctionOrClass,
		variableIds,
	};
}

function isExcludedNode(node, excluded) {
	return excluded.some((excludedNode) => isSameNodeLocation(node, excludedNode));
}

function hasIdentifierUse(input) {
	const visitorKeys = input.sourceCode?.visitorKeys ?? null;
	let found = false;

	function visit(node, parent) {
		if (!node || found) {
			return;
		}

		if (
			node.type === "Identifier"
			&& node.name === input.name
			&& !isExcludedNode(node, input.excluded)
			&& isIdentifierReference(node, parent)
		) {
			found = true;
			return;
		}

		for (const child of getChildNodes(node, visitorKeys)) {
			visit(child, node);
		}
	}

	visit(input.program, null);
	return found;
}

function hasInternalReference(variable, identifier) {
	for (const reference of variable.references ?? []) {
		if (!isSameNodeLocation(reference.identifier, identifier)) {
			return true;
		}
	}

	return false;
}

function globalDefaultExportInfo(scopeManager, name, identifier) {
	const variable = scopeManager?.globalScope?.variables?.find((item) => item.name === name);
	if (!variable) {
		return null;
	}

	const defs = variable.defs ?? [];
	return {
		hasInternalUse: hasInternalReference(variable, identifier),
		isFunctionOrClass: defs.some((def) => def.type === "FunctionName" || def.type === "ClassName"),
		isVariable: defs.some((def) => def.type === "Variable"),
	};
}

function hasVariableUse(input) {
	const excluded = [input.identifier, ...input.declarationInfo.variableIds];
	return hasIdentifierUse({
		excluded,
		name: input.name,
		program: input.program,
		sourceCode: input.sourceCode,
	});
}

export function isAllowedDefaultIdentifierExport(node, program, context) {
	if (node?.type !== "ExportDefaultDeclaration" || node.declaration?.type !== "Identifier") {
		return false;
	}

	const sourceCode = getSourceCode(context);
	const name = node.declaration.name;
	const declarationInfo = getTopLevelDeclarationInfo(program, name);
	const scopeInfo = globalDefaultExportInfo(sourceCode?.scopeManager, name, node.declaration);
	const isVariable = declarationInfo.hasVariable || scopeInfo?.isVariable === true;
	const isFunctionOrClass = declarationInfo.hasFunctionOrClass
		|| scopeInfo?.isFunctionOrClass === true;
	const hasInternalUse = scopeInfo?.hasInternalUse
		?? hasVariableUse({
			declarationInfo,
			identifier: node.declaration,
			name,
			program,
			sourceCode,
		});

	return isVariable && !isFunctionOrClass && hasInternalUse;
}
