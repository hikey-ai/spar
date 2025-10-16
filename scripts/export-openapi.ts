import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { oas31 } from "openapi3-ts";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "..");
const specPath = resolve(projectRoot, "openapi.yaml");
const outputDir = resolve(projectRoot, "generated");
const jsonOutPath = resolve(outputDir, "spar-openapi.json");
const yamlOutPath = resolve(outputDir, "spar-openapi.yaml");

async function exportSpec() {
  const source = await readFile(specPath, "utf8");
  const parsed = YAML.parse(source);
  const builder = oas31.OpenApiBuilder.create(parsed);
  const jsonSpec = builder.getSpecAsJson(undefined, 2);
  const yamlSpec = builder.getSpecAsYaml(undefined, { indent: 2 });

  await mkdir(outputDir, { recursive: true });
  await writeFile(jsonOutPath, `${jsonSpec}\n`);
  await writeFile(yamlOutPath, yamlSpec.endsWith("\n") ? yamlSpec : `${yamlSpec}\n`);
  console.log(`OpenAPI spec exported to:\n- ${jsonOutPath}\n- ${yamlOutPath}`);
}

await exportSpec();
