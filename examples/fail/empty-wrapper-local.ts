async function doWork(assetsDir: string, dryRun: boolean): Promise<void> {
	void assetsDir;
	void dryRun;
}

async function ensureItemsGroup(assetsDir: string, dryRun: boolean): Promise<void> {
	await doWork(assetsDir, dryRun);
}

export async function run(): Promise<void> {
	await ensureItemsGroup("assets", false);
}
