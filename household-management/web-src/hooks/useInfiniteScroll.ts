/**
 * useInfiniteScroll
 *
 * Reusable cursor-based pagination hook for the Activity_Log, Task_History,
 * and other large lists. It accumulates items across pages, tracks the opaque
 * `nextCursor`, and exposes a sentinel ref that (via IntersectionObserver)
 * auto-loads the next page when scrolled into view, plus a `loadMore` action
 * for an explicit "Load more" button.
 *
 * Requirements: 5.5 (load-more / scroll-near-end appends next page),
 *               5.6 (indicate more available while nextCursor is non-null),
 *               5.7 (stop requesting once nextCursor is null).
 *
 * The backend applies the default Page_Size (50) when `limit` is omitted, so
 * callers pass a fetcher that requests a page from an opaque cursor.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedResponse } from '@/types';

/**
 * A page fetcher: given the current opaque cursor (undefined for the first
 * page), resolve the next PaginatedResponse envelope.
 */
export type PageFetcher<T> = (cursor?: string) => Promise<PaginatedResponse<T>>;

export interface UseInfiniteScrollResult<T> {
  /** All items accumulated across the pages loaded so far. */
  items: T[];
  /** True while the first page is loading (before any items are shown). */
  loading: boolean;
  /** True while a subsequent page is loading (more items already shown). */
  loadingMore: boolean;
  /** True while additional pages remain (the last nextCursor was non-null). */
  hasMore: boolean;
  /** Error message from the most recent failed fetch, or null. */
  error: string | null;
  /** Explicitly request the next page (wired to a "Load more" button). */
  loadMore: () => void;
  /** Reset to the first page and reload from scratch. */
  reload: () => void;
  /**
   * Ref to attach to a sentinel element at the end of the list. When it
   * scrolls into view and more pages remain, the next page is requested.
   */
  sentinelRef: (node: Element | null) => void;
}

/**
 * @param fetchPage  fetcher that resolves a page from an opaque cursor
 * @param deps       dependency list; when any value changes the list resets
 *                   and reloads from the first page (e.g. an active filter)
 */
export function useInfiniteScroll<T>(
  fetchPage: PageFetcher<T>,
  deps: readonly unknown[] = [],
): UseInfiniteScrollResult<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Keep the latest fetcher without forcing effect re-runs on identity change.
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  // Guard so overlapping requests (scroll + button) don't double-load a page.
  const inFlightRef = useRef(false);
  // Monotonic token so a stale in-flight request from a previous filter/reset
  // cannot append its results after a newer reset has started.
  const requestTokenRef = useRef(0);

  const loadPage = useCallback(async (cursor: string | undefined, isReset: boolean) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const token = requestTokenRef.current;

    if (isReset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const page = await fetchPageRef.current(cursor);
      if (token !== requestTokenRef.current) return; // superseded by a reset
      setItems((prev) => (isReset ? page.items : [...prev, ...page.items]));
      setNextCursor(page.nextCursor);
      setHasMore(page.nextCursor !== null);
      setError(null);
    } catch (err) {
      if (token !== requestTokenRef.current) return;
      const message = err instanceof Error ? err.message : 'Failed to load more';
      setError(message);
    } finally {
      if (token === requestTokenRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
      inFlightRef.current = false;
    }
  }, []);

  // Initial load and reload-on-deps-change.
  useEffect(() => {
    requestTokenRef.current += 1;
    inFlightRef.current = false;
    setItems([]);
    setNextCursor(null);
    setHasMore(true);
    void loadPage(undefined, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;
    void loadPage(nextCursor ?? undefined, false);
  }, [hasMore, loading, loadingMore, nextCursor, loadPage]);

  const reload = useCallback(() => {
    requestTokenRef.current += 1;
    inFlightRef.current = false;
    setItems([]);
    setNextCursor(null);
    setHasMore(true);
    void loadPage(undefined, true);
  }, [loadPage]);

  // IntersectionObserver sentinel: auto-load when the end of the list appears.
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: Element | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (node === null) return;
      if (typeof IntersectionObserver === 'undefined') return;

      const observer = new IntersectionObserver((observerEntries) => {
        const entry = observerEntries[0];
        if (entry && entry.isIntersecting) {
          loadMore();
        }
      });
      observer.observe(node);
      observerRef.current = observer;
    },
    [loadMore],
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return { items, loading, loadingMore, hasMore, error, loadMore, reload, sentinelRef };
}
