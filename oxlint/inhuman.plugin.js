/**
 * Oxlint JS plugin: inhuman
 *
 * Opinionated rules that encode "pet peeves" and push code toward
 * explicit, guard-clause-first, error-safe patterns.
 */

import noBranchingPlugin from "oxlint-plugin-no-branching";
import { exportCodeLastRule } from "./rules/export-code-last.js";
import { maxFunctionSizeRule } from "./rules/max-function-size.js";
import { noCaughtTypeboxValidationRule } from "./rules/no-caught-typebox-validation.js";
import { noEmptyWrappersRule } from "./rules/no-empty-wrappers.js";
import { noLiteralBooleanCheckRule } from "./rules/no-literal-boolean-check.js";
import { noLocalPropertyAliasRule } from "./rules/no-local-property-alias.js";
import { noManualValidationRule } from "./rules/no-manual-validation.js";
import { noNonvalidatingDecodeRule } from "./rules/no-nonvalidating-decode.js";
import { noShellPollingLoopsRule } from "./rules/no-shell-polling-loops.js";
import { noSingleUseLocalFunctionRule } from "./rules/no-single-use-local-function.js";
import { noSwallowedCatchRule } from "./rules/no-swallowed-catch.js";
import { noUnusedSchemaPropertiesRule } from "./rules/no-unused-schema-properties.js";
import { noValidationInCodecRule } from "./rules/no-validation-in-codec.js";
import { requireGuardClausesRule } from "./rules/require-guard-clauses.js";

export default {
	meta: {
		name: "inhuman",
	},
	rules: {
		"require-guard-clauses": requireGuardClausesRule,
		"no-swallowed-catch": noSwallowedCatchRule,
		"export-code-last": exportCodeLastRule,
		"no-caught-typebox-validation": noCaughtTypeboxValidationRule,
		"no-empty-wrappers": noEmptyWrappersRule,
		"no-local-property-alias": noLocalPropertyAliasRule,
		"no-manual-validation": noManualValidationRule,
		"no-nonvalidating-decode": noNonvalidatingDecodeRule,
		"no-literal-boolean-check": noLiteralBooleanCheckRule,
		"no-shell-polling-loops": noShellPollingLoopsRule,
		"no-single-use-local-function": noSingleUseLocalFunctionRule,
		"no-unused-schema-properties": noUnusedSchemaPropertiesRule,
		"max-function-size": maxFunctionSizeRule,
		"no-validation-in-codec": noValidationInCodecRule,
		"no-switch": noBranchingPlugin.rules["no-switch"],
		"no-else": noBranchingPlugin.rules["no-else"],
	},
};
