import {
	createFunctionLikeVisitors,
	getCalleeNameCandidates,
	getSourceCode,
	unwrapExpression,
	walkWithoutNestedFunctions,
} from "./ast.js";

const NO_MANUAL_VALIDATION_MESSAGE =
	"Do not hand-roll runtime validation from primitive checks. Consider whether the project's established schema or validation package should define this validation and its inferred type.";

const BROAD_INPUT_TYPES = new Set([
	"TSAnyKeyword",
	"TSBigIntKeyword",
	"TSBooleanKeyword",
	"TSNullKeyword",
	"TSNumberKeyword",
	"TSObjectKeyword",
	"TSStringKeyword",
	"TSSymbolKeyword",
	"TSUndefinedKeyword",
	"TSUnknownKeyword",
]);

const UNKNOWN_INPUT_TYPES = new Set([
	"TSAnyKeyword",
	"TSObjectKeyword",
	"TSUnknownKeyword",
]);

const VALIDATOR_CALLEES = new Set([
	"Array.isArray",
	"Number.isFinite",
	"Number.isInteger",
	"Number.isNaN",
	"Number.isSafeInteger",
	"Object.hasOwn",
	"Object.prototype.hasOwnProperty.call",
	"Reflect.has",
	"test",
]);

const CONVERTER_CALLEES = new Set([
	"BigInt",
	"Date.parse",
	"Number",
	"Number.parseFloat",
	"Number.parseInt",
	"parseFloat",
	"parseInt",
]);

const COMPARISON_OPERATORS = new Set([
	"<",
	"<=",
	"==",
	"===",
	">",
	">=",
	"!=",
	"!==",
	"in",
	"instanceof",
]);

function getTypeAnnotation(node) {
	if (node?.type === "Identifier") {
		return node.typeAnnotation?.typeAnnotation ?? null;
	}

	if (node?.type === "AssignmentPattern" || node?.type === "RestElement") {
		return getTypeAnnotation(node.left ?? node.argument);
	}

	return null;
}

function isBroadInputType(annotation) {
	if (annotation?.type === "TSUnionType") {
		return annotation.types.length > 0 && annotation.types.every(isBroadInputType);
	}

	if (annotation?.type === "TSLiteralType") {
		return true;
	}

	return BROAD_INPUT_TYPES.has(annotation?.type);
}

function isUnknownInputType(annotation) {
	if (annotation?.type === "TSUnionType") {
		return annotation.types.length > 0 && annotation.types.every(isUnknownInputType);
	}

	return UNKNOWN_INPUT_TYPES.has(annotation?.type);
}

function getBroadInputNames(node) {
	return new Set(
		(node.params ?? [])
			.filter((param) => param.type === "Identifier" && isBroadInputType(getTypeAnnotation(param)))
			.map((param) => param.name),
	);
}

function hasUnknownInput(node) {
	return (node.params ?? []).some((param) => isUnknownInputType(getTypeAnnotation(param)));
}

function nodeReferencesNames(node, names, visitorKeys) {
	let found = false;
	walkWithoutNestedFunctions(node, visitorKeys, (current) => {
		if (current.type !== "Identifier" || !names.has(current.name)) {
			return;
		}

		found = true;
	});
	return found;
}

function collectDerivedNames(body, inputNames, visitorKeys) {
	const names = new Set(inputNames);
	const declarators = [];
	walkWithoutNestedFunctions(body, visitorKeys, (node) => {
		if (node.type !== "VariableDeclarator" || node.id?.type !== "Identifier" || node.init == null) {
			return;
		}

		declarators.push(node);
	});

	let changed = true;
	while (changed) {
		changed = false;
		for (const declarator of declarators) {
			if (names.has(declarator.id.name)) {
				continue;
			}

			if (!nodeReferencesNames(declarator.init, names, visitorKeys)) {
				continue;
			}

			names.add(declarator.id.name);
			changed = true;
		}
	}

	return names;
}

function hasMatchingCallee(node, expectedNames) {
	const expression = unwrapExpression(node);
	if (expression?.type !== "CallExpression") {
		return false;
	}

	return getCalleeNameCandidates(expression.callee).some((name) => expectedNames.has(name));
}

function isValidationOperation(node, evidence) {
	if (node.type === "UnaryExpression" && node.operator === "typeof") {
		return nodeReferencesNames(node.argument, evidence.names, evidence.visitorKeys);
	}

	if (node.type === "BinaryExpression") {
		return (
			(
				evidence.allowComparisons
				|| node.operator === "in"
				|| node.operator === "instanceof"
			)
			&& COMPARISON_OPERATORS.has(node.operator)
			&& nodeReferencesNames(node, evidence.names, evidence.visitorKeys)
		);
	}

	return (
		hasMatchingCallee(node, VALIDATOR_CALLEES)
		&& nodeReferencesNames(node, evidence.names, evidence.visitorKeys)
	);
}

function bodyHasValidation(body, evidence) {
	let found = false;
	walkWithoutNestedFunctions(body, evidence.visitorKeys, (node) => {
		if (!isValidationOperation(node, evidence)) {
			return;
		}

		found = true;
	});
	return found;
}

function hasTypePredicate(node) {
	return node.returnType?.typeAnnotation?.type === "TSTypePredicate";
}

function isFailureReturn(node) {
	if (node.argument == null) {
		return true;
	}

	const argument = unwrapExpression(node.argument);
	return argument?.type === "Literal" && (argument.value === false || argument.value == null);
}

function getReturnEvidence(body, names, visitorKeys) {
	const evidence = { succeeds: false };
	walkWithoutNestedFunctions(body, visitorKeys, (node) => {
		if (node.type !== "ReturnStatement") {
			return;
		}

		if (isFailureReturn(node)) {
			return;
		}

		if (nodeReferencesNames(node.argument, names, visitorKeys)) {
			evidence.succeeds = true;
		}
	});
	return evidence;
}

function branchHasRejection(branch, visitorKeys) {
	let found = false;
	walkWithoutNestedFunctions(branch, visitorKeys, (node) => {
		if (node.type === "ThrowStatement") {
			found = true;
			return;
		}

		if (node.type === "ReturnStatement" && isFailureReturn(node)) {
			found = true;
		}
	});
	return found;
}

function hasValidationRejection(body, evidence) {
	let found = false;
	walkWithoutNestedFunctions(body, evidence.visitorKeys, (node) => {
		if (node.type !== "IfStatement" || !bodyHasValidation(node.test, evidence)) {
			return;
		}

		if (
			branchHasRejection(node.consequent, evidence.visitorKeys)
			|| (
				node.alternate != null
				&& branchHasRejection(node.alternate, evidence.visitorKeys)
			)
		) {
			found = true;
		}
	});
	return found;
}

function hasConversion(body, names, visitorKeys) {
	let found = false;
	walkWithoutNestedFunctions(body, visitorKeys, (node) => {
		const expression = unwrapExpression(node);
		const isDateConstruction = expression?.type === "NewExpression"
			&& getCalleeNameCandidates(expression.callee).includes("Date");
		if (
			(isDateConstruction || hasMatchingCallee(expression, CONVERTER_CALLEES))
			&& nodeReferencesNames(expression, names, visitorKeys)
		) {
			found = true;
		}
	});
	return found;
}

function returnsDifferentType(node) {
	if (node.returnType?.typeAnnotation == null || hasTypePredicate(node)) {
		return false;
	}

	const returnType = unwrapPromiseType(node.returnType.typeAnnotation);
	return (node.params ?? []).some((param) => {
		const inputType = getTypeAnnotation(param);
		return isBroadInputType(inputType) && inputType.type !== returnType.type;
	});
}

function unwrapPromiseType(annotation) {
	if (
		annotation.type !== "TSTypeReference"
		|| annotation.typeName?.type !== "Identifier"
		|| annotation.typeName.name !== "Promise"
	) {
		return annotation;
	}

	const typeArguments = annotation.typeArguments ?? annotation.typeParameters;
	return typeArguments?.params?.[0] ?? annotation;
}

function isManualValidation(node, visitorKeys) {
	const inputNames = getBroadInputNames(node);
	if (inputNames.size === 0) {
		return false;
	}

	const names = collectDerivedNames(node.body, inputNames, visitorKeys);
	if (hasTypePredicate(node)) {
		return bodyHasValidation(node.body, { allowComparisons: false, names, visitorKeys });
	}

	const returns = getReturnEvidence(node.body, names, visitorKeys);
	if (!returns.succeeds) {
		return false;
	}

	const hasParserShape = hasConversion(node.body, names, visitorKeys)
		|| (hasUnknownInput(node) && returnsDifferentType(node));
	return hasParserShape
		&& hasValidationRejection(node.body, {
			allowComparisons: true,
			names,
			visitorKeys,
		});
}

export const noManualValidationRule = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Disallow hand-written runtime validators and primitive parsers.",
			recommended: false,
		},
		schema: [],
		messages: {
			noManualValidation: NO_MANUAL_VALIDATION_MESSAGE,
		},
	},
	create(context) {
		const sourceCode = getSourceCode(context);
		const visitorKeys = sourceCode?.visitorKeys ?? {};
		return createFunctionLikeVisitors((node) => {
			if (!isManualValidation(node, visitorKeys)) {
				return;
			}

			context.report({
				node,
				messageId: "noManualValidation",
			});
		});
	},
};
