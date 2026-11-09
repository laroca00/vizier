import { createContext, useContext, type ReactNode } from "react";
import type { Route } from "./router";

// Lets a panel inside one page open another page without being handed the router.
const OpenPageContext = createContext<(route: Route) => void>(() => {});

export const OpenPageProvider = ({ value, children }: { value: (route: Route) => void; children: ReactNode }) => (
  <OpenPageContext.Provider value={value}>{children}</OpenPageContext.Provider>
);

export const useOpenPage = () => useContext(OpenPageContext);
