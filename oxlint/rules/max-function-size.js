import {
	createFunctionLikeVisitors,
	getCalleeNameCandidates,
	getFunctionLineCount,
} from "./ast.js";

const MAX_FUNCTION_SIZE_MESSAGE =
	"This function is too large ({{lineCount}} lines). Limit is {{max}} lines.";

const DEFAULT_MAX_FUNCTION_SIZE_OPTIONS = {
	"max-lines": 100,
	scoped: [
		{
			inside: ["describe", "suite", "test", "test.describe"],
			"max-lines": 800,
		},
	],
};

function getMaxFunctionSizeOptions(context) {
	const raw = context.options?.[0] ?? {};

	return {
		maxLines: raw["max-lines"] ?? DEFAULT_MAX_FUNCTION_SIZE_OPTIONS["max-lines"],
		scoped: raw.scoped ?? DEFAULT_MAX_FUNCTION_SIZE_OPTIONS.scoped,
	};
}

function isFunctionInitializer(ancestor, child) {
	return ancestor.type === "VariableDeclarator" && ancestor.init === child;
}

function getFunctionName(node) {
	if (node.type === "FunctionDeclaration" || node.type === "FunctionExpression") {
		return node.id?.name == null ? [] : [node.id.name];
	}

	if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier") {
		return [];
	}

	return [node.id.name];
}

function getCallNames(node, child) {
	if (node.type !== "CallExpression") {
		return [];
	}

	if (!node.arguments?.includes(child)) {
		return [];
	}

	return getCalleeNameCandidates(node.callee);
}

function getAncestorNames(node) {
	const names = [];
	let child = node;

	while (child.parent != null) {
		names.push(...getCallNames(child.parent, child));
		if (!isFunctionInitializer(child.parent, child)) {
			names.push(...getFunctionName(child.parent));
		}

		child = child.parent;
	}

	return names;
}

function scopedLimit(scopedEntry, ancestorNames) {
	if (!Array.isArray(scopedEntry.inside)) {
		return null;
	}

	const matches = scopedEntry.inside.some((name) => ancestorNames.includes(name));
	return matches && typeof scopedEntry["max-lines"] === "number"
		? scopedEntry["max-lines"]
		: null;
}

function getFunctionSizeLimit(node, options) {
	const ancestorNames = getAncestorNames(node);

	for (const scopedEntry of options.scoped) {
		const limit = scopedLimit(scopedEntry, ancestorNames);
		if (limit != null) {
			return limit;
		}
	}

	return options.maxLines;
}

function checkFunctionLike(context, options, node) {
	const lineCount = getFunctionLineCount(node);
	if (lineCount === 0) {
		return;
	}

	const max = getFunctionSizeLimit(node, options);
	if (lineCount <= max) {
		return;
	}

	context.report({
		node,
		messageId: "maxFunctionSize",
		data: {
			lineCount: String(lineCount),
			max: String(max),
		},
	});
}

export const maxFunctionSizeRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Limit function size while allowing named callback containers to have larger limits.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					"max-lines": { type: "number" },
					scoped: {
						type: "array",
						items: {
							type: "object",
							properties: {
								inside: {
									type: "array",
									items: { type: "string" },
								},
								"max-lines": { type: "number" },
							},
							additionalProperties: false,
						},
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			maxFunctionSize: MAX_FUNCTION_SIZE_MESSAGE,
		},
	},
	create(context) {
		const options = getMaxFunctionSizeOptions(context);

		return createFunctionLikeVisitors((node) => {
			checkFunctionLike(context, options, node);
		});
	},
};
