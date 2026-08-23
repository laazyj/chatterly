import { type TurnOutcome } from "../../src/core/types/index.ts";
import { type Expectation } from "./expectation.ts";

/**
 * Decides whether a turn met its expectation. SEAM.
 *
 * The shipped grader is deterministic. A model-graded one is the obvious next
 * implementation — deliberately not the default, because a judge running on the same
 * small local model would be less reliable than the thing it is judging.
 */
export interface Grader {
  readonly name: string;
  /** @returns one message per failed assertion; empty means the turn passed. */
  grade(expect: Expectation, outcome: TurnOutcome): Promise<string[]>;
}
