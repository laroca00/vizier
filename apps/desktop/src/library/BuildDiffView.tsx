import { useState } from "react";
import { itemIconUrl, runeIconUrl } from "../data/ddragon";
import { useT } from "../i18n";
import { Select } from "../ui/Fields";
import { diffBuilds, type ListDiff } from "./buildDiff";
import { skillOrderLabel, type LibraryData } from "./data";
import type { SavedBuild } from "./store";

/** Pick another saved build and see what differs from this one. */
export function BuildDiffView({ build, others, data }: { build: SavedBuild; others: SavedBuild[]; data: LibraryData }) {
  const t = useT();
  const [otherId, setOtherId] = useState("");
  const candidates = others
    .filter((b) => b.id !== build.id)
    .sort((a, b) => Number(b.championId === build.championId) - Number(a.championId === build.championId));
  if (candidates.length === 0) return null;
  const other = candidates.find((b) => b.id === otherId);
  const diff = other ? diffBuilds(build, other) : null;

  const icons = (ids: number[], kind: "item" | "rune") =>
    ids.map((id, i) => {
      const rune = kind === "rune" ? data.runes.get(id) : undefined;
      const name = kind === "rune" ? rune?.name : data.items.get(id)?.name;
      const src = kind === "rune" ? (rune ? runeIconUrl(rune.icon) : "") : itemIconUrl(data.version, id);
      return src ? <img key={`${id}-${i}`} src={src} alt={name ?? ""} title={name} width={26} height={26} /> : null;
    });

  const row = (label: string, d: ListDiff, kind: "item" | "rune" = "item") =>
    d.same ? null : (
      <li key={label}>
        <span className="build__stat">{t(label)}</span>
        {d.reordered ? (
          <span>{t("Aynı eşyalar, farklı sıra")}</span>
        ) : (
          <>
            {d.onlyA.length > 0 && (
              <span className="diff__side" data-side="a">
                {t("Sadece bunda")} {icons(d.onlyA, kind)}
              </span>
            )}
            {d.onlyB.length > 0 && (
              <span className="diff__side" data-side="b">
                {t("Sadece diğerinde")} {icons(d.onlyB, kind)}
              </span>
            )}
          </>
        )}
      </li>
    );

  return (
    <section className="diff" aria-label={t("Build karşılaştırması")}>
      <Select
        label={t("Başka bir buildle karşılaştır")}
        value={otherId}
        options={[{ value: "", label: t("Seç") }, ...candidates.map((b) => ({ value: b.id, label: `${b.name} (${data.champions.get(b.championId)?.name ?? ""})` }))]}
        onChange={setOtherId}
      />
      {other && diff && (
        <ul className="diff__list">
          {diff.identical && <li>{t("İki build aynı.")}</li>}
          {(diff.runes.primaryStyle || diff.runes.subStyle) && (
            <li>
              <span className="build__stat">{t("Rün ağaçları")}</span>
              <span>
                {data.styles.get(build.runes.primaryStyle)?.name} / {data.styles.get(build.runes.subStyle)?.name} → {data.styles.get(other.runes.primaryStyle)?.name} /{" "}
                {data.styles.get(other.runes.subStyle)?.name}
              </span>
            </li>
          )}
          {row("Rünler", { same: diff.runes.onlyA.length + diff.runes.onlyB.length === 0, onlyA: diff.runes.onlyA, onlyB: diff.runes.onlyB, reordered: false }, "rune")}
          {!diff.spells.same && (
            <li>
              <span className="build__stat">{t("Büyüler")}</span>
              <span>
                {build.spells.map((id) => data.spells.get(id)?.name).join(", ")} → {other.spells.map((id) => data.spells.get(id)?.name).join(", ")}
              </span>
            </li>
          )}
          {row("Başlangıç", diff.startItems)}
          {row("Ana eşyalar", diff.coreItems)}
          {row("Duruma göre", diff.items)}
          {!diff.skillOrder.same && (
            <li>
              <span className="build__stat">{t("Yetenek sırası")}</span>
              <span>
                {skillOrderLabel(build.skillOrder)} → {skillOrderLabel(other.skillOrder)}
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
