import path from "path";
import * as fs from "fs";

export interface GrepMatch {
  file: string;
  lines: Array<{ line: number; content: string }>;
}

function getAllFiles(dir: string): string[] {
  const files: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return files;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

import { minimatch } from 'minimatch';

export async function glob(pattern: string, base: string, ignore: string[] = []): Promise<string[]> {
  if (!base || !path.isAbsolute(base)) {
    throw new Error('Invalid base path');
  }
  const allFiles = getAllFiles(base);
  const relFiles = allFiles.map(f => path.relative(base, f));
  const matched = relFiles.filter(f => minimatch(f, pattern));
  return matched.filter(f => !ignore.some(ig => minimatch(f, ig)));
}

export async function grep(pattern: string, base: string, include: string = '**/*', ignore: string[] = []): Promise<GrepMatch[]> {
  const rgArgs = [
    'rg',
    '-n', // line number
    '-g', include,
  ];
  if (ignore.length > 0) {
    ignore.forEach(ig => rgArgs.push('-g', `!${ig}`));
  }
  rgArgs.push(pattern, base);

  const proc = Bun.spawn(rgArgs, { cwd: base, stdout: 'pipe', stderr: 'pipe' });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  if (proc.exitCode !== 0 && stdout.trim() === '') {
    return [];
  }

  const lines = stdout.trim().split('\n');
  const fileMatches = new Map<string, GrepMatch>();

  for (const line of lines) {
    if (!line) continue;
    const parts = line.split(':');
    if (parts.length < 3) continue; // file:line:content
    const absFile = parts[0]!;
    const relFile = path.relative(base, absFile);
    const lineNumStr = parts[1]!;
    const content = parts.slice(2).join(':');
    const lineNum = parseInt(lineNumStr) - 1;

    if (!fileMatches.has(relFile)) {
      fileMatches.set(relFile, { file: relFile, lines: [] });
    }
    const match = fileMatches.get(relFile)!;
    match.lines.push({ line: lineNum, content });
  }

  return Array.from(fileMatches.values());
}