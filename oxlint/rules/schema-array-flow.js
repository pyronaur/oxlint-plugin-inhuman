import { unwrapExpression } from "./ast.js";

const ARRAY_ITERATOR_ELEMENT_PARAMETERS = new Map([
	["every", 0],
	["filter", 0],
	["find", 0],
	["findLast", 0],
	["flatMap", 0],
	["forEach", 0],
	["map", 0],
	["reduce", 1],
	["reduceRight", 1],
	["some", 0],
]);

export function traceArrayIterator({ input, member, operations, path }) {
	const parameterIndex = ARRAY_ITERATOR_ELEMENT_PARAMETERS.get(
		operations.memberName(member),
	);
	const callSnapshot = member.parent;
	if (
		parameterIndex == null
		|| callSnapshot?.type !== "CallExpression"
		|| callSnapshot.callee !== member
	) {
		return false;
	}

	const callback = unwrapExpression(callSnapshot.arguments?.[0]);
	if (
		callback?.type !== "ArrowFunctionExpression"
		&& callback?.type !== "FunctionExpression"
	) {
		input.usage.whole.add(JSON.stringify(path));
		return true;
	}

	const parameter = callback.params[parameterIndex];
	if (parameter == null) {
		input.usage.whole.add(JSON.stringify(path));
		return true;
	}
	operations.tracePattern(parameter, path, { ...input, declarator: callback });
	return true;
}

export function traceForOfElement({ input, path, statement, tracePattern }) {
	if (statement.left.type !== "VariableDeclaration") {
		input.usage.whole.add(JSON.stringify(path));
		return;
	}

	for (const declarator of statement.left.declarations) {
		tracePattern(declarator.id, path, { ...input, declarator });
	}
}
