import { createContext, useContext, type ReactNode } from "react";
import { useT } from "./i18n";

export type OpenMatchup = (championId: number | null, opponentId: number | null, position: string) => void;

const OpenMatchupContext = createContext<OpenMatchup>(() => {});

export const OpenMatchupProvider = ({ value, children }: { value: OpenMatchup; children: ReactNode }) => (
  <OpenMatchupContext.Provider value={value}>{children}</OpenMatchupContext.Provider>
);

export const useOpenMatchup = () => useContext(OpenMatchupContext);

/** Opens the matchup page with the given sides. */
export function MatchupLink({ championId, opponentId, position, label }: { championId: number | null; opponentId: number | null; position: string; label?: string }) {
  const t = useT();
  const open = useOpenMatchup();
  return (
    <button type="button" className="matchups__study" onClick={() => open(championId, opponentId, position)}>
      {label ?? t("Eşleşmeyi aç")}
    </button>
  );
}
