import { createContext, useContext, type ReactNode } from "react";

export type OpenChampion = (championId: number, position: string | null, queue: number) => void;

const OpenChampionContext = createContext<OpenChampion>(() => {});

export const OpenChampionProvider = ({ value, children }: { value: OpenChampion; children: ReactNode }) => (
  <OpenChampionContext.Provider value={value}>{children}</OpenChampionContext.Provider>
);

export const useOpenChampion = () => useContext(OpenChampionContext);
