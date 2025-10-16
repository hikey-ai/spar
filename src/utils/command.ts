export type CommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export type CommandOptions = {
  cwd?: string;
  env?: Record<string, string>;
};

export async function runCommand(
  command: string,
  args: string[],
  options: CommandOptions = {},
): Promise<CommandResult> {
  const proc = Bun.spawn([command, ...args], {
    cwd: options.cwd,
    env: options.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { stdout, stderr, exitCode };
}
