import { ClashPlanner } from "../simulator/ClashPlanner";
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { cycleSlot, firstPickable } from "../simulator/keys";
import { useDraftHistory } from "../simulator/history";
import { CompSummary, PhaseCurves, WinConditions } from "../CompAnalysis";
import { championIconUrl, roleIconUrl, type Champion } from "../data/ddragon";
import { adviceAgainst, analyzeComp, compDimensions, curveRead, DIMENSION_NAMES, teamCurve } from "../data/traits";
import { useChampSelect } from "../lcu";
import { draftCode, fromChampSelect, readDraftCode } from "../simulator/transfer";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import "../library/library.css";
import {
  deleteDraft,
  duplicateDraft,
  emptyDraft,
  nextSlot,
  place,
  MAX_BANS,
  ROLES,
  saveDraft,
  filterDrafts,
  parseTags,
  tagsOf,
  MAX_NOTES,
  swap,
  toggleBan,
  useSavedDrafts,
  type SavedDraft,
  type Side,
} from "../simulator/store";
import "../simulator/simulator.css";
import { Button } from "../ui/Button";
import { FilterChips, SearchInput, Select, Toggle } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { ConfirmDialog, Modal } from "../ui/Modal";
import { PageHeader } from "../ui/Page";
import { ErrorState, Skeleton } from "../ui/States";
import { Tabs } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import { useAsync } from "../useAsync";
import { ThreatsPanel } from "../draft/ThreatsPanel";
import { PickSuggestions } from "../draft/PickSuggestions";
import { loadChampionRoles, type ChampionRoles } from "./ChampionsPage";

const ALL = "ALL";
const SLOT_ROLE = "SLOT";

export function SimulatorPage() {
  const t = useT();
  const [data, retry] = useAsync("champion-roles", loadChampionRoles);
  return (
    <LiquidGlass className="panel tiers simulator" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Draft simülatörü")} subtitle={t("İki takımı kur, kompozisyonları yan yana gör. Kazanma ihtimali tahmin edilmez.")} />
      {data.status === "error" ? (
        <ErrorState message={t("Oyun verisi alınamadı.")} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={8} label={t("Yükleniyor")} />
      ) : (
        <Simulator data={data.value} />
      )}
    </LiquidGlass>
  );
}

function Simulator({ data }: { data: ChampionRoles }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const saved = useSavedDrafts();
  const session = useChampSelect();
  const { draft, set: setDraft, undo, redo, canUndo, canRedo } = useDraftHistory();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) undo();
      else if (key === "y" || (key === "z" && e.shiftKey)) redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
  // Explicit when the player clicked the slot; otherwise Vizier may move the pick to its role.
  const [active, setActive] = useState<{ side: Side; slot: number; explicit?: boolean } | null>({ side: "blue", slot: 0 });
  const [pickOrder, setPickOrder] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState(SLOT_ROLE);
  const [name, setName] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SavedDraft | null>(null);
  const [compare, setCompare] = useState<[string, string] | null>(null);
  const [compareWith, setCompareWith] = useState<string>("");
  const [banning, setBanning] = useState(false);
  const [codeText, setCodeText] = useState("");
  const [side, setSide] = useState<Side>("blue");
  const [tagsText, setTagsText] = useState("");
  const [notes, setNotes] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [savedQuery, setSavedQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Typing anywhere on the page starts a champion search.
  useEffect(() => {
    const onType = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1 || e.key === " ") return;
      if (target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable)) return;
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onType);
    return () => window.removeEventListener("keydown", onType);
  }, []);

  const picked = new Set([...draft.blue, ...draft.red].filter((id) => id > 0));
  const unavailable = new Set([...picked, ...draft.bans]);
  const role = roleFilter === SLOT_ROLE ? (active ? ROLES[active.slot] : null) : roleFilter === ALL ? null : roleFilter;
  const needle = query.trim().toLocaleLowerCase(lang);
  const pool = [...data.champions.values()]
    .filter((c) => (!needle || c.name.toLocaleLowerCase(lang).includes(needle)) && (!role || data.roles.get(c.key)?.has(role)))
    .sort((a, b) => a.name.localeCompare(b.name, lang));

  const isDisabled = (id: number) => (banning ? picked.has(id) || (draft.bans.length >= MAX_BANS && !draft.bans.includes(id)) : !active || unavailable.has(id));

  function searchKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const found = firstPickable(pool, isDisabled);
      if (!found) return;
      choose(found.key);
      setQuery("");
    } else if (e.key === "Tab") {
      e.preventDefault();
      setBanning(false);
      setActive({ ...cycleSlot(active, e.shiftKey), explicit: true });
    }
  }

  function choose(championId: number) {
    if (banning) {
      setDraft(toggleBan(draft, championId));
      return;
    }
    if (!active) return;
    let slot = active.slot;
    if (!active.explicit) {
      // Put the champion in the role it's played most, when that slot is free.
      const roles = [...(data.roles.get(championId)?.entries() ?? [])].sort((a, b) => b[1].games - a[1].games);
      const free = roles.map(([role]) => ROLES.indexOf(role as (typeof ROLES)[number])).find((i) => i >= 0 && draft[active.side][i] === 0);
      if (free !== undefined) slot = free;
    }
    const next = place(draft, active.side, slot, championId);
    setDraft(next);
    setActive(nextSlot(next, pickOrder, active));
  }

  function clearSlot(side: Side, slot: number) {
    setDraft({ ...draft, [side]: draft[side].map((id, i) => (i === slot ? 0 : id)) });
    setActive({ side, slot, explicit: true });
  }

  function load(d: SavedDraft) {
    setDraft({ blue: [...d.blue], red: [...d.red], bans: [...d.bans] });
    setName(d.name);
    setSide(d.side);
    setTagsText(d.tags.join(", "));
    setNotes(d.notes);
    setCurrentId(d.id);
    setActive(nextSlot(d, pickOrder, { side: "blue", slot: 0 }));
  }

  function reset() {
    setDraft(emptyDraft());
    setCurrentId(null);
    setName("");
    setSide("blue");
    setTagsText("");
    setNotes("");
    setActive({ side: "blue", slot: 0 });
  }

  const team = (ids: number[]) => ids.map((id) => data.champions.get(id)).filter((c): c is Champion => c !== undefined);
  const blue = team(draft.blue);
  const red = team(draft.red);
  const blueReport = analyzeComp(blue);
  const redReport = analyzeComp(red);
  const blueCurve = teamCurve(blue);
  const redCurve = teamCurve(red);
  const curveLine = curveRead(blueCurve, redCurve);
  const curve = blueCurve && redCurve && curveLine ? { ours: blueCurve, theirs: redCurve, read: curveLine } : null;

  return (
    <>
      <div className="library__filters">
        <Toggle label={t("Dereceli seçim sırası")} hint={t("Boş yerler B1, R1, R2, B2... sırasıyla dolar.")} checked={pickOrder} onChange={setPickOrder} />
        <Button variant="ghost" disabled={!canUndo} title="Ctrl+Z" onClick={undo}>
          {t("Geri al")}
        </Button>
        <Button variant="ghost" disabled={!canRedo} title="Ctrl+Y" onClick={redo}>
          {t("Yinele")}
        </Button>
        <Button variant="ghost" onClick={reset}>
          {t("Sıfırla")}
        </Button>
        <Button
          variant="ghost"
          disabled={!session}
          title={session ? undefined : t("Şampiyon seçimi açıkken kullanılabilir.")}
          onClick={() => {
            if (!session) return;
            const next = fromChampSelect(session);
            setDraft(next);
            setCurrentId(null);
            setName("");
            setActive(nextSlot(next, pickOrder, { side: "blue", slot: 0 }));
            toast("success", t("Şampiyon seçimi yüklendi"));
          }}
        >
          {t("Şampiyon seçimini yükle")}
        </Button>
        <Button
          variant="ghost"
          disabled={picked.size === 0}
          onClick={() => {
            const line = (label: string, ids: number[]) =>
              `${label}: ${ids
                .map((id, slot) => (id ? `${data.champions.get(id)?.name ?? id} (${t(POSITIONS[ROLES[slot]])})` : null))
                .filter(Boolean)
                .join(", ")}`;
            const bans = draft.bans.map((id) => data.champions.get(id)?.name ?? id).join(", ");
            const text = [line(t("Mavi takım"), draft.blue), line(t("Kırmızı takım"), draft.red), bans ? `${t("Yasaklar")}: ${bans}` : null, draftCode(draft)].filter(Boolean).join("\n");
            navigator.clipboard.writeText(text).then(
              () => toast("success", t("Draft panoya kopyalandı")),
              () => toast("error", t("Panoya kopyalanamadı.")),
            );
          }}
        >
          {t("Kopyala")}
        </Button>
      </div>

      <form
        className="library__collection-form"
        onSubmit={(e) => {
          e.preventDefault();
          const next = readDraftCode(codeText);
          if (!next) {
            toast("error", t("Bu bir Vizier draft kodu değil."));
            return;
          }
          setDraft(next);
          setCurrentId(null);
          setName("");
          setActive(nextSlot(next, pickOrder, { side: "blue", slot: 0 }));
          setCodeText("");
          toast("success", t("Draft koddan yüklendi"));
        }}
      >
        <input className="text-input" aria-label={t("Draft kodu")} placeholder={t("Draft kodu yapıştır")} value={codeText} onChange={(e) => setCodeText(e.target.value)} />
        <Button type="submit" disabled={!codeText.trim()}>
          {t("Koddan yükle")}
        </Button>
        <Button
          variant="ghost"
          disabled={picked.size === 0}
          onClick={() =>
            navigator.clipboard.writeText(draftCode(draft)).then(
              () => toast("success", t("Draft kodu kopyalandı")),
              () => toast("error", t("Panoya kopyalanamadı.")),
            )
          }
        >
          {t("Kodu kopyala")}
        </Button>
      </form>

      <div className="sim">
        <TeamColumn
          side="blue"
          label={t("Mavi takım")}
          ids={draft.blue}
          data={data}
          active={active}
          onSelect={(slot) => setActive({ side: "blue", slot, explicit: true })}
          onClear={(slot) => clearSlot("blue", slot)}
          onSwap={(a, b) => setDraft(swap(draft, "blue", a, b))}
        />

        <section className="sim__picker" aria-label={t("Şampiyon seç")}>
          <p className="build__note">
            {active
              ? active.explicit || !pickOrder
                ? t("{side} takım, {role} için seç", { side: active.side === "blue" ? t("Mavi") : t("Kırmızı"), role: t(POSITIONS[ROLES[active.slot]]) })
                : t("Sıra {side} takımda; şampiyon boşsa kendi rolüne yerleşir.", { side: active.side === "blue" ? t("Mavi") : t("Kırmızı") })
              : t("İki takım da dolu. Değiştirmek için bir yere tıkla.")}
          </p>
          <p className="build__note">{t("Yaz, Enter ile ilk sonucu seç, Tab ile sıradaki yere geç.")}</p>
          <div className="sim__picker-filters">
            <Tabs
              label={t("Ne seçiliyor")}
              size="small"
              items={[
                { id: "pick", label: t("Seçim") },
                { id: "ban", label: t("Yasak {count}/{max}", { count: draft.bans.length, max: MAX_BANS }) },
              ]}
              value={banning ? "ban" : "pick"}
              onChange={(id) => setBanning(id === "ban")}
            />
            <SearchInput label={t("Şampiyon ara")} value={query} onChange={setQuery} placeholder={t("Şampiyon ara")} inputRef={searchRef} onKeyDown={searchKey} />
            <Select
              label={t("Rol")}
              hideLabel
              value={roleFilter}
              options={[
                { value: SLOT_ROLE, label: t("Seçili yerin rolü") },
                { value: ALL, label: t("Tüm roller") },
                ...ROLES.map((r) => ({ value: r, label: t(POSITIONS[r]) })),
              ]}
              onChange={setRoleFilter}
            />
          </div>
          {!banning && active && (
            <div className="sim__suggest">
              <h3 className="draft__heading">{t("{role} için öneriler", { role: t(POSITIONS[ROLES[active.slot]]) })}</h3>
              <PickSuggestions
                role={ROLES[active.slot]}
                opponentId={draft[active.side === "blue" ? "red" : "blue"][active.slot] || null}
                allies={draft[active.side].filter((id, i) => id > 0 && i !== active.slot).map((id) => data.champions.get(id)).filter((c): c is Champion => c !== undefined)}
                unavailable={unavailable}
                champions={data.champions}
                version={data.version}
                onPick={(id) => {
                  const slot = active.slot;
                  const next = place(draft, active.side, slot, id);
                  setDraft(next);
                  setActive(nextSlot(next, pickOrder, active));
                }}
                limit={4}
              />
            </div>
          )}
          {draft.bans.length > 0 && (
            <ul className="sim__bans" aria-label={t("Yasaklar")}>
              {draft.bans.map((id) => {
                const c = data.champions.get(id);
                return c ? (
                  <li key={id}>
                    <button type="button" title={t("{champion} yasağını kaldır", { champion: c.name })} aria-label={t("{champion} yasağını kaldır", { champion: c.name })} onClick={() => setDraft(toggleBan(draft, id))}>
                      <img src={championIconUrl(data.version, c.id)} alt="" width={28} height={28} />
                    </button>
                  </li>
                ) : null;
              })}
            </ul>
          )}
          <ul className="sim__grid">
            {pool.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  disabled={isDisabled(c.key)}
                  aria-pressed={banning ? draft.bans.includes(c.key) : undefined}
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => choose(c.key)}
                >
                  <img src={championIconUrl(data.version, c.id)} alt="" width={44} height={44} loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <TeamColumn
          side="red"
          label={t("Kırmızı takım")}
          ids={draft.red}
          data={data}
          active={active}
          onSelect={(slot) => setActive({ side: "red", slot, explicit: true })}
          onClear={(slot) => clearSlot("red", slot)}
          onSwap={(a, b) => setDraft(swap(draft, "red", a, b))}
        />
      </div>

      {curve && (
        <section aria-label={t("Oyun evreleri")}>
          <h2 className="draft__heading">{t("Oyun evreleri")}</h2>
          <p className="build__note">{t("Yorum mavi takımın gözünden.")}</p>
          <PhaseCurves ours={curve.ours} theirs={curve.theirs} read={curve.read} ourLabel={t("mavi")} theirLabel={t("kırmızı")} />
        </section>
      )}

      <div className="sim__analysis">
        <section aria-label={t("Mavi takım")}>
          <h2 className="draft__heading">{t("Mavi takım")}</h2>
          {blue.length === 0 ? <p className="draft__empty">{t("Henüz seçim yok")}</p> : <CompSummary team={blue} report={blueReport} label={t("Mavi takım")} />}
          {blue.length >= 3 && <WinConditions team={blue} />}
          <Plans advice={adviceAgainst(redReport, blueReport)} title={t("Kırmızıya karşı plan")} />
          <ThreatsPanel enemies={red} title={t("Kırmızı takımın tehditleri")} />
        </section>
        <section aria-label={t("Kırmızı takım")}>
          <h2 className="draft__heading">{t("Kırmızı takım")}</h2>
          {red.length === 0 ? <p className="draft__empty">{t("Henüz seçim yok")}</p> : <CompSummary team={red} report={redReport} label={t("Kırmızı takım")} />}
          {red.length >= 3 && <WinConditions team={red} />}
          <Plans advice={adviceAgainst(blueReport, redReport)} title={t("Maviye karşı plan")} />
          <ThreatsPanel enemies={blue} title={t("Mavi takımın tehditleri")} />
        </section>
      </div>

      <ClashPlanner data={data} unavailable={new Set([...draft.red, ...draft.bans].filter((id) => id > 0))} onApply={(team) => setDraft({ ...draft, blue: team })} />

      <section className="sim__saved" aria-label={t("Kayıtlı draftlar")}>
        <h2 className="draft__heading">{t("Kayıtlı draftlar")}</h2>
        <form
          className="library__collection-form"
          onSubmit={(e) => {
            e.preventDefault();
            const finalName = name.trim() || t("Draft {n}", { n: saved.length + 1 });
            setCurrentId(saveDraft(draft, finalName, currentId, { side, tags: parseTags(tagsText), notes: notes.trim() }));
            setName(finalName);
            toast("success", t("{name} kaydedildi", { name: finalName }));
          }}
        >
          <input className="text-input" aria-label={t("Draft adı")} placeholder={t("Draft adı")} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
          <Select
            label={t("Oynadığın taraf")}
            hideLabel
            value={side}
            options={[
              { value: "blue", label: t("Mavi taraf") },
              { value: "red", label: t("Kırmızı taraf") },
            ]}
            onChange={setSide}
          />
          <input className="text-input" aria-label={t("Etiketler")} placeholder={t("Etiketler (virgülle)")} value={tagsText} onChange={(e) => setTagsText(e.target.value)} />
          <textarea className="text-input" aria-label={t("Not")} placeholder={t("Not")} value={notes} maxLength={MAX_NOTES} rows={2} onChange={(e) => setNotes(e.target.value)} />
          <Button type="submit" variant="primary">
            {currentId ? t("Güncelle") : t("Kaydet")}
          </Button>
          {currentId && (
            <Button
              onClick={() => {
                setCurrentId(null);
                setName("");
              }}
            >
              {t("Yeni draft olarak ayır")}
            </Button>
          )}
        </form>
        {saved.length === 0 ? (
          <p className="draft__empty">{t("Kaydettiğin draftlar burada listelenir.")}</p>
        ) : (
          <>
          <SearchInput label={t("Kayıtlı draftlarda ara")} placeholder={t("Ad ya da notta ara")} value={savedQuery} onChange={setSavedQuery} />
          {tagsOf(saved).length > 0 && (
            <FilterChips label={t("Etiketler")} chips={tagsOf(saved).map((tag) => ({ id: tag, label: tag }))} selected={tagFilter} onChange={setTagFilter} />
          )}
          <ul className="sim__saved-list">
            {filterDrafts(saved, tagFilter, savedQuery).map((d) => (
              <li key={d.id} data-current={d.id === currentId || undefined}>
                <span className="library__name">
                  {d.name}
                  <span className="build__stat sim__meta">{[t(d.side === "blue" ? "Mavi taraf" : "Kırmızı taraf"), ...d.tags].join(" · ")}</span>
                  {d.notes && <span className="build__stat sim__meta">{d.notes}</span>}
                </span>
                <span className="sim__mini">
                  {[...d.blue, ...d.red].map((id, i) => {
                    const c = data.champions.get(id);
                    return c ? <img key={i} src={championIconUrl(data.version, c.id)} alt={c.name} width={22} height={22} data-red={i >= 5 || undefined} /> : <span key={i} className="sim__mini-empty" />;
                  })}
                </span>
                <Button size="small" onClick={() => load(d)}>
                  {t("Aç")}
                </Button>
                <Button size="small" variant="ghost" onClick={() => duplicateDraft(d.id, (n) => t("{name} kopyası", { name: n }))}>
                  {t("Kopyala")}
                </Button>
                <Button size="small" variant="ghost" disabled={saved.length < 2} onClick={() => setCompareWith(d.id)}>
                  {t("Karşılaştır")}
                </Button>
                <Button size="small" variant="ghost" onClick={() => setDeleting(d)}>
                  {t("Sil")}
                </Button>
              </li>
            ))}
          </ul>
          </>
        )}
      </section>

      {compareWith && !compare && (
        <Modal open title={t("Neyle karşılaştırılsın?")} onClose={() => setCompareWith("")}>
          <ul className="sim__choose">
            {saved
              .filter((d) => d.id !== compareWith)
              .map((d) => (
                <li key={d.id}>
                  <Button onClick={() => setCompare([compareWith, d.id])}>{d.name}</Button>
                </li>
              ))}
          </ul>
        </Modal>
      )}
      {compare && (
        <CompareModal
          drafts={compare.map((id) => saved.find((d) => d.id === id)).filter((d): d is SavedDraft => !!d)}
          data={data}
          onClose={() => {
            setCompare(null);
            setCompareWith("");
          }}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={t("Draft silinsin mi?")}
        message={t("{name} bu bilgisayardan silinir. Bu geri alınamaz.", { name: deleting?.name ?? "" })}
        confirmLabel={t("Sil")}
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) deleteDraft(deleting.id);
          if (deleting?.id === currentId) setCurrentId(null);
          setDeleting(null);
        }}
      />
    </>
  );
}

function Plans({ advice, title }: { advice: { title: string; detail: string }[]; title: string }) {
  const t = useT();
  if (advice.length === 0) return null;
  return (
    <>
      <h3 className="draft__heading">{title}</h3>
      <ul className="advice">
        {advice.map((a) => (
          <li key={a.title}>
            <p>{t(a.title)}</p>
            <p>{t(a.detail)}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

type TeamProps = {
  side: Side;
  label: string;
  ids: number[];
  data: ChampionRoles;
  active: { side: Side; slot: number } | null;
  onSelect: (slot: number) => void;
  onClear: (slot: number) => void;
  onSwap: (a: number, b: number) => void;
};

function TeamColumn({ side, label, ids, data, active, onSelect, onClear, onSwap }: TeamProps) {
  const t = useT();
  return (
    <section className="sim__team" data-side={side} aria-label={label}>
      <h2 className="draft__heading">{label}</h2>
      <ol>
        {ids.map((id, slot) => {
          const champion = data.champions.get(id);
          const isActive = active?.side === side && active.slot === slot;
          return (
            <li key={slot} className="sim__slot" data-active={isActive || undefined}>
              <button type="button" className="sim__slot-main" aria-pressed={isActive} onClick={() => onSelect(slot)}>
                <img className="sim__role" src={roleIconUrl(ROLES[slot])} alt="" width={16} height={16} />
                {champion ? <img src={championIconUrl(data.version, champion.id)} alt="" width={36} height={36} /> : <span className="sim__empty" />}
                <span className="library__who">
                  <span className="library__name">{champion?.name ?? t("Boş")}</span>
                  <span className="build__stat">{t(POSITIONS[ROLES[slot]])}</span>
                </span>
              </button>
              <span className="sim__slot-actions">
                {slot > 0 && (
                  <button type="button" aria-label={t("Bir yukarı taşı")} title={t("Bir yukarı taşı")} onClick={() => onSwap(slot, slot - 1)}>
                    ↑
                  </button>
                )}
                {champion && (
                  <button type="button" aria-label={t("{champion} kaldır", { champion: champion.name })} title={t("Kaldır")} onClick={() => onClear(slot)}>
                    ×
                  </button>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function CompareModal({ drafts, data, onClose }: { drafts: SavedDraft[]; data: ChampionRoles; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const team = (ids: number[]) => ids.map((id) => data.champions.get(id)).filter((c): c is Champion => c !== undefined);
  return (
    <Modal open wide title={t("Draft karşılaştırması")} onClose={onClose}>
      <table className="sim__compare">
        <thead>
          <tr>
            <th />
            {drafts.flatMap((d) => [
              <th key={`${d.id}b`} scope="col">
                {d.name}, {t("Mavi")}
              </th>,
              <th key={`${d.id}r`} scope="col">
                {d.name}, {t("Kırmızı")}
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {(["frontline", "backline", "poke", "pick", "teamfight"] as const).map((dimension) => (
            <tr key={dimension}>
              <th scope="row">{t(DIMENSION_NAMES[dimension])}</th>
              {drafts.flatMap((d) =>
                [d.blue, d.red].map((ids, i) => {
                  const report = compDimensions(team(ids)).find((r) => r.dimension === dimension)!;
                  return (
                    <td key={`${d.id}${i}`} title={report.names.join(", ")}>
                      {report.names.length}
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
          <tr>
            <th scope="row">{t("Büyü hasarı")}</th>
            {drafts.flatMap((d) =>
              [d.blue, d.red].map((ids, i) => {
                const report = analyzeComp(team(ids));
                return <td key={`${d.id}m${i}`}>{report.champions ? formatPercent(report.magic, lang) : "–"}</td>;
              }),
            )}
          </tr>
        </tbody>
      </table>
    </Modal>
  );
}
