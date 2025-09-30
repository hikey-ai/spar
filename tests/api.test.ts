// import { test, expect, beforeAll, afterAll } from "bun:test";
// import path from "path";
// import { tmpdir } from "os";
// import { serve } from "bun";
// import app from "../index.js";

// let server: ReturnType<typeof serve>;

// beforeAll(() => {
//   process.env.API_KEY = 'testkey';
//   server = serve({
//     port: 0,
//     fetch: app.fetch,
//   });
// });

// afterAll(() => {
//   server.stop();
// });

// test("API health endpoint", async () => {
//   const tempDir = path.join(process.cwd(), 'tmp-spar-health');
//   Bun.spawnSync(['mkdir', '-p', tempDir]);
//   process.env.WORKSPACE_PATH = tempDir;

//   const res = await fetch(`http://localhost:${server.port}/proxy/health`, {
//     headers: { 'Authorization': 'Bearer testkey' }
//   });
//   expect(res.status).toBe(200);
//   const json = await res.json() as any;
//   expect(json.status).toBe('ok');
//   Bun.spawnSync(['rm', '-rf', tempDir]);
// });

// test("files read endpoint", async () => {
//   const tempDir = path.join(process.cwd(), 'tmp-spar-api-test');
//   Bun.spawnSync(['mkdir', '-p', tempDir]);
//   const testFile = path.join(tempDir, 'test.txt');
//   await Bun.write(testFile, 'test content');
//   process.env.WORKSPACE_PATH = tempDir;

//   const res = await fetch(`http://localhost:${server.port}/proxy/files/read`, {
//     method: 'POST',
//     headers: { 
//       'Content-Type': 'application/json',
//       'Authorization': 'Bearer testkey'
//     },
//     body: JSON.stringify({ paths: ['test.txt'] }),
//   });
//   expect(res.status).toBe(200);
//   const json = await res.json() as any;
//   expect(json.files[0].content).toBe('test content');
//   Bun.spawnSync(['rm', '-rf', tempDir]);
// });

// test("lsp diagnostics endpoint", async () => {
//   const tempDir = path.join(process.cwd(), 'tmp-spar-api-lsp');
//   Bun.spawnSync(['mkdir', '-p', tempDir]);
//   const testFile = path.join(tempDir, 'test.ts');
//   await Bun.write(testFile, 'let x: string = 1;');
//   process.env.WORKSPACE_PATH = tempDir;

//   const res = await fetch(`http://localhost:${server.port}/proxy/lsp/diagnostics`, {
//     method: 'POST',
//     headers: { 
//       'Content-Type': 'application/json',
//       'Authorization': 'Bearer testkey'
//     },
//     body: JSON.stringify({ filePath: 'test.ts', content: 'let x: string = 1;' }),
//   });
//   expect(res.status).toBe(200);
//   const json = await res.json() as any;
//   expect(Array.isArray(json)).toBe(true);
//   expect(json.length).toBeGreaterThan(0);
//   expect(json[0].message).toContain('Type');
//   Bun.spawnSync(['rm', '-rf', tempDir]);
// });