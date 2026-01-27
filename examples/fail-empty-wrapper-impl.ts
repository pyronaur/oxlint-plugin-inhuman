async function ensureItemsGroupImpl(assetsDir: string, dryRun: boolean): Promise<void> {
  void assetsDir;
  void dryRun;
}

export async function ensureItemsGroup(assetsDir: string, dryRun: boolean): Promise<void> {
  await ensureItemsGroupImpl(assetsDir, dryRun);
}
