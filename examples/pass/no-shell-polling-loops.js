const cancellationScript = [
	"emit run.started",
	"exec sleep 3600",
];
const eventDrivenScript = `#!/bin/sh
printf 'started\\n'
read -r release
printf '%s\\n' "$release"`;
const documentation = "Avoid while true; do sleep 0.01; done in shell fixtures.";

async function waitForReady(ready, pause) {
	while (!ready()) {
		await pause();
	}
}

console.log(cancellationScript, eventDrivenScript, documentation, waitForReady);
