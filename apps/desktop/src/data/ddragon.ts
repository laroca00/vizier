const BASE = "https://ddragon.leagueoflegends.com";

export type Champion = { id: string; key: number; name: string };

let version: Promise<string> | undefined;
let championsByKey: Promise<Map<number, Champion>> | undefined;

/** The newest patch on Data Dragon; fetched once per session. */
export function latestVersion(): Promise<string> {
  version ??= fetch(`${BASE}/api/versions.json`)
    .then((response) => response.json() as Promise<string[]>)
    .then((versions) => versions[0]);
  return version;
}

/** Champions keyed by the numeric id the LCU and match-v5 use. */
export function champions(): Promise<Map<number, Champion>> {
  championsByKey ??= latestVersion()
    .then((v) => fetch(`${BASE}/cdn/${v}/data/tr_TR/champion.json`))
    .then((response) => response.json() as Promise<{ data: Record<string, { id: string; key: string; name: string }> }>)
    .then(({ data }) => new Map(Object.values(data).map((c) => [Number(c.key), { id: c.id, key: Number(c.key), name: c.name }])));
  return championsByKey;
}

export function profileIconUrl(version: string, iconId: number) {
  return `${BASE}/cdn/${version}/img/profileicon/${iconId}.png`;
}

export function championIconUrl(version: string, championId: string) {
  return `${BASE}/cdn/${version}/img/champion/${championId}.png`;
}
