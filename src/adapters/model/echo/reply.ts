import { type ChatRequest, type Message } from "../../../core/types/index.ts";

const CLOCK_QUESTION = /\b(time|clock|date|day)\b/i;

export type EchoReply =
  | { kind: "text"; text: string }
  | { kind: "tool-call"; toolName: string }
  | { kind: "prompted-tool-call"; text: string };

/**
 * Decides what the echo provider says next.
 *
 * Kept separate from the streaming mechanics so the decision is testable on its own, and
 * because this is the part you edit when you want the stub to exercise a new path.
 */
export function decideReply(request: ChatRequest): EchoReply {
  const last = request.messages.at(-1);

  if (last?.role === "tool") {
    return {
      kind: "text",
      text: last.isError
        ? `The ${last.name} tool failed: ${last.content}`
        : `According to ${last.name}: ${last.content}`,
    };
  }

  const userText = lastUserText(request.messages);

  if (CLOCK_QUESTION.test(userText)) {
    // Native tools are advertised on the request; the prompted protocol instead leaves
    // tools out and expects a fenced block, so the stub answers in whichever dialect the
    // protocol under test is speaking.
    if (request.tools?.some((tool) => tool.name === "clock")) {
      return { kind: "tool-call", toolName: "clock" };
    }
    if (mentionsClockManual(request.messages)) {
      return {
        kind: "prompted-tool-call",
        text: '```json\n{"tool": "clock", "args": {}}\n```',
      };
    }
  }

  return {
    kind: "text",
    text: userText === "" ? "Nothing to echo." : `Echo: ${userText}`,
  };
}

function lastUserText(messages: Message[]): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === "user") return message.content.trim();
  }
  return "";
}

function mentionsClockManual(messages: Message[]): boolean {
  return messages.some(
    (message) => message.role === "system" && message.content.includes("### clock"),
  );
}
