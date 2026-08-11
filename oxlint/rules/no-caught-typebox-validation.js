import {
	collectTypeboxImportBindings,
	createTypeboxBindings,
	getSourceCode,
	getTypeboxValueCallName,
	walkWithoutNestedFunctions,
} from "./ast.js";

const NO_CAUGHT_TYPEBOX_VALIDATION_MESSAGE =
	"Do not catch TypeBox Assert, Parse, or Decode failures outside the configured validation boundary.";

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
	return VALIDATION_EXPORTS.has(getTypeboxValueCallName(node, bindings));
}

function blockCallsImportedValidation(block, bindings, visitorKeys) {
	let found = false;
	walkWithoutNestedFunctions(block, visitorKeys, (node) => {
		found = found || isImportedValidationCall(node, bindings);
	});
	return found;
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

		const bindings = createTypeboxBindings();
		const sourceCode = getSourceCode(context);
		const visitorKeys = sourceCode?.visitorKeys ?? {};
		return {
			ImportDeclaration(node) {
				collectTypeboxImportBindings(node, bindings);
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
