import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { type App } from "../../../app.ts";
import { runCommand } from "./commands.ts";
import { AGENT_PREFIX, bold, dim, red, USER_PROMPT } from "./render.ts";

function newSessionId(): string {
  return `session-${new Date().toISOString().replace(/[:.]/g, "-")}`;
}

/**
 * The terminal front end.
 *
 * Deliberately thin: it owns input, output and cancellation, and nothing about how the
 * agent works. That is what keeps a future HTTP adapter a sibling of this file rather
 * than a rewrite.
 */
export async function startRepl(app: App): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  let sessionId = newSessionId();

  /** Set while the model is generating, so Ctrl-C cancels the turn instead of the process. */
  let generation: AbortController | undefined;

  rl.on("SIGINT", () => {
    if (generation) {
      generation.abort();
      return;
    }
    rl.close();
  });

  // stdin can hit EOF while a turn is still running — piped input always does. Prompting
  // after that throws ERR_USE_AFTER_CLOSE, which would abort the loop and discard lines
  // the iterator has already buffered.
  let closed = false;
  rl.on("close", () => {
    closed = true;
  });
  const prompt = (): void => {
    if (!closed) rl.prompt();
  };

  console.log(bold("Chatterly"));
  console.log(dim(`${app.provider.name}:${app.provider.model} · ${app.protocol.name} tools`));
  console.log(dim("/help for commands, Ctrl-C to interrupt or exit\n"));

  // Iterating the interface rather than calling question() in a loop: question() drops
  // lines that arrive while a turn is in flight and never settles if stdin closes first,
  // which makes the REPL unusable with piped input. The iterator handles backpressure and
  // ends cleanly at EOF.
  rl.setPrompt(USER_PROMPT);
  prompt();

  for await (const line of rl) {
    const input = line.trim();
    if (input === "") {
      prompt();
      continue;
    }

    const result = await runCommand(input, {
      app,
      sessionId,
      newSession: () => {
        sessionId = newSessionId();
        return sessionId;
      },
    });
    if (result.exit) break;
    if (result.handled) {
      prompt();
      continue;
    }

    generation = new AbortController();
    stdout.write(AGENT_PREFIX);

    try {
      const outcome = await app.conversation.run({
        sessionId,
        userText: input,
        sink: (delta) => stdout.write(delta),
        signal: generation.signal,
      });

      stdout.write("\n");
      if (outcome.haltReason !== undefined) {
        console.log(dim(`  (stopped: ${outcome.haltReason})`));
      }
      if (outcome.toolResults.length > 0) {
        const used = outcome.toolResults
          .map((tool) => `${tool.name}${tool.isError ? "!" : ""}`)
          .join(", ");
        console.log(dim(`  (${String(outcome.steps)} steps · tools: ${used})`));
      }
    } catch (error) {
      stdout.write("\n");
      const message = error instanceof Error ? error.message : String(error);
      console.log(red(`  ${generation.signal.aborted ? "Interrupted." : message}`));
    } finally {
      generation = undefined;
    }

    console.log();
    prompt();
  }

  rl.close();
  console.log(dim("Bye."));
}
