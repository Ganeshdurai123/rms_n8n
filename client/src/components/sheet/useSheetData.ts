import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import type { RequestItem } from '@/lib/types';

export interface SheetQuery {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  status?: string;
  priority?: string;
  assignedTo?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  fields?: Record<string, string>;
}

export interface UseSheetDataReturn {
  requests: RequestItem[];
  pagination: { page: number; limit: number; total: number; pages: number };
  query: SheetQuery;
  isLoading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  setSort: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  toggleSort: (column: string) => void;
  setFilter: (key: string, value: string | undefined) => void;
  setFieldFilter: (fieldKey: string, value: string | undefined) => void;
  setSearch: (search: string) => void;
  setDateRange: (after?: string, before?: string) => void;
  refresh: () => void;
}

const DEFAULT_QUERY: SheetQuery = {
  page: 1,
  limit: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export function useSheetData(programId: string): UseSheetDataReturn {
  const [query, setQuery] = useState<SheetQuery>({ ...DEFAULT_QUERY });
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCounter, setRefetchCounter] = useState(0);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(query.search);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(query.search);
    }, 300);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [query.search]);

  // Fetch data whenever query state changes (using debounced search)
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        // Build query params
        const params: Record<string, string> = {
          page: String(query.page),
          limit: String(query.limit),
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
        };

        if (query.status) params.status = query.status;
        if (query.priority) params.priority = query.priority;
        if (query.assignedTo) params.assignedTo = query.assignedTo;
        if (debouncedSearch) params.search = debouncedSearch;
        if (query.createdAfter) params.createdAfter = query.createdAfter;
        if (query.createdBefore) params.createdBefore = query.createdBefore;

        // Custom field filters as fields[key]=value
        if (query.fields) {
          for (const [key, value] of Object.entries(query.fields)) {
            if (value) {
              params[`fields[${key}]`] = value;
            }
          }
        }

        const { data } = await api.get(
          `/programs/${programId}/requests`,
          { params },
        );

        if (!cancelled) {
          setRequests(data.data);
          setPagination(data.pagination);
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof Error ? err.message : 'Failed to fetch requests';
          setError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [
    programId,
    query.page,
    query.limit,
    query.sortBy,
    query.sortOrder,
    query.status,
    query.priority,
    query.assignedTo,
    debouncedSearch,
    query.createdAfter,
    query.createdBefore,
    query.fields,
    refetchCounter,
  ]);

  const setPage = useCallback((page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  }, []);

  const setLimit = useCallback((limit: number) => {
    setQuery((prev) => ({ ...prev, limit, page: 1 }));
  }, []);

  const setSort = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc') => {
      setQuery((prev) => ({ ...prev, sortBy, sortOrder, page: 1 }));
    },
    [],
  );

  const toggleSort = useCallback((column: string) => {
    setQuery((prev) => {
      if (prev.sortBy === column) {
        return {
          ...prev,
          sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
          page: 1,
        };
      }
      return { ...prev, sortBy: column, sortOrder: 'asc', page: 1 };
    });
  }, []);

  const setFilter = useCallback(
    (key: string, value: string | undefined) => {
      setQuery((prev) => ({
        ...prev,
        [key]: value || undefined,
        page: 1,
      }));
    },
    [],
  );

  const setFieldFilter = useCallback(
    (fieldKey: string, value: string | undefined) => {
      setQuery((prev) => {
        const newFields = { ...(prev.fields || {}) };
        if (!value) {
          delete newFields[fieldKey];
        } else {
          newFields[fieldKey] = value;
        }
        return {
          ...prev,
          fields: Object.keys(newFields).length > 0 ? newFields : undefined,
          page: 1,
        };
      });
    },
    [],
  );

  const setSearch = useCallback((search: string) => {
    setQuery((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  const setDateRange = useCallback(
    (after?: string, before?: string) => {
      setQuery((prev) => ({
        ...prev,
        createdAfter: after || undefined,
        createdBefore: before || undefined,
        page: 1,
      }));
    },
    [],
  );

  const refresh = useCallback(() => {
    setRefetchCounter((c) => c + 1);
  }, []);

  return {
    requests,
    pagination,
    query,
    isLoading,
    error,
    setPage,
    setLimit,
    setSort,
    toggleSort,
    setFilter,
    setFieldFilter,
    setSearch,
    setDateRange,
    refresh,
  };
}
