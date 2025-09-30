import { test, expect, beforeEach } from "bun:test";
import path from "path";
import { tmpdir } from "os";
import { mkdtempSync } from "fs";

let mockWorkspace: string;
let testTsFile: string;

beforeEach(async () => {
  mockWorkspace = mkdtempSync(path.join(tmpdir(), "spar-lsp-"));
  testTsFile = path.join(mockWorkspace, "test.ts");
  await Bun.write(testTsFile, 'let x: string = 1;');
});

test("getDiagnostics should return semantic errors", async () => {
  const { getDiagnostics } = await import("../src/lsp.ts");
  const diags = await getDiagnostics(testTsFile, undefined, mockWorkspace);
  console.dir(diags, { depth: null });
  expect(diags.length).toBeGreaterThan(0);
  expect(diags[0]!.message).toContain("Type 'number' is not assignable to type 'string'");
  expect(diags[0]!.severity).toBe("Error");
});

test("getDiagnostics should work with virtual content", async () => {
  const { getDiagnostics } = await import("../src/lsp.ts");
  const virtualContent = 'let y: number = "str";';
  const diags = await getDiagnostics(testTsFile, virtualContent, mockWorkspace);
  expect(diags.length).toBeGreaterThan(0);
  expect(diags[0]!.message).toContain("Type 'string' is not assignable to type 'number'");
  expect(diags[0]!.severity).toBe("Error");
});
