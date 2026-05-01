export interface BrowserElementRef {
  ref: string;
  role: string;
  name: string;
  selectorHint: string;
  source: "role" | "testid" | "text" | "css";
  visible: boolean;
  clickable: boolean;
  fillable: boolean;
  tagName: string;
  attributes: Record<string, string>;
  order: number;
  stale?: boolean;
}

export interface BrowserSnapshotRefMap {
  id: string;
  projectId: string;
  session: string;
  createdAt: string;
  url: string;
  title: string;
  text: string;
  ariaTree: string;
  interactiveRefs: BrowserElementRef[];
  promptInjectionDetected: boolean;
  promptInjectionFragments: string[];
  scannerSummary: {
    detected: boolean;
    fragmentCount: number;
  };
  consoleLogsCount: number;
  networkLogsCount: number;
  [key: string]: unknown; // Make it indexable to satisfy JsonObject
}

export class BrowserRefMapManager {
  private refMaps = new Map<string, BrowserSnapshotRefMap>();

  setRefMap(session: string, refMap: BrowserSnapshotRefMap): void {
    this.refMaps.set(session, refMap);
  }

  getRefMap(session: string): BrowserSnapshotRefMap | undefined {
    return this.refMaps.get(session);
  }

  resolveRef(session: string, ref: string): BrowserElementRef | undefined {
    const refMap = this.refMaps.get(session);
    if (!refMap) return undefined;
    
    // If ref starts with @e, resolve from interactive refs
    if (ref.startsWith("@e")) {
      return refMap.interactiveRefs.find(r => r.ref === ref);
    }
    
    // Otherwise try to find by test-id, role, or text
    return refMap.interactiveRefs.find(r => 
      r.ref === ref || 
      r.name === ref || 
      r.selectorHint === ref
    );
  }

  clearSession(session: string): void {
    this.refMaps.delete(session);
  }

  clearAll(): void {
    this.refMaps.clear();
  }
}
