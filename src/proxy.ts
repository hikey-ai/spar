import path from "path";
import { readFiles, writeFile, deleteFile, listDir } from "./fs-proxy.js";
import { glob, grep } from "./search-proxy.js";
import { startExec, getExecStatus, stopExec, runBash } from "./exec-proxy.js";
import { getStatus, getDiff, commit, getLog } from "./git-proxy.js";
import { getDiagnostics, getDefinition, getReferences } from "./lsp.js";

export async function handleRequest(type: string, body: any, base: string = '/workspace'): Promise<any> {
  // Central validation
  if (!base || !path.isAbsolute(base)) {
    return { error: 'Invalid base path', code: 400 };
  }

  switch (type) {
    case 'files/read':
      return await readFiles(body.paths || [], base);
    case 'files/write':
      return await writeFile(body.path, body.content, base);
    case 'files/delete':
      return await deleteFile(body.path, base);
    case 'dirs/list':
      return await listDir(body.path || '.', base, body.options || {});
    case 'search/glob':
      return await glob(body.pattern, base, body.ignore || []);
    case 'search/grep':
      return await grep(body.pattern, base, body.include, body.ignore || []);
    case 'exec/start':
      return await startExec(body.command, { infinite: body.infinite, timeout: body.timeout, cwd: base });
    case 'exec/status':
      return await getExecStatus(body.jobId);
    case 'exec/stop':
      return await stopExec(body.jobId);
    case 'exec/bash':
      return await runBash(body.command, { timeout: body.timeout, cwd: base });
    case 'git/status':
      return await getStatus(base);
    case 'git/diff':
      return await getDiff(base, body.path);
    case 'git/commit':
      return await commit(body.message, body.all || false, base);
    case 'git/log':
      return await getLog(body.limit || 10, base);
    case 'lsp/diagnostics':
      return await getDiagnostics(body.filePath, body.content, base);
    case 'lsp/definition':
      return await getDefinition(body.filePath, body.line, body.character, body.content, base);
    case 'lsp/references':
      return await getReferences(body.filePath, body.line, body.character, body.content, base);
    case 'health':
      try {
        await Bun.write(path.join(base, '.health-test'), 'test');
        Bun.spawnSync(['rm', path.join(base, '.health-test')], { cwd: base });
        return { status: 'ok', workspace: { exists: true, writable: true } };
      } catch {
        return { status: 'error', workspace: { exists: false, writable: false } };
      }
    default:
      return { error: 'Unknown type', code: 404 };
  }
}