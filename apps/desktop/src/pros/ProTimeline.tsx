import { useState } from "react";
import { getProBuilds, type ProBuild, type ProFilter } from "../api";
import { championIconUrl, itemIconUrl, runeIconUrl, spellIconUrl } from "../data/ddragon";
import { intlLocale, useLang, useT } from "../i18n";
import { parseRunes, loadProStatic, SaveProButton, type ProStatic } from "../ProBuildList";
import { POSITIONS } from "../labels";
import { Button } from "../ui/Button";
import { ErrorState } from "../ui/States";
import { useAsync } from "../useAsync";
import { buySteps, compareProBuilds, opening, skillLetters } from "./proTimeline";
import "./ProTimeline.css";

type Props = { filter: ProFilter; emptyText: string; onOpenChampion: (championId: number, position: string | null) => void };

/** Each pro game as a timeline: start, buy order, skill order, runes and spells; two games can be set side by side. */
export function ProTimelineList({ filter, emptyText, onOpenChampion }: Props) {
  const t = useT();
  const [state, retry] = useAsync(`pro-timeline:${JSON.stringify(filter)}`, () => getProBuilds(filter));
  const [data] = useAsync("pro-static", loadProStatic);
  const [picked, setPicked] = useState<string[]>([]);
  if (state.status === "error") return <ErrorState message={t("Pro maçları alınamadı.")} onRetry={retry} />;
  if (state.status !== "done" || data.status !== "done") return <p className="build__note">{t("Pro maçları yükleniyor")}</p>;
  if (state.value.length === 0) return <p className="build__note">{emptyText}</p>;
  const keyOf = (b: ProBuild) => `${b.matchId}-${b.player}`;
  const chosen = picked.map((k) => state.value.find((b) => keyOf(b) === k)).filter((b): b is ProBuild => !!b);
  const toggle = (b: ProBuild) => setPicked((cur) => (cur.includes(keyOf(b)) ? cur.filter((k) => k !== keyOf(b)) : [...cur, keyOf(b)].slice(-2)));

  return (
    <div className="timeline">
      {chosen.length === 2 && <Compare a={chosen[0]} b={chosen[1]} data={data.value} onClear={() => setPicked([])} />}
      <ul className="timeline__list">
        {state.value.map((b) => (
          <li key={keyOf(b)}>
            <Game build={b} data={data.value} selected={picked.includes(keyOf(b))} onToggle={() => toggle(b)} onOpenChampion={onOpenChampion} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Icons({ ids, data, size = 28, dim }: { ids: number[]; data: ProStatic; size?: number; dim?: (id: number) => boolean }) {
  return (
    <>
      {ids.map((id, i) => (
        <img key={`${id}-${i}`} src={itemIconUrl(data.version, id)} alt={data.items.get(id)?.name ?? ""} title={data.items.get(id)?.name} width={size} height={size} data-minor={dim?.(id) || undefined} loading="lazy" />
      ))}
    </>
  );
}

function Game({ build, data, selected, onToggle, onOpenChampion }: { build: ProBuild; data: ProStatic; selected: boolean; onToggle: () => void; onOpenChampion: Props["onOpenChampion"] }) {
  const t = useT();
  const lang = useLang();
  const champion = data.champions.get(build.championId);
  const opponent = build.opponentChampionId ? data.champions.get(build.opponentChampionId) : undefined;
  const complete = (id: number) => !!data.items.get(id)?.complete;
  const steps = buySteps(build.purchases, complete);
  const perks = parseRunes(build.runes).selectedPerkIds;
  const rune = (id: number, size: number) => {
    const r = data.runes.get(id);
    return r ? <img key={id} src={runeIconUrl(r.icon)} alt={r.name} title={r.name} width={size} height={size} /> : null;
  };
  const date = new Intl.DateTimeFormat(intlLocale(lang), { dateStyle: "medium" }).format(build.gameStart);
  return (
    <article className="timeline__game" data-result={build.win ? "win" : "loss"} data-selected={selected || undefined}>
      <header className="timeline__head">
        {champion && <img src={championIconUrl(data.version, champion.id)} alt={champion.name} width={36} height={36} />}
        <div>
          <strong>{build.player}</strong> <span className="build__stat">{build.team || t("Takımsız")}</span>
          <p className="build__stat">
            {[champion?.name, opponent ? t("karşısında {opponent}", { opponent: opponent.name }) : null, build.position ? t(POSITIONS[build.position] ?? build.position) : null, t("Yama {patch}", { patch: build.patch }), date, build.win ? t("Galibiyet") : t("Mağlubiyet")].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="timeline__actions">
          <Button size="small" variant={selected ? "primary" : "ghost"} aria-pressed={selected} onClick={onToggle}>
            {selected ? t("Seçildi") : t("Karşılaştır")}
          </Button>
          <SaveProButton build={build} data={data} />
          <Button size="small" variant="ghost" onClick={() => onOpenChampion(build.championId, build.position || null)}>
            {t("Şampiyonu aç")}
          </Button>
        </span>
      </header>
      <ol className="timeline__track" aria-label={t("Alış sırası")}>
        {build.startItems.length > 0 && (
          <li className="timeline__start">
            <span className="build__stat">{t("Başlangıç")}</span>
            <span className="timeline__icons">
              <Icons ids={build.startItems} data={data} />
            </span>
          </li>
        )}
        {steps.map((s, i) => (
          <li key={i} data-complete={s.complete || undefined}>
            <img src={itemIconUrl(data.version, s.id)} alt={data.items.get(s.id)?.name ?? ""} title={data.items.get(s.id)?.name} width={s.complete ? 34 : 24} height={s.complete ? 34 : 24} loading="lazy" />
            {s.count > 1 && <span className="timeline__count">×{s.count}</span>}
          </li>
        ))}
      </ol>
      <div className="timeline__meta">
        <span className="timeline__icons" aria-label={t("Rünler")}>
          {perks.slice(0, 1).map((id) => rune(id, 30))}
          {perks.slice(1, 4).map((id) => rune(id, 22))}
          <span className="timeline__gap" />
          {perks.slice(4, 6).map((id) => rune(id, 22))}
        </span>
        <span className="timeline__icons" aria-label={t("Büyüler")}>
          {build.spells.map((id, i) => {
            const spell = [...data.spells.values()].find((s) => s.key === id);
            return spell ? <img key={i} src={spellIconUrl(data.version, spell.id)} alt={spell.name} title={spell.name} width={24} height={24} /> : null;
          })}
        </span>
        {build.skillOrder.length > 0 && (
          <span className="timeline__skills" title={skillLetters(build.skillOrder).join(" ")}>
            {t("Yetenek sırası")}: {skillLetters(build.skillOrder).slice(0, 9).join(" ")}
            <span className="build__stat"> · {t("başlangıç {opening}", { opening: opening(build.skillOrder).join("") })}</span>
          </span>
        )}
      </div>
    </article>
  );
}

function Compare({ a, b, data, onClear }: { a: ProBuild; b: ProBuild; data: ProStatic; onClear: () => void }) {
  const t = useT();
  const c = compareProBuilds(a, b, (id) => !!data.items.get(id)?.complete);
  const row = (label: string, same: boolean) => (
    <li data-same={same || undefined}>
      <span>{label}</span>
      <span>{same ? t("Aynı") : t("Farklı")}</span>
    </li>
  );
  return (
    <section className="timeline__compare" aria-label={t("İki pro build'in karşılaştırması")}>
      <h3 className="draft__heading">
        {a.player} · {b.player}
      </h3>
      <div className="timeline__sets">
        <div>
          <p className="build__stat">{t("Ortak eşyalar")}</p>
          <span className="timeline__icons">{c.sharedItems.length ? <Icons ids={c.sharedItems} data={data} /> : "–"}</span>
        </div>
        <div>
          <p className="build__stat">{t("Yalnız {player}", { player: a.player })}</p>
          <span className="timeline__icons">{c.onlyA.length ? <Icons ids={c.onlyA} data={data} /> : "–"}</span>
        </div>
        <div>
          <p className="build__stat">{t("Yalnız {player}", { player: b.player })}</p>
          <span className="timeline__icons">{c.onlyB.length ? <Icons ids={c.onlyB} data={data} /> : "–"}</span>
        </div>
      </div>
      <ul className="timeline__same">
        {row(t("Ana rün"), c.sameKeystone)}
        {row(t("Rün sayfası"), c.sameRunePage)}
        {row(t("Büyüler"), c.sameSpells)}
        {row(t("Başlangıç eşyaları"), c.sameStart)}
        {c.openings[0].length > 0 && c.openings[1].length > 0 && row(t("Yetenek açılışı: {a} / {b}", { a: c.openings[0].join(""), b: c.openings[1].join("") }), c.sameOpening)}
      </ul>
      <Button size="small" variant="ghost" onClick={onClear}>
        {t("Seçimi temizle")}
      </Button>
    </section>
  );
}
