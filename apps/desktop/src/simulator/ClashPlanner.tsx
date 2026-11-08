import { useId, useState } from "react";
import { championIconUrl } from "../data/ddragon";
import { WEAKNESS_TEXT } from "../data/traits";
import { useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import type { ChampionRoles } from "../pages/ChampionsPage";
import { usePersonal } from "../personal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Fields";
import { addPlayer, MAX_PLAYERS, planDraft, removePlayer, updatePlayer, useClashPlayers, type ClashPlan, type ClashPlayer, type Role } from "./clash";
import { ROLES, type Team } from "./store";

type Props = {
  data: ChampionRoles;
  /** Champions the plan can't use: the other team's picks and the bans. */
  unavailable: Set<number>;
  onApply: (team: Team) => void;
};

const NONE = "";

/** Up to five players and their pools; one button turns them into the blue team. */
export function ClashPlanner({ data, unavailable, onApply }: Props) {
  const t = useT();
  const players = useClashPlayers();
  const personal = usePersonal();
  const [plan, setPlan] = useState<ClashPlan | null>(null);

  function suggest() {
    const next = planDraft(players, {
      champions: data.champions,
      tierOf: (id, role) => data.roles.get(id)?.get(role)?.tier,
      unavailable,
      rolesKnown: data.roles.size > 0,
    });
    setPlan(next);
    if (next.picks.length > 0) onApply(next.team);
  }

  return (
    <section className="clash" aria-label={t("Clash planı")}>
      <h2 className="draft__heading">{t("Clash planı")}</h2>
      <p className="build__note">
        {t("Takımındaki oyuncuları ve havuzlarını ekle. Vizier her oyuncuya bir rol verir ve havuzlarından birbirini tamamlayan beş şampiyonu mavi tarafa koyar; kırmızı seçimler ve yasaklar dışarıda kalır.")}
      </p>
      <ul className="clash__players">
        {players.map((p) => (
          <PlayerCard key={p.id} player={p} data={data} myPool={personal.pool.map((x) => x.championId)} />
        ))}
      </ul>
      <div className="clash__actions">
        {players.length < MAX_PLAYERS && (
          <Button onClick={() => addPlayer(t("Oyuncu {n}", { n: players.length + 1 }), ROLES[players.length] ?? null)}>{t("Oyuncu ekle")}</Button>
        )}
        <Button variant="primary" disabled={!players.some((p) => p.pool.length > 0)} onClick={suggest}>
          {t("Draft öner")}
        </Button>
      </div>
      {plan && <PlanNotes plan={plan} players={players} />}
    </section>
  );
}

function PlayerCard({ player, data, myPool }: { player: ClashPlayer; data: ChampionRoles; myPool: number[] }) {
  const t = useT();
  const lang = useLang();
  const listId = useId();
  const [adding, setAdding] = useState("");
  const names = [...data.champions.values()].sort((a, b) => a.name.localeCompare(b.name, lang));
  const roleOptions = (allowNone: boolean) => [...(allowNone ? [{ value: NONE, label: t("Yok") }] : []), ...ROLES.map((r) => ({ value: r, label: t(POSITIONS[r]) }))];
  const setRole = (index: number, value: string) => {
    const roles = [...player.roles];
    if (value === NONE) roles.splice(index, 1);
    else roles[index] = value as Role;
    updatePlayer(player.id, { roles: [...new Set(roles)] });
  };
  const add = (text: string) => {
    const found = names.find((c) => c.name.toLocaleLowerCase(lang) === text.trim().toLocaleLowerCase(lang));
    if (!found || player.pool.includes(found.key)) return false;
    updatePlayer(player.id, { pool: [...player.pool, found.key] });
    return true;
  };

  return (
    <li className="clash__player">
      <div className="clash__head">
        <input className="text-input" aria-label={t("Oyuncu adı")} value={player.name} maxLength={24} onChange={(e) => updatePlayer(player.id, { name: e.target.value })} />
        <Select label={t("Ana rol")} hideLabel value={player.roles[0] ?? NONE} options={roleOptions(true)} onChange={(v) => setRole(0, v)} />
        <Select label={t("İkinci rol")} hideLabel value={player.roles[1] ?? NONE} options={roleOptions(true)} onChange={(v) => setRole(1, v)} />
        <Button size="small" variant="ghost" onClick={() => removePlayer(player.id)}>
          {t("Çıkar")}
        </Button>
      </div>
      <ul className="clash__pool" aria-label={t("{player} havuzu", { player: player.name })}>
        {player.pool.map((id) => {
          const c = data.champions.get(id);
          if (!c) return null;
          return (
            <li key={id}>
              <button
                type="button"
                title={t("{champion} havuzdan çıkar", { champion: c.name })}
                aria-label={t("{champion} havuzdan çıkar", { champion: c.name })}
                onClick={() => updatePlayer(player.id, { pool: player.pool.filter((x) => x !== id) })}
              >
                <img src={championIconUrl(data.version, c.id)} alt="" width={30} height={30} />
              </button>
            </li>
          );
        })}
        <li className="clash__add">
          <input
            className="text-input"
            list={listId}
            aria-label={t("Havuza şampiyon ekle")}
            placeholder={t("Şampiyon ekle")}
            value={adding}
            onChange={(e) => {
              // Choosing from the list fills the full name; add it right away.
              if (add(e.target.value)) setAdding("");
              else setAdding(e.target.value);
            }}
          />
          <datalist id={listId}>
            {names.map((c) => (
              <option key={c.key} value={c.name} />
            ))}
          </datalist>
        </li>
      </ul>
      {myPool.length > 0 && player.pool.length === 0 && (
        <button type="button" className="clash__mine" onClick={() => updatePlayer(player.id, { pool: myPool })}>
          {t("Kendi havuzumu koy")}
        </button>
      )}
    </li>
  );
}

function PlanNotes({ plan, players }: { plan: ClashPlan; players: ClashPlayer[] }) {
  const t = useT();
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? "";
  const offRole = plan.picks.filter((p) => p.offRole);
  if (plan.picks.length === 0) return <p className="build__note">{t("Havuzlardaki şampiyonların hepsi alınmış ya da yasaklı.")}</p>;
  return (
    <ul className="advice clash__notes">
      {plan.empty.map((id) => (
        <li key={id}>
          <p>{t("{player} için uygun şampiyon kalmadı", { player: nameOf(id) })}</p>
          <p>{t("Havuzundaki şampiyonlar alınmış ya da yasaklı; havuzuna birkaç şampiyon daha ekle.")}</p>
        </li>
      ))}
      {offRole.map((p) => (
        <li key={p.playerId}>
          <p>{t("{player} rolü dışında", { player: nameOf(p.playerId) })}</p>
          <p>{t("Havuzunda {role} için şampiyon yok; en iyi seçenek yine de konuldu.", { role: t(POSITIONS[p.role]) })}</p>
        </li>
      ))}
      {plan.weaknesses.map((w) => (
        <li key={w}>
          <p>{t("Takımda eksik var")}</p>
          <p>{t(WEAKNESS_TEXT[w])}</p>
        </li>
      ))}
      {plan.picks.length >= 4 && plan.empty.length === 0 && offRole.length === 0 && plan.weaknesses.length === 0 && (
        <li>
          <p>{t("Takım dengeli")}</p>
          <p>{t("Ön hat, savaş başlatma ve karışık hasar var; herkes kendi rolünde.")}</p>
        </li>
      )}
    </ul>
  );
}
