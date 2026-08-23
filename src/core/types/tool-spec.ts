/**
 * A tool as the wire sees it: JSON Schema parameters, no zod.
 *
 * Derived from a ToolDefinition's zod schema, never written by hand. The native protocol
 * sends these on the request; the prompted protocol renders them into a text manual.
 */
export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
