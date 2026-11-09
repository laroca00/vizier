export type ImportKind = "runes" | "spells" | "items";
export type ImportOutcome = { ok: true } | { ok: false; reason: "noSlot" | "client" | "failed" };

/** Tells a closed client apart from a request the client refused. */
export function reasonOf(error: unknown): "client" | "failed" {
  const text = String(error).toLowerCase();
  return text.includes("not connected") || text.includes("connection") || text.includes("refused") ? "client" : "failed";
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

const DONE: Record<ImportKind, string> = {
  runes: "rünler",
  spells: "büyüler",
  items: "eşya seti",
};

const FAILED = {
  noSlot: "boş rün sayfası yok",
  client: "istemci kapalı",
  failed: "istemci reddetti",
};

/** One line for a whole auto-import: what went in and what did not, and why. */
export function importSummary(
  t: Translate,
  champion: string,
  results: Partial<Record<ImportKind, ImportOutcome>>,
): { kind: "success" | "error"; message: string } {
  const entries = (Object.keys(DONE) as ImportKind[]).flatMap((k) => (results[k] ? [[k, results[k]] as const] : []));
  const done = entries.filter(([, r]) => r.ok).map(([k]) => t(DONE[k]));
  const failed = entries.flatMap(([k, r]) => (r.ok ? [] : [`${t(DONE[k])}: ${t(FAILED[r.reason])}`]));
  const joined = done.length > 1 ? `${done.slice(0, -1).join(", ")} ${t("ve")} ${done[done.length - 1]}` : done.join("");
  if (failed.length === 0) return { kind: "success", message: t("{champion}: {parts} aktarıldı", { champion, parts: joined }) };
  const bad = t("{champion}: aktarılamadı, {parts}", { champion, parts: failed.join("; ") });
  return { kind: "error", message: done.length ? `${t("{champion}: {parts} aktarıldı", { champion, parts: joined })}. ${bad}` : bad };
}
