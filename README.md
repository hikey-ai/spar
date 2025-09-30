# Spar API Proxy

Spar is a lightweight, secure API proxy for agentic coding tools. It provides sandboxed access to a mounted codebase (/workspace) for file operations, search, exec, git, and LSP diagnostics. Built with Hono (TypeScript) on Bun for fast, low-memory performance. Binary distribution for easy deployment.

## Quick Start

1. **Install Dependencies**:
   ```
   bun install
   ```

2. **Run Development Server**:
   ```
   bun --hot index.ts
   ```
   - Defaults to http://localhost:3000.
   - Set PORT env: `PORT=8080 bun --hot index.ts`.

3. **Build Production Binary**:
   ```
   bun build index.ts --outdir dist --target bun --outfile spar
   ```
   - Run: `./dist/spar` (or `PORT=8080 ./dist/spar`).
   - Mount codebase: e.g., Docker `docker run -v /path/to/code:/workspace -e API_KEY=yourkey spar`.

4. **Environment Variables**:
   - `API_KEY`: Required for auth (Bearer token on /proxy/* routes).
   - `PORT`: Server port (default 3000).
   - `WORKSPACE_PATH`: Override /workspace mount (default /workspace).

5. **Authentication**:
   - All /proxy/* endpoints require `Authorization: Bearer <API_KEY>` header.
   - Set API_KEY env before running.

## Endpoints Overview

See [openapi.yaml](openapi.yaml) for full spec (use openapi-generator for clients). OpenAPI doc at /openapi.json.

- **Health**: GET /proxy/health → {status: 'ok', workspace: {exists, writable}}.
- **Files**:
  - POST /proxy/files/read {paths: string[]} → {files: [{path, content, error?}]} (batch read).
  - POST /proxy/files/write {path: string, content: string} → {success: bool}.
  - DELETE /proxy/files/{path} → {success: bool}.
  - GET /proxy/dirs/{path}?recursive=false → {files: string[], dirs: string[]}.
- **Search** (POST with JSON body):
  - /proxy/search/glob {pattern: string, path?: string, ignore?: string[]} → {matches: string[]}.
  - /proxy/search/grep {pattern: string, path?: string, include?: string, ignore?: string[]} → {matches: [{file, lines: [{line: number, content}]}]}.
- **Exec** (for shell commands like pnpm install/build):
  - POST /proxy/exec/start {command: string, infinite?: bool, timeout?: number} → {jobId: string} (background; infinite for continuous like 'pnpm run dev').
  - GET /proxy/exec/{jobId}/status → {status: 'running'|'complete'|'failed', stdout?: string, stderr?: string, exitCode?, duration?, error?} (poll for output).
  - POST /proxy/exec/{jobId}/stop → {success: bool} (kill job).
  - POST /proxy/exec/bash {command: string, timeout?: number} → {stdout, stderr, exitCode, duration} (legacy blocking for short commands).
- **Git**:
  - GET /proxy/git/status → {staged: [{path, status}], unstaged: [...], untracked: string[]}.
  - POST /proxy/git/diff {path?: string} → {diff: string, files: [{file, changes}]}.
  - POST /proxy/git/commit {message: string, all?: bool} → {commitHash: string, success: bool}.
  - GET /proxy/git/log?limit=10 → {commits: [{hash, message, author, date}]}.
- **LSP (TypeScript/JavaScript)**:
  - POST /proxy/lsp/diagnostics {filePath: string, content?: string} → {diagnostics: [{severity, message, range, code}]}.
  - POST /proxy/lsp/definition {filePath: string, line: number, character: number, content?: string} → {locations: [{uri, range}]}.
  - POST /proxy/lsp/references {filePath: string, line: number, character: number, content?: string} → {references: [{uri, range}]}.
- **Events**: GET /proxy/events?since=<timestamp> → {changes: [{path: string, type: 'added'|'changed'|'deleted', timestamp: number}]} (file watcher, ignores node_modules/dist/.git/dotfiles).

## Agent Integration Example (Python)

Use `requests` library with auth. Example for file read and exec start:

```python
import requests
import time
import os

BASE_URL = "http://localhost:3000"
API_KEY = os.getenv("API_KEY")
headers = {"Authorization": f"Bearer {API_KEY}"}

# Read file
response = requests.post(f"{BASE_URL}/proxy/files/read", json={"paths": ["src/app.ts"]}, headers=headers)
if response.status_code == 200:
    files = response.json()["files"]
    print(files[0]["content"])

# Start long-running exec (e.g., pnpm run dev)
start_resp = requests.post(f"{BASE_URL}/proxy/exec/start", json={"command": "pnpm run dev", "infinite": True}, headers=headers)
job_id = start_resp.json()["jobId"]

# Poll status/output
while True:
    status_resp = requests.get(f"{BASE_URL}/proxy/exec/{job_id}/status", headers=headers)
    status = status_resp.json()
    print(f"Status: {status['status']}, Output: {status.get('stdout', '')[-100:]}...")  # Last 100 chars
    if status['status'] == 'complete':
        break
    time.sleep(1)

# Stop if needed
requests.post(f"{BASE_URL}/proxy/exec/{job_id}/stop", headers=headers)
```

## Development & Testing

- **Typecheck**: `bun tsc --noEmit`.
- **Test**: `bun test` (16 tests, 100% pass).
- **Build**: `bun build index.ts --outdir dist --target bun --outfile spar`.
- **Coverage**: `bun test --coverage` (aim >90%).
- **Deploy**: Docker example in AGENTS.md.

See [design.md](design.md) for architecture and [openapi.yaml](openapi.yaml) for spec. OpenAPI doc at /openapi.json.