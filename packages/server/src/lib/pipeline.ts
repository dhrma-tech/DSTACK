import { ArtifactStore, buildSkillPipeline, SkillRegistry } from '@dstack/core';
import type { SkillPipeline } from '@dstack/shared';
import { getDstackDir } from '../context';

const registry = new SkillRegistry();

/** Current state of every skill, from the real registry and this project's artifacts. */
export async function currentPipeline(): Promise<SkillPipeline> {
  const artifacts = new ArtifactStore(getDstackDir());
  return buildSkillPipeline({
    manifests: await registry.list(),
    readLatest: async (skillName) => {
      const latest = await artifacts.readLatest(skillName);
      return latest ? { verdict: latest.verdict, createdAt: latest.createdAt } : null;
    }
  });
}
