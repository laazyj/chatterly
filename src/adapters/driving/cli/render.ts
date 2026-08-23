/** Minimal ANSI helpers. No dependency, and they degrade to plain text when piped. */
const useColour = process.stdout.isTTY && process.env.NO_COLOR === undefined;

const wrap = (code: string, text: string): string =>
  useColour ? `\u001B[${code}m${text}\u001B[0m` : text;

export const dim = (text: string): string => wrap("2", text);
export const bold = (text: string): string => wrap("1", text);
export const cyan = (text: string): string => wrap("36", text);
export const yellow = (text: string): string => wrap("33", text);
export const red = (text: string): string => wrap("31", text);

export const USER_PROMPT = `${cyan("you")} ${dim("›")} `;
export const AGENT_PREFIX = `${yellow("bot")} ${dim("›")} `;
