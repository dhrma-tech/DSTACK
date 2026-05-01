export interface RobotsRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
}

export interface RobotsResult {
  allowed: boolean;
  robotsStatus: "found" | "missing" | "error";
  matchedRule?: string;
  reason?: string;
  [key: string]: unknown; // Make it indexable to satisfy JsonObject
}

export class RobotsParser {
  private cache = new Map<string, RobotsRule[]>();

  async checkUrl(url: string): Promise<RobotsResult> {
    try {
      const urlObj = new URL(url);
      const origin = urlObj.origin;
      
      // Check cache first
      if (!this.cache.has(origin)) {
        await this.fetchAndCache(origin);
      }
      
      const rules = this.cache.get(origin) || [];
      const path = urlObj.pathname + (urlObj.search || '');
      
      // Find applicable rules for *
      const wildcardRules = rules.find(rule => rule.userAgent === "*");
      if (!wildcardRules) {
        return { allowed: true, robotsStatus: "found", reason: "No specific rules found" };
      }
      
      // Use longest-match precedence: find longest matching allow and disallow patterns
      const disallowMatch = this.findLongestMatch(path, wildcardRules.disallow);
      const allowMatch = this.findLongestMatch(path, wildcardRules.allow);
      
            
      // Allow takes precedence over Disallow if allow match is longer (more specific)
      if (allowMatch.matched && disallowMatch.matched) {
        if (allowMatch.pattern!.length > disallowMatch.pattern!.length) {
          return { 
            allowed: true, 
            robotsStatus: "found", 
            matchedRule: `Allow: ${allowMatch.pattern}`,
            reason: "Path matches more specific allow rule" 
          };
        } else {
          return { 
            allowed: false, 
            robotsStatus: "found", 
            matchedRule: `Disallow: ${disallowMatch.pattern}`,
            reason: "Path matches disallow rule" 
          };
        }
      }
      
      // Only allow matches
      if (allowMatch.matched) {
        return { 
          allowed: true, 
          robotsStatus: "found", 
          matchedRule: `Allow: ${allowMatch.pattern}`,
          reason: "Path matches allow rule" 
        };
      }
      
      // Only disallow matches
      if (disallowMatch.matched) {
        return { 
          allowed: false, 
          robotsStatus: "found", 
          matchedRule: `Disallow: ${disallowMatch.pattern}`,
          reason: "Path matches disallow rule" 
        };
      }
      
      // If no specific rules match, allow by default
      return { allowed: true, robotsStatus: "found", reason: "No matching rules found" };
      
    } catch (error) {
      // If robots.txt fetch fails, allow but mark as missing
      let errorMessage = "Unknown error";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String((error as { message: string }).message);
      } else {
        errorMessage = String(error);
      }
      
      if (errorMessage.includes("404")) {
        return { allowed: true, robotsStatus: "missing", reason: "robots.txt not found" };
      }
      return { allowed: true, robotsStatus: "error", reason: errorMessage };
    }
  }

  private async fetchAndCache(origin: string): Promise<void> {
    try {
      const robotsUrl = `${origin}/robots.txt`;
      const response = await fetch(robotsUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("404");
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const content = await response.text();
      const rules = this.parseRobotsContent(content);
      this.cache.set(origin, rules);
      
    } catch (error) {
      // Cache empty rules to avoid repeated fetches
      this.cache.set(origin, []);
      throw error;
    }
  }

  private parseRobotsContent(content: string): RobotsRule[] {
    const rules: RobotsRule[] = [];
    let currentRule: RobotsRule | null = null;
    
    const lines = content.split('\n').map(line => line.trim());
    
    for (const line of lines) {
      // Skip comments and empty lines
      if (line.startsWith('#') || !line) continue;
      
      const separatorIndex = line.indexOf(':');
      if (separatorIndex === -1) continue;
      
      const key = line.slice(0, separatorIndex).trim().toLowerCase();
      const value = line.slice(separatorIndex + 1).trim();
      
      if (key === 'user-agent') {
        // Save previous rule if exists
        if (currentRule) {
          rules.push(currentRule);
        }
        // Start new rule
        currentRule = {
          userAgent: value.toLowerCase(),
          allow: [],
          disallow: []
        };
      } else if (currentRule && (key === 'allow' || key === 'disallow')) {
        if (key === 'allow') {
          currentRule.allow.push(value);
        } else {
          currentRule.disallow.push(value);
        }
      }
    }
    
    // Save last rule
    if (currentRule) {
      rules.push(currentRule);
    }
    
    return rules;
  }

  private pathMatches(path: string, pattern: string): boolean {
    if (pattern === "") return false; // Empty pattern matches nothing
    if (pattern === "/") return true; // Root pattern matches everything
    
    // Convert robots.txt pattern to regex with proper escaping
    let regexPattern = pattern;
    
    // Check if pattern ends with $ (end anchor) - only treat as anchor if it's the ONLY $
    const hasEndAnchor = pattern.endsWith('$') && pattern.lastIndexOf('$') === pattern.length - 1;
    
    // Remove the $ for processing but remember it was there
    if (hasEndAnchor) {
      regexPattern = pattern.slice(0, -1);
    }
    
    // Escape all regex metacharacters except * and $
    regexPattern = regexPattern.replace(/[.+?^{}()|[\]\\]/g, '\\$&');
    
    // Escape $ characters that are not at the end (they should be treated as literals)
    if (!hasEndAnchor) {
      regexPattern = regexPattern.replace(/\$/g, '\\$');
    }
    
    // Handle * wildcard - matches any sequence of characters
    regexPattern = regexPattern.replace(/\*/g, '.*');
    
    // Add end anchor if it was in the original pattern
    if (hasEndAnchor) {
      regexPattern += '$';
    } else {
      // If no end anchor, allow any suffix
      regexPattern += '.*';
    }
    
    // Ensure pattern starts with ^ to match from beginning
    regexPattern = '^' + regexPattern;
    
    try {
      const regex = new RegExp(regexPattern);
      return regex.test(path);
    } catch {
      // If regex is invalid, fall back to simple string matching
      if (hasEndAnchor) {
        return path === pattern.slice(0, -1);
      }
      return path.startsWith(pattern.replace('*', ''));
    }
  }

  private findLongestMatch(path: string, patterns: string[]): { matched: boolean; pattern?: string } {
    let longestMatch = "";
    let matched = false;
    
    for (const pattern of patterns) {
      if (this.pathMatches(path, pattern)) {
        matched = true;
        // Longest match wins (more specific)
        if (pattern.length > longestMatch.length) {
          longestMatch = pattern;
        }
      }
    }
    
    return { matched, pattern: longestMatch };
  }

  clearCache(): void {
    this.cache.clear();
  }
}
