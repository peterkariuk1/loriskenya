import {
  AUDIENCE_MAP,
  PERSONALIZATION_PROFILE_VERSION,
} from "./personalizationConfig.js";

const createAffinityMap = () => ({
  men: { score: 0, lastUpdated: 0 },
  ladies: { score: 0, lastUpdated: 0 },
  unisex: { score: 0, lastUpdated: 0 },
});

export const createEmptyProfile = (visitorId, sessionId) => ({
  version: PERSONALIZATION_PROFILE_VERSION,
  visitorId,
  sessionId,
  userId: null,
  audienceAffinity: createAffinityMap(),
  categoryAffinity: {},
  priceBandAffinity: {},
  seenWithoutClick: {},
  purchasedProductIds: [],
  meaningfulActivity: {
    clicks: 0,
    addToCart: 0,
    purchases: 0,
    dwells: 0,
  },
  lastUpdated: 0,
});

const isObject = (value) => value && typeof value === "object" && !Array.isArray(value);

const normalizeAffinityMap = (value, fallback = {}) => {
  if (!isObject(value)) return fallback;
  return Object.entries(value).reduce((result, [key, entry]) => {
    if (typeof entry === "number") {
      result[key] = { score: entry, lastUpdated: 0 };
    } else if (isObject(entry) && Number.isFinite(entry.score)) {
      result[key] = {
        score: entry.score,
        lastUpdated: Number.isFinite(entry.lastUpdated) ? entry.lastUpdated : 0,
      };
    }
    return result;
  }, {});
};

export const sanitizeProfile = (candidate, visitorId, sessionId) => {
  const base = createEmptyProfile(visitorId, sessionId);
  if (!isObject(candidate)) return base;

  return {
    ...base,
    ...candidate,
    version: PERSONALIZATION_PROFILE_VERSION,
    visitorId,
    sessionId,
    audienceAffinity: {
      ...base.audienceAffinity,
      ...normalizeAffinityMap(candidate.audienceAffinity, base.audienceAffinity),
    },
    categoryAffinity: normalizeAffinityMap(candidate.categoryAffinity),
    priceBandAffinity: normalizeAffinityMap(candidate.priceBandAffinity),
    seenWithoutClick: isObject(candidate.seenWithoutClick)
      ? Object.entries(candidate.seenWithoutClick).reduce((result, [id, count]) => {
        if (Number.isFinite(count) && count > 0) result[id] = count;
        return result;
      }, {})
      : {},
    purchasedProductIds: Array.isArray(candidate.purchasedProductIds)
      ? [...new Set(candidate.purchasedProductIds.filter(Boolean))]
      : [],
    meaningfulActivity: {
      ...base.meaningfulActivity,
      ...(isObject(candidate.meaningfulActivity) ? candidate.meaningfulActivity : {}),
    },
    lastUpdated: Number.isFinite(candidate.lastUpdated) ? candidate.lastUpdated : 0,
  };
};

export const getAudience = (product) => AUDIENCE_MAP[product?.gender] || "unisex";

export const addAffinity = (profile, dimension, value, amount, timestamp = Date.now()) => {
  if (!value || !Number.isFinite(amount)) return profile;
  const current = profile[dimension]?.[value] || { score: 0, lastUpdated: 0 };
  return {
    ...profile,
    [dimension]: {
      ...profile[dimension],
      [value]: {
        score: current.score + amount,
        lastUpdated: timestamp,
      },
    },
    lastUpdated: timestamp,
  };
};

export const getVisitorStorage = () => {
  try {
    return {
      local: window.localStorage,
      session: window.sessionStorage,
    };
  } catch (error) {
    console.warn("Visitor personalization storage is unavailable.", error);
    return null;
  }
};

export const readStoredProfile = (visitorId, sessionId) => {
  const storage = getVisitorStorage();
  if (!storage) return createEmptyProfile(visitorId, sessionId);
  try {
    const saved = storage.local.getItem("loris:visitor-profile:v1");
    return sanitizeProfile(saved ? JSON.parse(saved) : null, visitorId, sessionId);
  } catch (error) {
    console.warn("Visitor personalization profile could not be read.", error);
    return createEmptyProfile(visitorId, sessionId);
  }
};

export const saveStoredProfile = (profile) => {
  const storage = getVisitorStorage();
  if (!storage) return false;
  try {
    storage.local.setItem("loris:visitor-profile:v1", JSON.stringify(profile));
    return true;
  } catch (error) {
    console.warn("Visitor personalization profile could not be saved.", error);
    return false;
  }
};
