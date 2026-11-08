import { createContext, useContext, type ReactNode } from "react";

export type OpenPro = (player: string) => void;

const OpenProContext = createContext<OpenPro>(() => {});

export const OpenProProvider = ({ value, children }: { value: OpenPro; children: ReactNode }) => (
  <OpenProContext.Provider value={value}>{children}</OpenProContext.Provider>
);

export const useOpenPro = () => useContext(OpenProContext);
