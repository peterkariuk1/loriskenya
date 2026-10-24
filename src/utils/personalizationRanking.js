import { VECTOR_VERSION } from "./productVector.js";
import {
  ADD_TO_CART_WEIGHT,
  BEST_SELLER_BOOST,
  CLICK_WEIGHT,
  IN_STOCK_BONUS,
  MIN_WEIGHTED_EVENTS,
} from "./personalizationConfig.js";
import { getInterestSnapshot } from "./personalizationStore.js";

const eventWeight = (event) => (
  (Number(event?.c) || 0) * CLICK_WEIGHT
  + (Number(event?.a) || 0) * ADD_TO_CART_WEIGHT
);

const hasEnoughInterest = (snapshot) => Object.values(snapshot?.products || {})
  .some((event) => eventWeight(event) >= MIN_WEIGHTED_EVENTS)
  || Object.values(snapshot?.products || {})
    .reduce((total, event) => total + eventWeight(event), 0) >= MIN_WEIGHTED_EVENTS;

const isUsableVector = (vector) => Array.isArray(vector)
  && vector.length > 0
  && vector.every((value) => Number.isFinite(value));

const cosineSimilarity = (left, right) => {
  if (!isUsableVector(left) || !isUsableVector(right) || left.length !== right.length) return null;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  left.forEach((value, index) => {
    dot += value * right[index];
    leftMagnitude += value * value;
    rightMagnitude += right[index] * right[index];
  });
  if (!leftMagnitude || !rightMagnitude) return null;
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
};

const sectionMatch = (event, section) => (
  section === "bestSellers" ? event.b
    : section === "ladies" ? event.g === "women"
      : section === "men" ? event.g === "men"
        : false
);

export const getSectionOrder = (snapshot = getInterestSnapshot()) => {
  const original = ["bestSellers", "ladies", "men"];
  if (!hasEnoughInterest(snapshot)) return original;
  return original
    .map((section, index) => ({
      section,
      index,
      score: Object.values(snapshot.products || {})
        .filter((event) => sectionMatch(event, section))
        .reduce((total, event) => total + eventWeight(event), 0),
    }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ section }) => section);
};

const isAvailable = (product) => product?.inStock !== false && Number(product?.stockQuantity) > 0;

const prioritizeAvailability = (products) => [
  ...products.filter(isAvailable),
  ...products.filter((product) => !isAvailable(product)),
];

export const rankProducts = (products, snapshot = getInterestSnapshot(), { availabilityPriority = true } = {}) => {
  if (!Array.isArray(products)) return products;
  if (!hasEnoughInterest(snapshot)) return availabilityPriority ? prioritizeAvailability(products) : products;

  const events = snapshot.products || {};
  const tasteCandidates = Object.entries(events)
    .map(([id, event]) => ({ product: event, weight: eventWeight(event), id }))
    .filter(({ product, weight }) => weight > 0 && product.vv === VECTOR_VERSION && isUsableVector(product.v));
  const vectorLength = tasteCandidates[0]?.product.v.length;
  if (!vectorLength) return availabilityPriority ? prioritizeAvailability(products) : products;

  const taste = Array(vectorLength).fill(0);
  let totalWeight = 0;
  tasteCandidates.forEach(({ product, weight }) => {
    if (product.v.length !== vectorLength) return;
    product.v.forEach((value, index) => { taste[index] += value * weight; });
    totalWeight += weight;
  });
  if (!totalWeight) return availabilityPriority ? prioritizeAvailability(products) : products;
  const tasteMagnitude = Math.sqrt(taste.reduce((total, value) => total + value * value, 0));
  if (!tasteMagnitude) return availabilityPriority ? prioritizeAvailability(products) : products;
  const tasteVector = taste.map((value) => value / tasteMagnitude);

  return products
    .map((product, index) => {
      const similarity = product.vecVersion === VECTOR_VERSION
        ? cosineSimilarity(tasteVector, product.vec)
        : null;
      return {
        product,
        index,
        score: similarity === null ? null : similarity + (product.isBestSeller ? BEST_SELLER_BOOST : 0)
          + (availabilityPriority && isAvailable(product) ? IN_STOCK_BONUS : 0),
      };
    })
    .sort((left, right) => {
      if (left.score === null && right.score === null) {
        if (availabilityPriority && isAvailable(left.product) !== isAvailable(right.product)) {
          return isAvailable(left.product) ? -1 : 1;
        }
        return left.index - right.index;
      }
      if (left.score === null) return 1;
      if (right.score === null) return -1;
      return right.score - left.score || left.index - right.index;
    })
    .map(({ product }) => product);
};

export const isDefaultGridSort = ({ sortBy = "newest", searchQuery = "", category = "", minPrice = 0, maxPrice = Infinity } = {}) => (
  sortBy === "newest" && !searchQuery && !category && Number(minPrice) <= 0 && maxPrice === Infinity
);
