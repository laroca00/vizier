import { useT } from "../i18n";
import { loadChampionRoles } from "../pages/ChampionsPage";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { useAsync } from "../useAsync";
import { checkBuild } from "./compat";
import type { LibraryData } from "./data";
import { saveBuild, type SavedBuild } from "./store";

// Roles with fewer than this share of the champion's games are not offered as normal.
const MIN_ROLE_PICK_RATE = 0.02;

/** What is off in a saved build, with a fix per issue that the player accepts one by one. */
export function CompatPanel({ build, data }: { build: SavedBuild; data: LibraryData }) {
  const t = useT();
  const toast = useToast();
  const [roles] = useAsync("champion-roles", loadChampionRoles);
  const champion = data.champions.get(build.championId);
  const rolesOf =
    roles.status === "done" && champion
      ? (id: number) => [...(roles.value.roles.get(id)?.entries() ?? [])].filter(([, stats]) => stats.pickRate >= MIN_ROLE_PICK_RATE).map(([role]) => role)
      : null;
  const issues = checkBuild(build, { items: data.items, details: data.details, styles: data.styles, rolesOf });
  if (issues.length === 0) return null;
  return (
    <section className="compat" aria-label={t("Build kontrolü")}>
      <h3 className="draft__heading">{t("Build kontrolü")}</h3>
      <p className="build__note">{t("Hiçbir şey kendiliğinden değişmez; düzeltmeleri tek tek sen onaylarsın.")}</p>
      <ul className="compat__list">
        {issues.map((issue, i) => (
          <li key={`${issue.kind}-${i}`}>
            <span>{t(issue.text[0], issue.text[1])}</span>
            {issue.fix && (
              <Button
                size="small"
                onClick={() => {
                  saveBuild(issue.fix!.apply(build));
                  toast("success", t("Düzeltildi"));
                }}
              >
                {t(issue.fix.label)}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
