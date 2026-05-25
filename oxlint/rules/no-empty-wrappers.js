import { createFunctionLikeVisitors, unwrapExpression } from "./ast.js";

const NO_EMPTY_WRAPPERS_MESSAGE =
	"Do not write empty wrapper functions. Use the implementation directly instead.";

function getCallExpressionFromStatement(statement) {
	if (!statement) {
		return null;
	}

	if (statement.type === "ExpressionStatement") {
		const expr = unwrapExpression(statement.expression);
		return expr?.type === "CallExpression" ? expr : null;
	}

	if (statement.type === "ReturnStatement") {
		const expr = unwrapExpression(statement.argument);
		return expr?.type === "CallExpression" ? expr : null;
	}

	return null;
}

function getPassThroughParams(params) {
	const names = [];
	let restName = null;

	for (const param of params ?? []) {
		if (param.type === "Identifier") {
			names.push(param.name);
			continue;
		}

		if (param.type === "RestElement" && param.argument?.type === "Identifier") {
			restName = param.argument.name;
			continue;
		}

		return null;
	}

	return { names, restName };
}

function argsMatchNames(args, names) {
	if (args.length < names.length) {
		return false;
	}

	return names.every((name, index) => {
		const arg = args[index];
		return arg?.type === "Identifier" && arg.name === name;
	});
}

function restArgMatches(arg, restName) {
	if (restName == null) {
		return true;
	}

	return (
		arg?.type === "SpreadElement"
		&& arg.argument?.type === "Identifier"
		&& arg.argument.name === restName
	);
}

function isPassThroughWrapper(node, callExpression) {
	const params = getPassThroughParams(node.params);
	if (params == null) {
		return false;
	}

	const args = callExpression.arguments ?? [];
	const expectedLength = params.names.length + (params.restName == null ? 0 : 1);
	if (args.length !== expectedLength) {
		return false;
	}

	if (!argsMatchNames(args, params.names)) {
		return false;
	}

	return restArgMatches(args[args.length - 1], params.restName);
}

function checkFunctionLike(context, node) {
	const statements = node.body?.type === "BlockStatement" ? node.body.body ?? [] : [];
	if (statements.length !== 1) {
		return;
	}

	const callExpression = getCallExpressionFromStatement(statements[0]);
	if (!callExpression || !isPassThroughWrapper(node, callExpression)) {
		return;
	}

	context.report({
		node,
		messageId: "noEmptyWrapper",
	});
}

export const noEmptyWrappersRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow empty wrapper functions that only pass through to a single call.",
			recommended: false,
		},
		schema: [],
		messages: {
			noEmptyWrapper: NO_EMPTY_WRAPPERS_MESSAGE,
		},
	},
	create(context) {
		return createFunctionLikeVisitors((node) => {
			checkFunctionLike(context, node);
		});
	},
};
