import { useLayoutEffect } from "react";

export const STOREFRONT_SCROLL_KEY = "loris-storefront-scroll";

export function useStorefrontScrollRestoration(locationKey) {
  useLayoutEffect(() => {
    const storedPosition = sessionStorage.getItem(STOREFRONT_SCROLL_KEY);
    if (!storedPosition) {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    try {
      const { path, scrollY } = JSON.parse(storedPosition);
      if (path !== locationKey) {
        sessionStorage.removeItem(STOREFRONT_SCROLL_KEY);
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        return;
      }

      // Restore immediately without an animated transition. The grid may still
      // be loading, so keep correcting the position until the saved point exists.
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });

      let frameCount = 0;
      let animationFrame;
      const restoreWhenReady = () => {
        frameCount += 1;
        const pageCanReachPosition = document.documentElement.scrollHeight >= scrollY + window.innerHeight;

        if (pageCanReachPosition || frameCount >= 120) {
          window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
          sessionStorage.removeItem(STOREFRONT_SCROLL_KEY);
          return;
        }

        animationFrame = requestAnimationFrame(restoreWhenReady);
      };

      animationFrame = requestAnimationFrame(restoreWhenReady);
      return () => cancelAnimationFrame(animationFrame);
    } catch (error) {
      sessionStorage.removeItem(STOREFRONT_SCROLL_KEY);
      console.error("Unable to restore storefront scroll position:", error);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [locationKey]);
}
