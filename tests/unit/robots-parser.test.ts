import { describe, expect, it } from "vitest";
import { RobotsParser } from "@dstack/core";

// Mock fetch for testing
global.fetch = vi.fn();

describe("RobotsParser", () => {
  let parser: RobotsParser;

  beforeEach(() => {
    parser = new RobotsParser();
    vi.clearAllMocks();
  });

  it("allows URLs when robots.txt is missing", async () => {
    (fetch as any).mockRejectedValueOnce({ message: "404" });
    
    const result = await parser.checkUrl("https://example.com/page");
    
    expect(result.allowed).toBe(true);
    expect(result.robotsStatus).toBe("missing");
    expect(result.reason).toBe("robots.txt not found");
  });

  it("allows URLs when robots.txt permits", async () => {
    const mockRobots = `User-agent: *
Allow: /page
Disallow: /private`;
    
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    const result = await parser.checkUrl("https://example.com/page");
    
    expect(result.allowed).toBe(true);
    expect(result.robotsStatus).toBe("found");
    expect(result.matchedRule).toBe("Allow: /page");
  });

  it("denies URLs when robots.txt disallows", async () => {
    const mockRobots = `User-agent: *
Disallow: /private`;
    
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    const result = await parser.checkUrl("https://example.com/private");
    
    expect(result.allowed).toBe(false);
    expect(result.robotsStatus).toBe("found");
    expect(result.matchedRule).toBe("Disallow: /private");
  });

  it("handles wildcard patterns", async () => {
    const mockRobots = `User-agent: *
Disallow: /*/admin`;
    
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    const result = await parser.checkUrl("https://example.com/users/admin");
    
    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("Disallow: /*/admin");
  });

  it("caches robots.txt results", async () => {
    const mockRobots = `User-agent: *
Disallow: /private`;
    
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    await parser.checkUrl("https://example.com/private");
    await parser.checkUrl("https://example.com/private2");
    
    // Should only fetch once due to caching
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("handles fetch errors gracefully", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("Network error"));
    
    const result = await parser.checkUrl("https://example.com/page");
    
    expect(result.allowed).toBe(true);
    expect(result.robotsStatus).toBe("error");
    expect(result.reason).toBe("Network error");
  });

  it("clears cache", async () => {
    const mockRobots = `User-agent: *
Disallow: /private`;
    
    (fetch as any).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    await parser.checkUrl("https://example.com/private");
    parser.clearCache();
    await parser.checkUrl("https://example.com/private2");
    
    // Should fetch twice since cache was cleared
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
