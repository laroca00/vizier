import { useState } from "react";
import { championIconUrl, type Champion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { POSITIONS, positionLabel } from "../labels";
import { addPlanned, movePlanned, removePlanned, usePersonal } from "../personal";
import { PLAN_LIMIT, type PlanKind } from "../pickPlan";
import { Button } from "../ui/Button";
import { Select } from "../ui/Fields";
import "./PickPlanPanel.css";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const KINDS: PlanKind[] = ["picks", "bans"];

type Props = { champions: Map<number, Champion>; version: string };

/** Per role: the picks and bans Vizier tries in champ select, in order. */
export function PickPlanPanel({ champions, version }: Props) {
  const t = useT();
  const lang = useLang();
  const personal = usePersonal();
  const sorted = [...champions.values()].sort((a, b) => a.name.localeCompare(b.name, lang));
  const [championId, setChampionId] = useState(String(sorted[0]?.key ?? ""));
  const [role, setRole] = useState("MIDDLE");
  const [kind, setKind] = useState<PlanKind>("picks");
  const [dragging, setDragging] = useState<{ role: string; kind: PlanKind; index: number } | null>(null);

  const label = (k: PlanKind) => (k === "picks" ? t("Seçimler") : t("Banlar"));

  return (
    <section className="plan" aria-label={t("Seçim planı")}>
      <h2 className="draft__heading">{t("Seçim planı")}</h2>
      <p className="plan__hint">{t("Sıran gelince ilk uygun şampiyon seçilir. Banlı, alınmış veya sahip olmadığın şampiyonlar atlanır. Sürükleyerek sırala.")}</p>
      <form
        className="library__filters"
        onSubmit={(e) => {
          e.preventDefault();
          if (championId) addPlanned(role, kind, Number(championId));
        }}
      >
        <Select label={t("Şampiyon")} value={championId} options={sorted.map((c) => ({ value: String(c.key), label: c.name }))} onChange={setChampionId} />
        <Select label={t("Rol")} value={role} options={ROLES.map((r) => ({ value: r, label: t(POSITIONS[r]) }))} onChange={setRole} />
        <Select label={t("Tür")} value={kind} options={KINDS.map((k) => ({ value: k, label: label(k) }))} onChange={setKind} />
        <Button type="submit">{t("Plana ekle")}</Button>
      </form>
      <div className="plan__roles">
        {ROLES.filter((r) => personal.plan[r]).map((r) => (
          <div className="plan__role" key={r}>
            <h3 className="plan__role-name">{positionLabel(r, lang)}</h3>
            {KINDS.map((k) => {
              const list = personal.plan[r]?.[k] ?? [];
              return (
                <div className="plan__group" key={k}>
                  <span className="plan__kind">{t("{kind} ({count}/{max})", { kind: label(k), count: list.length, max: PLAN_LIMIT[k] })}</span>
                  <ol className="plan__list">
                    {list.map((id, index) => {
                      const champion = champions.get(id);
                      return (
                        <li
                          key={id}
                          className="plan__item"
                          draggable
                          onDragStart={() => setDragging({ role: r, kind: k, index })}
                          onDragOver={(e) => dragging?.role === r && dragging.kind === k && e.preventDefault()}
                          onDrop={() => {
                            if (dragging && dragging.role === r && dragging.kind === k) movePlanned(r, k, dragging.index, index);
                            setDragging(null);
                          }}
                          onDragEnd={() => setDragging(null)}
                        >
                          <span className="plan__rank">{index + 1}</span>
                          {champion && <img src={championIconUrl(version, champion.id)} alt="" width={28} height={28} />}
                          <span className="plan__name">{champion?.name ?? id}</span>
                          <Button size="small" variant="ghost" disabled={index === 0} aria-label={t("Yukarı taşı")} onClick={() => movePlanned(r, k, index, index - 1)}>
                            ↑
                          </Button>
                          <Button size="small" variant="ghost" disabled={index === list.length - 1} aria-label={t("Aşağı taşı")} onClick={() => movePlanned(r, k, index, index + 1)}>
                            ↓
                          </Button>
                          <Button size="small" variant="ghost" onClick={() => removePlanned(r, k, id)}>
                            {t("Çıkar")}
                          </Button>
                        </li>
                      );
                    })}
                    {list.length === 0 && <li className="plan__empty">{t("Boş")}</li>}
                  </ol>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
