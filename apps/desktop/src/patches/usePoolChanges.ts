import { useLang } from "../i18n";
import { usePersonal } from "../personal";
import { useAsync } from "../useAsync";
import { cachedPatchDiff, patchVersions } from "./load";
import { changedOf } from "./pool";

/**
 * Pool champions changed in the newest patch, from the patch tracker's cache;
 * empty until the tracker has computed that diff, so Home downloads nothing.
 */
export function usePoolChanges(): Set<string> {
  const lang = useLang();
  const { pool, favourites } = usePersonal();
  const [versions] = useAsync("patch-versions", patchVersions);
  if (versions.status !== "done" || versions.value.length < 2) return new Set();
  const [to, from] = versions.value;
  const diff = cachedPatchDiff(from, to, lang);
  const mine = new Set([...pool.map((p) => p.championId), ...favourites].map(String));
  return diff ? changedOf(diff.entries, mine) : new Set();
}
