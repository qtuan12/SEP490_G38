import { useEffect, useRef } from 'react';
import {
  REALTIME_DATA_CHANGED_EVENT,
  type RealtimeDataChangedPayload,
} from '../constants/realtimeEntities';

/** Dùng cho các màn hình tải dữ liệu thủ công, không sử dụng React Query. */
export function useRealtimeDataRefresh(
  refresh: () => void | Promise<void>,
  entityNames?: readonly string[],
  debounceMs = 150,
) {
  const refreshRef = useRef(refresh);
  const entityNamesRef = useRef(entityNames);
  refreshRef.current = refresh;
  entityNamesRef.current = entityNames;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isRefreshing = false;
    let refreshQueued = false;
    let disposed = false;

    const executeRefresh = async () => {
      if (isRefreshing) {
        refreshQueued = true;
        return;
      }

      isRefreshing = true;
      try {
        do {
          refreshQueued = false;
          try {
            await refreshRef.current();
          } catch (error) {
            console.error('Realtime data refresh failed:', error);
          }
        } while (refreshQueued && !disposed);
      } finally {
        isRefreshing = false;
      }
    };

    const handleDataChanged = (event: Event) => {
      const payload = (event as CustomEvent<RealtimeDataChangedPayload>).detail;
      const changedEntities = payload?.entities ?? [];
      const watchedEntities = entityNamesRef.current;
      if (
        payload?.refreshAll !== true
        && changedEntities.length > 0
        && watchedEntities?.length
        && !watchedEntities.some(name => changedEntities.includes(name))
      ) return;

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void executeRefresh();
      }, debounceMs);
    };

    window.addEventListener(REALTIME_DATA_CHANGED_EVENT, handleDataChanged);
    return () => {
      disposed = true;
      window.removeEventListener(REALTIME_DATA_CHANGED_EVENT, handleDataChanged);
      if (timer) clearTimeout(timer);
    };
  }, [debounceMs]);
}
