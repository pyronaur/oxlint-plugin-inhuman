import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const oxlintBin = path.resolve("node_modules/.bin/oxlint");
const configPath = path.resolve(".oxlintrc.json");

if (!existsSync(oxlintBin)) {
	console.error("Oxlint binary not found at node_modules/.bin/oxlint.");
	process.exit(1);
}

function runOxlint(label, targetPath, expectZeroExit) {
	console.log(`\n==> ${label}: oxlint ${targetPath}`);
	const result = spawnSync(oxlintBin, ["--config", configPath, targetPath], {
		stdio: "inherit",
	});

	const exitCode = result.status ?? 1;
	if (expectZeroExit && exitCode !== 0) {
		console.error(`Expected ${label} to pass, but oxlint exited with ${exitCode}.`);
		process.exit(exitCode);
	}

	if (!expectZeroExit && exitCode === 0) {
		console.error(`Expected ${label} to fail, but oxlint exited with 0.`);
		process.exit(1);
	}

	console.log(`✔ ${label}`);
}

runOxlint("Pass fixtures", "examples/pass", true);
runOxlint("Fail fixtures", "examples/fail", false);

console.log("\nFixture expectations behaved as intended.");
