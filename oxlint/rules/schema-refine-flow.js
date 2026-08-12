import {
	getStaticPropertyName,
	getTypeboxTypeCallName,
	unwrapExpression,
} from "./ast.js";
import { resolvedExpression } from "./schema-codec-flow.js";

const ARRAY_SCHEMA_CALLS = new Set(["Intersect", "Tuple", "Union"]);
const SINGLE_SCHEMA_CALLS = new Set([
	"Array",
	"Decode",
	"Optional",
	"Readonly",
	"Unsafe",
]);

function callbackFlow(node, state, path) {
	if (node == null) {
		return [];
	}
	const callback = resolvedExpression(node, state);
	if (
		callback?.type === "ArrowFunctionExpression"
		|| callback?.type === "FunctionExpression"
	) {
		return [{ callback, path }];
	}
	return [{ callback: null, path }];
}

function objectFlows(call, input) {
	const shape = unwrapExpression(call.arguments?.[0]);
	if (shape?.type !== "ObjectExpression") {
		return [];
	}
	return shape.properties.flatMap((property) => {
		if (property.type !== "Property" || property.computed) {
			return [];
		}
		const name = getStaticPropertyName(property.key);
		return name == null
			? []
			: refineFlows(property.value, {
				...input,
				path: [...input.path, name],
			});
	});
}

function arrayFlows(call, input) {
	const schemas = unwrapExpression(call.arguments?.[0]);
	if (schemas?.type !== "ArrayExpression") {
		return [];
	}
	return schemas.elements.flatMap((schema, index) => {
		if (schema == null) {
			return [];
		}
		const childPath = getTypeboxTypeCallName(call, input.state.bindings) === "Tuple"
			? [...input.path, String(index)]
			: input.path;
		return refineFlows(schema, { ...input, path: childPath });
	});
}

function refineFlows(node, input) {
	const expression = unwrapExpression(node);
	if (expression?.type === "Identifier") {
		if (input.seen.has(expression.name)) {
			return [];
		}
		const declaration = input.state.valueDeclarators.get(expression.name);
		if (declaration == null) {
			return [];
		}
		return refineFlows(declaration.init, {
			...input,
			seen: new Set([...input.seen, expression.name]),
		});
	}

	const callName = getTypeboxTypeCallName(expression, input.state.bindings);
	if (callName === "Refine") {
		return [
			...refineFlows(expression.arguments?.[0], input),
			...callbackFlow(expression.arguments?.[1], input.state, input.path),
			...callbackFlow(expression.arguments?.[2], input.state, input.path),
		];
	}
	if (callName === "Object") {
		return objectFlows(expression, input);
	}
	if (ARRAY_SCHEMA_CALLS.has(callName)) {
		return arrayFlows(expression, input);
	}
	if (SINGLE_SCHEMA_CALLS.has(callName)) {
		return refineFlows(expression.arguments?.[0], input);
	}
	return [];
}

export function schemaRefineFlows(schema, state) {
	return refineFlows(schema, { path: [], seen: new Set(), state });
}
