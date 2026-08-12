import {
	getStaticPropertyName,
	unwrapExpression,
	walkDescendants,
} from "./ast.js";

function declaredName(node) {
	return node?.id?.type === "Identifier" ? node.id.name : null;
}

function exportedTypeSchemaNames(node, visitorKeys) {
	const names = new Set();
	walkDescendants(node, visitorKeys, (descendant) => {
		if (descendant.type !== "TSTypeQuery") {
			return;
		}

		const expression = unwrapExpression(descendant.exprName);
		if (expression?.type === "Identifier") {
			names.add(expression.name);
		}
	});
	return names;
}

function collectExportedVariables(declaration, state) {
	if (declaration?.type !== "VariableDeclaration") {
		return;
	}
	for (const item of declaration.declarations) {
		const name = declaredName(item);
		if (name != null) {
			state.publicSchemas.add(name);
		}
	}
}

function collectExportedType(declaration, state) {
	if (
		declaration?.type !== "TSTypeAliasDeclaration"
		&& declaration?.type !== "TSInterfaceDeclaration"
	) {
		return;
	}

	const name = declaredName(declaration);
	if (name != null) {
		state.publicTypes.add(name);
	}
	for (
		const schemaName of exportedTypeSchemaNames(
			declaration,
			state.visitorKeys,
		)
	) {
		state.publicSchemas.add(schemaName);
	}
}

export function collectExport(node, state) {
	collectExportedVariables(node.declaration, state);
	collectExportedType(node.declaration, state);
	for (const specifier of node.specifiers ?? []) {
		const name = getStaticPropertyName(specifier.local);
		if (name != null) {
			state.exportedNames.add(name);
		}
	}
}

export function expandPublicSchemas(state) {
	for (const name of state.exportedNames) {
		if (state.schemas.has(name)) {
			state.publicSchemas.add(name);
		}
		if (state.typeDeclarations.has(name)) {
			state.publicTypes.add(name);
		}
	}

	const pending = [...state.publicSchemas];
	while (pending.length > 0) {
		const name = pending.pop();
		const declaration = state.schemas.get(name);
		if (declaration == null) {
			continue;
		}

		walkDescendants(declaration, state.visitorKeys, (descendant) => {
			if (
				descendant.type !== "Identifier"
				|| !state.schemas.has(descendant.name)
				|| state.publicSchemas.has(descendant.name)
			) {
				return;
			}
			state.publicSchemas.add(descendant.name);
			pending.push(descendant.name);
		});
	}
}

export function usesPublicUnsafeType(node, state) {
	let usesPublicType = false;
	walkDescendants(node.typeArguments, state.visitorKeys, (descendant) => {
		if (descendant.type !== "Identifier") {
			return;
		}
		if (!state.publicTypes.has(descendant.name)) {
			return;
		}
		usesPublicType = true;
	});
	return usesPublicType;
}
