import { getStaticPropertyName, unwrapExpression } from "./ast.js";

const NO_LOCAL_PROPERTY_ALIAS_MESSAGE =
	"Do not alias a property to a local name unless the name communicates snapshot/boundary intent.";

const DEFAULT_OPTIONS = {
	"allow-name-pattern":
		"(^|_)(original|snapshot|initial|previous|cached|bound)($|[A-Z_])|(Original|Snapshot|Initial|Previous|Cached|Bound)$",
};

function getOptions(context) {
	const raw = context.options?.[0] ?? {};

	return {
		allowNamePattern: raw["allow-name-pattern"] ?? DEFAULT_OPTIONS["allow-name-pattern"],
	};
}

function staticMemberPropertyName(node) {
	const expression = unwrapExpression(node);
	if (expression?.type !== "MemberExpression") {
		return null;
	}

	if (expression.computed) {
		return expression.property?.type === "Literal" && typeof expression.property.value === "string"
			? expression.property.value
			: null;
	}

	return getStaticPropertyName(expression.property);
}

function allowedByName(name, options) {
	if (options.allowNamePattern === "") {
		return false;
	}

	return new RegExp(options.allowNamePattern, "u").test(name);
}

function checkDeclarator(context, options, node) {
	if (node.id?.type !== "Identifier") {
		return;
	}

	const propertyName = staticMemberPropertyName(node.init);
	if (propertyName == null || propertyName === node.id.name) {
		return;
	}

	if (allowedByName(node.id.name, options)) {
		return;
	}

	context.report({
		node: node.id,
		messageId: "noLocalPropertyAlias",
	});
}

export const noLocalPropertyAliasRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow local aliases for property reads unless the name states intent.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					"allow-name-pattern": { type: "string" },
				},
				additionalProperties: false,
			},
		],
		messages: {
			noLocalPropertyAlias: NO_LOCAL_PROPERTY_ALIAS_MESSAGE,
		},
	},
	create(context) {
		const options = getOptions(context);

		return {
			VariableDeclarator(node) {
				checkDeclarator(context, options, node);
			},
		};
	},
};
