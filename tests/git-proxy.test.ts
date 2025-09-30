import { test, expect, beforeEach, afterEach } from "bun:test";
import path from "path";
import { tmpdir } from "os";
import { mkdtempSync } from "fs";

let mockWorkspace: string;

beforeEach(async () => {
  mockWorkspace = mkdtempSync(path.join(tmpdir(), "spar-git-"));
  Bun.spawnSync(["git", "init"], { cwd: mockWorkspace });
  await Bun.write(path.join(mockWorkspace, "test.txt"), "content");
});

afterEach(() => {
  Bun.spawnSync(["rm", "-rf", mockWorkspace]);
});

test("getStatus should return untracked files", async () => {
  const { getStatus } = await import("../src/git-proxy.js");
  const status = await getStatus(mockWorkspace);
  expect(status.untracked).toContain("test.txt");
  expect(status.staged).toEqual([]);
  expect(status.unstaged).toEqual([]);
});
