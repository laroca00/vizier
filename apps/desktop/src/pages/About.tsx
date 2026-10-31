import notices from "../../../../THIRD_PARTY_NOTICES.md?raw";
import type { LcuStatus } from "../lcu";
import { LiquidGlass } from "../ui/LiquidGlass";

const CREDITS = [
  { name: "liquid-glass-js", use: "cam yüzeylerdeki kırılma", license: "MIT" },
  { name: "shadergradient", use: "arka plandaki gradient", license: "MIT" },
  { name: "glsl-noise", use: "gradient'teki gürültü", license: "MIT" },
  { name: "Geologica", use: "yazı tipi", license: "SIL Open Font License 1.1" },
];

export function About(_props: { lcu: LcuStatus }) {
  return (
    <LiquidGlass className="panel about" radius={28} strength={2.5}>
      <h1 className="about__title enter">Hakkında</h1>
      <p className="about__version enter">Sürüm {__APP_VERSION__}</p>

      <section className="about__section enter" aria-labelledby="about-riot">
        <h2 id="about-riot">Riot Games</h2>
        <p lang="en">
          Vizier isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
          officially involved in producing or managing Riot Games properties. Riot Games, and all associated
          properties are trademarks or registered trademarks of Riot Games, Inc.
        </p>
      </section>

      <section className="about__section enter" aria-labelledby="about-oss">
        <h2 id="about-oss">Açık kaynak</h2>
        <ul className="credits">
          {CREDITS.map((credit) => (
            <li key={credit.name}>
              <span className="credits__name">{credit.name}</span>
              <span className="credits__use">
                {credit.use}, {credit.license}
              </span>
            </li>
          ))}
        </ul>
        <details className="notices">
          <summary>Lisans metinleri</summary>
          <pre lang="en">{notices}</pre>
        </details>
      </section>
    </LiquidGlass>
  );
}
