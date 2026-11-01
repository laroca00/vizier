import { createContext, useContext, useEffect, useState } from "react";
import { champions, splashUrl } from "../data/ddragon";

const SetSplash = createContext<(championId: number | null) => void>(() => {});

/** Shows the champion's splash behind the page while the calling component is mounted. */
export function useSplash(championId: number | null | undefined) {
  const set = useContext(SetSplash);
  useEffect(() => {
    set(championId || null);
    return () => set(null);
  }, [championId, set]);
}

export const SplashProvider = SetSplash.Provider;

export function SplashBackdrop({ championId }: { championId: number | null }) {
  const [url, setUrl] = useState<string | null>(null);
  // The outgoing splash stays mounted so the two can crossfade.
  const [layers, setLayers] = useState<string[]>([]);

  useEffect(() => {
    if (!championId) return setUrl(null);
    let current = true;
    champions().then((list) => {
      const champion = list.get(championId);
      if (current) setUrl(champion ? splashUrl(champion.id) : null);
    });
    return () => {
      current = false;
    };
  }, [championId]);

  useEffect(() => {
    setLayers((previous) => (previous[previous.length - 1] === (url ?? "") ? previous : [...previous.slice(-1), url ?? ""]));
  }, [url]);

  return (
    <div className="splash" aria-hidden="true">
      {layers.map(
        (src, i) =>
          src && (
            <img
              key={src}
              src={src}
              alt=""
              data-current={i === layers.length - 1 || undefined}
              onLoad={(event) => event.currentTarget.setAttribute("data-loaded", "")}
            />
          ),
      )}
    </div>
  );
}
