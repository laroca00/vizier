import { useEffect, useState } from "react";
import {
  championIconUrl,
  champions,
  latestVersion,
  spellIconUrl,
  summonerSpells,
  type Champion,
  type SummonerSpell,
} from "../data/ddragon";
import { BuildSuggestion } from "../BuildSuggestion";
import { draftPhaseLabel, positionLabel } from "../labels";
import type { ChampSelect, DraftMember } from "../lcu";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useAsync } from "../useAsync";

type StaticData = { version: string; champions: Map<number, Champion>; spells: Map<number, SummonerSpell> };

async function loadStatic(): Promise<StaticData> {
  const [version, championList, spells] = await Promise.all([latestVersion(), champions(), summonerSpells()]);
  return { version, champions: championList, spells };
}

function useSecondsLeft(endsAt: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

function shownChampion(member: DraftMember) {
  return member.championId || member.pickIntent;
}

export function ChampSelectPage({ draft }: { draft: ChampSelect }) {
  const [data] = useAsync("static", loadStatic);
  const seconds = useSecondsLeft(draft.phaseEndsAt);
  const me = draft.myTeam.find((m) => m.isLocal);
  const ready = data.status === "done" ? data.value : null;

  return (
    <LiquidGlass className="panel draft" radius={28} strength={2.5}>
      <header className="draft__header enter">
        <h1 className="draft__title">Şampiyon seçimi</h1>
        <p className="draft__phase">
          {draftPhaseLabel(draft.phase)}
          <span className="draft__timer" aria-label={`${seconds} saniye kaldı`}>
            {seconds}
          </span>
        </p>
      </header>

      <div className="draft__body">
        <section className="draft__me enter" aria-label="Senin seçimin">
          {me && <MyPick member={me} data={ready} />}
          {me && ready && shownChampion(me) > 0 && (
            <>
              <h2 className="draft__heading draft__heading--spaced">Vizier önerisi</h2>
              <BuildSuggestion
                championId={shownChampion(me)}
                championName={ready.champions.get(shownChampion(me))?.name ?? ""}
                position={me.position || null}
                currentSpells={me.spells as [number, number]}
                locked={me.championId !== 0}
              />
            </>
          )}
        </section>

        <section className="draft__teams enter" aria-label="Takımlar">
          <h2 className="draft__heading">Takımın</h2>
          <ul className="team">
            {draft.myTeam.map((member) => (
              <TeamRow key={member.cellId} member={member} data={ready} />
            ))}
          </ul>

          <h2 className="draft__heading">Rakip takım</h2>
          <ChampionStrip ids={draft.theirTeam.map((m) => m.championId)} data={ready} empty="Henüz seçim yok" />

          <h2 className="draft__heading">Yasaklar</h2>
          <ChampionStrip ids={draft.bans} data={ready} empty="Yasak yok" muted />
        </section>
      </div>
    </LiquidGlass>
  );
}

function MyPick({ member, data }: { member: DraftMember; data: StaticData | null }) {
  const championId = shownChampion(member);
  const champion = data?.champions.get(championId);
  const locked = member.championId !== 0;

  return (
    <div className="my-pick">
      <div className="my-pick__portrait" data-locked={locked}>
        {champion && data && <img src={championIconUrl(data.version, champion.id)} alt="" width={88} height={88} />}
      </div>
      <div>
        <p className="my-pick__name">{champion?.name ?? "Şampiyon seçilmedi"}</p>
        <p className="my-pick__meta">
          {[positionLabel(member.position), champion && !locked ? "seçilmek üzere" : null].filter(Boolean).join(", ")}
        </p>
        {data && (
          <div className="my-pick__spells">
            {member.spells.map((key, i) => {
              const spell = data.spells.get(key);
              return spell ? (
                <img key={i} src={spellIconUrl(data.version, spell.id)} alt={spell.name} title={spell.name} width={28} height={28} />
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamRow({ member, data }: { member: DraftMember; data: StaticData | null }) {
  const champion = data?.champions.get(shownChampion(member));
  const locked = member.championId !== 0;
  return (
    <li data-local={member.isLocal || undefined} data-locked={locked || undefined}>
      <span className="team__position">{positionLabel(member.position) ?? ""}</span>
      {champion && data ? (
        <img src={championIconUrl(data.version, champion.id)} alt="" width={28} height={28} className="team__icon" />
      ) : (
        <span className="team__icon team__icon--empty" />
      )}
      <span className="team__name">{champion?.name ?? "Seçim bekleniyor"}</span>
      {member.isLocal && <span className="team__you">Sen</span>}
    </li>
  );
}

function ChampionStrip({
  ids,
  data,
  empty,
  muted,
}: {
  ids: number[];
  data: StaticData | null;
  empty: string;
  muted?: boolean;
}) {
  const picked = ids.filter((id) => id > 0);
  if (picked.length === 0) return <p className="draft__empty">{empty}</p>;
  return (
    <ul className="strip" data-muted={muted || undefined}>
      {picked.map((id, i) => {
        const champion = data?.champions.get(id);
        return (
          <li key={`${id}-${i}`}>
            {champion && data && (
              <img src={championIconUrl(data.version, champion.id)} alt={champion.name} title={champion.name} width={32} height={32} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
