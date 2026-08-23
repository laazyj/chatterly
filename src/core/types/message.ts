import { type ToolCall } from "./tool-call.ts";

export interface SystemMessage {
  role: "system";
  content: string;
}

export interface UserMessage {
  role: "user";
  content: string;
}

export interface AssistantMessage {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

export interface ToolMessage {
  role: "tool";
  toolCallId: string;
  name: string;
  content: string;
  isError: boolean;
}

/** The transcript unit. Discriminated on `role` — add a variant and the switch checks bite. */
export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;
