/**
 * Oxlint JS plugin: inhuman
 *
 * Opinionated rules that encode "pet peeves" and push code toward
 * explicit, guard-clause-first, error-safe patterns.
 */

import noBranchingPlugin from "oxlint-plugin-no-branching";
import { exportCodeLastRule } from "./rules/export-code-last.js";
import { noEmptyWrappersRule } from "./rules/no-empty-wrappers.js";
import { noSingleUseLocalFunctionRule } from "./rules/no-single-use-local-function.js";
import { noSwallowedCatchRule } from "./rules/no-swallowed-catch.js";
import { requireGuardClausesRule } from "./rules/require-guard-clauses.js";
import { testSizeRule } from "./rules/test-size.js";

export default {
	meta: {
		name: "inhuman",
	},
	rules: {
		"require-guard-clauses": requireGuardClausesRule,
		"no-swallowed-catch": noSwallowedCatchRule,
		"export-code-last": exportCodeLastRule,
		"no-empty-wrappers": noEmptyWrappersRule,
		"no-single-use-local-function": noSingleUseLocalFunctionRule,
		"test-size": testSizeRule,
		"no-switch": noBranchingPlugin.rules["no-switch"],
		"no-else": noBranchingPlugin.rules["no-else"],
	},
};
