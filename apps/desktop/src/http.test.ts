import { describe, expect, it, vi } from "vitest";
import { ApiError, requestJson } from "./http";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("requestJson", () => {
  it("returns parsed json", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(ok({ a: 1 }));
    expect(await requestJson("/x", {}, { fetchImpl })).toEqual({ a: 1 });
  });

  it("retries once after a network error", async () => {
    const fetchImpl = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(ok({ a: 2 }));
    expect(await requestJson("/x", {}, { fetchImpl })).toEqual({ a: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline"));
    await expect(requestJson("/x", {}, { fetchImpl })).rejects.toThrow("offline");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("does not retry 4xx and keeps the server message", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "nope" }), { status: 404 }));
    const error = (await requestJson("/x", {}, { fetchImpl }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(404);
    expect(error.message).toBe("nope");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("times out without retrying", async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason))),
    );
    await expect(requestJson("/x", {}, { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 10 })).rejects.toMatchObject({ name: "TimeoutError" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("honours the caller's abort signal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init!.signal!.addEventListener("abort", () => reject(new DOMException("x", "AbortError")))),
    );
    const pending = requestJson("/x", { signal: controller.signal }, { fetchImpl: fetchImpl as unknown as typeof fetch });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
