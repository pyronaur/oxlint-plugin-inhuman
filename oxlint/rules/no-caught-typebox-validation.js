import {
	getSourceCode,
	getStaticPropertyName,
	unwrapExpression,
	walkWithoutNestedFunctions,
} from "./ast.js";

const NO_CAUGHT_TYPEBOX_VALIDATION_MESSAGE =
	"Do not catch TypeBox Assert, Parse, or Decode failures outside the configured validation boundary.";

const TYPEBOX_VALUE_MODULE = "typebox/value";
const VALIDATION_EXPORTS = new Set(["Assert", "Decode", "Parse"]);

function normalizedPath(value) {
	return value.replaceAll("\\", "/");
}

function isAllowedFile(filename, allowedFiles) {
	const normalizedFilename = normalizedPath(filename);
	return allowedFiles.some((configuredPath) => {
		const normalizedConfiguredPath = normalizedPath(configuredPath);
		if (normalizedFilename === normalizedConfiguredPath) {
			return true;
		}

		if (normalizedConfiguredPath.startsWith("/")) {
			return false;
		}

		const relativePath = normalizedConfiguredPath.replace(/^\.\//u, "");
		return normalizedFilename.endsWith(`/${relativePath}`);
	});
}

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
			description: "Disallow catching TypeBox validation failures outside configured boundaries.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					allowed_files: {
						type: "array",
						items: { type: "string" },
						uniqueItems: true,
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			noCaughtTypeboxValidation: NO_CAUGHT_TYPEBOX_VALIDATION_MESSAGE,
		},
	},
	create(context) {
		const allowedFiles = context.options?.[0]?.allowed_files ?? [];
		if (isAllowedFile(context.filename, allowedFiles)) {
			return {};
		}

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
