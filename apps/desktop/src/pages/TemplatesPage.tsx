import { useState } from "react";
import { COMP_TEMPLATES, TEMPLATE_BY_ID, fittingChampions, type CompTemplate } from "../data/compTemplates";
import { championIconUrl, champions, latestVersion } from "../data/ddragon";
import { PHASE_TEXT } from "../data/traits";
import { useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { loadErrorMessage } from "../loadError";
import { DataBadge } from "../ui/DataBadge";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import { useOnline } from "../useOnline";
import "./TemplatesPage.css";

const SHOWN = 14;

/** Team plans: what each needs, where it is strong and weak, what beats it and which champions fit. */
export function TemplatesPage({ onOpenChampion }: { onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const online = useOnline();
  const [data, retry] = useAsync("templates-static", async () => ({ version: await latestVersion(), list: await champions() }));
  const [open, setOpen] = useState<string | null>(null);
  return (
    <LiquidGlass className="panel tiers templates" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Takım şablonları")} subtitle={t("Takımın nasıl oynayabileceğine dair planlar: neye ihtiyaç duyar, nerede güçlü, neye yenilir.")} />
      <p className="section-badge">
        <DataBadge editorial source={t("Vizier'in elle yazdığı planlar; maç verisi değil.")} />
      </p>
      {data.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <ul className="templates__list">
          {COMP_TEMPLATES.map((tpl) => (
            <li key={tpl.id} id={`template-${tpl.id}`}>
              <TemplateCard template={tpl} open={open === tpl.id} onToggle={() => setOpen(open === tpl.id ? null : tpl.id)} onOpen={setOpen} version={data.value.version} champions={data.value.list} onOpenChampion={onOpenChampion} />
            </li>
          ))}
        </ul>
      )}
    </LiquidGlass>
  );
}

function TemplateCard({
  template,
  open,
  onToggle,
  onOpen,
  version,
  champions: all,
  onOpenChampion,
}: {
  template: CompTemplate;
  open: boolean;
  onToggle: () => void;
  onOpen: (id: string) => void;
  version: string;
  champions: Map<number, import("../data/ddragon").Champion>;
  onOpenChampion: (id: number, position: string | null) => void;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <article className="templates__card" data-open={open || undefined}>
      <button type="button" className="templates__head" aria-expanded={open} onClick={onToggle}>
        <strong>{template.name[lang]}</strong>
        <span className="build__stat">{t(PHASE_TEXT[template.phase])}</span>
      </button>
      <p>{template.objective[lang]}</p>
      {open && (
        <>
          <p className="build__stat">{t("Planı taşıyan roller: {roles}", { roles: template.roles.map((r) => t(POSITIONS[r])).join(", ") })}</p>
          <h4 className="build__stat">{t("Gerekenler")}</h4>
          <ul>
            {template.needs.map((n, i) => (
              <li key={i}>{t("En az {count}: {need}", { count: n.min, need: n.lacking[lang] })}</li>
            ))}
          </ul>
          <p>
            <strong>{t("Güçlü yanı")}:</strong> {template.strengths[lang]}
          </p>
          <p>
            <strong>{t("Zayıf yanı")}:</strong> {template.weaknesses[lang]}
          </p>
          <p className="templates__counters">
            <strong>{t("Karşısında zorlanır")}:</strong>{" "}
            {template.counteredBy.map((id) => (
              <button key={id} type="button" className="templates__link" onClick={() => onOpen(id)}>
                {TEMPLATE_BY_ID.get(id)!.name[lang]}
              </button>
            ))}
          </p>
          <h4 className="build__stat">{t("Uyan şampiyonlar")}</h4>
          <ul className="templates__champions">
            {fittingChampions(template, all.values())
              .slice(0, SHOWN)
              .map(({ champion, fills }) => (
                <li key={champion.id}>
                  <button type="button" className="templates__champion" title={fills.map((i) => template.needs[i].lacking[lang]).join(", ")} onClick={() => onOpenChampion(champion.key, null)}>
                    <img src={championIconUrl(version, champion.id)} alt="" width={28} height={28} loading="lazy" />
                    {champion.name}
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </article>
  );
}
