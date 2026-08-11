import {
	collectTypeboxImportBindings,
	createTypeboxBindings,
	getTypeboxTypeCallName,
	unwrapExpression,
} from "./ast.js";

const NO_NONVALIDATING_DECODE_MESSAGE =
	"Type.Decode must have a validating base schema. Replace Type.Unknown or Type.Any with the encoded input schema.";
const NONVALIDATING_BASES = new Set(["Any", "Unknown"]);

function isNonvalidatingBase(node, bindings, localBases) {
	const expression = unwrapExpression(node);
	if (expression?.type === "Identifier" && localBases.has(expression.name)) {
		return true;
	}

	return NONVALIDATING_BASES.has(getTypeboxTypeCallName(expression, bindings));
}

export const noNonvalidatingDecodeRule = {
	meta: {
		type: "problem",
		docs: {
			description: "Require Type.Decode codecs to declare a validating encoded schema.",
			recommended: false,
		},
		schema: [],
		messages: {
			noNonvalidatingDecode: NO_NONVALIDATING_DECODE_MESSAGE,
		},
	},
	create(context) {
		const bindings = createTypeboxBindings();
		const localBases = new Set();

		return {
			ImportDeclaration(node) {
				collectTypeboxImportBindings(node, bindings);
			},
			VariableDeclarator(node) {
				if (node.id?.type !== "Identifier") {
					return;
				}

				if (!NONVALIDATING_BASES.has(getTypeboxTypeCallName(node.init, bindings))) {
					return;
				}

				localBases.add(node.id.name);
			},
			CallExpression(node) {
				if (
					getTypeboxTypeCallName(node, bindings) !== "Decode"
					|| !isNonvalidatingBase(node.arguments?.[0], bindings, localBases)
				) {
					return;
				}

				context.report({
					node,
					messageId: "noNonvalidatingDecode",
				});
			},
		};
	},
};
