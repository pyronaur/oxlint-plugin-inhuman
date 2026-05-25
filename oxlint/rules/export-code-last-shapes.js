import { unwrapExpression } from "./ast.js";
import { getSchemaNamespaceNames, isSchemaNamespaceExpression } from "./schema-names.js";

const primitiveLiteralTypes = new Set(["string", "number", "boolean", "bigint"]);

function isExportNode(node) {
	return (
		node?.type === "ExportAllDeclaration"
		|| node?.type === "ExportDefaultDeclaration"
		|| node?.type === "ExportNamedDeclaration"
	);
}

function isTypeOnlyExport(node) {
	if (node?.type !== "ExportNamedDeclaration") {
		return false;
	}

	if (node.exportKind === "type") {
		return true;
	}

	if (!Array.isArray(node.specifiers) || node.specifiers.length === 0) {
		return false;
	}

	return node.specifiers.every((specifier) => specifier.exportKind === "type");
}

function isPrimitiveLiteralValue(value) {
	return value === null || primitiveLiteralTypes.has(typeof value);
}

function isNumericUnaryExpression(node) {
	if (node.operator !== "+" && node.operator !== "-" && node.operator !== "~") {
		return false;
	}

	const arg = node.argument;
	return arg?.type === "Literal" && primitiveLiteralTypes.has(typeof arg.value);
}

function isBooleanUnaryExpression(node) {
	const arg = node.argument;
	return node.operator === "!" && arg?.type === "Literal" && typeof arg.value === "boolean";
}

function isPrimitiveLiteralExpression(node) {
	const expression = unwrapExpression(node);
	if (!expression) {
		return false;
	}

	if (expression.type === "TemplateLiteral") {
		return expression.expressions.length === 0;
	}

	if (expression.type === "Literal") {
		return isPrimitiveLiteralValue(expression.value);
	}

	if (expression.type !== "UnaryExpression") {
		return false;
	}

	return isNumericUnaryExpression(expression) || isBooleanUnaryExpression(expression);
}

function getLocalConstExportDeclarators(node) {
	if (node?.type !== "ExportNamedDeclaration" || node.source != null) {
		return null;
	}

	const declaration = node.declaration;
	if (!declaration || declaration.type !== "VariableDeclaration" || declaration.kind !== "const") {
		return null;
	}

	const declarations = declaration.declarations ?? [];
	return declarations.length === 0 ? null : declarations;
}

function isPrimitiveConstDeclarator(declarator) {
	return declarator.id?.type === "Identifier" && isPrimitiveLiteralExpression(declarator.init);
}

function isPrimitiveConstExport(node) {
	const declarations = getLocalConstExportDeclarators(node);
	return declarations != null && declarations.every(isPrimitiveConstDeclarator);
}

function isDirectSchemaDeclarator(schemaNames, declarator) {
	return (
		declarator.id?.type === "Identifier"
		&& isSchemaNamespaceExpression(declarator.init, schemaNames)
	);
}

function isDirectSchemaExport(node, schemaNames) {
	const declarations = getLocalConstExportDeclarators(node);
	if (declarations == null) {
		return false;
	}

	return declarations.every((declarator) => isDirectSchemaDeclarator(schemaNames, declarator));
}

function isReExport(node) {
	if (node.type === "ExportAllDeclaration") {
		return true;
	}

	return node.type === "ExportNamedDeclaration" && node.source;
}

function isExemptExport(node, options, schemaNames) {
	if (isTypeOnlyExport(node) || isPrimitiveConstExport(node)) {
		return true;
	}

	if (isDirectSchemaExport(node, schemaNames)) {
		return true;
	}

	return options?.allowReExport === true && isReExport(node);
}

function isAliasLikeExpression(node) {
	const expression = unwrapExpression(node);
	return expression?.type === "Identifier" || expression?.type === "MemberExpression";
}

export function getExportProgramInfo(program) {
	return {
		body: program.body ?? [],
		schemaNames: getSchemaNamespaceNames(program),
	};
}

export function findLastNonExportIndex(body) {
	for (let index = body.length - 1; index >= 0; index -= 1) {
		if (!isExportNode(body[index])) {
			return index;
		}
	}

	return -1;
}

export function shouldReportEarlyExport(node, options, schemaNames) {
	if (!isExportNode(node)) {
		return false;
	}

	if (isReportableLocalExportList(node)) {
		return false;
	}

	if (isReportableAliasExport(node)) {
		return false;
	}

	return !isExemptExport(node, options, schemaNames);
}

export function isReportableLocalExportList(node) {
	if (node?.type !== "ExportNamedDeclaration") {
		return false;
	}

	if (node.declaration != null || node.source != null) {
		return false;
	}

	return (
		Array.isArray(node.specifiers)
		&& node.specifiers.length > 0
		&& !isTypeOnlyExport(node)
	);
}

export function isReportableAliasExport(node) {
	if (node?.type !== "ExportNamedDeclaration") {
		return false;
	}

	const declaration = node.declaration;
	if (!declaration || declaration.type !== "VariableDeclaration") {
		return false;
	}

	return declaration.declarations.some((declarator) => isAliasLikeExpression(declarator.init));
}

export function isReportableDefaultIdentifierExport(node) {
	return node?.type === "ExportDefaultDeclaration" && node.declaration?.type === "Identifier";
}
