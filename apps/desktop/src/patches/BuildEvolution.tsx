import { useState } from "react";
import { getBuild, getBuildHistory, type BuildSnapshot } from "../api";
import { items as loadItems, itemIconUrl, runes as loadRunes, runeIconUrl } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { Select } from "../ui/Fields";
import { useAsync } from "../useAsync";
import { compareBuilds, snapshotOf, type ItemChange, type Move } from "./buildEvolution";
import "./BuildEvolution.css";

const MOVE_TEXT: Record<Move, string> = { rising: "Yükseliyor", falling: "Düşüyor", steady: "Aynı", new: "Yeni", gone: "Çıktı" };
const MOVE_MARK: Record<Move, string> = { rising: "▲", falling: "▼", steady: "●", new: "+", gone: "−" };
const CURRENT = "current";

/** Two patches of one champion and role: items, runes, boots and skill order rising and falling. */
export function BuildEvolution({ championId, position, version }: { championId: number; position: string; version: string }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`build-evolution:${championId}:${position}`, async () => {
    const [history, current, itemList, styles] = await Promise.all([getBuildHistory(championId, position), getBuild(championId, position), loadItems(), loadRunes()]);
    return { history, current: current ? snapshotOf(current) : null, itemList, styles };
  });
  const [pickedBefore, setBefore] = useState<string | null>(null);
  const [pickedAfter, setAfter] = useState<string | null>(null);
  if (state.status !== "done") return null;
  const { history, current, itemList, styles } = state.value;
  // The live build is the newest option; closed patches follow.
  const options: { id: string; label: string; snapshot: BuildSnapshot }[] = [
    ...(current ? [{ id: CURRENT, label: t("Şu an ({patch})", { patch: current.patch }), snapshot: current }] : []),
    ...history.map((s) => ({ id: s.patch, label: `${s.patch}`, snapshot: s })),
  ];
  // Patches the live build already covers add nothing as separate closed entries.
  const usable = options.filter((o, i) => options.findIndex((x) => x.snapshot.patch === o.snapshot.patch) === i);

  if (usable.length < 2) {
    return (
      <section className="evolution enter" aria-label={t("Build'in yamalar arası değişimi")}>
        <h2 className="draft__heading">{t("Build'in yamalar arası değişimi")}</h2>
        <p className="build__note">{t("Karşılaştıracak iki yama henüz yok. Vizier bir yama kapanınca o yamanın build'ini saklar; ilki bir sonraki yamadan sonra görünür.")}</p>
      </section>
    );
  }
  const after = usable.find((o) => o.id === (pickedAfter ?? usable[0].id)) ?? usable[0];
  const before = usable.find((o) => o.id === (pickedBefore ?? usable.find((o2) => o2.id !== after.id)!.id)) ?? usable[1];
  const diff = compareBuilds(before.snapshot, after.snapshot);
  const itemName = (id: number) => itemList.get(id)?.name ?? String(id);
  const isBoots = (id: number) => !!itemList.get(id)?.boots;
  const boots = diff.items.filter((i) => isBoots(i.id));
  const rest = diff.items.filter((i) => !isBoots(i.id));
  const runeName = (id: number | undefined) => (id === undefined ? "–" : ([...styles.values()].flatMap((s) => s.slots.flat()).find((r) => r.id === id)?.name ?? String(id)));
  const options2 = usable.map((o) => ({ value: o.id, label: o.label }));

  const row = (c: ItemChange) => (
    <li key={c.id} data-move={c.move}>
      <img src={itemIconUrl(version, c.id)} alt="" width={28} height={28} loading="lazy" />
      <span className="evolution__name">{itemName(c.id)}</span>
      <span className="evolution__move" title={t(MOVE_TEXT[c.move])}>
        {MOVE_MARK[c.move]} {t(MOVE_TEXT[c.move])}
      </span>
      <span className="build__stat">
        {c.before ? t("{rate}, {games} maç", { rate: formatPercent(c.before.share, lang, 0), games: c.before.games }) : "–"} → {c.after ? t("{rate}, {games} maç", { rate: formatPercent(c.after.share, lang, 0), games: c.after.games }) : "–"}
      </span>
    </li>
  );

  return (
    <section className="evolution enter" aria-label={t("Build'in yamalar arası değişimi")}>
      <h2 className="draft__heading">{t("Build'in yamalar arası değişimi")}</h2>
      <div className="evolution__pick">
        <Select label={t("Önce")} value={before.id} options={options2.filter((o) => o.value !== after.id)} onChange={setBefore} />
        <Select label={t("Sonra")} value={after.id} options={options2.filter((o) => o.value !== before.id)} onChange={setAfter} />
        <DataBadge games={after.snapshot.games} winRate={after.snapshot.winRate} patches={[after.snapshot.patch]} source={t("Yama {patch}", { patch: after.snapshot.patch })} />
      </div>
      <p className="build__note">
        {t("Yüzdeler her yamanın kendi maçları içindeki seçilme oranı: {before} yamasında {a} maç, {after} yamasında {b} maç.", {
          before: before.snapshot.patch,
          a: before.snapshot.games,
          after: after.snapshot.patch,
          b: after.snapshot.games,
        })}
      </p>

      <h3 className="build__stat">{t("Rünler")}</h3>
      <p>
        {diff.runes.before && diff.runes.after
          ? diff.runes.keystoneChanged
            ? t("Ana rün değişti: {a} → {b}", { a: runeName(diff.runes.before.perks[0]), b: runeName(diff.runes.after.perks[0]) })
            : t("Ana rün aynı: {a}", { a: runeName(diff.runes.after.perks[0]) })
          : t("Bu yamalardan birinde rün verisi yok.")}
        {diff.runes.before && diff.runes.after && (
          <span className="build__stat">
            {" "}
            ({t("{games} maç", { games: diff.runes.before.games })} → {t("{games} maç", { games: diff.runes.after.games })})
          </span>
        )}
        {diff.runes.keystoneChanged && diff.runes.after && <img className="evolution__rune" src={runeIconUrl([...styles.values()].flatMap((s) => s.slots.flat()).find((r) => r.id === diff.runes.after!.perks[0])?.icon ?? "")} alt="" width={24} height={24} />}
      </p>

      <h3 className="build__stat">{t("Botlar")}</h3>
      {boots.length === 0 ? <p className="build__note">{t("Listede bot yok.")}</p> : <ul className="evolution__items">{boots.map(row)}</ul>}

      <h3 className="build__stat">{t("Eşyalar")}</h3>
      <ul className="evolution__items">{rest.map(row)}</ul>

      <h3 className="build__stat">{t("Yetenek sırası")}</h3>
      <p>
        {diff.skills.before && diff.skills.after
          ? diff.skills.changed
            ? t("Değişti: {a} → {b}", { a: skillText(diff.skills.before.maxOrder), b: skillText(diff.skills.after.maxOrder) })
            : t("Aynı: {a}", { a: skillText(diff.skills.after.maxOrder) })
          : t("Bu yamalardan birinde yetenek sırası verisi yok.")}
      </p>
    </section>
  );
}

const SLOT = ["Q", "W", "E"];
const skillText = (order: number[]) => order.map((s) => SLOT[s - 1] ?? "?").join(" > ");

