import {
  PERSONALIZATION_WEIGHTS,
} from "./personalizationConfig.js";
import { getAudience } from "./visitorProfile.js";

const getPriceBand = (price) => {
  const amount = Number(price) || 0;
  if (amount < 3000) return "budget";
  if (amount < 7000) return "mid";
  return "premium";
};

const decay = (entry, now) => {
  if (!entry || !Number.isFinite(entry.score)) return 0;
  if (!entry.lastUpdated) return entry.score;
  const age = Math.max(0, now - entry.lastUpdated);
  return entry.score * Math.pow(0.5, age / PERSONALIZATION_WEIGHTS.decayHalfLifeMs);
};

const hash = (value) => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
};

const seededValue = (seed, id) => hash(`${seed}:${id}`) / 4294967296;

export const getProductScore = (product, profile, now = Date.now()) => {
  if (!profile || !product) return { score: 0, reasons: ["default ordering"] };

  const audience = getAudience(product);
  const category = product.category;
  const priceBand = getPriceBand(product.price);
  const audienceScore = decay(profile.audienceAffinity?.[audience], now);
  const categoryScore = decay(profile.categoryAffinity?.[category], now);
  const priceBandScore = decay(profile.priceBandAffinity?.[priceBand], now);
  const seenCount = profile.seenWithoutClick?.[product.id] || 0;
  const purchased = profile.purchasedProductIds?.includes(product.id);
  let score = audienceScore + categoryScore + priceBandScore;
  const reasons = [];

  if (audienceScore) reasons.push(`audience ${audienceScore.toFixed(2)}`);
  if (categoryScore) reasons.push(`category ${categoryScore.toFixed(2)}`);
  if (priceBandScore) reasons.push(`price ${priceBandScore.toFixed(2)}`);
  if (product.isBestSeller) {
    score += PERSONALIZATION_WEIGHTS.bestSellerBoost;
    reasons.push("best seller");
  }
  if (product.inStock === false || (
    Number.isFinite(Number(product.stockQuantity)) && Number(product.stockQuantity) <= 0
  )) {
    score -= PERSONALIZATION_WEIGHTS.outOfStockPenalty;
    reasons.push("out of stock");
  }
  if (purchased) {
    score -= PERSONALIZATION_WEIGHTS.purchasedPenalty;
    reasons.push("already purchased");
  }
  if (seenCount > 2) {
    score -= (seenCount - 2) * PERSONALIZATION_WEIGHTS.repeatedSeenPenalty;
    reasons.push(`${seenCount} impression-only views`);
  }

  return { score, reasons };
};

export const rankProducts = (products, profile, sessionId, options = {}) => {
  if (!Array.isArray(products) || !profile || !sessionId) return products;
  const now = options.now || Date.now();
  const coldStart = Object.values(profile.meaningfulActivity || {}).reduce(
    (total, value) => total + (Number(value) || 0),
    0
  ) < 1;
  if (coldStart) return products;

  const scored = products.map((product, index) => ({
    product,
    index,
    ...getProductScore(product, profile, now),
  }));
  scored.sort((left, right) => (
    right.score - left.score
    || seededValue(sessionId, left.product.id) - seededValue(sessionId, right.product.id)
    || left.index - right.index
  ));

  const explorationCount = Math.min(PERSONALIZATION_WEIGHTS.explorationSlots, scored.length);
  const exploration = [...scored]
    .sort((left, right) => seededValue(`${sessionId}:explore`, left.product.id) - seededValue(`${sessionId}:explore`, right.product.id))
    .slice(0, explorationCount);
  const explorationIds = new Set(exploration.map(({ product }) => product.id));
  const ranked = scored.filter(({ product }) => !explorationIds.has(product.id));
  exploration.forEach((item, index) => ranked.splice(Math.min((index + 1) * 4, ranked.length), 0, item));

  return ranked.map(({ product }) => product);
};

export const getSectionOrder = (profile, sessionId) => {
  const sections = [
    { key: "best", audience: null },
    { key: "ladies", audience: "ladies" },
    { key: "men", audience: "men" },
  ];
  if (!profile || !sessionId) return sections.map(({ key }) => key);
  return sections
    .map((section, index) => ({
      ...section,
      score: section.audience
        ? decay(profile.audienceAffinity?.[section.audience], Date.now())
        : 0.1,
      index,
    }))
    .sort((left, right) => right.score - left.score || seededValue(sessionId, left.key) - seededValue(sessionId, right.key))
    .map(({ key }) => key);
};

export { getPriceBand };
