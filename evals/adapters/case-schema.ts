import { z } from "zod";

/** Validates a case file against the `Expectation` and `EvalCase` port shapes. */
export const expectationSchema = z.object({
  contains: z.string().optional(),
  notContains: z.string().optional(),
  minLength: z.number().int().positive().optional(),
  toolCalled: z.string().optional(),
  noToolCalls: z.boolean().optional(),
  toolsSucceeded: z.boolean().optional(),
  maxSteps: z.number().int().positive().optional(),
});

export const caseSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  turns: z
    .array(
      z.object({
        user: z.string(),
        expect: expectationSchema,
      }),
    )
    .min(1),
});
