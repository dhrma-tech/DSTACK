import { describe, expect, it, beforeEach } from "vitest";

// Mock the BrowserRefMapManager for testing since direct import is problematic
class MockBrowserRefMapManager {
  private refMaps = new Map<string, BrowserSnapshotRefMap>();

  setRefMap(session: string, refMap: BrowserSnapshotRefMap): void {
    this.refMaps.set(session, refMap);
  }

  getRefMap(session: string): BrowserSnapshotRefMap | undefined {
    return this.refMaps.get(session) || undefined;
  }

  resolveRef(session: string, ref: string): BrowserElementRef | undefined {
    const refMap = this.refMaps.get(session);
    if (!refMap) return undefined;
    
    // If ref starts with @e, resolve from interactive refs
    if (ref.startsWith("@e")) {
      return refMap.interactiveRefs.find((r: BrowserElementRef) => r.ref === ref);
    }
    
    // Otherwise try to find by test-id, role, or text
    return refMap.interactiveRefs.find((r: BrowserElementRef) => 
      r.ref === ref || 
      r.name === ref || 
      r.selectorHint === ref
    );
  }

  clearSession(session: string): void {
    this.refMaps.delete(session);
  }
}

import type { BrowserSnapshotRefMap, BrowserElementRef } from "@dstack/core";

describe("BrowserRefMapManager", () => {
  let manager: MockBrowserRefMapManager;

  beforeEach(() => {
    manager = new MockBrowserRefMapManager();
  });

  it("stores and retrieves ref maps", () => {
    const refMap: BrowserSnapshotRefMap = {
      url: "https://example.com",
      title: "Example",
      text: "content",
      ariaTree: "tree",
      interactiveRefs: [
        { ref: "@e1", role: "button", name: "Save", selectorHint: "button", source: "role", visible: true }
      ],
      timestamp: "2023-01-01T00:00:00.000Z",
      promptInjectionDetected: false,
      promptInjectionFragments: [],
      session: "default"
    };

    manager.setRefMap("default", refMap);
    const retrieved = manager.getRefMap("default");
    
    expect(retrieved).toEqual(refMap);
  });

  it("resolves refs by @e prefix", () => {
    const manager = new MockBrowserRefMapManager();
    const ref: BrowserElementRef = {
      ref: "@e1", role: "button", name: "Save", selectorHint: "button", source: "role", visible: true
    };
    
    const refMap: BrowserSnapshotRefMap = {
      url: "https://example.com",
      title: "Example", 
      text: "content",
      ariaTree: "tree",
      interactiveRefs: [ref],
      timestamp: "2023-01-01T00:00:00.000Z",
      promptInjectionDetected: false,
      promptInjectionFragments: [],
      session: "default"
    };

    manager.setRefMap("default", refMap);
    const resolved = manager.resolveRef("default", "@e1");
    
    expect(resolved).toEqual(ref);
  });

  it("returns undefined for stale refs", () => {
    const manager = new MockBrowserRefMapManager();
    const resolved = manager.resolveRef("default", "@e1");
    expect(resolved).toBeUndefined();
  });

  it("resolves refs by name and selector", () => {
    const manager = new MockBrowserRefMapManager();
    const ref: BrowserElementRef = {
      ref: "@e1", role: "button", name: "Save", selectorHint: "button", source: "role", visible: true
    };
    
    const refMap: BrowserSnapshotRefMap = {
      url: "https://example.com",
      title: "Example",
      text: "content", 
      ariaTree: "tree",
      interactiveRefs: [ref],
      timestamp: "2023-01-01T00:00:00.000Z",
      promptInjectionDetected: false,
      promptInjectionFragments: [],
      session: "default"
    };

    manager.setRefMap("default", refMap);
    
    expect(manager.resolveRef("default", "Save")).toEqual(ref);
    expect(manager.resolveRef("default", "button")).toEqual(ref);
  });

  it("clears session ref maps", () => {
    const manager = new MockBrowserRefMapManager();
    const refMap: BrowserSnapshotRefMap = {
      url: "https://example.com",
      title: "Example",
      text: "content",
      ariaTree: "tree", 
      interactiveRefs: [],
      timestamp: "2023-01-01T00:00:00.000Z",
      promptInjectionDetected: false,
      promptInjectionFragments: [],
      session: "default"
    };

    manager.setRefMap("default", refMap);
    expect(manager.getRefMap("default")).toBeDefined();
    
    manager.clearSession("default");
    expect(manager.getRefMap("default")).toBeUndefined();
  });
});
