import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { type CaseSource, type EvalCase } from "../ports/index.ts";
import { caseSchema } from "./case-schema.ts";

/** Reads `*.json` case files from a directory, validating each against the schema. */
export function jsonFileCaseSource(dir: string): CaseSource {
  return {
    name: `json-files(${dir})`,

    async load(): Promise<EvalCase[]> {
      const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();

      const cases: EvalCase[] = [];
      for (const file of files) {
        const raw = await readFile(join(dir, file), "utf8");
        const parsed = caseSchema.safeParse(JSON.parse(raw));
        if (!parsed.success) {
          throw new Error(`${file} is not a valid eval case: ${parsed.error.message}`);
        }
        cases.push(parsed.data);
      }
      return cases;
    },
  };
}
