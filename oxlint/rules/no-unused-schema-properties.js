import {
	collectTypeboxImportBindings,
	createTypeboxBindings,
	getCalleeNameCandidates,
	getSourceCode,
	getStaticPropertyName,
	getTypeboxTypeCallName,
	getTypeboxValueCallName,
	unwrapExpression,
} from "./ast.js";
import {
	traceArrayIterator,
	traceForOfElement,
} from "./schema-array-flow.js";
import { codecFlow } from "./schema-codec-flow.js";
import {
	collectExport,
	expandPublicSchemas,
	usesPublicUnsafeType,
} from "./schema-public.js";

const NO_UNUSED_SCHEMA_PROPERTY_MESSAGE =
	"This private schema property is validated but its decoded value is not used.";
const SCHEMA_WRAPPERS = new Set([
	"Array",
	"Decode",
	"Optional",
	"Readonly",
	"Refine",
	"Unsafe",
]);
const TYPEBOX_BOUNDARIES = new Set(["Assert", "Decode", "Parse"]);

function optionsFor(context) {
	const options = context.options?.[0] ?? {};
	return {
		boundaryFunctions: new Set(options.boundary_functions ?? []),
	};
}

function declaredName(node) {
	return node.id?.type === "Identifier" ? node.id.name : null;
}

function schemaProperty(node) {
	if (node.type !== "Property" || node.computed || node.kind !== "init") {
		return null;
	}

	const name = getStaticPropertyName(node.key);
	return name == null ? null : { name, node: node.key, schema: node.value };
}

function objectChildren(node) {
	const shape = unwrapExpression(node.arguments?.[0]);
	if (shape?.type !== "ObjectExpression") {
		return [];
	}

	return shape.properties.flatMap((property) => {
		const child = schemaProperty(property);
		return child == null ? [] : [child];
	});
}

function tupleChildren(node) {
	const shape = unwrapExpression(node.arguments?.[0]);
	if (shape?.type !== "ArrayExpression") {
		return [];
	}

	return shape.elements.flatMap((schema, index) => {
		return schema == null ? [] : [{ name: String(index), node: schema, schema }];
	});
}

function referencedSchemaTree(expression, state, seen) {
	if (seen.has(expression.name)) {
		return null;
	}
	const declaration = state.schemas.get(expression.name);
	if (declaration == null) {
		return null;
	}
	return schemaTree(declaration, state, new Set([...seen, expression.name]));
}

function calledSchemaTree(expression, state, seen) {
	const callName = getTypeboxTypeCallName(expression, state.bindings);
	if (callName === "Literal") {
		return { children: [], literal: true };
	}
	if (callName === "Object") {
		return { children: objectChildren(expression), literal: false };
	}
	if (callName === "Tuple") {
		return { children: tupleChildren(expression), literal: false };
	}
	if (callName === "Record" || callName == null) {
		return null;
	}
	if (callName === "Unsafe" && usesPublicUnsafeType(expression, state)) {
		return null;
	}
	if (SCHEMA_WRAPPERS.has(callName)) {
		return schemaTree(expression.arguments?.[0], state, seen);
	}
	return { children: [], literal: false };
}

function schemaTree(node, state, seen = new Set()) {
	const expression = unwrapExpression(node);
	if (expression?.type === "Identifier") {
		return referencedSchemaTree(expression, state, seen);
	}
	return calledSchemaTree(expression, state, seen);
}

function boundaryCall(node, state) {
	const valueCall = getTypeboxValueCallName(node, state.bindings);
	if (TYPEBOX_BOUNDARIES.has(valueCall)) {
		return {
			schema: node.arguments?.[0],
			value: valueCall === "Assert" ? node.arguments?.[1] : node,
		};
	}

	const names = getCalleeNameCandidates(unwrapExpression(node.callee));
	if (!names.some((name) => state.options.boundaryFunctions.has(name))) {
		return null;
	}

	return { schema: node.arguments?.[0], value: node };
}

function memberName(node) {
	if (!node.computed) {
		return getStaticPropertyName(node.property);
	}
	if (node.property?.type !== "Literal") {
		return null;
	}
	return String(node.property.value);
}

function isInside(node, ancestor) {
	let current = node;
	while (current != null) {
		if (current === ancestor) {
			return true;
		}
		current = current.parent;
	}
	return false;
}

function declaredVariable(declarator, name, sourceCode) {
	return sourceCode
		.getDeclaredVariables(declarator)
		.find((candidate) => candidate.name === name);
}

function traceObjectPattern(target, path, input) {
	for (const property of target.properties) {
		if (property.type === "RestElement") {
			input.usage.whole.add(JSON.stringify(path));
			continue;
		}

		const name = getStaticPropertyName(property.key);
		if (name == null) {
			input.usage.whole.add(JSON.stringify(path));
			continue;
		}

		tracePattern(property.value, [...path, name], input);
	}
}

function traceArrayPattern(target, path, input) {
	for (const [index, element] of target.elements.entries()) {
		if (element != null) {
			tracePattern(element, [...path, String(index)], input);
		}
	}
}

function tracePattern(pattern, path, input) {
	const target = unwrapExpression(pattern);
	if (target?.type === "AssignmentPattern") {
		tracePattern(target.left, path, input);
		return;
	}
	if (target?.type === "ObjectPattern") {
		traceObjectPattern(target, path, input);
		return;
	}
	if (target?.type === "ArrayPattern") {
		traceArrayPattern(target, path, input);
		return;
	}
	if (target?.type === "Identifier") {
		const variable = declaredVariable(
			input.declarator,
			target.name,
			input.state.sourceCode,
		);
		traceVariable(variable, path, input);
		return;
	}
	input.usage.whole.add(JSON.stringify(path));
}

function traceReference(identifier, basePath, input) {
	let current = identifier;
	const path = [...basePath];
	while (current.parent?.type === "MemberExpression" && current.parent.object === current) {
		const memberSnapshot = current.parent;
		if (
			traceArrayIterator({
				input,
				member: memberSnapshot,
				operations: { memberName, tracePattern },
				path,
			})
		) {
			return;
		}

		const name = memberName(memberSnapshot);
		if (name == null) {
			input.usage.whole.add(JSON.stringify(path));
			return;
		}

		path.push(name);
		current = memberSnapshot;
	}

	const parent = current.parent;
	if (parent?.type === "VariableDeclarator" && parent.init === current) {
		tracePattern(parent.id, path, { ...input, declarator: parent });
		return;
	}
	if (parent?.type === "ForOfStatement" && parent.right === current) {
		traceForOfElement({ input, path, statement: parent, tracePattern });
		return;
	}
	input.usage.whole.add(JSON.stringify(path));
}

function traceVariable(variable, path, input) {
	if (variable == null) {
		input.usage.whole.add(JSON.stringify(path));
		return;
	}

	const traceKey = `${variable.name}:${variable.identifiers[0]?.start}:${JSON.stringify(path)}`;
	if (input.seen.has(traceKey)) {
		input.usage.whole.add(JSON.stringify(path));
		return;
	}
	input.seen.add(traceKey);

	for (const reference of variable.references) {
		if (!reference.isRead() || isInside(reference.identifier, input.ignoredNode)) {
			continue;
		}
		traceReference(reference.identifier, path, input);
	}
}

function variableUsage(declarator, ignoredNode, state) {
	const usage = { whole: new Set() };
	const variable = declaredVariable(declarator, declarator.id.name, state.sourceCode);
	traceVariable(variable, [], { ignoredNode, seen: new Set(), state, usage });
	return usage;
}

function callUsage(input, state) {
	const { call, value } = input;
	const usage = { whole: new Set() };
	const traceInput = { ignoredNode: null, seen: new Set(), state, usage };
	const expression = unwrapExpression(value);
	if (expression?.type === "Identifier") {
		const declaration = state.valueDeclarators.get(expression.name);
		if (declaration != null) {
			return variableUsage(declaration, call, state);
		}
	}

	if (value === call) {
		const parent = call.parent;
		if (parent?.type === "VariableDeclarator") {
			if (parent.id.type === "Identifier") {
				return variableUsage(parent, null, state);
			}
			tracePattern(parent.id, [], { ...traceInput, declarator: parent });
			return usage;
		}
		traceReference(call, [], traceInput);
		return usage;
	}

	usage.whole.add(JSON.stringify([]));
	return usage;
}

function codecUsage(schema, state) {
	const flow = codecFlow(schema, state);
	if (flow == null || flow.transparent) {
		return null;
	}

	const usage = { whole: new Set() };
	if (flow.callback == null) {
		usage.whole.add(JSON.stringify([]));
		return usage;
	}
	if (flow.callback.params[0] == null) {
		return usage;
	}
	tracePattern(flow.callback.params[0], [], {
		declarator: flow.callback,
		ignoredNode: null,
		seen: new Set(),
		state,
		usage,
	});
	return usage;
}

function hasWholeUsage(usage, path) {
	for (let length = 0; length <= path.length; length += 1) {
		if (usage.whole.has(JSON.stringify(path.slice(0, length)))) {
			return true;
		}
	}
	return false;
}

function hasDescendantUsage(usage, path) {
	const prefix = `${JSON.stringify(path).slice(0, -1)},`;
	return [...usage.whole].some((entry) => entry.startsWith(prefix));
}

function reportUnused(input, state) {
	const { context, path, tree, usage } = input;
	for (const child of tree.children) {
		const childPath = [...path, child.name];
		const childTree = schemaTree(child.schema, state);
		if (childTree?.literal || hasWholeUsage(usage, childPath)) {
			continue;
		}

		if (!hasDescendantUsage(usage, childPath)) {
			context.report({ node: child.node, messageId: "noUnusedSchemaProperty" });
			continue;
		}

		if (childTree != null) {
			reportUnused({ context, path: childPath, tree: childTree, usage }, state);
		}
	}
}

export const noUnusedSchemaPropertiesRule = {
	meta: {
		type: "problem",
		docs: {
			description: "Require private TypeBox schema properties to be consumed.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					boundary_functions: {
						type: "array",
						items: { type: "string" },
						uniqueItems: true,
					},
				},
				additionalProperties: false,
			},
		],
		messages: {
			noUnusedSchemaProperty: NO_UNUSED_SCHEMA_PROPERTY_MESSAGE,
		},
	},
	create(context) {
		const sourceCode = getSourceCode(context);
		const state = {
			bindings: createTypeboxBindings(),
			boundaries: [],
			options: optionsFor(context),
			exportedNames: new Set(),
			publicSchemas: new Set(),
			publicTypes: new Set(),
			schemas: new Map(),
			sourceCode,
			typeDeclarations: new Set(),
			valueDeclarators: new Map(),
			visitorKeys: sourceCode?.visitorKeys ?? {},
		};

		return {
			ImportDeclaration(node) {
				collectTypeboxImportBindings(node, state.bindings);
			},
			VariableDeclarator(node) {
				const name = declaredName(node);
				if (name == null) {
					return;
				}

				state.schemas.set(name, node.init);
				state.valueDeclarators.set(name, node);
			},
			ExportNamedDeclaration(node) {
				collectExport(node, state);
			},
			TSInterfaceDeclaration(node) {
				const name = declaredName(node);
				if (name != null) {
					state.typeDeclarations.add(name);
				}
			},
			TSTypeAliasDeclaration(node) {
				const name = declaredName(node);
				if (name != null) {
					state.typeDeclarations.add(name);
				}
			},
			CallExpression(node) {
				const boundary = boundaryCall(node, state);
				if (boundary != null) {
					state.boundaries.push({ call: node, ...boundary });
				}
			},
			"Program:exit"() {
				expandPublicSchemas(state);
				for (const boundary of state.boundaries) {
					const schema = unwrapExpression(boundary.schema);
					if (schema?.type === "Identifier" && state.publicSchemas.has(schema.name)) {
						continue;
					}

					const tree = schemaTree(schema, state);
					if (tree == null) {
						continue;
					}

					const usage = codecUsage(schema, state) ?? callUsage(boundary, state);
					reportUnused({ context, path: [], tree, usage }, state);
				}
			},
		};
	},
};
