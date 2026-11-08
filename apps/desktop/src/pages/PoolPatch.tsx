import { useLang, useT } from "../i18n";
import { fieldLabel, formatValue } from "../patches/format";
import { cachedPatchDiff, patchName, patchVersions } from "../patches/load";
import { usePersonal } from "../personal";
import type { Route } from "../router";
import { useAsync } from "../useAsync";

const SHOWN_CHANGES = 2;

/**
 * What changed for the player's pool in the newest patch, read from the
 * patch tracker's cache so Home downloads nothing heavy.
 */
export function PoolPatch({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const t = useT();
  const lang = useLang();
  const { pool, favourites } = usePersonal();
  const [versions] = useAsync("patch-versions", patchVersions);
  const mine = new Set([...pool.map((p) => p.championId), ...favourites].map(String));
  if (mine.size === 0 || versions.status !== "done" || versions.value.length < 2) return null;
  const [to, from] = versions.value;
  const diff = cachedPatchDiff(from, to, lang);
  const open = () => onNavigate({ page: "patches" });
  if (!diff) {
    return (
      <p className="state__text pool-patch">
        {t("Yama {patch} havuzunu nasıl etkiledi?", { patch: patchName(to) })}{" "}
        <button type="button" className="link" onClick={open}>
          {t("Yama takibinde gör")}
        </button>
      </p>
    );
  }
  const changed = diff.entries.filter((e) => e.kind === "champion" && mine.has(e.id));
  return (
    <section className="pool-patch" aria-label={t("Havuzun bu yamada")}>
      <h2 className="section-title">{t("Havuzun yama {patch}'de", { patch: patchName(to) })}</h2>
      {changed.length === 0 ? (
        <p className="state__text">{t("Havuzundaki şampiyonların Data Dragon değerleri bu yamada değişmedi.")}</p>
      ) : (
        <ul className="pool-patch__list">
          {changed.map((e) => (
            <li key={e.id}>
              <span className="pool-patch__name">{e.name}</span>
              <span className="state__text">
                {e.changes
                  .slice(0, SHOWN_CHANGES)
                  .map((c) => `${fieldLabel(c.field, t)} ${formatValue(c, c.before, diff.itemNames, lang, t)} → ${formatValue(c, c.after, diff.itemNames, lang, t)}`)
                  .join("; ")}
                {e.changes.length > SHOWN_CHANGES ? ` ${t("ve {count} değişiklik daha", { count: e.changes.length - SHOWN_CHANGES })}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="link" onClick={open}>
        {t("Tüm değişiklikler")}
      </button>
    </section>
  );
}
