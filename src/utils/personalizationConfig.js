export const PERSONALIZATION_PROFILE_VERSION = 1;
export const VISITOR_ID_STORAGE_KEY = "loris:visitor-id:v1";
export const SESSION_ID_STORAGE_KEY = "loris:visitor-session-id:v1";
export const PROFILE_STORAGE_KEY = "loris:visitor-profile:v1";
export const OPT_OUT_STORAGE_KEY = "loris:personalization-opt-out:v1";
export const CONSENT_STORAGE_KEY = "loris:personalization-consent:v1";
export const DEBUG_STORAGE_KEY = "loris:personalization-debug:v1";

export const PERSONALIZATION_WEIGHTS = {
  impression: -0.08,
  click: 1,
  dwell: 1.5,
  addToCart: 3,
  purchase: 5,
  bestSellerBoost: 0.15,
  outOfStockPenalty: 3,
  purchasedPenalty: 4,
  repeatedSeenPenalty: 0.12,
  explorationSlots: 2,
  dwellThresholdMs: 3000,
  decayHalfLifeMs: 1000 * 60 * 60 * 24 * 30,
};

export const AUDIENCE_MAP = {
  men: "men",
  women: "ladies",
  unisex: "unisex",
};
