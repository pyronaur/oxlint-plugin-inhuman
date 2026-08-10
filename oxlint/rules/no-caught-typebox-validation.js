import {
	getSourceCode,
	getStaticPropertyName,
	unwrapExpression,
	walkWithoutNestedFunctions,
} from "./ast.js";

const NO_CAUGHT_TYPEBOX_VALIDATION_MESSAGE =
	"Do not catch TypeBox Parse or Decode failures to synthesize application errors. Express expected validation through a schema or refinement and allow structured TypeBox errors to propagate.";

const TYPEBOX_VALUE_MODULE = "typebox/value";
const VALIDATION_EXPORTS = new Set(["Decode", "Parse"]);

function isImportedValidationCall(node, bindings) {
	const expression = unwrapExpression(node);
	if (expression?.type !== "CallExpression") {
		return false;
	}

	const callee = unwrapExpression(expression.callee);
	if (callee?.type === "Identifier") {
		return bindings.named.has(callee.name);
	}

	if (callee?.type !== "MemberExpression") {
		return false;
	}

	const object = unwrapExpression(callee.object);
	const property = getStaticPropertyName(callee.property);
	return object?.type === "Identifier"
		&& bindings.namespaces.has(object.name)
		&& VALIDATION_EXPORTS.has(property);
}

function blockCallsImportedValidation(block, bindings, visitorKeys) {
	let found = false;
	walkWithoutNestedFunctions(block, visitorKeys, (node) => {
		found = found || isImportedValidationCall(node, bindings);
	});
	return found;
}

function collectImportBindings(node, bindings) {
	if (node.source?.value !== TYPEBOX_VALUE_MODULE) {
		return;
	}

	for (const specifier of node.specifiers ?? []) {
		if (specifier.type === "ImportNamespaceSpecifier") {
			bindings.namespaces.add(specifier.local.name);
			continue;
		}

		if (
			specifier.type === "ImportSpecifier"
			&& VALIDATION_EXPORTS.has(getStaticPropertyName(specifier.imported))
		) {
			bindings.named.add(specifier.local.name);
		}
	}
}

export const noCaughtTypeboxValidationRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow catching TypeBox Parse or Decode failures.",
			recommended: false,
		},
		schema: [],
		messages: {
			noCaughtTypeboxValidation: NO_CAUGHT_TYPEBOX_VALIDATION_MESSAGE,
		},
	},
	create(context) {
		const bindings = { named: new Set(), namespaces: new Set() };
		const sourceCode = getSourceCode(context);
		const visitorKeys = sourceCode?.visitorKeys ?? {};
		return {
			ImportDeclaration(node) {
				collectImportBindings(node, bindings);
			},
			TryStatement(node) {
				if (
					node.handler == null || !blockCallsImportedValidation(node.block, bindings, visitorKeys)
				) {
					return;
				}

				context.report({
					node,
					messageId: "noCaughtTypeboxValidation",
				});
			},
		};
	},
};
