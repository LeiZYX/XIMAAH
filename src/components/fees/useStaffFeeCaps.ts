"use client";

import { useEffect, useState } from "react";

export function useStaffFeeCaps() {
  const [caps, setCaps] = useState({
    loaded: false,
    canReprice: false,
    canRecordRefund: false,
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user?: { role?: string } } | null) => {
        const role = data?.user?.role;
        setCaps({
          loaded: true,
          canReprice: role === "ADMIN" || role === "EXAM_OFFICER",
          canRecordRefund: role === "ADMIN" || role === "FINANCE",
        });
      })
      .catch(() => setCaps((current) => ({ ...current, loaded: true })));
  }, []);

  return caps;
}
