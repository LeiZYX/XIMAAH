"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface RegistrationsRefreshContextValue {
  workspaceRefreshKey: number;
  bumpWorkspaceList: () => void;
}

const RegistrationsRefreshContext = createContext<RegistrationsRefreshContextValue | null>(null);

export function RegistrationsRefreshProvider({ children }: { children: ReactNode }) {
  const [workspaceRefreshKey, setWorkspaceRefreshKey] = useState(0);
  const bumpWorkspaceList = useCallback(() => {
    setWorkspaceRefreshKey((current) => current + 1);
  }, []);

  return (
    <RegistrationsRefreshContext.Provider value={{ workspaceRefreshKey, bumpWorkspaceList }}>
      {children}
    </RegistrationsRefreshContext.Provider>
  );
}

export function useRegistrationsRefresh(): RegistrationsRefreshContextValue {
  const context = useContext(RegistrationsRefreshContext);
  if (!context) {
    return {
      workspaceRefreshKey: 0,
      bumpWorkspaceList: () => {},
    };
  }
  return context;
}
