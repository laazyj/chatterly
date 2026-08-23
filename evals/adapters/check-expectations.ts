import { type TurnOutcome } from "../../src/core/types/index.ts";
import { type Expectation, type Grader } from "../ports/index.ts";

/** The default grader: deterministic assertions, no model in the loop. */
export function deterministicGrader(): Grader {
  return {
    name: "deterministic",
    grade: (expect, outcome) => Promise.resolve(checkExpectations(expect, outcome)),
  };
}

/** @returns one message per failed assertion; empty means the turn passed. */
export function checkExpectations(expect: Expectation, outcome: TurnOutcome): string[] {
  const failures: string[] = [];
  const text = outcome.text.toLowerCase();
  const called = outcome.toolResults.map((result) => result.name);

  if (expect.contains !== undefined && !text.includes(expect.contains.toLowerCase())) {
    failures.push(`expected reply to contain "${expect.contains}"`);
  }
  if (expect.notContains !== undefined && text.includes(expect.notContains.toLowerCase())) {
    failures.push(`expected reply not to contain "${expect.notContains}"`);
  }
  if (expect.minLength !== undefined && outcome.text.trim().length < expect.minLength) {
    failures.push(
      `reply was ${String(outcome.text.trim().length)} chars, expected at least ${String(expect.minLength)}`,
    );
  }
  if (expect.toolCalled !== undefined && !called.includes(expect.toolCalled)) {
    failures.push(
      `expected tool "${expect.toolCalled}" to be called (called: ${called.join(", ") || "none"})`,
    );
  }
  if (expect.noToolCalls === true && called.length > 0) {
    failures.push(`expected no tool calls (called: ${called.join(", ")})`);
  }
  if (expect.toolsSucceeded === true) {
    const failed = outcome.toolResults.filter((result) => result.isError);
    if (failed.length > 0) {
      failures.push(`tools errored: ${failed.map((result) => result.name).join(", ")}`);
    }
  }
  if (expect.maxSteps !== undefined && outcome.steps > expect.maxSteps) {
    failures.push(
      `took ${String(outcome.steps)} steps, expected at most ${String(expect.maxSteps)}`,
    );
  }

  return failures;
}
