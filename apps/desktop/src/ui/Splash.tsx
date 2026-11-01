import { createContext, useContext, useEffect, useState } from "react";
import { champions, skins, splashUrl } from "../data/ddragon";

const SKIN_MS = 4000;

const SetSplash = createContext<(url: string | null) => void>(() => {});

export const SplashProvider = SetSplash.Provider;

/** Shows the image behind the page while the calling component is mounted. */
export function useSplashUrl(url: string | null) {
  const set = useContext(SetSplash);
  useEffect(() => {
    set(url);
    return () => set(null);
  }, [url, set]);
}

/** Shows the champion's default splash behind the page. */
export function useSplash(championId: number | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

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

  useSplashUrl(url);
}

/** Walks through the champion's skins, moving on only once the next splash has loaded. */
export function useSkinSplash(championId: string | undefined) {
  const [urls, setUrls] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setUrls([]);
    setIndex(0);
    if (!championId) return;
    let current = true;
    skins(championId).then(
      (list) => current && setUrls(list.map((skin) => splashUrl(championId, skin.num))),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [championId]);

  useEffect(() => {
    if (urls.length < 2 || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current = true;
    const timer = setTimeout(() => {
      const next = (index + 1) % urls.length;
      const image = new Image();
      image.src = urls[next];
      image.decode().then(
        () => current && setIndex(next),
        // A skin without art on Data Dragon is dropped instead of shown blank.
        () => current && setUrls((list) => list.filter((url) => url !== urls[next])),
      );
    }, SKIN_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [urls, index]);

  return championId ? (urls[index] ?? splashUrl(championId)) : null;
}

/** Crossfades to each new image; the outgoing one stays until the incoming one has loaded. */
export function SplashLayers({ url, className }: { url: string | null; className: string }) {
  const [layers, setLayers] = useState<string[]>([]);

  useEffect(() => {
    setLayers((previous) => (previous[previous.length - 1] === (url ?? "") ? previous : [...previous.slice(-1), url ?? ""]));
  }, [url]);

  return (
    <div className={className} aria-hidden="true" data-empty={!layers[layers.length - 1] || undefined}>
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
