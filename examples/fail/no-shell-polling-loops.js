const readyPath = "/tmp/ready";
const oneLine = "while true; do sleep 0.01; done";
const multiline = `until [ -f /tmp/stop ]
do
	sleep 1
done`;
const interpolated = `while [ ! -f ${readyPath} ]; do sleep 0.01; done`;
const embeddedScript = `#!/bin/sh
printf 'started\\n'
while :; do
	/bin/sleep 5
done`;

console.log(oneLine, multiline, interpolated, embeddedScript);
