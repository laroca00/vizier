import { championKey, type LiveGame, type LivePlayer } from "./live";

const FLASH = "SummonerFlash";
const FLASH_COOLDOWN = 300;
// Ionian Boots of Lucidity give summoner spell haste. Runes that do the same
// (Cosmic Insight) can't be seen in the Live Client data, so the timer may run long.
const SPELL_HASTE: Record<number, number> = { 3158: 10 };
/** A Flash that came back stays on the card this long, so the player sees it is up. */
export const READY_LINGER = 10;

export const FLASH_SLOTS = ["flash1", "flash2", "flash3", "flash4", "flash5"] as const;
export type FlashSlot = (typeof FLASH_SLOTS)[number];
const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

/** The enemy a slot means: by role on the Rift, by scoreboard order where roles are empty. */
export function enemyForSlot(game: LiveGame, myTeam: string, slot: FlashSlot): LivePlayer | null {
  const enemies = game.players.filter((p) => p.team !== myTeam);
  const index = FLASH_SLOTS.indexOf(slot);
  return enemies.find((p) => p.position === ROLE_ORDER[index]) ?? (enemies.every((p) => !p.position) ? (enemies[index] ?? null) : null);
}

/** Flash's cooldown for this player, with the summoner spell haste their items give. */
export function flashCooldown(player: LivePlayer): number {
  const haste = player.items.reduce((sum, i) => sum + (SPELL_HASTE[i.itemId] ?? 0), 0);
  return FLASH_COOLDOWN * (100 / (100 + haste));
}

export type FlashTimer = { slot: FlashSlot; champion: string; backAt: number };

/**
 * Timers for the presses the player made. A press on an enemy without Flash
 * (they run Ghost and Teleport, say) is ignored rather than counted.
 */
export function flashTimers(presses: Partial<Record<FlashSlot, number>>, game: LiveGame, myTeam: string, time: number): FlashTimer[] {
  const out: FlashTimer[] = [];
  for (const slot of FLASH_SLOTS) {
    const at = presses[slot];
    if (at === undefined) continue;
    const enemy = enemyForSlot(game, myTeam, slot);
    if (!enemy || (enemy.spells && enemy.spells.length > 0 && !enemy.spells.includes(FLASH))) continue;
    const backAt = at + flashCooldown(enemy);
    if (time - backAt < READY_LINGER) out.push({ slot, champion: championKey(enemy), backAt });
  }
  return out.sort((a, b) => a.backAt - b.backAt);
}
