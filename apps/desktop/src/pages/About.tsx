import notices from "../../../../THIRD_PARTY_NOTICES.md?raw";
import { LIMITED_HALF_WIDTH, RELIABLE_HALF_WIDTH, CONFIDENCE_LABEL } from "../data/confidence";
import { CoverageTable } from "../ui/CoverageTable";
import { DataBadge } from "../ui/DataBadge";
import { useT } from "../i18n";
import { LiquidGlass } from "../ui/LiquidGlass";
import "./About.css";

const CREDITS = [
  { name: "liquid-glass-js", use: "cam yüzeylerdeki kırılma", license: "MIT" },
  { name: "shadergradient", use: "arka plandaki gradient", license: "MIT" },
  { name: "glsl-noise", use: "gradient'teki gürültü", license: "MIT" },
  { name: "Geologica", use: "yazı tipi", license: "SIL Open Font License 1.1" },
];

export function About() {
  const t = useT();
  return (
    <LiquidGlass className="panel about" radius={28} strength={2.5} scroll>
      <h1 className="about__title enter">{t("Hakkında")}</h1>
      <p className="about__version enter">{t("Sürüm {version}", { version: __APP_VERSION__ })}</p>

      <section className="about__section enter" aria-labelledby="about-data">
        <h2 id="about-data">{t("Veriler nereden geliyor")}</h2>
        <ul className="about__facts">
          <li>{t("Maç istatistikleri: Vizier'in kendi tarayıcısı Riot Web API'den TR, EUW ve KR sunucularındaki dereceli maçları Demir'den Şampiyonluk'a her ligden toplar. Varsayılan görünüm Zümrüt ve üstüdür. Başka bir siteden veri alınmaz.")}</li>
          <li>{t("Şampiyon, eşya, rün ve yetenek bilgileri Riot'un Data Dragon ve CommunityDragon dosyalarından gelir.")}</li>
          <li>{t("Yalnızca en yeni iki yama tutulur; eski yamaların maçları güncel oyunu anlatmaz.")}</li>
          <li>{t("Oyun içi veriler (şampiyon seçimi, oyun saati, eşyalar) yalnızca Riot'un kendi istemci arayüzlerinden okunur; oyun belleğine dokunulmaz.")}</li>
        </ul>
        <CoverageTable />
        <h3>{t("Rozetler ne diyor")}</h3>
        <p>
          {t("Bir kazanma oranı, maç sayısına göre bir aralıkla birlikte okunur (%95 Wilson aralığı). Aralığın yarı genişliği en çok {reliable} puansa veri güvenilir, en çok {limited} puansa sınırlı, daha genişse yetersiz sayılır. Yetersiz veri gerçek gibi gösterilmez. Son yamanın dışında kalan veri eski diye işaretlenir.", {
            reliable: Math.round(RELIABLE_HALF_WIDTH * 100),
            limited: Math.round(LIMITED_HALF_WIDTH * 100),
          })}
        </p>
        <ul className="about__badges">
          {(["reliable", "limited", "insufficient", "outdated"] as const).map((level) => (
            <li key={level}>
              <span className="data-badge" data-confidence={level}>
                {t(CONFIDENCE_LABEL[level])}
              </span>
            </li>
          ))}
        </ul>
        <h3>{t("Elle tutulan içerik")}</h3>
        <p>
          {t("Bazı tablolar maçlardan hesaplanmaz; Vizier elle yazar ve günceller: şampiyon özellikleri, sınıflar, kısa açıklamalar ve nedenler. Bunlar istatistik değildir ve şu rozetle işaretlenir:")}{" "}
          <DataBadge editorial />
        </p>
      </section>

      <section className="about__section enter" aria-labelledby="about-riot">
        <h2 id="about-riot">Riot Games</h2>
        <p lang="en">
          Vizier isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
          officially involved in producing or managing Riot Games properties. Riot Games, and all associated
          properties are trademarks or registered trademarks of Riot Games, Inc.
        </p>
      </section>

      <section className="about__section enter" aria-labelledby="about-oss">
        <h2 id="about-oss">{t("Açık kaynak")}</h2>
        <ul className="credits">
          {CREDITS.map((credit) => (
            <li key={credit.name}>
              <span className="credits__name">{credit.name}</span>
              <span className="credits__use">
                {t(credit.use)}, {credit.license}
              </span>
            </li>
          ))}
        </ul>
        <details className="notices">
          <summary>{t("Lisans metinleri")}</summary>
          <pre lang="en">{notices}</pre>
        </details>
      </section>
    </LiquidGlass>
  );
}
