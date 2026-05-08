import { ArtifactStore } from '../artifacts/store.js';

export interface ConflictRecord {
  artifactA: string;
  artifactB: string;
  field: string;
  conflict: string;
  severity: 'high' | 'medium' | 'low';
}

export class ConflictScanner {
  constructor(private artifactStore: ArtifactStore) {}

  async scan(graph: any): Promise<ConflictRecord[]> {
    const conflicts: ConflictRecord[] = [];
    const artifacts = new Map<string, any>();

    // Load all current artifacts
    for (const node of graph.nodes) {
      if (node.status === 'PASS' || node.status === 'REVISE') {
        const artifactsList = await this.artifactStore.listArtifactsBySkill(node.skillName, 1);
        const latest = artifactsList[0];
        if (latest) {
          artifacts.set(node.skillName, latest.content);
        }
      }
    }

    // Rule 1: Product plan vs Architecture
    const plan = artifacts.get('product-manager');
    const arch = artifacts.get('system-architect');
    
    if (plan?.features && arch?.services) {
      // Mock logic: if plan has >5 features but arch has 1 service, flag it
      if (plan.features.length > 5 && arch.services.length === 1) {
        conflicts.push({
          artifactA: 'product-manager',
          artifactB: 'system-architect',
          field: 'scope',
          conflict: 'Plan outlines many features, but architecture defines only a single monolithic service.',
          severity: 'medium'
        });
      }
    }

    // Rule 2: Frontend Developer vs UI Designer
    const fe = artifacts.get('frontend-developer');
    const ui = artifacts.get('ui-designer');

    if (fe?.components && ui?.components) {
      const feNames = new Set((fe.components as Array<{name: string}>).map(c => c.name));
      const uiNames = (ui.components as Array<{name: string}>).map(c => c.name);
      
      const missing = uiNames.filter(name => !feNames.has(name));
      if (missing.length > 0) {
        conflicts.push({
          artifactA: 'ui-designer',
          artifactB: 'frontend-developer',
          field: 'components',
          conflict: `Frontend is missing components designed by UI: ${missing.join(', ')}`,
          severity: 'high'
        });
      }
    }

    return conflicts;
  }
}
