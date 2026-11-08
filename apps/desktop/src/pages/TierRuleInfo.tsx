import { useState } from "react";
import type { TierList } from "../api";
import { formatPercent, useLang, useT } from "../i18n";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

/** Explains the tier rule with the server's own numbers, so the text can't drift from the code. */
export function TierRuleInfo({ list }: { list: TierList }) {
  const t = useT();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const rule = list.rule;
  if (!rule) return null;
  const percent = (n: number) => formatPercent(n, lang, 2);
  return (
    <>
      <Button variant="ghost" size="small" onClick={() => setOpen(true)}>
        {t("Tier nasıl hesaplanıyor?")}
      </Button>
      <Modal open={open} title={t("Tier nasıl hesaplanıyor?")} onClose={() => setOpen(false)}>
        <p>{t("Kazanma oranı, rolün ortalamasına doğru çekilir: sanki her şampiyonun ortalama oranla {games} maçı daha varmış gibi. Az maçlı şampiyon bu yüzden ortada kalır.", { games: rule.priorGames })}</p>
        <p>{t("Üstüne seçilme ve yasaklanma payı eklenir: rol ortalamasının her iki katı için {points} puan.", { points: (rule.presenceWeight * 100).toFixed(1) })}</p>
        <ul>
          {rule.cuts.map((cut) => (
            <li key={cut.tier}>{t("{tier}: skor {score} ve üstü", { tier: cut.tier, score: percent(cut.score) })}</li>
          ))}
          <li>{t("D: bunun altı")}</li>
        </ul>
        <p>
          {t("Liste {listGames} maçtan başlar, tier {tierGames} maçtan sonra güvenilir sayılır. Bu listede {games} oyuncu maçı ve {count} şampiyon var.", {
            listGames: rule.listGames,
            tierGames: rule.tierGames,
            games: list.games.toLocaleString(),
            count: list.champions.length,
          })}
        </p>
      </Modal>
    </>
  );
}
