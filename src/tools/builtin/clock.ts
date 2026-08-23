import { z } from "zod";
import { defineTool } from "../define-tool.ts";

/**
 * The example tool. Exists to make the tool loop demonstrable end to end, and to be the
 * thing you copy when adding a real one.
 *
 * Note what it does not do: no side effects, no network, and it answers a question the
 * model genuinely cannot answer alone, which is what makes it a useful smoke test.
 */
export const clockTool = defineTool({
  name: "clock",
  description:
    "Get the current date and time. Use this whenever the user asks what time or day it is.",
  parameters: z.object({
    timeZone: z
      .string()
      .optional()
      .describe('IANA time zone, e.g. "Europe/London". Defaults to the machine time zone.'),
  }),
  execute({ timeZone }) {
    try {
      return new Date().toLocaleString("en-GB", {
        dateStyle: "full",
        timeStyle: "long",
        ...(timeZone === undefined ? {} : { timeZone }),
      });
    } catch {
      return `Unknown time zone "${timeZone ?? ""}". Use an IANA name such as "Europe/London".`;
    }
  },
});
