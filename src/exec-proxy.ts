import { v4 as uuidv4 } from 'uuid';

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  duration: number;
}

export interface JobStatus {
  status: 'running' | 'complete' | 'failed';
  exitCode?: number;
  duration?: number;
  error?: string;
  stdout?: string;
  stderr?: string;
}

interface Job {
  id: string;
  command: string;
  options: { timeout?: number; cwd?: string };
  proc: any;
  stdout: string;
  stderr: string;
  startTime: number;
  endTime?: number;
  exitCode?: number;
}

const jobs = new Map<string, Job>();
let runningJobs = 0;
const MAX_CONCURRENT = 5;

function createJob(command: string, options: { timeout?: number; cwd?: string } = {}): Job {
  const id = uuidv4();
  const startTime = Date.now();
  const job: Job = {
    id,
    command,
    options,
    proc: null,
    stdout: '',
    stderr: '',
    startTime,
  };
  jobs.set(id, job);
  return job;
}

function cleanupJob(id: string): void {
  jobs.delete(id);
}

export async function startExec(command: string, options: { infinite?: boolean; timeout?: number; cwd?: string } = {}): Promise<{ jobId: string }> {
  if (runningJobs >= MAX_CONCURRENT) {
    throw new Error('Max concurrent jobs reached');
  }

  const job = createJob(command, options);
  runningJobs++;

  const timeout = options.infinite ? undefined : (options.timeout || 120000);

  try {
    const proc = Bun.spawn(['bash', '-c', command], {
      cwd: options.cwd || '/workspace',
      stdout: 'pipe',
      stderr: 'pipe',
      timeout,
    });

    job.proc = proc;

    // Read stdout stream
    const stdoutStream = proc.stdout.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await stdoutStream.read();
          if (done) break;
          job.stdout += new TextDecoder().decode(value);
          if (job.stdout.length > 1048576) { // 1MB cap
            job.stdout = job.stdout.slice(-524288); // Keep last 512KB
          }
        }
      } catch (e) {
        job.stderr += (e as Error).message;
      }
    })();

    // Read stderr stream
    const stderrStream = proc.stderr.getReader();
    (async () => {
      try {
        while (true) {
          const { done, value } = await stderrStream.read();
          if (done) break;
          job.stderr += new TextDecoder().decode(value);
          if (job.stderr.length > 1048576) { // 1MB cap
            job.stderr = job.stderr.slice(-524288);
          }
        }
      } catch (e) {
        job.stderr += (e as Error).message;
      }
    })();

    proc.exited.then((exitCode) => {
      job.exitCode = exitCode;
      job.endTime = Date.now();
      job.proc = null;
      runningJobs--;
    }).catch((error) => {
      job.exitCode = 1;
      job.stderr += (error as Error).message;
      job.endTime = Date.now();
      job.proc = null;
      runningJobs--;
    });

    return { jobId: job.id };
  } catch (error) {
    runningJobs--;
    cleanupJob(job.id);
    throw error;
  }
}

export async function stopExec(jobId: string): Promise<{ success: boolean; message?: string }> {
  const job = jobs.get(jobId);
  if (!job || !job.proc) {
    return { success: false, message: 'Job not found or already finished' };
  }

  try {
    job.proc.kill();
    return { success: true };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}

export async function getExecStatus(jobId: string): Promise<JobStatus> {
  const job = jobs.get(jobId);
  if (!job) {
    return { status: 'failed', error: 'Job not found' };
  }

  if (!job.endTime) {
    return { status: 'running', duration: Date.now() - job.startTime, stdout: job.stdout, stderr: job.stderr };
  }

  const duration = job.endTime - job.startTime;
  return { status: 'complete', exitCode: job.exitCode ?? 0, duration, stdout: job.stdout, stderr: job.stderr };
}

export async function runBash(command: string, options: { timeout?: number; cwd?: string } = {}): Promise<ExecResult> {
  // Legacy blocking method
  const job = createJob(command, options);
  const proc = Bun.spawn(['bash', '-c', command], {
    cwd: options.cwd || '/workspace',
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: options.timeout || 120000,
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  const duration = Date.now() - job.startTime;

  cleanupJob(job.id);

  return { stdout, stderr, exitCode: exitCode || 0, duration };
}

// Cleanup old jobs
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (job.endTime && now - job.endTime > 3600000) { // 1h for completed jobs
      cleanupJob(id);
    }
  }
}, 60000);