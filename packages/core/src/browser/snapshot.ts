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
    url,
    title,
    text: injectionScan.sanitized,
    ariaTree,
    interactiveRefs,
    timestamp: new Date().toISOString(),
    promptInjectionDetected: injectionScan.detected,
    promptInjectionFragments: injectionScan.fragments,
    session
  };
}

async function generateAriaTree(page: Page): Promise<string> {
  // Simplified ARIA tree generation
  try {
    const elements = await page.locator('[role], button, a, input, select, textarea').all();
    const tree: string[] = [];
    
    for (const element of elements.slice(0, 50)) { // Limit to prevent huge output
      try {
        const tagName = await element.evaluate((el: any) => el.tagName.toLowerCase());
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
        
        const ref = await createRefFromElement(page, element, `@e${refCounter++}`, "testid", testId);
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
              const ref = await createRefFromElement(page, element, `@e${refCounter++}`, "role", name.trim());
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
          const ref = await createRefFromElement(page, element, `@e${refCounter++}`, "text", text.trim());
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
  element: any, 
  ref: string, 
  source: BrowserElementRef["source"], 
  name: string
): Promise<BrowserElementRef | null> {
  try {
    const visible = await element.isVisible();
    const tagName = await element.evaluate((el: any) => el.tagName.toLowerCase());
    const role = await element.getAttribute('role') || tagName;
    
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
      visible
    };
  } catch {
    return null;
  }
}
