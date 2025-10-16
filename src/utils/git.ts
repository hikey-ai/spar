import { runCommand } from './command.js'

const DEFAULT_GIT_NAME = process.env.GIT_DEFAULT_NAME || 'Spar Agent'
const DEFAULT_GIT_EMAIL = process.env.GIT_DEFAULT_EMAIL || 'spar@example.com'

export async function configureGitIdentity(
  workspacePath: string,
  identity?: { name?: string; email?: string }
) {
  const name = identity?.name || DEFAULT_GIT_NAME
  const email = identity?.email || DEFAULT_GIT_EMAIL
  await runOrThrow('git', ['config', 'user.name', name], { cwd: workspacePath })
  await runOrThrow('git', ['config', 'user.email', email], { cwd: workspacePath })
}

async function runOrThrow(
  command: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string> } = {}
) {
  const result = await runCommand(command, args, options)
  if (result.exitCode !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed (exit ${result.exitCode}): ${
        result.stderr || result.stdout
      }`
    )
  }
  return result
}
