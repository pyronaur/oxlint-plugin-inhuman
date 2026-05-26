const namespaceSchemaSources = new Set(["zod", "effect/Schema"]);
const namedSchemaImports = new Set(["zod:z", "effect:Schema"]);
const expressionWrappers = new Set([
	"ChainExpression",
	"ParenthesizedExpression",
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSNonNullExpression",
	"TSTypeAssertion",
]);

function importedIdentifierName(specifier) {
	if (specifier.imported?.type !== "Identifier") {
		return null;
	}

	return specifier.imported.name;
}

function schemaSpecifierName(source, specifier) {
	if (specifier.type === "ImportNamespaceSpecifier" && namespaceSchemaSources.has(source)) {
		return specifier.local.name;
	}

	if (specifier.type !== "ImportSpecifier") {
		return null;
	}

	const importedName = importedIdentifierName(specifier);
	if (!namedSchemaImports.has(`${source}:${importedName}`)) {
		return null;
	}

	return specifier.local.name;
}

function schemaExpressionSubject(node) {
	if (node.type === "MemberExpression") {
		return node.object;
	}

	if (node.type === "CallExpression") {
		return node.callee;
	}

	if (expressionWrappers.has(node.type)) {
		return node.expression;
	}

	return null;
}

export function getSchemaNamespaceNames(program) {
	const names = new Set();

	for (const node of program.body ?? []) {
		if (node.type !== "ImportDeclaration") {
			continue;
		}

		for (const specifier of node.specifiers ?? []) {
			const name = schemaSpecifierName(node.source?.value, specifier);
			if (name != null) {
				names.add(name);
			}
		}
	}

	return names;
}

export function isSchemaNamespaceExpression(node, schemaNames) {
	if (!node || schemaNames.size === 0) {
		return false;
	}

	if (node.type === "Identifier") {
		return schemaNames.has(node.name);
	}

	const subject = schemaExpressionSubject(node);
	if (subject == null) {
		return false;
	}

	return isSchemaNamespaceExpression(subject, schemaNames);
}
