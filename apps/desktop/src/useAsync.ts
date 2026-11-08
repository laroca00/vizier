import { useCallback, useEffect, useRef, useState } from "react";
import { createStaleCache } from "./staleCache";

const results = createStaleCache(10 * 60_000);

export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; value: T }
  | { status: "error"; error: unknown };

/**
 * Runs `load` whenever `key` changes; a null key means nothing to load yet.
 * A key seen before shows its last result straight away and refreshes behind it.
 */
export function useAsync<T>(key: string | null, load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  // `load` closes over values that `key` already identifies, so a new
  // function alone doesn't start another request.
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    if (key === null) {
      setState({ status: "idle" });
      return;
    }
    let current = true;
    const stale = results.get<T>(key);
    setState(stale === undefined ? { status: "loading" } : { status: "done", value: stale });
    latest.current().then(
      (value) => {
        results.set(key, value);
        if (current) setState({ status: "done", value });
      },
      (error) => current && stale === undefined && setState({ status: "error", error }),
    );
    return () => {
      current = false;
    };
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return [state, retry] as const;
}
