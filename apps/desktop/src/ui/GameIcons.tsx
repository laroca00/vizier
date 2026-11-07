import { useState } from "react";
import { championIconUrl, itemIconUrl, runeIconUrl } from "../data/ddragon";

// Data Dragon sometimes lags a new champion or item by a few hours; a missing
// image falls back to a plain tile with the first letter instead of a broken icon.
function GameImage({ src, name, size, round, gilt }: { src: string; name: string; size: number; round?: boolean; gilt?: boolean }) {
  const [failed, setFailed] = useState(false);
  const className = ["game-icon", round && "game-icon--round", gilt && "game-icon--gilt"].filter(Boolean).join(" ");
  if (failed) {
    return (
      <span className={`${className} game-icon--missing`} style={{ width: size, height: size }} role="img" aria-label={name}>
        {name.charAt(0)}
      </span>
    );
  }
  return <img className={className} src={src} alt={name} width={size} height={size} loading="lazy" onError={() => setFailed(true)} />;
}

/** `championId` is Data Dragon's string id ("MonkeyKing"), not the numeric key. */
export function ChampionIcon({ version, championId, name, size = 32 }: { version: string; championId: string; name: string; size?: number }) {
  return <GameImage src={championIconUrl(version, championId)} name={name} size={size} gilt />;
}

export function ItemIcon({ version, itemId, name, size = 28 }: { version: string; itemId: number; name: string; size?: number }) {
  return <GameImage src={itemIconUrl(version, itemId)} name={name} size={size} />;
}

export function RuneIcon({ icon, name, size = 28 }: { icon: string; name: string; size?: number }) {
  return <GameImage src={runeIconUrl(icon)} name={name} size={size} round />;
}

/** A champion as a clickable row: icon, name and an optional line under it. */
export function ChampionCard({
  version,
  championId,
  name,
  detail,
  onOpen,
}: {
  version: string;
  championId: string;
  name: string;
  detail?: string;
  onOpen?: () => void;
}) {
  const body = (
    <>
      <ChampionIcon version={version} championId={championId} name="" size={36} />
      <span className="champion-card__text">
        <span className="champion-card__name">{name}</span>
        {detail && <span className="champion-card__detail">{detail}</span>}
      </span>
    </>
  );
  return onOpen ? (
    <button type="button" className="champion-card" onClick={onOpen}>
      {body}
    </button>
  ) : (
    <span className="champion-card">{body}</span>
  );
}
