import { createFunctionLikeVisitors } from "./ast.js";

const REQUIRE_GUARD_CLAUSE_MESSAGE =
	"Avoid wrapping the entire function body in an if. Use a guard clause / early return instead.";

function isEarlyExitStatement(node) {
	if (!node) {
		return false;
	}

	if (node.type === "ReturnStatement" || node.type === "ThrowStatement") {
		return true;
	}

	if (node.type === "BlockStatement") {
		return node.body.length === 1 && isEarlyExitStatement(node.body[0]);
	}

	return false;
}

function isNegatedCondition(node) {
	return node?.type === "UnaryExpression" && node.operator === "!";
}

function isAllowedGuardClause(statement) {
	return isEarlyExitStatement(statement.consequent) && isNegatedCondition(statement.test);
}

function checkFunctionLike(context, node) {
	const body = node.body;
	if (!body || body.type !== "BlockStatement") {
		return;
	}

	const statements = body.body;
	if (statements.length !== 1) {
		return;
	}

	const onlyStatement = statements[0];
	if (onlyStatement.type !== "IfStatement") {
		return;
	}

	if (onlyStatement.alternate != null || isAllowedGuardClause(onlyStatement)) {
		return;
	}

	context.report({ node: onlyStatement, messageId: "requireGuardClause" });
}

export const requireGuardClausesRule = {
	meta: {
		type: "suggestion",
		docs: {
			description:
				"Require guard clauses by forbidding a single if-statement that wraps the entire function body.",
			recommended: false,
		},
		schema: [],
		messages: {
			requireGuardClause: REQUIRE_GUARD_CLAUSE_MESSAGE,
		},
	},
	create(context) {
		return createFunctionLikeVisitors((node) => {
			checkFunctionLike(context, node);
		});
	},
};
