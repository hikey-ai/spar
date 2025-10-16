import { test, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { finalizeWorkspace } from '../src/finalize.js'

function createTempDir(prefix: string) {
  return mkdtempSync(path.join(tmpdir(), prefix))
}

function runOrThrow(command: string, args: string[], cwd?: string) {
  const res = Bun.spawnSync([command, ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = new TextDecoder().decode(res.stdout)
  const stderr = new TextDecoder().decode(res.stderr)
  if ((res.exitCode ?? 0) !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${stderr || stdout}`)
  }
  return { stdout, stderr }
}

let workspace: string

beforeEach(() => {
  workspace = createTempDir('spar-finalize-')
  runOrThrow('git', ['init'], workspace)
  runOrThrow('git', ['config', 'user.email', 'test@example.com'], workspace)
  runOrThrow('git', ['config', 'user.name', 'Test User'], workspace)
  writeFileSync(path.join(workspace, 'README.md'), '# Test\n')
  runOrThrow('git', ['add', '-A'], workspace)
  runOrThrow('git', ['commit', '-m', 'Initial'], workspace)
})

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true })
})

test('finalize returns no-op when no changes', async () => {
  const result = await finalizeWorkspace(workspace, 'run-1')
  expect(result.hasChanges).toBeFalse()
  expect(result.commitHash).toBeUndefined()
  expect(result.tarPath).toBeUndefined()
})

test('finalize commits and tars when changes exist', async () => {
  writeFileSync(path.join(workspace, 'src.ts'), 'export const x = 1;\n')
  const result = await finalizeWorkspace(workspace, 'run-2', {
    commitMessage: 'Add src',
  })
  expect(result.hasChanges).toBeTrue()
  expect(result.commitHash).toBeDefined()
  expect(result.tarPath).toBeDefined()
})

// No longer bundling dist assets in Spar finalize; assets handled by LangGraph
