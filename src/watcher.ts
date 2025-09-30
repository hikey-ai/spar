import chokidar from 'chokidar';
import path from 'path';

export interface FileChange {
  path: string;
  type: 'added' | 'changed' | 'deleted';
  timestamp: number;
}

let recentChanges: FileChange[] = [];
const MAX_EVENTS = 100;
const TTL = 5 * 60 * 1000; // 5 min

export function startWatcher(base: string): void {
  const watcher = chokidar.watch(base, {
    ignored: [
      /node_modules\/.*/,
      /dist\/.*/,
      /\.git\/.*/,
      '**/.*', // Ignore dotfiles
    ],
    ignoreInitial: true,
    persistent: true,
  });

  watcher.on('add', (p) => {
    recentChanges.push({ path: path.relative(base, p), type: 'added', timestamp: Date.now() });
    if (recentChanges.length > MAX_EVENTS) recentChanges.shift();
  });

  watcher.on('change', (p) => {
    recentChanges.push({ path: path.relative(base, p), type: 'changed', timestamp: Date.now() });
    if (recentChanges.length > MAX_EVENTS) recentChanges.shift();
  });

  watcher.on('unlink', (p) => {
    recentChanges.push({ path: path.relative(base, p), type: 'deleted', timestamp: Date.now() });
    if (recentChanges.length > MAX_EVENTS) recentChanges.shift();
  });

  // Cleanup old events
  setInterval(() => {
    const now = Date.now();
    recentChanges = recentChanges.filter(e => now - e.timestamp < TTL);
  }, 60000); // Every minute
}

export function getRecentChanges(since?: number): FileChange[] {
  if (since) {
    return recentChanges.filter(e => e.timestamp > since);
  }
  return recentChanges;
}