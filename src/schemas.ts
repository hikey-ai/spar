import { z } from 'zod';

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