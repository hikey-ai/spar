import { runBash } from "./exec-proxy.js";
import path from "path";

export interface FileStatus {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'untracked';
}

export interface GitStatus {
  staged: FileStatus[];
  unstaged: FileStatus[];
  untracked: string[];
}

export async function getStatus(base: string): Promise<GitStatus> {
  const { stdout } = await runBash('git status --porcelain', { cwd: base });
  const lines = stdout.trim().split('\n');
  const staged: FileStatus[] = [];
  const unstaged: FileStatus[] = [];
  const untracked: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    const match = line.match(/^([ ?AMDRU])([ ?AMDRU])?\s+(.*)$/);
    if (!match) continue;
    const xStatus = match[1]!;
    const yStatus = match[2] || '';
    const relPath = match[3]!;
    if (xStatus === '?' && yStatus === '?') {
      untracked.push(relPath);
    } else if (xStatus !== ' ' && yStatus === ' ') {
      staged.push({ path: relPath, status: 'added' as const });
    } else if (xStatus === ' ' && yStatus !== ' ') {
      unstaged.push({ path: relPath, status: 'modified' as const });
    }
  }

  return { staged, unstaged, untracked };
}

// Stubs for other functions
export async function getDiff(base: string, path?: string): Promise<{ diff: string; files: { file: string; changes: string }[] }> {
  return { diff: '', files: [] };
}

export async function commit(message: string, all: boolean, base: string): Promise<{ commitHash: string; success: boolean }> {
  const cmd = all ? `git add . && git commit -m "${message}"` : `git commit -m "${message}"`;
  const { stdout, exitCode } = await runBash(cmd, { cwd: base });
  const hash = stdout.match(/commit ([a-f0-9]+)/)?.[1] || '';
  return { commitHash: hash, success: exitCode === 0 };
}

export async function getLog(limit: number = 10, base: string): Promise<{ commits: { hash: string; message: string; author: string; date: Date }[] }> {
  const { stdout } = await runBash(`git log --oneline -n ${limit}`, { cwd: base });
  return { commits: [] };
}