import type { Page } from "playwright";
import { scanDomContent } from "../browser/dom-scanner.js";
import type { RobotsResult } from "./robots-parser.js";

export interface StructuredScrapeResult {
  url: string;
  title: string;
  description: string;
  headings: string[];
  links: Array<{ text: string; href: string }>;
  mainText: string;
  contentLength: number;
  scannerFindings: {
    promptInjectionDetected: boolean;
    promptInjectionFragments: string[];
  };
  robots: RobotsResult;
  allowed: boolean;
  truncated: boolean;
}

export class StructuredExtractor {
  async extract(page: Page, robotsResult: RobotsResult, maxTextLength = 10_000): Promise<StructuredScrapeResult> {
    const url = page.url();
    const title = await page.title();
    
    // Extract meta description
    const description = await page.locator('meta[name="description"]').getAttribute('content') || 
                       await page.locator('meta[property="og:description"]').getAttribute('content') || 
                       "";
    
    // Extract headings
    const headings = await this.extractHeadings(page);
    
    // Extract links
    const links = await this.extractLinks(page);
    
    // Extract main text content
    const mainText = await this.extractMainText(page);
    const contentLength = mainText.length;
    
    // Apply truncation
    const truncated = mainText.length > maxTextLength;
    const finalText = truncated ? 
      mainText.slice(0, maxTextLength) + "\n\n[TRUNCATED: Content exceeded limit]" : 
      mainText;
    
    // Scan for prompt injection
    const scan = scanDomContent(finalText);
    
    return {
      url,
      title,
      description,
      headings,
      links,
      mainText: scan.sanitized,
      contentLength,
      scannerFindings: {
        promptInjectionDetected: scan.detected,
        promptInjectionFragments: scan.fragments
      },
      robots: robotsResult,
      allowed: robotsResult.allowed,
      truncated
    };
  }

  private async extractHeadings(page: Page): Promise<string[]> {
    try {
      const headingElements = await page.locator('h1, h2, h3, h4, h5, h6').all();
      const headings: string[] = [];
      
      for (const element of headingElements.slice(0, 20)) { // Limit to prevent huge output
        try {
          const text = await element.textContent() || "";
          if (text.trim()) {
            headings.push(text.trim());
          }
        } catch {
          // Skip inaccessible elements
        }
      }
      
      return headings;
    } catch {
      return [];
    }
  }

  private async extractLinks(page: Page): Promise<Array<{ text: string; href: string }>> {
    try {
      const linkElements = await page.locator('a[href]').all();
      const links: Array<{ text: string; href: string }> = [];
      
      for (const element of linkElements.slice(0, 50)) { // Limit to prevent huge output
        try {
          const text = await element.textContent() || "";
          const href = await element.getAttribute('href') || "";
          
          if (text.trim() && href.trim()) {
            links.push({
              text: text.trim(),
              href: href.trim()
            });
          }
        } catch {
          // Skip inaccessible elements
        }
      }
      
      return links;
    } catch {
      return [];
    }
  }

  private async extractMainText(page: Page): Promise<string> {
    try {
      // Try to find main content area first
      const mainSelectors = [
        'main',
        '[role="main"]',
        'article',
        '.content',
        '.main-content',
        '#content',
        '#main'
      ];
      
      for (const selector of mainSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible()) {
            const text = await element.textContent() || "";
            if (text.trim().length > 100) {
              return text.trim();
            }
          }
        } catch {
          // Continue to next selector
        }
      }
      
      // Fallback to body content
      return await page.locator('body').textContent() || "";
    } catch {
      return "";
    }
  }
}
