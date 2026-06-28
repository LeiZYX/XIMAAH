"use client";

import { useCallback, useEffect, useState } from "react";

const LOAD_ERROR =
  "Could not load data. Check that MySQL is running and run npm run db:migrate.";

export async function fetchJsonList<T>(endpoint: string): Promise<T[]> {
  const response = await fetch(endpoint);

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || LOAD_ERROR);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

interface UseAdminListResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useAdminList<T>(endpoint: string): UseAdminListResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchJsonList<T>(endpoint);
      setItems(data);
    } catch (loadError) {
      setItems([]);
      setError(
        loadError instanceof Error ? loadError.message : "Failed to load data",
      );
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { items, loading, error, reload };
}

interface AdminStatusProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  entityName: string;
}

export function AdminStatus({ loading, error, empty, entityName }: AdminStatusProps) {
  if (loading) {
    return (
      <p className="mb-4 text-sm text-slate-500">Loading {entityName}...</p>
    );
  }

  if (error) {
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (empty) {
    return (
      <p className="mb-4 text-sm text-slate-500">
        No {entityName} yet. Use the form to add one.
      </p>
    );
  }

  return null;
}
