import { getTypeboxTypeCallName, unwrapExpression } from "./ast.js";

function resolvedExpression(node, state, seen = new Set()) {
	const expression = unwrapExpression(node);
	if (expression?.type !== "Identifier" || seen.has(expression.name)) {
		return expression;
	}

	const declaration = state.valueDeclarators.get(expression.name);
	if (declaration == null) {
		return expression;
	}
	seen.add(expression.name);
	return resolvedExpression(declaration.init, state, seen);
}

function returnExpression(callback) {
	if (callback.body.type !== "BlockStatement") {
		return unwrapExpression(callback.body);
	}
	if (
		callback.body.body.length !== 1
		|| callback.body.body[0].type !== "ReturnStatement"
	) {
		return null;
	}
	return unwrapExpression(callback.body.body[0].argument);
}

function isParameter(expression, parameter) {
	return expression?.type === "Identifier"
		&& parameter.type === "Identifier"
		&& expression.name === parameter.name;
}

function isTransparentCallback(callback) {
	const parameter = callback.params[0];
	if (parameter == null) {
		return false;
	}

	const returned = returnExpression(callback);
	if (isParameter(returned, parameter)) {
		return true;
	}
	return returned?.type === "LogicalExpression"
		&& returned.operator === "??"
		&& isParameter(unwrapExpression(returned.left), parameter);
}

export function codecFlow(schema, state) {
	const expression = resolvedExpression(schema, state);
	if (getTypeboxTypeCallName(expression, state.bindings) !== "Decode") {
		return null;
	}

	const callback = resolvedExpression(expression.arguments?.[1], state);
	if (
		callback?.type !== "ArrowFunctionExpression"
		&& callback?.type !== "FunctionExpression"
	) {
		return { callback: null, transparent: false };
	}
	return { callback, transparent: isTransparentCallback(callback) };
}
