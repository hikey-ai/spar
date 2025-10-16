import { promises as fs } from "node:fs";
import path from "node:path";
import { runCommand } from "./utils/command.js";
import { configureGitIdentity } from "./utils/git.js";

export type FinalizeRequest = {
  commitMessage?: string;
  gitIdentity?: {
    name?: string;
    email?: string;
  };
  distPath?: string;
};

export type FinalizeResponse = {
  hasChanges: boolean;
  commitHash?: string;
  tarPath?: string;
  distFiles: string[];
};

const DEFAULT_COMMIT_MESSAGE =
  process.env.FINALIZE_COMMIT_MESSAGE || "Agent changes";

async function getGitStatus(workspacePath: string) {
  const result = await runCommand(
    "git",
    ["status", "--porcelain"],
    { cwd: workspacePath },
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `git status failed: ${result.stderr || result.stdout}`,
    );
  }
  return result.stdout.trim();
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

async function ensureGitConfigured(
  workspacePath: string,
  identity?: FinalizeRequest["gitIdentity"],
) {
  await configureGitIdentity(workspacePath, identity);
}

async function stageAndCommit(
  workspacePath: string,
  message: string,
) {
  const add = await runCommand("git", ["add", "-A"], { cwd: workspacePath });
  if (add.exitCode !== 0) {
    throw new Error(
      `git add failed: ${add.stderr || add.stdout}`,
    );
  }

  const commit = await runCommand(
    "git",
    ["commit", "-m", message],
    { cwd: workspacePath },
  );
  if (commit.exitCode !== 0) {
    // git commit exit code 1 indicates no changes; treat as such
    if (commit.exitCode === 1) {
      return false;
    }
    throw new Error(
      `git commit failed: ${commit.stderr || commit.stdout}`,
    );
  }
  return true;
}

async function createTarball(
  workspacePath: string,
  runId: string,
): Promise<string> {
  const tmpDir = process.env.SPAR_TMP_DIR || "/tmp";
  const tarPath = path.join(tmpDir, `spar-run-${runId}.tar.gz`);
  const result = await runCommand(
    "tar",
    ["-czf", tarPath, "-C", workspacePath, "."],
  );
  if (result.exitCode !== 0) {
    throw new Error(
      `tar creation failed: ${result.stderr || result.stdout}`,
    );
  }
  return tarPath;
}

export async function finalizeWorkspace(
  workspacePath: string,
  runId: string,
  request: FinalizeRequest = {},
): Promise<FinalizeResponse> {
  const gitStatus = await getGitStatus(workspacePath);
  const hasChanges = gitStatus.length > 0;

  if (!hasChanges) {
    return {
      hasChanges: false,
      distFiles: [],
    };
  }

  await ensureGitConfigured(workspacePath, request.gitIdentity);

  const committed = await stageAndCommit(
    workspacePath,
    request.commitMessage || DEFAULT_COMMIT_MESSAGE,
  );

  if (!committed) {
    return {
      hasChanges: false,
      distFiles: [],
    };
  }

  const commitHash = await getCurrentCommit(workspacePath);
  const tarPath = await createTarball(workspacePath, runId);

  return {
    hasChanges: true,
    commitHash,
    tarPath,
    distFiles: [],
  };
}
