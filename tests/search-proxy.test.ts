import { test, expect, beforeEach, afterEach } from "bun:test";
import path from "path";
import { tmpdir } from "os";
import { mkdtempSync, mkdirSync } from "fs";

// Shared setup with fs-proxy
let mockWorkspace: string;

beforeEach(async () => {
  mockWorkspace = mkdtempSync(path.join(tmpdir(), "spar-search-"));
  // Create sample files
  await Bun.write(path.join(mockWorkspace, "file1.txt"), "content1");
  await Bun.write(path.join(mockWorkspace, "file2.js"), "js code");
  const subDir = path.join(mockWorkspace, "subdir");
  mkdirSync(subDir, { recursive: true });
  await Bun.write(path.join(subDir, "file3.txt"), "content3");
});

afterEach(() => {
  Bun.spawnSync(["rm", "-rf", mockWorkspace]);
});

test("glob should find matching files", async () => {
  const { glob } = await import("../src/search-proxy.ts");
  const matches = await glob("**/*.txt", mockWorkspace);
  expect(matches).toContain("file1.txt");
  expect(matches).toContain("subdir/file3.txt");
  expect(matches.length).toBe(2);
  expect(matches.every(m => !path.isAbsolute(m))).toBe(true); // Relative paths
});

test("grep should find matching lines", async () => {
  const { grep } = await import("../src/search-proxy.ts");
  const matches = await grep("content", mockWorkspace);
  expect(matches.length).toBe(2);
  const file1Match = matches.find(m => m.file === "file1.txt");
  expect(file1Match).toBeDefined();
  if (file1Match && file1Match.lines.length > 0) {
    expect(file1Match!.lines[0]!.content).toContain("content1");
  }
  const subMatch = matches.find(m => m.file === "subdir/file3.txt");
  expect(subMatch).toBeDefined();
  if (subMatch && subMatch.lines.length > 0) {
    expect(subMatch!.lines[0]!.content).toContain("content3");
  }
  // file2.js should not match
  const file2Match = matches.find(m => m.file === "file2.js");
  expect(file2Match).toBeUndefined();
});

test("grep should respect case sensitivity", async () => {
  const { grep } = await import("../src/search-proxy.ts");
  await Bun.write(path.join(mockWorkspace, "case.txt"), "CaseSensitive\ncasematters");

  // Case-sensitive (default)
  let matches = await grep("CaseSensitive", mockWorkspace, '**/*', [], { caseSensitive: true });
  expect(matches.length).toBe(1);
  expect(matches[0]!.file).toBe("case.txt");

  // Case-insensitive
  matches = await grep("casesensitive", mockWorkspace, '**/*', [], { caseSensitive: false });
  expect(matches.length).toBe(1);
  expect(matches[0]!.file).toBe("case.txt");
});

test("grep should handle fixed string matching", async () => {
  const { grep } = await import("../src/search-proxy.ts");
  await Bun.write(path.join(mockWorkspace, "fixed.txt"), "search.this");

  // Regex (default)
  let matches = await grep("search.this", mockWorkspace, '**/*', [], { matchString: false });
  expect(matches.length).toBe(1);

  // Fixed string
  matches = await grep("search.this", mockWorkspace, '**/*', [], { matchString: true });
  expect(matches.length).toBe(1);
});

test("grep should include context lines", async () => {
  const { grep } = await import("../src/search-proxy.ts");
  await Bun.write(path.join(mockWorkspace, "context.txt"), "line1\nline2\nline3");

  const matches = await grep("line2", mockWorkspace, '**/*', [], { contextLines: 1 });
  expect(matches.length).toBe(1);
  const fileMatch = matches[0]!;
  expect(fileMatch.lines.length).toBe(3);
  expect(fileMatch.lines[0]!.content).toContain("line1");
  expect(fileMatch.lines[1]!.content).toContain("line2");
  expect(fileMatch.lines[2]!.content).toContain("line3");
});

test("grep should respect max results", async () => {
  const { grep } = await import("../src/search-proxy.ts");
  await Bun.write(path.join(mockWorkspace, "max.txt"), "a\na\na");

  const matches = await grep("a", mockWorkspace, '**/*', [], { maxResults: 2 });
  expect(matches.length).toBe(1);
  expect(matches[0]!.lines.length).toBe(2);
});
