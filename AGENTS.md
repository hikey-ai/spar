# AGENTS.md

## Build/Lint/Test Commands
- Install dependencies: `bun install`
- Run development server: `bun --hot index.ts` (uses Hono for routing, port via PORT env)
- Test all: `bun test` (Bun's built-in test runner)
- Run single test: `bun test path/to/specific.test.ts`
- Build for production: `bun build index.ts --outdir dist --target bun --outfile spar` (run `./dist/spar`, port via PORT env)
- Typecheck: `bun tsc --noEmit` (uses TypeScript from peerDeps)
- Lint: No ESLint/Prettier config; rely on TS strict mode and editor formatting

## API Usage
- Auth: Set API_KEY env var; all /proxy/* routes require Authorization: Bearer <key> header (401 otherwise).
- File Operations: POST /proxy/files/read {paths: string[]} for batch read; POST /proxy/files/write {path: string, content: string} for overwrite; DELETE /proxy/files/{path} for delete; GET /proxy/dirs/{path}?recursive=false&includeFiles=true for listing.
- Search: POST /proxy/search/glob {pattern: string, path?: string, ignore?: string[]} for file patterns; POST /proxy/search/grep {pattern: string, path?: string, include?: string, ignore?: string[]} for content search (JSON body for complex params).
- Exec: POST /proxy/exec/start {command: string, infinite?: bool, timeout?: number} for background (e.g., 'pnpm run dev'); GET /proxy/exec/{jobId}/status for polling output/status; POST /proxy/exec/{jobId}/stop to kill. Legacy POST /proxy/exec/bash for short blocking commands.
- Git: GET /proxy/git/status; POST /proxy/git/diff {path?: string}; POST /proxy/git/commit {message: string, all?: bool}; GET /proxy/git/log?limit=10.
- LSP (TS/JS): POST /proxy/lsp/diagnostics {filePath: string, content?: string} for errors; POST /proxy/lsp/definition {filePath, line, character, content?} for definitions; POST /proxy/lsp/references {filePath, line, character, content?} for references.
- Events: GET /proxy/events?since=<timestamp> for recent file changes (watcher ignores node_modules/dist/.git/dotfiles).
- Strong Types: All endpoints use typed JSON bodies (see src/types.ts; generate clients from /openapi.json).
- Port: Default 3000; set PORT env for custom (e.g., PORT=8080 ./dist/spar).
- OpenAPI: GET /openapi.json for spec; use openapi-generator for typed clients.

## Code Style Guidelines
- Language: TypeScript (strict mode enabled in tsconfig.json)
- Target: ESNext, module resolution: bundler
- Naming: camelCase for variables/functions, PascalCase for classes/components
- Imports: Prefer named imports; use relative paths; avoid default unless necessary
- Formatting: Use editor defaults (no Prettier); 2-space indent, single quotes
- Types: Always infer or explicit; no implicit any
- Error Handling: Use try-catch for async; return Hono errors (c.json({error}, 400))
- Conventions: Follow Bun APIs (Bun.serve over Express, bun:sqlite, etc.)
- JSX: react-jsx mode; support React if used
- Security: Never log/expose secrets; validate inputs

## Periodically commit your changes locally when you think you have implemented changes asked by user.