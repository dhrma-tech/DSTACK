import { describe, expect, it, beforeEach, vi } from "vitest";
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
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ message: "404" });
    
    const result = await parser.checkUrl("https://example.com/page");
    
    expect(result.allowed).toBe(true);
    expect(result.robotsStatus).toBe("missing");
    expect(result.reason).toBe("robots.txt not found");
  });

  it("allows URLs when robots.txt permits", async () => {
    const mockRobots = `User-agent: *
Allow: /page
Disallow: /private`;
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
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
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    await parser.checkUrl("https://example.com/private");
    await parser.checkUrl("https://example.com/private2");
    
    // Should only fetch once due to caching
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("handles fetch errors gracefully", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));
    
    const result = await parser.checkUrl("https://example.com/page");
    
    expect(result.allowed).toBe(true);
    expect(result.robotsStatus).toBe("error");
    expect(result.reason).toBe("Network error");
  });

  it("clears cache", async () => {
    const mockRobots = `User-agent: *
Disallow: /private`;
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    await parser.checkUrl("https://example.com/private");
    parser.clearCache();
    await parser.checkUrl("https://example.com/private2");
    
    // Should fetch twice since cache was cleared
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  // New comprehensive tests for longest-match precedence and edge cases
  it("Disallow /private blocks /private/page", async () => {
    const mockRobots = `User-agent: *
Disallow: /private`;
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    const result = await parser.checkUrl("https://example.com/private/page");
    
    expect(result.allowed).toBe(false);
    expect(result.matchedRule).toBe("Disallow: /private");
  });

  it("Allow /private/public beats Disallow /private", async () => {
    const mockRobots = `User-agent: *
Disallow: /private
Allow: /private/public`;
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    const result = await parser.checkUrl("https://example.com/private/public");
    
    expect(result.allowed).toBe(true);
    expect(result.matchedRule).toBe("Allow: /private/public");
  });

  it("Missing robots allows with robotsStatus=missing", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce({ message: "404" });
    
    const result = await parser.checkUrl("https://example.com/page");
    
    expect(result.allowed).toBe(true);
    expect(result.robotsStatus).toBe("missing");
    expect(result.reason).toBe("robots.txt not found");
  });

  it("wildcard and $ anchor behavior", async () => {
    const mockRobots = `User-agent: *
Disallow: /admin/*
Allow: /admin/public$`;
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    const disallowedResult = await parser.checkUrl("https://example.com/admin/secret");
    const allowedResult = await parser.checkUrl("https://example.com/admin/public");
    
    expect(disallowedResult.allowed).toBe(false);
    expect(disallowedResult.matchedRule).toBe("Disallow: /admin/*");
    
    expect(allowedResult.allowed).toBe(true);
    expect(allowedResult.matchedRule).toBe("Allow: /admin/public$");
  });

  it("properly escapes regex metacharacters", async () => {
    const mockRobots = `User-agent: *
Disallow: /path+with+plus
Disallow: /path?with?question
Disallow: /path$with$dollar`;
    
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockRobots)
    });
    
    const result1 = await parser.checkUrl("https://example.com/path+with+plus");
    const result2 = await parser.checkUrl("https://example.com/path?with?question");
    const result3 = await parser.checkUrl("https://example.com/path$with$dollar");
    
    expect(result1.allowed).toBe(false);
    expect(result2.allowed).toBe(false);
    expect(result3.allowed).toBe(false);
  });
});
