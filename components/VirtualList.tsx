import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number; // px
  height: number; // px
  overscan?: number; // number of items to render above/below
  renderItem: (item: T, index: number) => React.ReactNode;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export default function VirtualList<T>({ items, itemHeight, height, overscan = 5, renderItem }: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(height / itemHeight);

  const startIndex = clamp(Math.floor(scrollTop / itemHeight) - overscan, 0, Math.max(0, items.length - 1));
  const endIndex = clamp(startIndex + visibleCount + overscan * 2, 0, items.length);

  const offsetY = startIndex * itemHeight;
  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);

  const onScroll = useCallback(() => {
    if (!containerRef.current) return;
    setScrollTop(containerRef.current.scrollTop);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => onScroll();
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler as any);
  }, [onScroll]);

  return (
    <div ref={containerRef} style={{ height, overflowY: 'auto', willChange: 'transform' }}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {visibleItems.map((item, i) => renderItem(item, startIndex + i))}
        </div>
      </div>
    </div>
  );
}

