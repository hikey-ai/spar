import { z } from 'zod';
import { createRouteConfig } from '@hono/zod-openapi';

export const FilesReadBody = z.object({
  paths: z.array(z.string()),
});

export const FilesWriteBody = z.object({
  path: z.string(),
  content: z.string(),
});

export const SearchGlobBody = z.object({
  pattern: z.string(),
  path: z.string().optional(),
  ignore: z.array(z.string()).optional(),
});

export const SearchGrepBody = z.object({
  pattern: z.string(),
  path: z.string().optional(),
  include: z.string().optional(),
  ignore: z.array(z.string()).optional(),
});

export const ExecStartBody = z.object({
  command: z.string(),
  infinite: z.boolean().optional(),
  timeout: z.number().optional(),
});

export const GitDiffBody = z.object({
  path: z.string().optional(),
});

export const GitCommitBody = z.object({
  message: z.string(),
  all: z.boolean().optional(),
});

export const LspDiagnosticsBody = z.object({
  filePath: z.string(),
  content: z.string().optional(),
  configPath: z.string().optional(),
});

export const LspDefinitionBody = z.object({
  filePath: z.string(),
  line: z.number(),
  character: z.number(),
  content: z.string().optional(),
});

export const LspReferencesBody = z.object({
  filePath: z.string(),
  line: z.number(),
  character: z.number(),
  content: z.string().optional(),
});

// Route configs for OpenAPI
export const HealthGet = createRouteConfig({
  method: 'get',
  path: '/proxy/health',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            workspace: z.object({
              exists: z.boolean(),
              writable: z.boolean(),
            }),
          }),
        },
      },
    },
  },
});

export const FilesReadPost = createRouteConfig({
  method: 'post',
  path: '/proxy/files/read',
  request: {
    body: {
      content: {
        'application/json': {
          schema: FilesReadBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            files: z.array(
              z.object({
                path: z.string(),
                content: z.string().optional(),
                error: z.string().optional(),
              })
            ),
          }),
        },
      },
    },
  },
});

export const FilesWritePost = createRouteConfig({
  method: 'post',
  path: '/proxy/files/write',
  request: {
    body: {
      content: {
        'application/json': {
          schema: FilesWriteBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string().optional(),
          }),
        },
      },
    },
  },
});

export const FilesDeleteDelete = createRouteConfig({
  method: 'delete',
  path: '/proxy/files/{path}',
  parameters: [
    {
      name: 'path',
      in: 'path',
      schema: z.string(),
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string().optional(),
          }),
        },
      },
    },
  },
});

export const DirsListGet = createRouteConfig({
  method: 'get',
  path: '/proxy/dirs/{path}',
  parameters: [
    {
      name: 'path',
      in: 'path',
      schema: z.string(),
    },
    {
      name: 'recursive',
      in: 'query',
      schema: z.boolean().default(false),
    },
    {
      name: 'includeFiles',
      in: 'query',
      schema: z.boolean().default(true),
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            files: z.array(z.string()),
            dirs: z.array(z.string()),
          }),
        },
      },
    },
  },
});

export const SearchGlobPost = createRouteConfig({
  method: 'post',
  path: '/proxy/search/glob',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SearchGlobBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            matches: z.array(z.string()),
          }),
        },
      },
    },
  },
});

export const SearchGrepPost = createRouteConfig({
  method: 'post',
  path: '/proxy/search/grep',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SearchGrepBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            matches: z.array(
              z.object({
                file: z.string(),
                lines: z.array(
                  z.object({
                    line: z.number(),
                    content: z.string(),
                  })
                ),
              })
            ),
          }),
        },
      },
    },
  },
});

export const ExecStartPost = createRouteConfig({
  method: 'post',
  path: '/proxy/exec/start',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ExecStartBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            jobId: z.string(),
          }),
        },
      },
    },
  },
});

export const ExecStatusGet = createRouteConfig({
  method: 'get',
  path: '/proxy/exec/{jobId}/status',
  parameters: [
    {
      name: 'jobId',
      in: 'path',
      schema: z.string(),
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            status: z.enum(['running', 'complete', 'failed']),
            stdout: z.string().optional(),
            stderr: z.string().optional(),
            exitCode: z.number().optional(),
            duration: z.number().optional(),
            error: z.string().optional(),
          }),
        },
      },
    },
  },
});

export const ExecStopPost = createRouteConfig({
  method: 'post',
  path: '/proxy/exec/{jobId}/stop',
  parameters: [
    {
      name: 'jobId',
      in: 'path',
      schema: z.string(),
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string().optional(),
          }),
        },
      },
    },
  },
});

export const GitStatusGet = createRouteConfig({
  method: 'get',
  path: '/proxy/git/status',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            staged: z.array(
              z.object({
                path: z.string(),
                status: z.string(),
              })
            ),
            unstaged: z.array(
              z.object({
                path: z.string(),
                status: z.string(),
              })
            ),
            untracked: z.array(z.string()),
          }),
        },
      },
    },
  },
});

export const GitDiffPost = createRouteConfig({
  method: 'post',
  path: '/proxy/git/diff',
  request: {
    body: {
      content: {
        'application/json': {
          schema: GitDiffBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            diff: z.string(),
            files: z.array(
              z.object({
                file: z.string(),
                changes: z.string(),
              })
            ),
          }),
        },
      },
    },
  },
});

export const GitCommitPost = createRouteConfig({
  method: 'post',
  path: '/proxy/git/commit',
  request: {
    body: {
      content: {
        'application/json': {
          schema: GitCommitBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            commitHash: z.string(),
            success: z.boolean(),
          }),
        },
      },
    },
  },
});

export const GitLogGet = createRouteConfig({
  method: 'get',
  path: '/proxy/git/log',
  parameters: [
    {
      name: 'limit',
      in: 'query',
      schema: z.number().default(10),
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            commits: z.array(
              z.object({
                hash: z.string(),
                message: z.string(),
                author: z.string(),
                date: z.string(),
              })
            ),
          }),
        },
      },
    },
  },
});

export const LspDiagnosticsPost = createRouteConfig({
  method: 'post',
  path: '/proxy/lsp/diagnostics',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LspDiagnosticsBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            diagnostics: z.array(
              z.object({
                severity: z.string(),
                message: z.string(),
                range: z.object({
                  start: z.object({
                    line: z.number(),
                    character: z.number(),
                  }),
                  end: z.object({
                    line: z.number(),
                    character: z.number(),
                  }),
                }),
                code: z.string().optional(),
              })
            ),
          }),
        },
      },
    },
  },
});

export const LspDefinitionPost = createRouteConfig({
  method: 'post',
  path: '/proxy/lsp/definition',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LspDefinitionBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            locations: z.array(
              z.object({
                uri: z.string(),
                range: z.object({
                  start: z.object({
                    line: z.number(),
                    character: z.number(),
                  }),
                  end: z.object({
                    line: z.number(),
                    character: z.number(),
                  }),
                }),
              })
            ),
          }),
        },
      },
    },
  },
});

export const LspReferencesPost = createRouteConfig({
  method: 'post',
  path: '/proxy/lsp/references',
  request: {
    body: {
      content: {
        'application/json': {
          schema: LspReferencesBody,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            references: z.array(
              z.object({
                uri: z.string(),
                range: z.object({
                  start: z.object({
                    line: z.number(),
                    character: z.number(),
                  }),
                  end: z.object({
                    line: z.number(),
                    character: z.number(),
                  }),
                }),
              })
            ),
          }),
        },
      },
    },
  },
});

export const EventsGet = createRouteConfig({
  method: 'get',
  path: '/proxy/events',
  parameters: [
    {
      name: 'since',
      in: 'query',
      schema: z.number().optional(),
    },
  ],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            changes: z.array(
              z.object({
                path: z.string(),
                type: z.enum(['added', 'changed', 'deleted']),
                timestamp: z.number(),
              })
            ),
          }),
        },
      },
    },
  },
});