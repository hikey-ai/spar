import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

type GitIdentity = {
  name?: string;
  email?: string;
};

type TemplateAuth =
  | {
      type: "github_pat" | "basic";
      token: string;
      username?: string;
    };

type ClonePreparation = {
  url: string;
  env?: Record<string, string>;
  cleanup?: () => Promise<void>;
};

export type BootstrapRequest = {
  mode: "restore" | "template";
  archivePath?: string;
  templateRepo?: string;
  gitIdentity?: GitIdentity;
  templateAuth?: TemplateAuth;
  force?: boolean;
};

type BootstrapStatus = "noop" | "restored" | "fresh";

export type BootstrapResponse = {
  status: BootstrapStatus;
  commitHash?: string;
  message: string;
};

const DEFAULT_GIT_NAME = process.env.GIT_DEFAULT_NAME || "Spar Agent";
const DEFAULT_GIT_EMAIL = process.env.GIT_DEFAULT_EMAIL || "spar@example.com";

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.stat(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function cleanDirectory(dir: string) {
  await ensureDir(dir);
  const entries = await fs.readdir(dir);
  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(dir, entry);
      await fs.rm(entryPath, { recursive: true, force: true });
    }),
  );
}

type RunCommandOptions = {
  cwd?: string;
  env?: Record<string, string>;
};

async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: options.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = proc.stdout
    ? await Bun.readableStreamToText(proc.stdout)
    : "";
  const stderr = proc.stderr
    ? await Bun.readableStreamToText(proc.stderr)
    : "";
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}

async function configureGitIdentity(base: string, identity?: GitIdentity) {
  const name = identity?.name || DEFAULT_GIT_NAME;
  const email = identity?.email || DEFAULT_GIT_EMAIL;
  await runOrThrow("git", ["config", "user.name", name], { cwd: base });
  await runOrThrow("git", ["config", "user.email", email], { cwd: base });
}

async function runOrThrow(
  command: string,
  args: string[],
  options: RunCommandOptions = {},
) {
  const result = await runCommand(command, args, options);
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
    );
  }
  return result;
}

async function restoreFromArchive(
  archivePath: string,
  workspacePath: string,
) {
  const archiveExists = await pathExists(archivePath);
  if (!archiveExists) {
    throw new Error(`Archive not found at ${archivePath}`);
  }

  await cleanDirectory(workspacePath);

  await runOrThrow("tar", ["-xzf", archivePath, "-C", workspacePath]);

  const gitDir = path.join(workspacePath, ".git");
  if (!(await pathExists(gitDir))) {
    throw new Error("Restored archive is missing .git directory");
  }
}

async function cloneTemplateIntoWorkspace(
  templateRepo: string,
  workspacePath: string,
  gitIdentity?: GitIdentity,
  templateAuth?: TemplateAuth,
) {
  if (!templateRepo) {
    throw new Error("templateRepo is required for template bootstrap");
  }

  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "spar-template-"),
  );
  try {
    const prep = await prepareClone(
      templateRepo,
      templateAuth,
    );
    try {
      const env = prep.env
        ? { ...process.env, ...prep.env }
        : undefined;
      const targetUrl = prep.url;
      const result = await runCommand(
        "git",
        ["clone", "--depth", "1", targetUrl, tempDir],
        { env },
      );
      if (result.exitCode !== 0) {
        throw new Error(
          `git clone failed (exit ${result.exitCode}): ${result.stderr || result.stdout}`,
        );
      }
    } finally {
      await prep.cleanup?.();
    }

    await fs.rm(path.join(tempDir, ".git"), { recursive: true, force: true });

    await cleanDirectory(workspacePath);
    await runOrThrow("cp", ["-a", `${tempDir}/.`, workspacePath]);

    await runOrThrow("git", ["init"], { cwd: workspacePath });
    await configureGitIdentity(workspacePath, gitIdentity);
    await runOrThrow("git", ["add", "-A"], { cwd: workspacePath });
    await runOrThrow(
      "git",
      ["commit", "-m", "Initial template import"],
      { cwd: workspacePath },
    );
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function getCurrentCommit(workspacePath: string) {
  const result = await runCommand(
    "git",
    ["rev-parse", "HEAD"],
    { cwd: workspacePath },
  );
  if (result.exitCode !== 0) {
    return undefined;
  }
  return result.stdout.trim();
}

export async function handleBootstrap(
  workspacePath: string,
  request: BootstrapRequest,
): Promise<BootstrapResponse> {
  const gitDir = path.join(workspacePath, ".git");
  const gitExists = await pathExists(gitDir);
  if (gitExists && !request.force) {
    const commitHash = await getCurrentCommit(workspacePath);
    return {
      status: "noop",
      commitHash,
      message: "Workspace already initialized; skipping bootstrap",
    };
  }

  if (request.mode === "restore" && request.archivePath) {
    await restoreFromArchive(request.archivePath, workspacePath);
    const commitHash = await getCurrentCommit(workspacePath);
    return {
      status: "restored",
      commitHash,
      message: "Workspace restored from archive",
    };
  }

  if (request.mode === "template") {
    await cloneTemplateIntoWorkspace(
      request.templateRepo || "",
      workspacePath,
      request.gitIdentity,
      request.templateAuth,
    );
    const commitHash = await getCurrentCommit(workspacePath);
    return {
      status: "fresh",
      commitHash,
      message: "Workspace bootstrapped from template",
    };
  }

  if (request.mode === "restore" && !request.archivePath) {
    throw new Error(
      "archivePath is required when mode is 'restore'. Provide a staged archive or set mode='template'.",
    );
  }

  throw new Error(
    `Unsupported bootstrap request. mode=${request.mode}, archivePath=${request.archivePath}`,
  );
}

async function prepareClone(
  templateRepo: string,
  templateAuth?: TemplateAuth,
): Promise<ClonePreparation> {
  if (!templateAuth) {
    return { url: templateRepo };
  }

  let url: URL;
  try {
    url = new URL(templateRepo);
  } catch {
    throw new Error("templateRepo must be a valid HTTPS URL when auth is provided");
  }

  if (url.protocol !== "https:") {
    throw new Error("Authenticated template clone requires an HTTPS URL");
  }

  const username =
    templateAuth.type === "github_pat"
      ? templateAuth.username || "x-access-token"
      : templateAuth.username;

  if (!username) {
    throw new Error("Username is required for authenticated template clone");
  }

  url.username = username;
  url.password = "";

  const { scriptPath, cleanup } = await createAskPassScript(
    templateAuth.token,
  );

  return {
    url: url.toString(),
    env: {
      GIT_TERMINAL_PROMPT: "0",
      GIT_ASKPASS: scriptPath,
    },
    cleanup: async () => {
      await cleanup();
    },
  };
}

async function createAskPassScript(token: string) {
  const scriptPath = path.join(
    os.tmpdir(),
    `spar-askpass-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const escaped = token.replace(/(["\\$`])/g, "\\$1");
  const content = `#!/bin/sh\necho "${escaped}"\n`;
  await fs.writeFile(scriptPath, content, { mode: 0o700 });
  await fs.chmod(scriptPath, 0o700);
  return {
    scriptPath,
    cleanup: async () => {
      await fs.rm(scriptPath, { force: true });
    },
  };
}
