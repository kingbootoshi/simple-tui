export type RetryOptions = {
  tries?: number;
  baseMs?: number;
  factor?: number;
  jitter?: boolean;
};

/**
 * Execute an async function with exponential backoff.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const tries = options.tries ?? 3;
  const baseMs = options.baseMs ?? 250;
  const factor = options.factor ?? 2;
  const jitter = options.jitter ?? true;

  let attempt = 0;
  let lastError: unknown;

  while (attempt < tries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= tries) break;

      const wait = baseMs * Math.pow(factor, attempt - 1);
      const delay = jitter ? wait * (0.5 + Math.random()) : wait;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export default withRetry;
