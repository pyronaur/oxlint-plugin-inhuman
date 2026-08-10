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

console.log(isReady({ status: "ready" }));
