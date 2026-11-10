import { itemIconUrl, type Item } from "./data/ddragon";
import { hasEnoughGames } from "./data/confidence";
import { formatPercent, useLang, useT } from "./i18n";
import type { ItemNode } from "./lab/itemPath";

/** The first three completed items as a tree: each step shows the branches players took next, with games and win rate. */
export function ItemTree({ tree, items, version }: { tree: ItemNode[] | undefined; items: Map<number, Item>; version: string }) {
  const t = useT();
  if (!tree?.length) return null;
  return (
    <section className="build__block" aria-label={t("Eşya ağacı")}>
      <p className="build__stat path__label">{t("Eşya ağacı: ilk üç tamamlanan eşya")}</p>
      <TreeLevel nodes={tree} items={items} version={version} />
      <p className="build__note">{t("Her dal, kendisine kadar aynı eşyaları alan oyunlardan sayılır; az maçlı dallar listede yok.")}</p>
    </section>
  );
}

function TreeLevel({ nodes, items, version }: { nodes: ItemNode[]; items: Map<number, Item>; version: string }) {
  const t = useT();
  const lang = useLang();
  return (
    <ul className="item-tree">
      {nodes.map((n) => {
        const name = items.get(n.id)?.name ?? "";
        const enough = hasEnoughGames(n.games, n.winRate);
        return (
          <li key={n.id} data-enough={enough}>
            <span className="item-tree__node" title={`${name}\n${t("{games} maç", { games: n.games.toLocaleString() })}`}>
              <img src={itemIconUrl(version, n.id)} alt={name} width={28} height={28} />
              <span className="build__stat">
                {enough ? formatPercent(n.winRate, lang, 1) : t("az maç")} · {t("{games} maç", { games: n.games.toLocaleString() })}
              </span>
            </span>
            {n.next.length > 0 && <TreeLevel nodes={n.next} items={items} version={version} />}
          </li>
        );
      })}
    </ul>
  );
}
