import { createContext, useContext, type ReactNode } from "react";

// Badges link to the data sources section of the About page; outside the app shell there is no handler and they stay plain labels.
const OpenSourcesContext = createContext<(() => void) | null>(null);

export const OpenSourcesProvider = ({ value, children }: { value: () => void; children: ReactNode }) => (
  <OpenSourcesContext.Provider value={value}>{children}</OpenSourcesContext.Provider>
);

export const useOpenSources = () => useContext(OpenSourcesContext);
