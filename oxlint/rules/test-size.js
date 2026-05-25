import {
	createFunctionLikeVisitors,
	getCalleeNameCandidates,
	getFunctionLineCount,
} from "./ast.js";

const TEST_SIZE_MESSAGE =
	"This test/helper function is too large ({{lineCount}} lines). Limit is {{max}} lines.";

const DEFAULT_TEST_SIZE_OPTIONS = {
	calleeLimits: {
		describe: 800,
	},
	max: 100,
};

function getTestSizeOptions(context) {
	const raw = context.options?.[0] ?? {};

	return {
		calleeLimits: raw.calleeLimits ?? DEFAULT_TEST_SIZE_OPTIONS.calleeLimits,
		max: raw.max ?? DEFAULT_TEST_SIZE_OPTIONS.max,
	};
}

function getCallbackCallExpression(node) {
	const parent = node.parent;
	if (parent?.type !== "CallExpression") {
		return null;
	}

	return parent.arguments?.includes(node) ? parent : null;
}

function getTestSizeLimit(node, options) {
	const callExpression = getCallbackCallExpression(node);
	if (callExpression == null) {
		return options.max;
	}

	for (const name of getCalleeNameCandidates(callExpression.callee)) {
		const limit = options.calleeLimits[name];
		if (typeof limit === "number") {
			return limit;
		}
	}

	return options.max;
}

function checkFunctionLike(context, options, node) {
	const lineCount = getFunctionLineCount(node);
	if (lineCount === 0) {
		return;
	}

	const max = getTestSizeLimit(node, options);
	if (lineCount <= max) {
		return;
	}

	context.report({
		node,
		messageId: "testSize",
		data: {
			lineCount: String(lineCount),
			max: String(max),
		},
	});
}

export const testSizeRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Limit test callbacks and helpers while allowing named suite containers to have larger limits.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					calleeLimits: {
						type: "object",
						additionalProperties: { type: "number" },
					},
					max: { type: "number" },
				},
				additionalProperties: false,
			},
		],
		messages: {
			testSize: TEST_SIZE_MESSAGE,
		},
	},
	create(context) {
		const options = getTestSizeOptions(context);

		return createFunctionLikeVisitors((node) => {
			checkFunctionLike(context, options, node);
		});
	},
};
