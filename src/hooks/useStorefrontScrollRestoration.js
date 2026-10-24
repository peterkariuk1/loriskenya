import { useLayoutEffect, useRef } from "react";

export const STOREFRONT_SCROLL_KEY = "loris-storefront-scroll";
const entryKey = (key) => `loris-storefront-entry:${key}`;

export function getStorefrontEntry(locationKey) {
  try { return JSON.parse(sessionStorage.getItem(entryKey(locationKey)) || "null"); }
  catch { return null; }
}

export function getStorefrontGridState(locationKey, gridId) {
  return getStorefrontEntry(locationKey)?.gridState?.[gridId] || {};
}

export function saveStorefrontEntry(locationKey, gridId, gridState) {
  if (!locationKey) return;
  try {
    const previous = getStorefrontEntry(locationKey) || {};
    sessionStorage.setItem(entryKey(locationKey), JSON.stringify({
      scrollY: window.scrollY,
      gridState: gridId ? { ...previous.gridState, [gridId]: gridState } : previous.gridState || {},
    }));
    sessionStorage.setItem(STOREFRONT_SCROLL_KEY, "1");
  } catch (error) {
    console.error("Unable to save storefront position:", error);
  }
}

export function useStorefrontGridState(locationKey, gridId, state) {
  const latestState = useRef(state);
  latestState.current = state;
  useLayoutEffect(() => {
    const save = () => saveStorefrontEntry(locationKey, gridId, latestState.current);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, [locationKey, gridId]);
}

export function useStorefrontScrollRestoration(location, navigationType = "POP") {
  const previousPath = useRef(null);
  useLayoutEffect(() => {
    const { key, pathname } = location;
    const saved = getStorefrontEntry(key);
    const isFirstVisit = previousPath.current === null;
    const changedPath = previousPath.current !== null && previousPath.current !== pathname;
    previousPath.current = pathname;

    if (navigationType !== "POP" || !saved) {
      if (isFirstVisit || changedPath) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      if (isFirstVisit || changedPath) sessionStorage.removeItem(STOREFRONT_SCROLL_KEY);
    } else {
      sessionStorage.setItem(STOREFRONT_SCROLL_KEY, "1");
      const page = document.querySelector(pathname === "/" ? "#men" : "#grid-section") || document.documentElement;
      const target = Math.max(0, Number(saved.scrollY) || 0);
      let finished = false;
      let timeoutId;
      const finish = () => {
        if (finished) return;
        finished = true;
        const documentMax = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const pageBottom = page.getBoundingClientRect().bottom + window.scrollY;
        const maxScroll = Math.min(documentMax, Math.max(0, pageBottom - window.innerHeight));
        window.scrollTo({ top: Math.min(target, maxScroll), left: 0, behavior: "instant" });
        observer?.disconnect();
        mutationObserver?.disconnect();
        clearTimeout(timeoutId);
        sessionStorage.removeItem(STOREFRONT_SCROLL_KEY);
      };
      const attempt = () => {
        const pageBottom = page.getBoundingClientRect().bottom + window.scrollY;
        const pageMax = Math.max(0, pageBottom - window.innerHeight);
        if (pageMax >= target || Date.now() >= deadline) finish();
      };
      const deadline = Date.now() + 2000;
      const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(attempt);
      const mutationObserver = typeof MutationObserver === "undefined" ? null : new MutationObserver(attempt);
      const saveIfRestored = () => { if (finished) saveStorefrontEntry(key); };
      observer?.observe(page);
      mutationObserver?.observe(page, { childList: true, subtree: true });
      window.addEventListener("pagehide", saveIfRestored);
      timeoutId = window.setTimeout(finish, 2000);
      requestAnimationFrame(attempt);
      return () => {
        if (finished) saveStorefrontEntry(key);
        window.removeEventListener("pagehide", saveIfRestored);
        observer?.disconnect();
        mutationObserver?.disconnect();
        clearTimeout(timeoutId);
      };
    }

    const save = () => saveStorefrontEntry(key);
    window.addEventListener("pagehide", save);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
    };
  }, [location.key, location.pathname, navigationType]);
}
