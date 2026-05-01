import type { Page } from "playwright";
import { scanDomContent } from "./dom-scanner.js";
import type { BrowserElementRef, BrowserSnapshotRefMap } from "./ref-map.js";

const INTERACTIVE_ROLES = new Set([
  "button", "link", "textbox", "checkbox", "combobox", "radio", "tab", "menuitem", "option"
]);

export async function generateBrowserSnapshot(page: Page, session: string): Promise<BrowserSnapshotRefMap> {
  const url = page.url();
  const title = await page.title();
  
  // Get page text and scan for prompt injection
  const text = await page.locator("body").innerText().catch(() => "");
  const injectionScan = scanDomContent(text);
  
  // Generate ARIA tree (simplified version)
  const ariaTree = await generateAriaTree(page);
  
  // Generate interactive refs
  const interactiveRefs = await generateInteractiveRefs(page);
  
  return {
    id: `snapshot-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    projectId: "default", // This should be set by the caller
    session,
    createdAt: new Date().toISOString(),
    url,
    title,
    text: injectionScan.sanitized,
    ariaTree,
    interactiveRefs,
    promptInjectionDetected: injectionScan.detected,
    promptInjectionFragments: injectionScan.fragments,
    scannerSummary: {
      detected: injectionScan.detected,
      fragmentCount: injectionScan.fragments.length
    },
    consoleLogsCount: 0, // TODO: Implement console log counting
    networkLogsCount: 0 // TODO: Implement network log counting
  };
}

async function generateAriaTree(page: Page): Promise<string> {
  // Simplified ARIA tree generation
  try {
    const elements = await page.locator('[role], button, a, input, select, textarea').all();
    const tree: string[] = [];
    
    for (const element of elements.slice(0, 50)) { // Limit to prevent huge output
      try {
        const tagName = await element.evaluate((el: { tagName: string }) => el.tagName.toLowerCase());
        const role = await element.getAttribute('role') || tagName;
        const name = await element.getAttribute('aria-label') || 
                   await element.getAttribute('title') || 
                   await element.textContent() || 
                   '';
        
        if (name.trim()) {
          tree.push(`${role}: ${name.trim()}`);
        }
      } catch {
        // Skip elements that can't be accessed
      }
    }
    
    return tree.join('\n');
  } catch {
    return "";
  }
}

async function generateInteractiveRefs(page: Page): Promise<BrowserElementRef[]> {
  const refs: BrowserElementRef[] = [];
  let refCounter = 1;
  
  try {
    // Find elements by data-testid first
    const testIdElements = await page.locator('[data-testid]').all();
    for (const element of testIdElements.slice(0, 20)) {
      try {
        const testId = await element.getAttribute('data-testid');
        if (!testId) continue;
        
        const ref = await createRefFromElement(page, element, `@e${refCounter++}`, "testid", testId, refs.length + 1);
        if (ref) refs.push(ref);
      } catch {
        // Skip inaccessible elements
      }
    }
    
    // Find elements by ARIA roles
    for (const role of INTERACTIVE_ROLES) {
      try {
        const elements = await page.locator(`[role="${role}"], ${role}`).all();
        for (const element of elements.slice(0, 10)) {
          try {
            // Skip if already has testid
            const hasTestId = await element.getAttribute('data-testid');
            if (hasTestId) continue;
            
            const name = await element.getAttribute('aria-label') || 
                       await element.getAttribute('title') || 
                       await element.textContent() || 
                       '';
            
            if (name.trim()) {
              const ref = await createRefFromElement(page, element, `@e${refCounter++}`, "role", name.trim(), refs.length + 1);
              if (ref) refs.push(ref);
            }
          } catch {
            // Skip inaccessible elements
          }
        }
      } catch {
        // Skip if selector fails
      }
    }
    
    // Find elements by visible text (fallback for buttons/links without roles)
    const textElements = await page.locator('button:visible, a:visible').all();
    for (const element of textElements.slice(0, 15)) {
      try {
        // Skip if already processed
        const hasTestId = await element.getAttribute('data-testid');
        const hasRole = await element.getAttribute('role');
        if (hasTestId || hasRole) continue;
        
        const text = await element.textContent() || '';
        if (text.trim() && text.trim().length <= 50) {
          const ref = await createRefFromElement(page, element, `@e${refCounter++}`, "text", text.trim(), refs.length + 1);
          if (ref) refs.push(ref);
        }
      } catch {
        // Skip inaccessible elements
      }
    }
    
  } catch {
    // If anything fails, return empty refs rather than crashing
  }
  
  return refs;
}

async function createRefFromElement(
  page: Page, 
  element: { isVisible(): Promise<boolean>; getAttribute(name: string): Promise<string | null>; evaluate(fn: (el: unknown) => unknown): Promise<unknown> }, 
  ref: string, 
  source: BrowserElementRef["source"], 
  name: string,
  order: number
): Promise<BrowserElementRef | null> {
  try {
    const visible = await element.isVisible() ?? false;
    const tagName = await element.evaluate((el: unknown) => (el as { tagName: string }).tagName.toLowerCase()) as string;
    const role = await element.getAttribute('role') || tagName;
    
    // Get all attributes for better resolution
    const attributes: Record<string, string> = await element.evaluate((el: unknown) => {
      const element = el as { attributes: { name: string; value: string }[] };
      const attrs: Record<string, string> = {};
      for (const attr of element.attributes) {
        attrs[attr.name] = attr.value;
      }
      return attrs;
    }) as Record<string, string>;
    
    // Determine if element is fillable or clickable
    const fillable = FILLABLE_TAGS.has(tagName) || 
                   attributes.type && FILLABLE_INPUT_TYPES.has(attributes.type.toLowerCase());
    const clickable = CLICKABLE_TAGS.has(tagName) || 
                   attributes.role === "button" || 
                   attributes.role === "link" ||
                   attributes.type === "submit" ||
                   attributes.type === "button";
    
    // Generate selector hint
    let selectorHint = "";
    if (source === "testid") {
      selectorHint = `[data-testid="${name}"]`;
    } else if (source === "role") {
      selectorHint = `[role="${role}"]`;
    } else if (source === "text") {
      selectorHint = `text=${name}`;
    }
    
    return {
      ref,
      role,
      name,
      selectorHint,
      source,
      visible: visible ?? false,
      fillable,
      clickable,
      tagName,
      attributes,
      order
    } as BrowserElementRef;
  } catch {
    return null;
  }
}

// Helper constants for element type detection
const FILLABLE_TAGS = new Set(["input", "textarea", "select"]);
const FILLABLE_INPUT_TYPES = new Set([
  "text", "password", "email", "url", "tel", "search", "number", 
  "date", "datetime-local", "month", "week", "time", "color"
]);
const CLICKABLE_TAGS = new Set(["button", "a", "input", "select", "textarea", "summary", "details"]);
