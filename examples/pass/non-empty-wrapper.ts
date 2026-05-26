async function readItems(assetsDir: string): Promise<string> {
	return assetsDir;
}

async function ensureItemsGroupImpl(assetsDir: string, dryRun: boolean): Promise<void> {
	void assetsDir;
	void dryRun;
}

export async function ensureItemsGroup(assetsDir: string, dryRun: boolean): Promise<void> {
	if (dryRun) return;
	await ensureItemsGroupImpl(assetsDir, dryRun);
}

export async function normalizedItems(assetsDir: string): Promise<string> {
	const result = await readItems(assetsDir);
	return result.trim();
}

export async function handledItems(assetsDir: string): Promise<string> {
	const result = await readItems(assetsDir);
	if (result === "") return "empty";
	return result;
}
