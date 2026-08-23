import { join } from "node:path";
import { createApp } from "../src/app.ts";
import { loadConfig } from "../src/config/index.ts";
import { deterministicGrader } from "./adapters/check-expectations.ts";
import { jsonFileCaseSource } from "./adapters/json-file-case-source.ts";
import { type CaseSource, type Grader } from "./ports/index.ts";

interface CaseReport {
  name: string;
  failures: string[];
  steps: number;
  tools: string[];
}

/**
 * The eval runner: a driving adapter, a sibling of the REPL rather than a seam of the
 * agent. It drives the same `ConversationPort` a person does.
 *
 * Its own two seams are `CaseSource` (where cases come from) and `Grader` (how a turn is
 * judged), both swapped here in one line each.
 *
 * Sessions go under `<dataDir>/evals` so a run never pollutes real conversations, and each
 * case gets its own session so cases cannot leak context into each other.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const app = createApp({ ...config, dataDir: join(config.dataDir, "evals") });

  const source: CaseSource = jsonFileCaseSource(join(import.meta.dirname, "cases"));
  const grader: Grader = deterministicGrader();

  const cases = await source.load();
  if (cases.length === 0) {
    console.error(`No eval cases found in ${source.name}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `${app.provider.name}:${app.provider.model} · ${app.protocol.name} tools · ${grader.name} grading\n`,
  );

  const reports: CaseReport[] = [];

  for (const testCase of cases) {
    const sessionId = `eval-${testCase.name}-${String(Date.now())}`;
    const report: CaseReport = { name: testCase.name, failures: [], steps: 0, tools: [] };

    for (const [index, turn] of testCase.turns.entries()) {
      const outcome = await app.conversation.run({ sessionId, userText: turn.user });
      report.steps += outcome.steps;
      report.tools.push(...outcome.toolResults.map((result) => result.name));
      report.failures.push(
        ...(await grader.grade(turn.expect, outcome)).map(
          (failure) => `turn ${String(index + 1)}: ${failure}`,
        ),
      );
    }

    reports.push(report);
    const status = report.failures.length === 0 ? "PASS" : "FAIL";
    const detail = `${String(report.steps)} steps, tools: ${report.tools.join(", ") || "none"}`;
    console.log(`${status}  ${testCase.name.padEnd(20)} ${detail}`);
    for (const failure of report.failures) {
      console.log(`        ${failure}`);
    }
  }

  const failed = reports.filter((report) => report.failures.length > 0);
  console.log(`\n${String(reports.length - failed.length)}/${String(reports.length)} passed`);
  if (failed.length > 0) process.exitCode = 1;
}

await main();
