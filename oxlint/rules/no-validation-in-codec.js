import {
	collectTypeboxImportBindings,
	createTypeboxBindings,
	getSourceCode,
	getTypeboxTypeCallName,
	getTypeboxValueCallName,
	isFunctionExpression,
	unwrapExpression,
	walkDescendants,
} from "./ast.js";

const NO_VALIDATION_IN_CODEC_MESSAGE =
	"Type.Decode codec callbacks must only transform validated input. Move checks and rejection into the encoded schema or refinements.";
const VALIDATION_CALLS = new Set(["Assert", "Check"]);

function callbackFunction(node, localFunctions) {
	const expression = unwrapExpression(node);
	if (isFunctionExpression(expression)) {
		return expression;
	}

	if (expression?.type !== "Identifier") {
		return null;
	}

	return localFunctions.get(expression.name) ?? null;
}

function isPropagatedFailure(node) {
	const argument = unwrapExpression(node.argument);
	return argument?.type === "Identifier" || argument?.type === "MemberExpression";
}

function branchHasValidationThrow(branch, visitorKeys) {
	let found = false;
	walkDescendants(branch, visitorKeys, (node) => {
		found = found || (node.type === "ThrowStatement" && !isPropagatedFailure(node));
	});
	return found;
}

function hasConditionalValidationThrow(callback, visitorKeys) {
	let found = false;
	walkDescendants(callback.body, visitorKeys, (node) => {
		if (found || node.type !== "IfStatement") {
			return;
		}

		found = branchHasValidationThrow(node.consequent, visitorKeys)
			|| branchHasValidationThrow(node.alternate, visitorKeys);
	});
	return found;
}

function hasValidationCall(callback, bindings, visitorKeys) {
	let found = false;
	walkDescendants(callback.body, visitorKeys, (node) => {
		found = found
			|| VALIDATION_CALLS.has(getTypeboxValueCallName(node, bindings));
	});
	return found;
}

function callbackValidates(callback, bindings, visitorKeys) {
	return hasValidationCall(callback, bindings, visitorKeys)
		|| hasConditionalValidationThrow(callback, visitorKeys);
}

export const noValidationInCodecRule = {
	meta: {
		type: "problem",
		docs: {
			description: "Require Type.Decode callbacks to transform without validating.",
			recommended: false,
		},
		schema: [],
		messages: {
			noValidationInCodec: NO_VALIDATION_IN_CODEC_MESSAGE,
		},
	},
	create(context) {
		const bindings = createTypeboxBindings();
		const decodeCalls = [];
		const localFunctions = new Map();
		const sourceCode = getSourceCode(context);
		const visitorKeys = sourceCode?.visitorKeys ?? {};

		return {
			ImportDeclaration(node) {
				collectTypeboxImportBindings(node, bindings);
			},
			FunctionDeclaration(node) {
				if (node.id == null) {
					return;
				}

				localFunctions.set(node.id.name, node);
			},
			VariableDeclarator(node) {
				if (node.id?.type !== "Identifier" || !isFunctionExpression(node.init)) {
					return;
				}

				localFunctions.set(node.id.name, node.init);
			},
			CallExpression(node) {
				if (getTypeboxTypeCallName(node, bindings) !== "Decode") {
					return;
				}

				decodeCalls.push(node);
			},
			"Program:exit"() {
				for (const decodeCall of decodeCalls) {
					const callback = callbackFunction(decodeCall.arguments?.[1], localFunctions);
					if (callback == null || !callbackValidates(callback, bindings, visitorKeys)) {
						continue;
					}

					context.report({
						node: decodeCall,
						messageId: "noValidationInCodec",
					});
				}
			},
		};
	},
};
