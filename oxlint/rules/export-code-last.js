import { isAllowedDefaultIdentifierExport } from "./default-export-use.js";
import {
	findLastNonExportIndex,
	getExportProgramInfo,
	isReportableAliasExport,
	isReportableDefaultIdentifierExport,
	isReportableLocalExportList,
	shouldReportEarlyExport,
} from "./export-code-last-shapes.js";

const EXPORTS_LAST_EXCEPT_TYPES_MESSAGE =
	"Runtime value exports (functions, classes, and most const values) must appear at the end of the file. Type-only exports, primitive consts, and direct Zod or Effect schema exports are exempt.";

const NO_EXPORT_SPECIFIERS_MESSAGE =
	"Do not use `export { ... }` for local values. Export the declaration directly at the bottom of the file instead.";

const NO_EXPORT_ALIAS_MESSAGE =
	"Do not export local aliases like `export const x = y`. Export the original declaration directly instead.";

const NO_DEFAULT_EXPORT_IDENTIFIER_MESSAGE =
	"Default-exported identifiers are only allowed for variables used internally. Export the declaration directly instead.";

function reportDefaultIdentifierExports(context, program, body) {
	for (const node of body) {
		if (!isReportableDefaultIdentifierExport(node)) {
			continue;
		}

		if (isAllowedDefaultIdentifierExport(node, program, context)) {
			continue;
		}

		context.report({
			node,
			messageId: "noDefaultExportIdentifier",
		});
	}
}

function reportLocalNamedExportLists(context, body) {
	for (const node of body) {
		if (isReportableLocalExportList(node)) {
			context.report({
				node,
				messageId: "noExportSpecifiers",
			});
		}
	}
}

function reportAliasExports(context, body) {
	for (const node of body) {
		if (isReportableAliasExport(node)) {
			context.report({
				node,
				messageId: "noExportAlias",
			});
		}
	}
}

function reportEarlyExport(input) {
	for (let index = 0; index < input.lastNonExportIndex; index += 1) {
		const node = input.body[index];
		if (shouldReportEarlyExport(node, input.options, input.schemaNames)) {
			input.context.report({
				node,
				messageId: "exportsLast",
			});
		}
	}
}

function checkProgram(context, options, program) {
	const { body, schemaNames } = getExportProgramInfo(program);
	if (body.length === 0) {
		return;
	}

	reportDefaultIdentifierExports(context, program, body);
	reportLocalNamedExportLists(context, body);
	reportAliasExports(context, body);

	const lastNonExportIndex = findLastNonExportIndex(body);
	if (lastNonExportIndex === -1) {
		return;
	}

	reportEarlyExport({ body, context, lastNonExportIndex, options, schemaNames });
}

export const exportCodeLastRule = {
	meta: {
		type: "layout",
		docs: {
			description:
				"Require value exports at the bottom of the file, but allow type-only exports anywhere.",
			recommended: false,
		},
		schema: [
			{
				type: "object",
				properties: {
					allowReExport: { type: "boolean" },
				},
				additionalProperties: false,
			},
		],
		messages: {
			exportsLast: EXPORTS_LAST_EXCEPT_TYPES_MESSAGE,
			noExportSpecifiers: NO_EXPORT_SPECIFIERS_MESSAGE,
			noExportAlias: NO_EXPORT_ALIAS_MESSAGE,
			noDefaultExportIdentifier: NO_DEFAULT_EXPORT_IDENTIFIER_MESSAGE,
		},
	},
	create(context) {
		const options = context.options?.[0] ?? {};

		return {
			Program(program) {
				checkProgram(context, options, program);
			},
		};
	},
};
