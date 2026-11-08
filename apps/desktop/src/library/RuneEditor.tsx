import { runeIconUrl, type Rune, type RuneStyle } from "../data/ddragon";
import { useT } from "../i18n";
import type { RuneSelection } from "./store";

// Stat shards are not in Data Dragon's rune data. Ids as the client uses them.
export const SHARD_ROWS: { id: number; name: string }[][] = [
  [
    { id: 5008, name: "Uyarlanabilir güç" },
    { id: 5005, name: "Saldırı hızı" },
    { id: 5007, name: "Yetenek hızı" },
  ],
  [
    { id: 5008, name: "Uyarlanabilir güç" },
    { id: 5010, name: "Hareket hızı" },
    { id: 5001, name: "Seviyeyle artan can" },
  ],
  [
    { id: 5011, name: "Can" },
    { id: 5013, name: "Direnç ve yavaşlatma direnci" },
    { id: 5001, name: "Seviyeyle artan can" },
  ],
];

export function shardName(row: number, id: number) {
  return SHARD_ROWS[row]?.find((s) => s.id === id)?.name ?? "";
}

type Props = { value: RuneSelection; styles: Map<number, RuneStyle>; onChange: (value: RuneSelection) => void };

const rowOf = (style: RuneStyle | undefined, id: number) => style?.slots.findIndex((slot) => slot.some((r) => r.id === id)) ?? -1;

/**
 * Picks a rune page the way the client does: a primary tree with a keystone
 * and one rune per row, two runes from different rows of a second tree, and
 * three stat shards. Perks are kept in the client's order.
 */
export function RuneEditor({ value, styles, onChange }: Props) {
  const t = useT();
  const primary = styles.get(value.primaryStyle);
  const secondary = styles.get(value.subStyle);
  const perks = [...value.perks];
  while (perks.length < 9) perks.push(0);
  const primaryPerks = perks.slice(0, 4);
  const secondaryPerks = perks.slice(4, 6).filter((id) => id > 0);
  const shards = perks.slice(6, 9);

  function emit(next: Partial<RuneSelection> & { perks?: number[] }) {
    onChange({ ...value, ...next, perks: next.perks ?? perks });
  }

  function choosePrimaryStyle(id: number) {
    if (id === value.primaryStyle) return;
    // The old primary can't stay as the secondary tree once it's the main one.
    const sub = value.subStyle === id ? value.primaryStyle : value.subStyle;
    emit({ primaryStyle: id, subStyle: sub, perks: [0, 0, 0, 0, ...(sub === value.subStyle ? perks.slice(4, 6) : [0, 0]), ...shards] });
  }

  function chooseSecondaryStyle(id: number) {
    if (id === value.subStyle || id === value.primaryStyle) return;
    emit({ subStyle: id, perks: [...primaryPerks, 0, 0, ...shards] });
  }

  function choosePrimary(row: number, rune: Rune) {
    const next = [...perks];
    next[row] = rune.id;
    emit({ perks: next });
  }

  function chooseSecondary(rune: Rune) {
    const row = rowOf(secondary, rune.id);
    // One rune per row; a third pick pushes out the older of the two.
    const kept = secondaryPerks.filter((id) => rowOf(secondary, id) !== row);
    const both = [...kept, rune.id].slice(-2);
    emit({ perks: [...primaryPerks, both[0] ?? 0, both[1] ?? 0, ...shards] });
  }

  function chooseShard(row: number, id: number) {
    const next = [...perks];
    next[6 + row] = id;
    emit({ perks: next });
  }

  const trees = [...styles.values()];

  return (
    <div className="rune-editor">
      <fieldset className="rune-editor__tree">
        <legend>{t("Ana ağaç")}</legend>
        <TreeTabs trees={trees} value={value.primaryStyle} onChange={choosePrimaryStyle} />
        {primary?.slots.map((slot, row) => (
          <RuneRow key={row} runes={slot} chosen={primaryPerks[row]} big={row === 0} label={row === 0 ? t("Temel rün") : t("{row}. sıra", { row })} onChoose={(r) => choosePrimary(row, r)} />
        ))}
      </fieldset>
      <fieldset className="rune-editor__tree">
        <legend>{t("İkincil ağaç")}</legend>
        <TreeTabs trees={trees} value={value.subStyle} disabled={value.primaryStyle} onChange={chooseSecondaryStyle} />
        {secondary?.slots.slice(1).map((slot, i) => (
          <RuneRow key={i} runes={slot} chosen={secondaryPerks.find((id) => slot.some((r) => r.id === id)) ?? 0} label={t("{row}. sıra", { row: i + 1 })} onChoose={chooseSecondary} />
        ))}
        <div className="rune-editor__shards">
          {SHARD_ROWS.map((row, i) => (
            <div key={i} className="rune-editor__shard-row" role="group" aria-label={t("Bonus {row}", { row: i + 1 })}>
              {row.map((shard) => (
                <button key={shard.id} type="button" aria-pressed={shards[i] === shard.id} onClick={() => chooseShard(i, shard.id)}>
                  {t(shard.name)}
                </button>
              ))}
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function TreeTabs({ trees, value, disabled, onChange }: { trees: RuneStyle[]; value: number; disabled?: number; onChange: (id: number) => void }) {
  return (
    <div className="rune-editor__trees" role="group">
      {trees.map((tree) => (
        <button
          key={tree.id}
          type="button"
          aria-pressed={tree.id === value}
          aria-label={tree.name}
          title={tree.name}
          disabled={tree.id === disabled}
          onClick={() => onChange(tree.id)}
        >
          <img src={runeIconUrl(tree.icon)} alt="" width={24} height={24} />
        </button>
      ))}
    </div>
  );
}

function RuneRow({ runes, chosen, big, label, onChoose }: { runes: Rune[]; chosen: number; big?: boolean; label: string; onChoose: (rune: Rune) => void }) {
  return (
    <div className="rune-editor__row" role="group" aria-label={label} data-keystone={big || undefined}>
      {runes.map((rune) => (
        <button key={rune.id} type="button" aria-pressed={rune.id === chosen} title={rune.name} aria-label={rune.name} onClick={() => onChoose(rune)}>
          <img src={runeIconUrl(rune.icon)} alt="" width={big ? 40 : 30} height={big ? 40 : 30} />
        </button>
      ))}
    </div>
  );
}
