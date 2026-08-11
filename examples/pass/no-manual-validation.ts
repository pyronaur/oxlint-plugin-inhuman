declare const window: undefined | {
	name: string;
};

if (typeof window === "undefined") {
	console.log("server");
}

type Job = {
	status: "ready" | "waiting";
};

type ReadyJob = Job & {
	status: "ready";
};

function isReady(job: Job): job is ReadyJob {
	return job.status === "ready";
}

async function fooAsync(left: string, right: string): Promise<string> {
	const status = await Promise.resolve(`${left}:${right}`);
	if (status === "") {
		throw new Error("missing status");
	}

	return status;
}

async function fooPromise(value: unknown): Promise<unknown> {
	if (typeof value === "undefined") {
		throw new Error("missing value");
	}

	return value;
}

function fooPredicate(left: string, right: string): boolean {
	return left === right;
}

function fooRange(text: string, from: number, to: number): string {
	if (to < from) {
		throw new Error("invalid range");
	}

	return text.slice(from, to);
}

function fooPath(root: string, file: string): {
	readonly display: string;
	readonly resolved: string;
} {
	const resolved = `${root}/${file}`;
	if (resolved === root) {
		throw new Error("invalid path");
	}

	return { display: file, resolved };
}

function fooPayload(value: unknown, fail: boolean): string {
	const text = typeof value === "string" ? value : "";
	if (fail) {
		throw new Error("operational failure");
	}

	return text;
}

console.log(
	isReady({ status: "ready" }),
	await fooAsync("foo", "bar"),
	await fooPromise("foo"),
	fooPredicate("foo", "foo"),
	fooRange("foobar", 0, 3),
	fooPath("/foo", "bar"),
	fooPayload("foo", false),
);
