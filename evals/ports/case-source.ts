import { type Expectation } from "./expectation.ts";

export interface EvalTurn {
  user: string;
  expect: Expectation;
}

export interface EvalCase {
  name: string;
  description?: string | undefined;
  turns: EvalTurn[];
}

/**
 * Where cases come from. SEAM.
 *
 * A port because the interesting sources are not files: replaying a real session from
 * `.data/sessions` as a regression case, or generating cases from a spec, should not mean
 * touching the runner.
 */
export interface CaseSource {
  readonly name: string;
  load(): Promise<EvalCase[]>;
}
