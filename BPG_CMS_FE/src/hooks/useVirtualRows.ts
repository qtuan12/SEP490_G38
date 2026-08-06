import React, { useMemo, useState } from 'react';

interface UseVirtualRowsOptions {
  rowHeight?: number;
  containerHeight?: number;
  overscan?: number;
  threshold?: number;
}

interface VirtualRow<T> {
  item: T;
  index: number;
}

export function useVirtualRows<T>(
  items: T[],
  {
    rowHeight = 56,
    containerHeight = 520,
    overscan = 6,
    threshold = 50,
  }: UseVirtualRowsOptions = {},
) {
  const [scrollTop, setScrollTop] = useState(0);
  const isVirtualized = items.length > threshold;

  const startIndex = isVirtualized
    ? Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
    : 0;
  const visibleCount = isVirtualized
    ? Math.ceil(containerHeight / rowHeight) + overscan * 2
    : items.length;
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  const visibleRows = useMemo<VirtualRow<T>[]>(
    () => items.slice(startIndex, endIndex).map((item, offset) => ({
      item,
      index: startIndex + offset,
    })),
    [items, startIndex, endIndex],
  );

  const topPadding = isVirtualized ? startIndex * rowHeight : 0;
  const bottomPadding = isVirtualized ? Math.max(0, (items.length - endIndex) * rowHeight) : 0;

  const scrollContainerProps = {
    onScroll: (event: React.UIEvent<HTMLElement>) => {
      if (isVirtualized) {
        setScrollTop(event.currentTarget.scrollTop);
      }
    },
    style: isVirtualized
      ? { maxHeight: containerHeight, overflowY: 'auto' as const }
      : undefined,
  };

  return {
    isVirtualized,
    visibleRows,
    topPadding,
    bottomPadding,
    rowHeight,
    scrollContainerProps,
  };
}
