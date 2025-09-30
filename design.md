# API Proxy for Mounted Codebase Interaction Technical Design Document

## Overview
**Project**: Spar API (Hono/Bun/TypeScript) – a secure API proxy enabling agentic coding tools to interact with codebases mounted directly in `/workspace`.  
**Goal**: Provide a comprehensive API layer that proxies file operations, search, execution, version control, and LSP diagnostics to the mounted `/workspace` directory. This allows agents to analyze, edit, and build code in a sandboxed manner without direct host filesystem access beyond the mount. The API will be distributed as a standalone binary via `bun compile`, running on the host with `/workspace` mounted (e.g., via Docker volume or bind mount). LSP support focuses on diagnostics, definitions, and references for real-time code analysis. Initial focus on TypeScript/JavaScript; extensible to multi-language workflows.  
**Scope**: Embed TypeScript Language Service for LSP; proxy file I/O, shell exec, git, and search via safe abstractions using Bun's APIs. Support stateless requests; avoid WebSockets—use polling for updates (e.g., agents periodically call diagnostics endpoint).  
**Non-Goals**: Container orchestration or inter-container communication (direct mount access only); WebSocket/event bus (polling suffices; future if needed); multi-language LSP beyond TS/JS (phase 2); appending file writes.  
**Assumptions**: `/workspace` is mounted at runtime (e.g., `docker run -v /host/code:/workspace ...`); API binary runs on host or in container with shared mount; Bun loads `.env` for config (e.g., `WORKSPACE_PATH=/workspace`). Agents authenticate via API keys. Binary built with `bun compile --target=bun index.ts --outfile=spar`.  
**Security**: All operations sandboxed to `/workspace`; path validation prevents escapes; exec whitelisting; no direct shell access from agents. Rate-limiting and input sanitization enforced.  

## Architecture
- **Core Components**:
  - **Proxy Layer** (`proxy.ts`): Central handler for all requests, validating inputs, normalizing paths to `/workspace`, and forwarding to specialized modules. Ensures mount isolation via path checks.
  - **LSP Service Layer** (`lsp.ts`): Wraps TypeScript's LanguageService API as an in-process server. Resolves files from `/workspace` mount, supports virtual edits for unsaved changes. Limited to diagnostics, definitions, and references (no completions or hover).
  - **File & Search Proxy** (`fs-proxy.ts`, `search-proxy.ts`): Safe I/O and pattern matching limited to `/workspace`. Uses `Bun.file` for reads/writes; glob/grep via Bun natives or lightweight libs.
  - **Execution Proxy** (`exec-proxy.ts`): Proxies shell commands directly in the host environment (cd to `/workspace` first). Captures stdout/stderr securely using `Bun.spawn`.
  - **Git Proxy** (`git-proxy.ts`): Wraps git commands through exec proxy, parsing outputs to JSON for agent consumption.
  - **API Layer** (Hono routes in `index.ts`): Exposes endpoints with middleware for auth/validation. Returns standardized JSON; errors as `{error: string, code: number}`.
  - **Real-Time Alternative**: No WebSockets; agents poll endpoints (e.g., `/proxy/lsp/diagnostics` for latest errors). Future event bus (e.g., in-memory pub/sub) if polling overhead becomes issue.

- **Data Flow** (General Proxy Pattern):
  1. Agent sends request (e.g., POST `/proxy/files/read` with `{paths: string[]}`).
  2. Proxy Layer: Authenticate; validate/sanitize (each path must resolve to `/workspace/*`); check mount health.
  3. Route to Module: E.g., for file read, use `Bun.file` on mounted paths.
  4. Execute & Respond: Capture results; proxy back as JSON. For LSP, init service with mount's tsconfig/files.
  5. Logging/Monitoring: Audit trail (non-sensitive); metrics on proxy latency.

- **Mount Integration**:
  - **Access**: Direct filesystem ops on `/workspace` mount (no Docker exec needed, as binary runs with mount visible).
  - **Isolation**: Use `path.resolve('/workspace', relPath)` + prefix check; deny `..` traversal. Prefix exec with `cd /workspace &&`.
  - **Health Checks**: `/health` verifies mount writability (e.g., temp file write test).

- **Dependencies**:
  - Existing: `hono@^4.9.9`, `typescript@^5` (peerDep).
  - New: `bun add -d @types/node vscode-languageserver-types` (for LSP types).
  - Runtime: Minimal; Bun builtins for file/exec.

- **Error Handling**:
  - Proxy Errors: 400/403 for invalid requests; 404 for missing files; 502 for mount issues.
  - Module Errors: Wrap in try-catch; return descriptive messages without exposing internals.
  - Async: All handlers async; Hono error responses.
  - Resilience: Retry transient I/O failures; timeout proxies (2s for reads, 30s for exec).

- **Performance/Scalability**:
  - Stateless Proxies: Per-request isolation; no connection pooling needed.
  - Caching: LRU for frequent reads/searches (e.g., file lists); invalidate on writes.
  - Concurrency: Hono scales; queue long-running execs if needed.
  - Binary Distribution: `bun compile` produces self-contained executable; ~10-20MB size.

- **Extensibility**:
  - Multi-Language: Plugin system for LSP (e.g., add Python via pylsp spawn).
  - Event Bus: Future in-memory (e.g., EventEmitter) for pub/sub if polling insufficient.
  - Agent Features: Webhooks for events (e.g., post-write notifications).

## API Endpoints
### LSP Proxy APIs (Code Analysis)
- **POST `/proxy/lsp/diagnostics`**  
  Body: `{filePath: string, content?: string, configPath?: string}`  
  Returns: `{diagnostics: Diagnostic[]}`  
  Description: Proxies TS diagnostics from `/workspace`; supports virtual content. Agents poll for updates.

- **POST `/proxy/lsp/definition`**  
  Body: `{filePath: string, line: number, character: number, content?: string}`  
  Returns: `{locations: Location[]}`  
  Description: Symbol definitions, cross-file in mount.

- **POST `/proxy/lsp/references`**  
  Body: `{filePath: string, line: number, character: number, content?: string}`  
  Returns: `{references: Location[]}`  
  Description: Symbol references across mount codebase.

### File Management Proxy APIs
- **POST `/proxy/files/read`**  
  Body: `{paths: string[]}` (array for one or many files)  
  Returns: `{files: {path: string, content: string, metadata?: {size: number, mtime: Date}}[]}`  
  Description: Reads one or multiple files from `/workspace`; returns array of results (errors per file if missing).

- **POST `/proxy/files/write`**  
  Body: `{path: string, content: string}`  
  Returns: `{success: boolean, message: string}`  
  Description: Writes/overwrites file in `/workspace`.

- **DELETE `/proxy/files/{path:path*}`  
  Returns: `{success: boolean}`  
  Description: Deletes file in `/workspace`.

- **GET `/proxy/dirs/{path:path*}`  
  Query: `?recursive=false&includeFiles=true`  
  Returns: `{files: string[], dirs: string[]}`  
  Description: Lists directory tree in `/workspace`.

### Search Proxy APIs
- **POST `/proxy/search/glob`**  
  Body: `{pattern: string, path?: string, ignore?: string[]}`  
  Returns: `{matches: string[]}`  
  Description: Glob search in `/workspace` filesystem (POST for complex patterns).

- **POST `/proxy/search/grep`**  
  Body: `{pattern: string, path?: string, include?: string, ignore?: string[]}`  
  Returns: `{matches: {file: string, lines: {line: number, content: string}[] }[]}`  
  Description: Regex content search, respecting `/workspace` files (POST for complex patterns).

### Execution Proxy APIs
- **POST `/proxy/exec/start`**  
  Body: `{command: string, infinite?: boolean, timeout?: number (ms)}`  
  Returns: `{jobId: string}`  
  Description: Starts background exec (infinite for dev servers like 'pnpm run dev'); poll /exec/{jobId}/status for output.

- **GET `/proxy/exec/{jobId}/status`**  
  Returns: `{status: 'running' | 'complete' | 'failed', stdout?: string, stderr?: string, exitCode?: number, duration?: number, error?: string}`  
  Description: Polls status and partial/full output (buffer capped at 1MB for continuous).

- **POST `/proxy/exec/{jobId}/stop`**  
  Body: `{}`  
  Returns: `{success: boolean, message?: string}`  
  Description: Stops a running background job (e.g., dev server).

- **POST `/proxy/exec/bash`**  
  Body: `{command: string, timeout?: number (ms), cwd?: string}`  
  Returns: `{stdout: string, stderr: string, exitCode: number, duration: number}`  
  Description: Legacy blocking exec for short commands.

### Git Proxy APIs
- **GET `/proxy/git/status`**  
  Returns: `{staged: FileStatus[], unstaged: FileStatus[], untracked: string[]}`  
  Description: Git status from `/workspace` repo.

- **POST `/proxy/git/diff`**  
  Body: `{path?: string}`  
  Returns: `{diff: string, files: {file: string, changes: string}[]}`  
  Description: Diff changes in `/workspace`.

- **POST `/proxy/git/commit`**  
  Body: `{message: string, all?: boolean}`  
  Returns: `{commitHash: string, success: boolean}`  
  Description: Commits changes in `/workspace` (no push).

- **GET `/proxy/git/log`**  
  Query: `?limit=10&since=main`  
  Returns: `{commits: {hash: string, message: string, author: string, date: Date}[]}`  
  Description: Commit history from `/workspace`.

### Utility Proxy APIs
- **GET `/proxy/health`**  
  Returns: `{status: 'ok', workspace: {exists: boolean, writable: boolean}}`  
  Description: Checks API and mount health.

All endpoints under `/proxy/` namespace for clarity. Enforce auth, rate-limits (100/min), and mount-specific timeouts.

## Implementation Details
- **File Structure**:
  - `src/proxy.ts`: Core validation/dispatch; mount health checks.
  - `src/lsp.ts`: TS service host for mount files (diagnostics/definition/references only).
  - `src/fs-proxy.ts`: File ops with mount-aware I/O (batch read support).
  - `src/search-proxy.ts`: Glob/grep via Bun or exec.
  - `src/exec-proxy.ts`: Command spawning with `/workspace` cwd.
  - `src/git-proxy.ts`: Git wrappers over exec-proxy.
  - `index.ts`: Hono app with `/proxy/*` routes and middleware.
  - `config.ts`: Load `.env` for mount details.
  - Update `tsconfig.json`: Add `"types": ["node"]`.
  - Binary: Add script `build-binary: bun compile --target=bun index.ts --outfile=dist/spar`.

- **Key Proxy Mechanisms**:
  - Path Normalization: `import path from 'path'; const safePath = path.resolve('/workspace', relPath); if (!safePath.startsWith('/workspace')) throw Error;`
  - Batch Read: Loop over paths array; collect results/errors.
  - Exec: `Bun.spawn(['bash', '-c', `cd /workspace && ${command}`], {stdout: 'pipe', stderr: 'pipe'});`
  - LSP Host: Read from mount; virtual snapshots for edits.

- **Edge Cases**:
  - Mount Unavailable: 503 responses.
  - Large Batch Reads: Limit array size (e.g., 50 paths); stream if needed.
  - Non-Git Workspaces: Graceful fallback in git APIs.
  - Polling Overhead: Document agent should cache and poll sparingly (e.g., after writes).

- **Build/Deployment**:
  - Dev: `bun --hot index.ts`; test with mounted `/workspace`.
  - Binary: `bun compile index.ts --outfile=spar --target=bun`; distribute executable.
  - Prod: Run `./spar` with mount (e.g., in Docker: `docker run -v /code:/workspace ./spar`).
  - Monitoring: Log proxy calls; expose `/metrics`.

## Risks & Mitigations
- **Mount Dependencies**: Test with various mounts (bind, volume); fallback if unwritable.
- **Security**: Path traversal (resolve + check); exec injection (args array, no shell strings).
- **Performance**: Batch ops efficient; cache for lists.
- **Complexity**: Simplified APIs (~300 LOC total); TDD for reliability.

## TDD Plan
Strict TDD with `bun test`. Mock mount (temp dirs).

1. **Setup**: `tests/setup.ts` – Create mock `/workspace` with temp files.

2. **Sequence** (Red-Green-Refactor):
   - **Proxy Core**: Test validation (good/bad paths); dispatch.
   - **FS**: Batch read (single/multi); write (overwrite); list.
   - **LSP**: Diagnostics/definition/references on mock TS files.
   - **Search/Exec/Git**: Glob matches; bash echo; git status parse.
   - **API E2E**: Hono helpers; request-response (e.g., batch read).
   - **Health**: Mount checks.

3. **Coverage**: 90%+; single tests via `bun test file:testName`.
   - Verification: `bun test`; manual curls on mounted workspace.

Estimated: 4-6 hours. Post-TDD, implement iteratively.