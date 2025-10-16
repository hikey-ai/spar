import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { handleRequest } from './src/proxy.js'
import { handleBootstrap, type BootstrapRequest } from './src/bootstrap.js'
import { finalizeWorkspace, type FinalizeRequest } from './src/finalize.js'
import { startWatcher, getRecentChanges } from './src/watcher.js'
import type { ApiTypes } from './src/types'

const app = new Hono()

// Auth middleware (applied to /proxy/*)
const authMiddleware = async (c: Context, next: Next) => {
  const auth = c.req.header('Authorization')
  if (auth !== `Bearer ${process.env.API_KEY}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}

// Apply auth to all /proxy routes
app.use('/proxy/*', authMiddleware)
app.use('/internal/*', authMiddleware)

// Serve OpenAPI spec
app.get('/openapi.json', async (c: Context) => {
  const yaml = await Bun.file('./openapi.yaml').text();
  const spec = JSON.parse(yaml);
  return c.json(spec, 200, { 'Content-Type': 'application/json' });
})

app.get('/', (c: Context) => c.text('Spar API Proxy'))

app.post('/internal/bootstrap', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  try {
    const body = await c.req.json<BootstrapRequest>()
    if (!body.mode) {
      return c.json({ error: 'mode is required' }, 400)
    }
    const result = await handleBootstrap(base, body)
    return c.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bootstrap failed'
    return c.json({ error: message }, 500)
  }
})

app.post('/internal/finalize', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  try {
    const body = await c.req.json<
      FinalizeRequest & { runId?: string }
    >()
    if (!body.runId) {
      return c.json({ error: 'runId is required' }, 400)
    }

    const result = await finalizeWorkspace(base, body.runId, body)
    return c.json({
      hasChanges: result.hasChanges,
      commitHash: result.commitHash,
      runId: body.runId,
      tarPath: result.tarPath
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Finalize failed'
    return c.json({ error: message }, 500)
  }
})

app.get('/proxy/health', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const result = await handleRequest('health', {}, base)
  return c.json(result)
})

app.post('/proxy/files/read', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['FilesReadBody']>()
  const result = await handleRequest('files/read', body, base)
  return c.json(result)
})

app.post('/proxy/files/write', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['FilesWriteBody']>()
  const result = await handleRequest('files/write', body, base)
  return c.json(result)
})

app.delete('/proxy/files/:path*', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const pathParam = c.req.param('path') || ''
  const result = await handleRequest('files/delete', { path: pathParam }, base)
  return c.json(result)
})

app.get('/proxy/dirs/:path*', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const pathParam = c.req.param('path') || '.'
  const query = c.req.query()
  const ignore = query.ignore ? query.ignore.split(',') : []
  const result = await handleRequest('dirs/list', { path: pathParam, options: { recursive: query.recursive === 'true', includeFiles: query.includeFiles !== 'false', ignore } }, base)
  return c.json(result)
})

app.post('/proxy/search/glob', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['SearchGlobBody']>()
  const ignore = body.ignore || []
  const result = await handleRequest('search/glob', { pattern: body.pattern, path: body.path || base, ignore }, base)
  return c.json(result)
})

app.post('/proxy/search/grep', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['SearchGrepBody']>()
  const ignore = body.ignore || []
  const options = {
    caseSensitive: body.caseSensitive,
    matchString: body.matchString,
    contextLines: body.contextLines,
    maxResults: body.maxResults,
  }
  const result = await handleRequest('search/grep', { pattern: body.pattern, path: body.path || base, include: body.include, ignore, options }, base)
  return c.json(result)
})

app.post('/proxy/exec/start', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['ExecStartBody']>()
  const result = await handleRequest('exec/start', { ...body, infinite: body.infinite ?? false }, base)
  return c.json(result)
})

app.get('/proxy/exec/:jobId/status', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const jobId = c.req.param('jobId')
  const result = await handleRequest('exec/status', { jobId }, base)
  return c.json(result)
})

app.post('/proxy/exec/:jobId/stop', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const jobId = c.req.param('jobId')
  const result = await handleRequest('exec/stop', { jobId }, base)
  return c.json(result)
})

app.post('/proxy/exec/bash', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['ExecBashBody']>()
  const result = await handleRequest('exec/bash', body, base)
  return c.json(result)
})

app.get('/proxy/git/status', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const result = await handleRequest('git/status', {}, base)
  return c.json(result)
})

app.post('/proxy/git/diff', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['GitDiffBody']>()
  const result = await handleRequest('git/diff', body, base)
  return c.json(result)
})

app.post('/proxy/git/commit', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['GitCommitBody']>()
  const result = await handleRequest('git/commit', body, base)
  return c.json(result)
})

app.get('/proxy/git/log', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const query = c.req.query() || {}
  const limit = parseInt(query.limit || '10')
  const result = await handleRequest('git/log', { limit }, base)
  return c.json(result)
})

app.post('/proxy/lsp/diagnostics', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['LspDiagnosticsBody']>()
  const result = await handleRequest('lsp/diagnostics', body, base)
  return c.json(result)
})

app.post('/proxy/lsp/definition', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['LspDefinitionBody']>()
  const result = await handleRequest('lsp/definition', body, base)
  return c.json(result)
})

app.post('/proxy/lsp/references', async (c: Context) => {
  const base = process.env.WORKSPACE_PATH || '/workspace'
  const body = await c.req.json<ApiTypes['LspReferencesBody']>()
  const result = await handleRequest('lsp/references', body, base)
  return c.json(result)
})

app.get('/proxy/events', async (c: Context) => {
  const query = c.req.query()
  const since = parseInt(query.since || '0')
  const changes = getRecentChanges(since)
  return c.json({ changes })
})

const base = process.env.WORKSPACE_PATH || '/workspace'
startWatcher(base)

const port = parseInt(process.env.INTERNAL_PORT || '3000')
Bun.serve({
  fetch: app.fetch,
  port,
})

console.log(`Spar API Proxy running on http://localhost:${port}`)

export { app }
