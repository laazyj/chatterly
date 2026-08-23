/**
 * What a turn is asserted to do.
 *
 * Assertions must be backend-agnostic. One that only holds for a single provider — a
 * substring matching the echo stub, say — tests the double rather than the agent, and
 * reports a real model as broken for behaving correctly.
 *
 * Optionals are written `?: T | undefined` rather than `?: T` because these come from
 * parsed JSON, where an absent key and an explicit undefined are the same thing — and
 * `exactOptionalPropertyTypes` otherwise treats them as different.
 */
export interface Expectation {
  contains?: string | undefined;
  notContains?: string | undefined;
  /** Guards against an empty or one-word non-answer without pinning the wording. */
  minLength?: number | undefined;
  toolCalled?: string | undefined;
  noToolCalls?: boolean | undefined;
  toolsSucceeded?: boolean | undefined;
  maxSteps?: number | undefined;
}
