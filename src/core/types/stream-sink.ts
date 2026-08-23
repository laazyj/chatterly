/** Where streamed assistant text goes. The CLI writes stdout; evals and tests collect. */
export type StreamSink = (delta: string) => void;
