async function doWork(assetsDir: string, dryRun: boolean): Promise<void> {
	void assetsDir;
	void dryRun;
}

function doNow(): Promise<void> {
	return doWork("assets", false);
}

const worker = {
	doNow,
};

const optionalWork = doNow;

async function ensureItemsGroup(assetsDir: string, dryRun: boolean): Promise<void> {
	const result = await doWork(assetsDir, dryRun);
	return result;
}

async function wrappedReturn(assetsDir: string, dryRun: boolean): Promise<void> {
	const outcome = await doWork(assetsDir, dryRun);
	return await outcome;
}

function parenthesizedWrapper(assetsDir: string, dryRun: boolean): Promise<void> {
	const value = doWork(assetsDir, dryRun);
	return value;
}

function assertedWrapper(): Promise<void> {
	const value = doNow();
	return value as Promise<void>;
}

function nonNullWrapper(): Promise<void> {
	const value = doNow();
	return value!;
}

function assignedWrapper(): Promise<void> {
	let value;
	value = doNow();
	return value;
}

function restWrapper(...args: [string, boolean]): Promise<void> {
	const delegated = doWork(...args);
	return delegated;
}

function memberWrapper(): Promise<void> {
	const handled = worker.doNow();
	return handled;
}

function optionalWrapper(): Promise<void> | undefined {
	const maybeHandled = optionalWork?.();
	return maybeHandled;
}

export async function run(): Promise<void> {
	await ensureItemsGroup("assets", false);
}
