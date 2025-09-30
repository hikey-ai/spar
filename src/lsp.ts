import * as ts from "typescript";
import path from "path";
import * as fs from "fs";

export interface Diagnostic {
  severity: "Error" | "Warning" | "Information" | "Hint";
  message: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  code?: string | number;
  source?: string;
}

class LspHost implements ts.LanguageServiceHost {
  private compilerOptions: ts.CompilerOptions = {
    strict: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    jsx: ts.JsxEmit.React,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  };

  constructor(
    private base: string,
    targetFile: string,
    private targetContent?: string
  ) {
    this.targetFile = path.resolve(base, targetFile.replace(/^\/workspace/, ''));
  }

  private targetFile: string;

  getCompilationSettings(): ts.CompilerOptions {
    return this.compilerOptions;
  }

  getScriptFileNames(): string[] {
    return [this.targetFile];
  }

  getScriptVersion(_fileName: string): string {
    return "1"; // No change tracking
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    if (fileName === this.targetFile && this.targetContent !== undefined) {
      return ts.ScriptSnapshot.fromString(this.targetContent);
    }
    try {
      const text = fs.readFileSync(fileName, 'utf8');
      return ts.ScriptSnapshot.fromString(text);
    } catch {
      return undefined;
    }
  }

  getCurrentDirectory(): string {
    return this.base;
  }

  getDefaultLibFileName(_options: ts.CompilerOptions): string {
    return "lib.d.ts";
  }

  getScriptIsOpen(_fileName: string): boolean {
    return false;
  }

  readFile(_fileName: string): string | undefined {
    // Use getScriptSnapshot
    const snapshot = this.getScriptSnapshot(_fileName);
    return snapshot ? snapshot.getText(0, snapshot.getLength()) : undefined;
  }

  fileExists(_fileName: string): boolean {
    return Bun.file(_fileName).size > 0;
  }

  getDirectories(_path: string): string[] {
    try {
      const dirs = fs.readdirSync(_path).filter(f => fs.statSync(path.join(_path, f)).isDirectory());
      return dirs.map(d => path.join(_path, d));
    } catch {
      return [];
    }
  }

  directoryExists(_path: string): boolean {
    try {
      return fs.statSync(_path).isDirectory();
    } catch {
      return false;
    }
  }

  getNewLine(): string {
    return "\n";
  }

  useCaseSensitiveFileNames(): boolean {
    return process.platform === "linux";
  }

  getScriptKind(fileName: string): ts.ScriptKind {
    const ext = path.extname(fileName).toLowerCase();
    switch (ext) {
      case '.ts':
        return ts.ScriptKind.TS;
      case '.tsx':
        return ts.ScriptKind.TSX;
      case '.js':
        return ts.ScriptKind.JS;
      case '.jsx':
        return ts.ScriptKind.JSX;
      default:
        return ts.ScriptKind.Unknown;
    }
  }
}

export async function getDiagnostics(
  filePath: string,
  content?: string,
  base: string = '/workspace'
): Promise<Diagnostic[]> {
  const fullFileName = path.resolve(base, filePath.replace(/^\/workspace/, ''));
  const host = new LspHost(base, fullFileName, content);
  const service = ts.createLanguageService(host, ts.createDocumentRegistry());

  const syntacticDiagnostics = service.getSyntacticDiagnostics(fullFileName);
  const semanticDiagnostics = service.getSemanticDiagnostics(fullFileName);

  const allDiagnostics = [...syntacticDiagnostics, ...semanticDiagnostics];

  service.dispose();

  return allDiagnostics.map(diag => {
    const severity = diag.category === ts.DiagnosticCategory.Error ? "Error" :
                     diag.category === ts.DiagnosticCategory.Warning ? "Warning" :
                     "Information";
    const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
    let range;
    if (diag.file && diag.start !== undefined) {
      const sourceFile = diag.file;
      const start = sourceFile.getLineAndCharacterOfPosition(diag.start);
      const length = diag.length || 0;
      const end = sourceFile.getLineAndCharacterOfPosition(diag.start + length);
      range = { start: { line: start.line, character: start.character }, end: { line: end.line, character: end.character } };
    }
    return {
      severity,
      message,
      range,
      code: diag.code,
      source: diag.source
    };
  });
}

// Stub for other functions
export async function getDefinition(
  _filePath: string,
  _line: number,
  _character: number,
  _content?: string,
  _base: string = '/workspace'
): Promise<any[]> {
  return [];
}

export async function getReferences(
  _filePath: string,
  _line: number,
  _character: number,
  _content?: string,
  _base: string = '/workspace'
): Promise<any[]> {
  return [];
}