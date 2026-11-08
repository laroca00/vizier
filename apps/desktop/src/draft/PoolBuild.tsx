import { isTauri } from "@tauri-apps/api/core";
import { useT } from "../i18n";
import { useBuildExport } from "../library/useBuildExport";
import { useLibrary, type SavedBuild } from "../library/store";
import { usePersonal } from "../personal";
import { Button } from "../ui/Button";

/**
 * The saved build the player attached to this champion in their pool, ready
 * to import. The role's own entry wins over one for any role.
 */
export function PoolBuild({ championId, role, locked }: { championId: number; role: string | null; locked: boolean }) {
  const { pool } = usePersonal();
  const library = useLibrary();
  const picks = pool.filter((p) => p.championId === championId && p.buildId);
  const pick = picks.find((p) => p.position === role) ?? picks.find((p) => p.position === null) ?? picks[0];
  const build = pick ? library.builds.find((b) => b.id === pick.buildId) : undefined;
  return build ? <PoolBuildBox build={build} locked={locked} /> : null;
}

function PoolBuildBox({ build, locked }: { build: SavedBuild; locked: boolean }) {
  const t = useT();
  const { busy, pages, exportToClient, cancel } = useBuildExport(build);
  return (
    <div className="pool-build">
      <p className="pool-build__name">
        {t("Havuzundaki build'in: {name}", { name: build.name })}
        {build.notes && <span className="build__note">{build.notes}</span>}
      </p>
      {pages ? (
        <div className="build__pages" role="group" aria-label={t("Üzerine yazılacak rün sayfası")}>
          {pages.map((p) => (
            <Button key={p.id} size="small" onClick={() => exportToClient(p.id)}>
              {t("{page} yerine yaz", { page: p.name })}
            </Button>
          ))}
          <Button size="small" variant="ghost" onClick={cancel}>
            {t("Vazgeç")}
          </Button>
        </div>
      ) : (
        <Button variant="primary" busy={busy} disabled={!isTauri() || !locked} onClick={() => exportToClient()}>
          {t("Bunu aktar")}
        </Button>
      )}
    </div>
  );
}
