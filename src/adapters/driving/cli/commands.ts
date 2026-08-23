import { join } from "node:path";
import { type App } from "../../../app.ts";
import { type Message } from "../../../core/types/index.ts";
import { bold, dim, red } from "./render.ts";

export interface CommandContext {
  app: App;
  sessionId: string;
  newSession: () => string;
}

export interface CommandResult {
  /** False means the input was ordinary text and should go to the agent. */
  handled: boolean;
  exit?: boolean;
}

const HELP = `${bold("Commands")}
  /new       start a fresh session
  /tools     list registered tools
  /history   replay the current session from disk
  /trace     where this session's spans are written
  /model     provider, model and active tool protocol
  /help      this list
  /quit      exit`;

/**
 * Handles slash commands. Anything else falls through to the agent.
 *
 * These read state that already exists rather than keeping their own: /history reads the
 * session file, /trace reports the tracer's path. A command that lies about what is on
 * disk is worse than no command.
 */
export async function runCommand(input: string, ctx: CommandContext): Promise<CommandResult> {
  if (!input.startsWith("/")) return { handled: false };

  const command = input.slice(1).split(/\s+/)[0] ?? "";

  switch (command) {
    case "quit":
    case "exit":
      return { handled: true, exit: true };

    case "help":
      console.log(HELP);
      return { handled: true };

    case "new": {
      const id = ctx.newSession();
      console.log(dim(`Started session ${id}`));
      return { handled: true };
    }

    case "tools": {
      const tools = ctx.app.tools.list();
      if (tools.length === 0) {
        console.log(dim("No tools registered."));
        return { handled: true };
      }
      for (const tool of tools) {
        console.log(`  ${bold(tool.name)} ${dim(tool.description)}`);
      }
      return { handled: true };
    }

    case "history": {
      const messages = await ctx.app.sessions.load(ctx.sessionId);
      if (messages.length === 0) {
        console.log(dim("This session has no history yet."));
        return { handled: true };
      }
      for (const message of messages) {
        console.log(`  ${dim(label(message))} ${summarise(message)}`);
      }
      return { handled: true };
    }

    case "trace": {
      const path = join(ctx.app.config.dataDir, "traces", `${ctx.sessionId}.jsonl`);
      console.log(dim(`Spans for this session: ${path}`));
      return { handled: true };
    }

    case "model": {
      const { provider, protocol, config } = ctx.app;
      console.log(
        [
          `  provider      ${provider.name}`,
          `  model         ${provider.model}`,
          `  tool protocol ${protocol.name}${config.toolProtocol === "auto" ? dim(" (auto)") : ""}`,
          `  temperature   ${String(config.temperature)}`,
          `  max steps     ${String(config.maxSteps)}`,
        ].join("\n"),
      );
      return { handled: true };
    }

    default:
      console.log(red(`Unknown command "/${command}". Try /help.`));
      return { handled: true };
  }
}

function label(message: Message): string {
  return message.role === "tool" ? `tool:${message.name}` : message.role;
}

function summarise(message: Message): string {
  const text = message.content.replace(/\s+/g, " ").trim();
  const calls =
    message.role === "assistant" && message.toolCalls?.length
      ? dim(` [calls: ${message.toolCalls.map((call) => call.name).join(", ")}]`)
      : "";
  return (text.length > 160 ? `${text.slice(0, 157)}...` : text) + calls;
}
