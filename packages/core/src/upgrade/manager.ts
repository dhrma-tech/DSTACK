import type { UpgradePlan } from "@dstack/shared";
import { CheckpointStore } from "../memory.js";

export interface UpgradeManagerOptions {
  projectRoot: string;
  dstackDir: string;
  currentVersion: string;
}

export type DStackUpgradePlan = UpgradePlan;

export class UpgradeManager {
  constructor(private readonly options: UpgradeManagerOptions) {}

  async check(latestVersion = this.options.currentVersion): Promise<DStackUpgradePlan> {
    const isUpToDate = latestVersion === this.options.currentVersion;
    return {
      currentVersion: this.options.currentVersion,
      latestVersion,
      isUpToDate,
      changelogSummary: isUpToDate ? "Installed DStack version is current." : "A newer DStack version is available. Review changelog before upgrading.",
      breakingChanges: isUpToDate ? [] : ["Review Phase 2 artifact schema changes before upgrading."],
      requiredMigrations: isUpToDate ? [] : [{ description: "Verify .dstack artifact schema compatibility.", type: "SCHEMA_CHANGE", automated: true }],
      backupCheckpointCreated: false,
      backupCheckpointPath: null,
      upgradeApproved: false,
      upgradeExecuted: false,
      postUpgradeVerification: "SKIPPED"
    };
  }

  async createBackupCheckpoint(): Promise<string> {
    const checkpoint = await new CheckpointStore(this.options.dstackDir, this.options.projectRoot).save("pre-upgrade");
    return checkpoint.name;
  }
}
