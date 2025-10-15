import { test, expect, beforeEach, afterEach } from "bun:test";
import path from "path";
import { tmpdir } from "os";
import { mkdtempSync } from "fs";

// Mock /workspace as temp dir for tests
let mockWorkspace: string;
let testFilePath: string;

beforeEach(async () => {
  mockWorkspace = mkdtempSync(path.join(tmpdir(), "spar-test-"));
  testFilePath = path.join(mockWorkspace, "test.txt");
  await Bun.write(testFilePath, "initial content");
});

afterEach(() => {
  // Cleanup temp dir
  Bun.spawnSync(["rm", "-rf", mockWorkspace]);
});

test("batch read should return content for valid paths", async () => {
  const { readFiles } = await import("../src/fs-proxy.ts");
  const paths = [testFilePath];
  const result = await readFiles(paths, mockWorkspace);
  expect(result.files[0]!.content).toBe("initial content");
  expect(result.files[0]!.path).toBe(testFilePath);
  expect(Array.isArray(result.files)).toBe(true);
});

test("batch read should handle multiple paths including invalid", async () => {
  const { readFiles } = await import("../src/fs-proxy.ts");
  const validPath2 = path.join(mockWorkspace, "another.txt");
  await Bun.write(validPath2, "another content");
  const invalidPath = "/outside"; // Absolute outside base
  const paths = [testFilePath, validPath2, invalidPath];
  const result = await readFiles(paths, mockWorkspace);
  expect(result.files.length).toBe(3);
  expect(result.files[0]!.content).toBe("initial content");
  expect(result.files[1]!.content).toBe("another content");
  expect(result.files[2]!.error).toContain("Invalid path");
  expect(result.files[2]!.content).toBe("");
});

test("writeFile should overwrite content", async () => {
  const { writeFile, readFiles } = await import("../src/fs-proxy.ts");
  const newContent = "overwritten content";
  const relPath = path.relative(mockWorkspace, testFilePath);
  const result = await writeFile(relPath, newContent, mockWorkspace); // Pass relPath
  expect(result.success).toBe(true);

  const readResult = await readFiles([testFilePath], mockWorkspace);
  expect(readResult.files[0]!.content).toBe(newContent);
});

test("deleteFile should remove file", async () => {
  const { deleteFile, readFiles } = await import("../src/fs-proxy.ts");
  const relPath = path.relative(mockWorkspace, testFilePath);
  const deleteResult = await deleteFile(relPath, mockWorkspace);
  expect(deleteResult.success).toBe(true);

  const readResult = await readFiles([testFilePath], mockWorkspace);
  expect(readResult.files[0]!.error).toContain("no such file or directory");
  expect(readResult.files[0]!.content).toBe("");
});

test("listDir should return files and dirs", async () => {
  const { listDir } = await import("../src/fs-proxy.ts");
  // Create subdir and file
  const subDir = path.join(mockWorkspace, "subdir");
  Bun.spawnSync(["mkdir", subDir]);
  const subFile = path.join(subDir, "sub.txt");
  await Bun.write(subFile, "sub content");

  const result = await listDir(".", mockWorkspace, { recursive: false });
  expect(result.files.length).toBeGreaterThan(0); // At least test.txt
  expect(result.dirs).toContain("subdir");
});

test("listDir should recursively list files", async () => {
  const { listDir } = await import("../src/fs-proxy.ts");
  const subDir = path.join(mockWorkspace, "subdir");
  Bun.spawnSync(["mkdir", subDir]);
  const subFile = path.join(subDir, "sub.txt");
  await Bun.write(subFile, "sub content");

  const result = await listDir(".", mockWorkspace, { recursive: true });
  expect(result.files).toContain("subdir/sub.txt");
});

test("listDir should ignore files and dirs", async () => {
  const { listDir } = await import("../src/fs-proxy.ts");
  const subDir = path.join(mockWorkspace, "subdir");
  Bun.spawnSync(["mkdir", subDir]);
  const subFile = path.join(subDir, "sub.txt");
  await Bun.write(subFile, "sub content");
  const ignoredFile = path.join(mockWorkspace, "ignored.txt");
  await Bun.write(ignoredFile, "ignored content");

  const result = await listDir(".", mockWorkspace, { recursive: true, ignore: ["ignored.txt", "subdir"] });
  expect(result.files).not.toContain("ignored.txt");
  expect(result.dirs).not.toContain("subdir");
  expect(result.files).not.toContain("subdir/sub.txt");
});
