import { test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "fs";
import path from "path";
import { tmpdir } from "os";
import { handleBootstrap } from "../src/bootstrap.js";

type TempDirs = {
  dirs: string[];
  createDir(prefix: string): string;
  cleanup(): void;
};

function createTempManager(): TempDirs {
  const dirs: string[] = [];
  return {
    dirs,
    createDir(prefix: string) {
      const dir = mkdtempSync(path.join(tmpdir(), prefix));
      dirs.push(dir);
      return dir;
    },
    cleanup() {
      for (const dir of dirs.reverse()) {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

function runSync(
  command: string,
  args: string[],
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(result.stdout);
  const stderr = new TextDecoder().decode(result.stderr);
  return {
    stdout,
    stderr,
    exitCode: result.exitCode ?? 0,
  };
}

function runOrFail(command: string, args: string[], cwd?: string) {
  const result = runSync(command, args, cwd);
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
  return result;
}

let tm: TempDirs;

beforeEach(() => {
  tm = createTempManager();
});

afterEach(() => {
  tm.cleanup();
});

test("bootstrap skips when workspace already initialized", async () => {
  const workspace = tm.createDir("spar-bootstrap-workspace-");
  runOrFail("git", ["init"], workspace);
  runOrFail("git", ["config", "user.email", "agent@example.com"], workspace);
  runOrFail("git", ["config", "user.name", "Agent"], workspace);
  writeFileSync(path.join(workspace, "existing.txt"), "hello");
  runOrFail("git", ["add", "-A"], workspace);
  runOrFail("git", ["commit", "-m", "Initial"], workspace);

  const result = await handleBootstrap(workspace, {
    mode: "template",
    templateRepo: "https://example.com/unused.git",
  });

  expect(result.status).toBe("noop");
  expect(result.commitHash?.length).toBeGreaterThan(0);
});

function createTemplateRepo(): string {
  const templateDir = tm.createDir("spar-template-");
  runOrFail("git", ["init"], templateDir);
  runOrFail("git", ["config", "user.email", "template@example.com"], templateDir);
  runOrFail("git", ["config", "user.name", "Template"], templateDir);
  writeFileSync(path.join(templateDir, "README.md"), "# Template\n");
  runOrFail("git", ["add", "-A"], templateDir);
  runOrFail("git", ["commit", "-m", "Template initial"], templateDir);
  return templateDir;
}

test("bootstrap clones template when workspace empty", async () => {
  const templateDir = createTemplateRepo();
  const workspace = tm.createDir("spar-bootstrap-workspace-");

  const result = await handleBootstrap(workspace, {
    mode: "template",
    templateRepo: templateDir,
  });

  expect(result.status).toBe("fresh");
  expect(existsSync(path.join(workspace, "README.md"))).toBeTrue();
  expect(existsSync(path.join(workspace, ".git"))).toBeTrue();
});

test("bootstrap restores from archive", async () => {
  const sourceDir = tm.createDir("spar-archive-source-");
  runOrFail("git", ["init"], sourceDir);
  runOrFail("git", ["config", "user.email", "source@example.com"], sourceDir);
  runOrFail("git", ["config", "user.name", "Source"], sourceDir);
  writeFileSync(path.join(sourceDir, "file.txt"), "content");
  runOrFail("git", ["add", "-A"], sourceDir);
  runOrFail("git", ["commit", "-m", "Snapshot"], sourceDir);

  const archivePath = path.join(tmpdir(), `spar-archive-${Date.now()}.tar.gz`);
  runOrFail("tar", ["-czf", archivePath, "-C", sourceDir, "."], undefined);
  tm.dirs.push(archivePath);

  const workspace = tm.createDir("spar-restore-workspace-");
  const result = await handleBootstrap(workspace, {
    mode: "restore",
    archivePath,
  });

  expect(result.status).toBe("restored");
  expect(existsSync(path.join(workspace, "file.txt"))).toBeTrue();
  expect(existsSync(path.join(workspace, ".git"))).toBeTrue();
});
