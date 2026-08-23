/**
 * A promise that rejects when `signal` aborts, and never resolves.
 *
 * Raced against a tool handler so an implementation that ignores its signal still cannot
 * hang the loop. The cleanup controller removes the listener once the race is decided,
 * so a long conversation does not accumulate one listener per tool call.
 */
export function rejectOnAbort(signal: AbortSignal, cleanup: AbortSignal): Promise<never> {
  return new Promise<never>((_resolve, reject) => {
    if (signal.aborted) {
      reject(new Error(abortMessage(signal)));
      return;
    }
    signal.addEventListener(
      "abort",
      () => {
        reject(new Error(abortMessage(signal)));
      },
      { once: true, signal: cleanup },
    );
  });
}

function abortMessage(signal: AbortSignal): string {
  const reason: unknown = signal.reason;
  if (reason instanceof Error) {
    return reason.name === "TimeoutError" ? "timed out" : reason.message;
  }
  return "aborted";
}
