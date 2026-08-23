import { type z } from "zod";

/**
 * Renders validation failures for the model to read.
 *
 * Terse and path-first ("city: expected string, received number") because this text goes
 * back into the transcript as a tool result, and a small model given a wall of prose is
 * markedly worse at correcting its own arguments than one given a short list.
 */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
