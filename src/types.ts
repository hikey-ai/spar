export interface ApiTypes {
  // File Management
  FilesReadBody: {
    paths: string[];
  };
  FilesWriteBody: {
    path: string;
    content: string;
  };
  FilesDeleteBody: {
    path: string;
  };
  DirsListBody: {
    path?: string;
    options?: {
      recursive?: boolean;
      includeFiles?: boolean;
    };
  };

  // Search
  SearchGlobBody: {
    pattern: string;
    path?: string;
    ignore?: string[];
  };
  SearchGrepBody: {
    pattern: string;
    path?: string;
    include?: string;
    ignore?: string[];
    caseSensitive?: boolean;
    matchString?: boolean;
    contextLines?: number;
    maxResults?: number;
  };

  // Exec
  ExecStartBody: {
    command: string;
    infinite?: boolean;
    timeout?: number;
  };
  ExecBashBody: {
    command: string;
    timeout?: number;
  };

  // Git
  GitDiffBody: {
    path?: string;
  };
  GitCommitBody: {
    message: string;
    all?: boolean;
  };
  GitLogBody: {
    limit?: number;
  };

  // LSP
  LspDiagnosticsBody: {
    filePath: string;
    content?: string;
    configPath?: string;
  };
  LspDefinitionBody: {
    filePath: string;
    line: number;
    character: number;
    content?: string;
  };
  LspReferencesBody: {
    filePath: string;
    line: number;
    character: number;
    content?: string;
  };
}
