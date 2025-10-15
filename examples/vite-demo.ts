/**
 * Demo script that provisions a Vite React app inside a running Spar container
 * using the Spar HTTP API. Requires a Spar instance listening on SPAR_URL
 * (default http://localhost:3000) with API_KEY matching SPAR_API_KEY.
 *
 * Run with: SPAR_API_KEY=demo bun run examples/vite-demo.ts
 */

const BASE_URL = process.env.SPAR_URL ?? "http://localhost:3000";
const API_KEY = process.env.SPAR_API_KEY ?? "demo-token";

const authHeaders = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

async function post<T = unknown>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request to ${path} failed with ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

async function get<T = unknown>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Request to ${path} failed with ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

type ExecResponse = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

async function runBash(command: string): Promise<ExecResponse> {
  console.log(`\n$ ${command}`);
  const result = await post<ExecResponse>("/proxy/exec/bash", { command });
  if (result.exitCode !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`Command "${command}" failed with exit code ${result.exitCode}`);
  }
  if (result.stdout.trim().length > 0) {
    console.log(result.stdout.trim());
  }
  if (result.stderr.trim().length > 0) {
    console.warn(result.stderr.trim());
  }
  return result;
}

async function main() {
  console.log(`Using Spar at ${BASE_URL}`);

  const health = await get<{ status: string; workspace: { writable: boolean } }>("/proxy/health");
  if (health.status !== "ok" || !health.workspace.writable) {
    throw new Error("Workspace is not writable. Mount a volume to /workspace before running the demo.");
  }

  // Clean up any previous run
  // await runBash("rm -rf demo-vite");

  // // Create project
  // await runBash("CI=1 pnpm create vite@latest demo-vite -- --template react");

  // // Install dependencies
  // await runBash("cd demo-vite && pnpm install");

  // // Build project
  // await runBash("cd demo-vite && pnpm build");

  const pkg = await post<{ files: { path: string; content: string }[] }>("/proxy/files/read", {
    paths: ["demo-vite/package.json"],
  });
  const distListing = await runBash("cd demo-vite && ls -1 dist");
  const distFiles = distListing.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  console.log("\nCreated Vite app package.json:");
  console.log(pkg.files[0]?.content ?? "package.json not found");

  console.log("\nBuild artifacts in dist/:");
  if (distFiles.length === 0) {
    console.log("  (no files generated)");
  } else {
    distFiles.forEach((file) => console.log(`  - ${file}`));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
