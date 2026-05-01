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
  [key: string]: any; // Make it indexable to satisfy JsonObject
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
      const path = urlObj.pathname;
      
      // Find applicable rules for *
      const wildcardRules = rules.find(rule => rule.userAgent === "*");
      if (!wildcardRules) {
        return { allowed: true, robotsStatus: "found", reason: "No specific rules found" };
      }
      
      // Check disallow rules first (they take precedence)
      for (const pattern of wildcardRules.disallow) {
        if (this.pathMatches(path, pattern)) {
          return { 
            allowed: false, 
            robotsStatus: "found", 
            matchedRule: `Disallow: ${pattern}`,
            reason: "Path matches disallow rule" 
          };
        }
      }
      
      // Check allow rules
      for (const pattern of wildcardRules.allow) {
        if (this.pathMatches(path, pattern)) {
          return { 
            allowed: true, 
            robotsStatus: "found", 
            matchedRule: `Allow: ${pattern}`,
            reason: "Path matches allow rule" 
          };
        }
      }
      
      // If no specific rules match, allow by default
      return { allowed: true, robotsStatus: "found", reason: "No matching rules found" };
      
    } catch (error) {
      // If robots.txt fetch fails, allow but mark as missing
      if (error instanceof Error && error.message.includes("404")) {
        return { allowed: true, robotsStatus: "missing", reason: "robots.txt not found" };
      }
      return { allowed: true, robotsStatus: "error", reason: error instanceof Error ? error.message : "Unknown error" };
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
    
    // Convert robots.txt pattern to regex
    let regexPattern = pattern
      .replace(/\*/g, '.*') // * matches any sequence
      .replace(/\$/g, '$') // $ is end anchor (preserve)
      .replace(/\?/g, '.'); // ? matches any single character
    
    // Ensure pattern starts with ^ to match from beginning
    if (!regexPattern.startsWith('^')) {
      regexPattern = '^' + regexPattern;
    }
    
    // If pattern doesn't end with $, allow any suffix
    if (!regexPattern.endsWith('$')) {
      regexPattern += '.*';
    }
    
    try {
      const regex = new RegExp(regexPattern);
      return regex.test(path);
    } catch {
      // If regex is invalid, fall back to simple string matching
      return path.startsWith(pattern.replace('*', ''));
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
