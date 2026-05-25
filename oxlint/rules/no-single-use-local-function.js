import { isFunctionExpression } from "./ast.js";

const NO_SINGLE_USE_LOCAL_FUNCTION_MESSAGE =
	"This local function has one return expression and is called once. Inline it at the call site or make the abstraction carry real behavior.";

const DEFAULT_SINGLE_USE_LOCAL_FUNCTION_OPTIONS = {
	predicateNamePattern: "^(is|has|can|should|must|needs|will)[A-Z_]",
};

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
		parent?.type === "CallExpression"
		&& parent.callee === identifier
		&& parent.arguments.length > 0
		&& identifier.name === functionName
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

function getSingleUseLocalFunctionOptions(context) {
	const raw = context.options?.[0] ?? {};
	const settings = context.settings?.inhuman ?? {};

	return {
		predicateNamePattern: raw.predicateNamePattern
			?? settings.predicateNamePattern
			?? DEFAULT_SINGLE_USE_LOCAL_FUNCTION_OPTIONS.predicateNamePattern,
	};
}

function maybeCandidate(input) {
	if (shouldIgnoreFunctionName(input.name, input.options.predicateNamePattern)) {
		return null;
	}

	if (singleReturnExpression(input.bindingNode) == null) {
		return null;
	}

	return {
		bindingNode: input.bindingNode,
		id: input.id,
		name: input.name,
	};
}

function variableCandidate(options, node) {
	if (node.id?.type !== "Identifier" || !isFunctionExpression(node.init)) {
		return null;
	}

	if (singleReturnExpression(node.init) == null) {
		return null;
	}

	return maybeCandidate({
		bindingNode: node,
		id: node.id,
		name: node.id.name,
		options,
	});
}

function declaredVariable(context, candidate) {
	return context.sourceCode
		.getDeclaredVariables(candidate.bindingNode)
		.find((declared) => declared.name === candidate.name);
}

function reportCandidate(context, candidate) {
	const variable = declaredVariable(context, candidate);
	const reference = variable == null ? null : singleDirectCall(variable);
	if (reference == null || !isDirectCallReference(reference, candidate.name)) {
		return;
	}

	context.report({
		node: candidate.id,
		messageId: "noSingleUseLocalFunction",
	});
}

export const noSingleUseLocalFunctionRule = {
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

		return {
			FunctionDeclaration(node) {
				if (node.id == null) {
					return;
				}

				const candidate = maybeCandidate({
					bindingNode: node,
					id: node.id,
					name: node.id.name,
					options,
				});
				if (candidate != null) {
					candidates.push(candidate);
				}
			},

			VariableDeclarator(node) {
				const candidate = variableCandidate(options, node);
				if (candidate != null) {
					candidates.push(candidate);
				}
			},

			ExportNamedDeclaration(node) {
				collectExportedName(node, exportedNames);
			},

			"Program:exit"() {
				for (const candidate of candidates) {
					if (!exportedNames.has(candidate.name)) {
						reportCandidate(context, candidate);
					}
				}
			},
		};
	},
};
