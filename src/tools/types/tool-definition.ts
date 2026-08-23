import { type z } from "zod";
import { type ToolContext } from "../../core/types/index.ts";

/**
 * A tool, defined once.
 *
 * The zod schema is the single source of truth: the JSON Schema sent to native-tool
 * models and the text manual shown to prompted models are both derived from it, and the
 * handler's argument type is inferred from it. Adding a tool means adding one of these.
 *
 * `execute` uses method syntax deliberately — the bivariance that gives us is what lets
 * differently-shaped tools sit in one registry.
 */
export interface ToolDefinition<Schema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  parameters: Schema;
  execute(args: z.output<Schema>, ctx: ToolContext): Promise<string> | string;
}
