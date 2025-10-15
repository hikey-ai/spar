// No import needed for Bun.file
import path from "path";

export interface ReadResult {
  files: Array<{
    path: string;
    content: string;
    error?: string;
  }>;
}

export async function readFiles(paths: string[], base: string): Promise<ReadResult> {
  const files: ReadResult["files"] = [];
  for (const p of paths) {
    let safePath: string;
    if (path.isAbsolute(p)) {
      if (!p.startsWith(base)) {
        files.push({ path: p, content: '', error: 'Invalid path' });
        continue;
      }
      safePath = p;
    } else {
      safePath = path.resolve(base, p);
      if (!safePath.startsWith(base)) {
        files.push({ path: p, content: '', error: 'Invalid path' });
        continue;
      }
    }
    try {
      const file = Bun.file(safePath);
      const content = await file.text();
      files.push({ path: safePath, content });
    } catch (e) {
      files.push({ path: p, content: '', error: (e as Error).message });
    }
  }
  return { files };
}

export async function writeFile(p: string, content: string, base: string = '/workspace'): Promise<{ success: boolean; message?: string }> {
  let safePath: string;
  if (path.isAbsolute(p)) {
    if (!p.startsWith(base)) {
      return { success: false, message: 'Invalid path' };
    }
    safePath = p;
  } else {
    safePath = path.resolve(base, p);
    if (!safePath.startsWith(base)) {
      return { success: false, message: 'Invalid path' };
    }
  }
  try {
    await Bun.write(safePath, content);
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

export async function deleteFile(p: string, base: string = '/workspace'): Promise<{ success: boolean; message?: string }> {
  let safePath: string;
  if (path.isAbsolute(p)) {
    if (!p.startsWith(base)) {
      return { success: false, message: 'Invalid path' };
    }
    safePath = p;
  } else {
    safePath = path.resolve(base, p);
    if (!safePath.startsWith(base)) {
      return { success: false, message: 'Invalid path' };
    }
  }
  try {
    Bun.spawnSync(['rm', safePath]);
    return { success: true };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

import { Dirent } from "fs";
import * as fs from "node:fs/promises";
import { minimatch } from 'minimatch';

export async function listDir(p: string = '.', base: string = '/workspace', options: { recursive?: boolean; includeFiles?: boolean; ignore?: string[] } = {}): Promise<{ files: string[]; dirs: string[] }> {
  let safePath: string;
  if (path.isAbsolute(p)) {
    if (!p.startsWith(base)) {
      throw new Error('Invalid path');
    }
    safePath = p;
  } else {
    safePath = path.resolve(base, p);
    if (!safePath.startsWith(base)) {
      throw new Error('Invalid path');
    }
  }

  const allFiles: string[] = [];
  const allDirs: string[] = [];

  async function walk(currentDir: string) {
    let entries: Dirent[];
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (e) {
      return;
    }

    const promises = entries.map(async (entry) => {
      const entryPath = path.join(currentDir, entry.name);
      const relPath = path.relative(base, entryPath);

      if (options.ignore && options.ignore.some(pattern => minimatch(relPath, pattern))) {
        return;
      }

      if (entry.isDirectory()) {
        allDirs.push(relPath);
        if (options.recursive) {
          await walk(entryPath);
        }
      } else if (options.includeFiles !== false) {
        allFiles.push(relPath);
      }
    });

    await Promise.all(promises);
  }

  await walk(safePath);

  return { files: allFiles, dirs: allDirs };
}