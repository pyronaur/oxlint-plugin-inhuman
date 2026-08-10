const NO_SHELL_POLLING_LOOPS_MESSAGE =
	"Do not repeatedly spawn sleep from a shell loop. Use an event-driven wait or one exec-replaced blocker.";

const SHELL_LOOP = /\b(?:while|until)\b[\s\S]*?\bdo\b(?<body>[\s\S]*?)\bdone\b/gu;
const SLEEP_COMMAND = /(?:^|[;\n\r|&({]|\bthen\b|\bdo\b)\s*(?:\/?[\w.-]+\/)*sleep(?:\s|$)/u;
const SHELL_SHEBANG = /^#![^\n\r]*(?:ba|da|k|z)?sh(?:\s|$)/mu;
const STANDALONE_LOOP = /^(?:while|until)\b/u;
const TEMPLATE_EXPRESSION = " __inhuman_expression__ ";

function templateText(node) {
	return node.quasis
		.map((quasi) => quasi.value.cooked ?? quasi.value.raw)
		.join(TEMPLATE_EXPRESSION);
}

function shellSourceText(node) {
	if (node.type === "Literal" && typeof node.value === "string") {
		return node.value;
	}

	if (node.type === "TemplateLiteral") {
		return templateText(node);
	}

	return null;
}

function isShellSource(text) {
	const trimmed = text.trim();
	return STANDALONE_LOOP.test(trimmed) || SHELL_SHEBANG.test(trimmed);
}

function hasPollingLoop(text) {
	for (const match of text.matchAll(SHELL_LOOP)) {
		if (SLEEP_COMMAND.test(match.groups?.body ?? "")) {
			return true;
		}
	}

	return false;
}

function checkShellLiteral(context, node) {
	const text = shellSourceText(node);
	if (text == null || !isShellSource(text) || !hasPollingLoop(text)) {
		return;
	}

	context.report({ node, messageId: "noShellPollingLoops" });
}

export const noShellPollingLoopsRule = {
	meta: {
		type: "problem",
		docs: {
			description: "Forbid shell loops that repeatedly spawn sleep commands.",
			recommended: false,
		},
		schema: [],
		messages: {
			noShellPollingLoops: NO_SHELL_POLLING_LOOPS_MESSAGE,
		},
	},
	create(context) {
		return {
			Literal(node) {
				checkShellLiteral(context, node);
			},
			TemplateLiteral(node) {
				checkShellLiteral(context, node);
			},
		};
	},
};
