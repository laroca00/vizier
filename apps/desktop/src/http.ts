export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type RequestOptions = {
  timeoutMs?: number;
  /** Retries after a network failure; HTTP errors and aborts are never retried. */
  retries?: number;
  fetchImpl?: typeof fetch;
};

const TIMEOUT = 15_000;

function isAbort(error: unknown) {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");
}

export async function requestJson<T>(url: string, init: RequestInit = {}, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = TIMEOUT, retries = 1, fetchImpl = fetch } = options;
  for (let attempt = 0; ; attempt++) {
    const timer = new AbortController();
    const timeout = setTimeout(() => timer.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timer.signal]) : timer.signal;
    try {
      const response = await fetchImpl(url, { ...init, signal });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new ApiError(response.status, body?.error ?? response.statusText);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ApiError || isAbort(error) || init.signal?.aborted) throw error;
      if (attempt >= retries) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
