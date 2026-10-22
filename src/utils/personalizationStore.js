import {
  ADD_TO_CART_WEIGHT,
  CLICK_WEIGHT,
  MAX_INTERESTED_PRODUCTS,
  PERSONALIZATION_STORAGE_KEY,
  STORE_WRITE_DEBOUNCE_MS,
  VISITOR_ID_STORAGE_KEY,
} from "./personalizationConfig.js";

const emptyStore = (vid) => ({ vid, updatedAt: 0, products: {} });

const canUseStorage = () => typeof window !== "undefined" && window.localStorage;

const createVisitorId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getVisitorId = () => {
  try {
    if (!canUseStorage()) return "local";
    const existing = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
    if (existing) return existing;
    const visitorId = createVisitorId();
    window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
    return visitorId;
  } catch {
    return "local";
  }
};

const readStore = () => {
  try {
    if (!canUseStorage()) return emptyStore(getVisitorId());
    const parsed = JSON.parse(window.localStorage.getItem(PERSONALIZATION_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object" || !parsed.products) {
      return emptyStore(getVisitorId());
    }
    return { ...emptyStore(getVisitorId()), ...parsed, products: parsed.products };
  } catch {
    return emptyStore(getVisitorId());
  }
};

let store = readStore();
let writeTimer = null;

const flush = () => {
  try {
    if (canUseStorage()) {
      window.localStorage.setItem(PERSONALIZATION_STORAGE_KEY, JSON.stringify(store));
    }
  } catch {
    // Tracking must never affect storefront behavior.
  }
};

const scheduleWrite = () => {
  try {
    if (writeTimer) window.clearTimeout(writeTimer);
    writeTimer = window.setTimeout(() => {
      writeTimer = null;
      flush();
    }, STORE_WRITE_DEBOUNCE_MS);
  } catch {
    flush();
  }
};

const recordEvent = (product, key) => {
  try {
    if (!product?.id) return;
    const current = store.products[product.id] || { c: 0, a: 0, t: 0 };
    store.products[product.id] = {
      ...current,
      [key]: current[key] + 1,
      t: Date.now(),
      b: Boolean(product.isBestSeller),
      g: typeof product.gender === "string" ? product.gender.toLowerCase() : "",
      v: Array.isArray(product.vec) ? product.vec : current.v,
      vv: product.vecVersion ?? current.vv,
    };
    store.updatedAt = Date.now();

    const recentIds = Object.entries(store.products)
      .sort(([, left], [, right]) => right.t - left.t)
      .slice(0, MAX_INTERESTED_PRODUCTS)
      .map(([id]) => id);
    store.products = Object.fromEntries(recentIds.map((id) => [id, store.products[id]]));
    scheduleWrite();
  } catch {
    // Tracking must never affect storefront behavior.
  }
};

export const recordClick = (product) => recordEvent(product, "c", CLICK_WEIGHT);
export const recordAddToCart = (product) => recordEvent(product, "a", ADD_TO_CART_WEIGHT);

export const getInterestSnapshot = () => store;

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", flush);
}
