import { ELEMENT_NAMES, type Element } from "../dragons";
import type { WidgetContext } from "./context";

function Row({ label, list, point, t }: { label: string; list: Element[]; point: boolean; t: WidgetContext["t"] }) {
  return (
    <p className="overlay__row overlay__dragon-row" data-point={point || undefined}>
      <span>{label}</span>
      <span className="overlay__drakes">
        {list.map((element, i) => (
          <span key={i} className="overlay__drake" data-element={element} title={t(ELEMENT_NAMES[element])} />
        ))}
        <span className="overlay__value">{list.length}</span>
      </span>
    </p>
  );
}

export function DragonsWidget({ t, dragons }: WidgetContext) {
  if (!dragons) return null;
  const { ours, theirs, soul, soulTaken, soulPoint, elders } = dragons;
  const soulName = soul ? t(ELEMENT_NAMES[soul]) : null;
  const line = soulTaken
    ? t(soulTaken === "ours" ? "{soul} ruhu bizde" : "{soul} ruhu rakipte", { soul: soulName ?? "" })
    : soulPoint.ours && soulPoint.theirs
      ? t("İki takım da ruh noktasında")
      : soulPoint.ours
        ? t("Ruh noktasındayız")
        : soulPoint.theirs
          ? t("Rakip ruh noktasında")
          : soulName
            ? t("Ruh: {soul}", { soul: soulName })
            : null;
  return (
    <section className="overlay__card overlay__dragons">
      <Row label={t("Biz")} list={ours} point={soulPoint.ours} t={t} />
      <Row label={t("Rakip")} list={theirs} point={soulPoint.theirs} t={t} />
      {line && <p className="overlay__dragon-line" data-soon={soulPoint.ours || soulPoint.theirs || undefined}>{line}</p>}
      {elders.ours + elders.theirs > 0 && (
        <p className="overlay__caption">{t("Yaşlı ejder: biz {ours}, rakip {theirs}", { ours: elders.ours, theirs: elders.theirs })}</p>
      )}
    </section>
  );
}
