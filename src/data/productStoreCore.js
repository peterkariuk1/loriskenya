export const PRODUCT_TTL_MS = 2 * 60 * 1000;
export const PRODUCT_MAX_STALE_MS = 10 * 60 * 1000;

export function createProductStore(fetchProducts, now = Date.now) {
  let products = null;
  let updatedAt = 0;
  let inFlight = null;
  let invalidated = true;

  const refresh = () => {
    if (inFlight) return inFlight;
    inFlight = Promise.resolve().then(fetchProducts).then((fresh) => {
      products = fresh;
      updatedAt = now();
      invalidated = false;
      return products;
    }).finally(() => { inFlight = null; });
    return inFlight;
  };

  return {
    async getProducts() {
      const age = invalidated ? Infinity : now() - updatedAt;
      if (Array.isArray(products) && products.length && age < PRODUCT_TTL_MS) return products;
      if (Array.isArray(products) && products.length && age < PRODUCT_MAX_STALE_MS) {
        refresh().catch(() => {});
        return products;
      }
      return refresh();
    },
    peek: () => products,
    isExpired: () => invalidated || !Array.isArray(products) || !products.length || now() - updatedAt >= PRODUCT_MAX_STALE_MS,
    invalidate() { invalidated = true; },
    async forceRefresh() { return refresh(); },
  };
}
