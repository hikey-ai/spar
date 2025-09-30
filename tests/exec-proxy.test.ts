import { test, expect, beforeEach, afterEach } from "bun:test";
import path from "path";
import { tmpdir } from "os";
import { mkdtempSync } from "fs";

// Shared setup
let mockWorkspace: string;

beforeEach(() => {
  mockWorkspace = mkdtempSync(path.join(tmpdir(), "spar-exec-"));
});

afterEach(() => {
  Bun.spawnSync(["rm", "-rf", mockWorkspace]);
});

test("runBash should execute simple command", async () => {
  const { runBash } = await import("../src/exec-proxy.js");
  const result = await runBash('echo "hello world"', { cwd: mockWorkspace });
  expect(result.stdout.trim()).toBe("hello world");
  expect(result.stderr).toBe("");
  expect(result.exitCode).toBe(0);
  expect(result.duration).toBeGreaterThan(0);
});

test("runBash should handle error command", async () => {
  const { runBash } = await import("../src/exec-proxy.js");
  const result = await runBash('exit 1', { cwd: mockWorkspace });
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("");
  expect(result.duration).toBeGreaterThan(0);
});

test("startExec should start background job", async () => {
  const { startExec, getExecStatus } = await import("../src/exec-proxy.js");
  const { jobId } = await startExec('sleep 5', { cwd: mockWorkspace });
  expect(jobId).toBeDefined();

  // Small delay to ensure duration > 0
  await new Promise(r => setTimeout(r, 50));

  // Poll status
  let status = await getExecStatus(jobId);
  expect(status.status).toBe('running');
  expect(status.duration).toBeGreaterThan(0);

  // Wait and check completion
  await new Promise(r => setTimeout(r, 5500));

  status = await getExecStatus(jobId);
  expect(status.status).toBe('complete');
  expect(status.stdout).toBe('');
  expect(status.exitCode).toBe(0);
}, 15000);

test("getExecStatus should return partial output for running job", async () => {
  const { startExec, getExecStatus } = await import("../src/exec-proxy.js");
  const { jobId } = await startExec('echo "streaming test" && sleep 5', { cwd: mockWorkspace });
  // Poll after short delay
  await new Promise(r => setTimeout(r, 2000));
  const status = await getExecStatus(jobId);
  expect(status.status).toBe('running');
  expect(status.stdout).toContain('streaming test');
}, 10000);