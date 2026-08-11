import {
	collectTypeboxImportBindings,
	createTypeboxBindings,
	getTypeboxTypeCallName,
	getTypeboxValueCallName,
	unwrapExpression,
} from "./ast.js";

const NO_LITERAL_BOOLEAN_CHECK_MESSAGE =
	"Do not wrap a boolean condition in Check(Type.Literal(true|false), ...). Use the boolean condition directly.";

function isBooleanLiteralSchema(node, bindings, localSchemas) {
	const expression = unwrapExpression(node);
	if (expression?.type === "Identifier" && localSchemas.has(expression.name)) {
		return true;
	}

	if (getTypeboxTypeCallName(expression, bindings) !== "Literal") {
		return false;
	}

	const value = unwrapExpression(expression.arguments?.[0]);
	return value?.type === "Literal" && typeof value.value === "boolean";
}

export const noLiteralBooleanCheckRule = {
	meta: {
		type: "problem",
		docs: {
			description: "Forbid TypeBox literal schemas around boolean conditions.",
			recommended: false,
		},
		schema: [],
		messages: {
			noLiteralBooleanCheck: NO_LITERAL_BOOLEAN_CHECK_MESSAGE,
		},
	},
	create(context) {
		const bindings = createTypeboxBindings();
		const declarations = [];
		const calls = [];

		return {
			ImportDeclaration(node) {
				collectTypeboxImportBindings(node, bindings);
			},
			VariableDeclarator(node) {
				if (node.id?.type !== "Identifier") {
					return;
				}

				declarations.push(node);
			},
			CallExpression(node) {
				if (getTypeboxValueCallName(node, bindings) !== "Check") {
					return;
				}

				calls.push(node);
			},
			"Program:exit"() {
				const localSchemas = new Set();
				for (const declaration of declarations) {
					if (isBooleanLiteralSchema(declaration.init, bindings, localSchemas)) {
						localSchemas.add(declaration.id.name);
					}
				}

				for (const call of calls) {
					if (!isBooleanLiteralSchema(call.arguments?.[0], bindings, localSchemas)) {
						continue;
					}

					context.report({
						node: call,
						messageId: "noLiteralBooleanCheck",
					});
				}
			},
		};
	},
};
