import type { ChampSelect, DraftMember } from "../lcu";
import { Reader, toBase64UrlBytes, varint } from "../library/share";
import { emptyDraft, MAX_BANS, ROLES, type Draft, type Team } from "./store";

/** Lowercase LCU positions in the simulator's slot order. */
const LCU_ROLES = ["top", "jungle", "middle", "bottom", "utility"];

/** The champions a team has settled on, each in its role slot; players without a role take the free slots in cell order. */
function teamOf(members: DraftMember[]): Team {
  const team: Team = ROLES.map(() => 0);
  const rest: number[] = [];
  for (const m of [...members].sort((a, b) => a.cellId - b.cellId)) {
    // Hovering counts: the draft is what the team is heading for.
    const id = m.championId > 0 ? m.championId : m.pickIntent;
    if (id <= 0) continue;
    const slot = LCU_ROLES.indexOf(m.position);
    if (slot >= 0 && team[slot] === 0) team[slot] = id;
    else rest.push(id);
  }
  for (const id of rest) {
    const free = team.indexOf(0);
    if (free >= 0) team[free] = id;
  }
  return team;
}

/** The current champ select as a simulator draft: your team is blue. */
export function fromChampSelect(session: ChampSelect): Draft {
  return {
    ...emptyDraft(),
    blue: teamOf(session.myTeam),
    red: teamOf(session.theirTeam),
    bans: [...new Set(session.bans.filter((id) => id > 0))].slice(0, MAX_BANS),
  };
}

const PREFIX = "VZD1:";

/** A draft as a short code: blue slots, red slots, then the bans. */
export function draftCode(draft: Draft): string {
  const out: number[] = [];
  for (const id of [...draft.blue, ...draft.red]) varint(out, id);
  varint(out, draft.bans.length);
  for (const id of draft.bans) varint(out, id);
  return PREFIX + toBase64UrlBytes(out);
}

/** The first draft code in a piece of text. */
export function findDraftCode(text: string): string | null {
  return text.match(/VZD1:[A-Za-z0-9_-]+/)?.[0] ?? null;
}

/** A draft from a code, or null when the code is damaged or not Vizier's. */
export function readDraftCode(code: string): Draft | null {
  const found = findDraftCode(code);
  if (!found) return null;
  try {
    const base64 = found.slice(PREFIX.length).replace(/-/g, "+").replace(/_/g, "/");
    const r = new Reader(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)));
    const slots = ROLES.length * 2;
    const picks = Array.from({ length: slots }, () => r.varint());
    const bans = r.list(MAX_BANS);
    if (!r.done) return null;
    const seen = new Set<number>();
    // A champion can be in a draft once.
    const unique = (id: number) => (id > 0 && !seen.has(id) ? (seen.add(id), id) : 0);
    const blue = picks.slice(0, ROLES.length).map(unique);
    const red = picks.slice(ROLES.length).map(unique);
    return { blue, red, bans: bans.filter((id) => id > 0 && !seen.has(id)) };
  } catch {
    return null;
  }
}
