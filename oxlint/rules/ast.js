export function getStaticPropertyName(node) {
	if (node?.type === "Identifier") {
		return node.name;
	}

	if (node?.type === "Literal" && typeof node.value === "string") {
		return node.value;
	}

	return null;
}

export function getSourceCode(context) {
	return (
		context.sourceCode
			?? (typeof context.getSourceCode === "function" ? context.getSourceCode() : null)
	);
}

export function unwrapExpression(node) {
	let current = node;

	while (
		current
		&& (current.type === "AwaitExpression"
			|| current.type === "ChainExpression"
			|| current.type === "ParenthesizedExpression")
	) {
		current = current.type === "AwaitExpression" ? current.argument : current.expression;
	}

	return current;
}

export function isFunctionExpression(node) {
	return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

export function getCalleeNameCandidates(node) {
	if (!node) {
		return [];
	}

	if (node.type === "Identifier") {
		return [node.name];
	}

	if (node.type === "CallExpression") {
		return getCalleeNameCandidates(node.callee);
	}

	if (node.type === "ChainExpression" || node.type === "ParenthesizedExpression") {
		return getCalleeNameCandidates(node.expression);
	}

	if (node.type !== "MemberExpression") {
		return [];
	}

	const objectNames = getCalleeNameCandidates(node.object);
	const propertyName = getStaticPropertyName(node.property);
	if (propertyName == null) {
		return objectNames;
	}

	const fullNames = objectNames.map((name) => `${name}.${propertyName}`);
	return [...fullNames, ...objectNames, propertyName];
}

export function getFunctionLineCount(node) {
	if (!node.loc?.start || !node.loc?.end) {
		return 0;
	}

	return node.loc.end.line - node.loc.start.line + 1;
}

export function createFunctionLikeVisitors(visit) {
	return {
		FunctionDeclaration(node) {
			const current = node;
			visit(current);
		},
		FunctionExpression(node) {
			const current = node;
			visit(current);
		},
		ArrowFunctionExpression(node) {
			const current = node;
			visit(current);
		},
	};
}
