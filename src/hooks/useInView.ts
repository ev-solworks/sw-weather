/**
 * useInView — fires once when an element first scrolls within `rootMargin` of the
 * viewport, and stays true thereafter. Used to lazy-load Home cards so off-screen
 * locations don't fetch until needed (keeps the cold-load burst small).
 */

import { useEffect, useRef, useState } from 'react';

export function useInView<T extends HTMLElement>(rootMargin = '200px'): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return; // latch: once seen, stop observing
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true); // no IO support → just enable
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);

  return [ref, inView];
}
