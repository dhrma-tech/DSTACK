import { describe, expect, it } from "vitest";
import { BrowserRefMapManager, type BrowserSnapshotRefMap, type BrowserElementRef } from "@dstack/core";

describe("BrowserRefMapManager", () => {
  it("stores and retrieves ref maps", () => {
    const manager = new BrowserRefMapManager();
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
    const manager = new BrowserRefMapManager();
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
    const manager = new BrowserRefMapManager();
    const resolved = manager.resolveRef("default", "@e1");
    expect(resolved).toBeUndefined();
  });

  it("resolves refs by name and selector", () => {
    const manager = new BrowserRefMapManager();
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
    const manager = new BrowserRefMapManager();
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
