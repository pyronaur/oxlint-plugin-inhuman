async function ensureItemsGroupImpl(assetsDir: string, dryRun: boolean): Promise<void> {
  void assetsDir;
  void dryRun;
}

export async function ensureItemsGroup(assetsDir: string, dryRun: boolean): Promise<void> {
  if (dryRun) return;
  await ensureItemsGroupImpl(assetsDir, dryRun);
}
