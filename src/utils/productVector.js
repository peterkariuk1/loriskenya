import {
  PRODUCT_CATEGORIES,
  PRICE_MAX,
  PRICE_MIN,
  SCENT_VOCABULARY,
  SIZE_LIST,
  VECTOR_BLOCK_WEIGHTS,
} from "./productVectorConfig.js";

export const VECTOR_VERSION = 1;

export const VECTOR_LABELS = [
  ...SCENT_VOCABULARY.map((scent) => `scent:${scent}`),
  ...PRODUCT_CATEGORIES.map((category) => `category:${category}`),
  "gender:men",
  "gender:women",
  "price:normalized",
  ...SIZE_LIST.map((size) => `size:${size}ml`),
];

const l2NormalizeAndWeight = (values, weight) => {
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  if (!magnitude) return values.map(() => 0);
  const scale = Math.sqrt(weight) / magnitude;
  return values.map((value) => value * scale);
};

const round = (value) => Number(value.toFixed(4));

const getText = (product) => `${product?.name || ""} ${product?.description || ""}`;

const getScentBlock = (product) => {
  const text = getText(product);
  return l2NormalizeAndWeight(
    SCENT_VOCABULARY.map((scent) => (
      new RegExp(`\\b${scent}\\b`, "i").test(text) ? 1 : 0
    )),
    VECTOR_BLOCK_WEIGHTS.scent
  );
};

const getCategoryBlock = (product) => l2NormalizeAndWeight(
  PRODUCT_CATEGORIES.map((category) => (
    typeof product?.category === "string"
      && product.category.toLowerCase() === category.toLowerCase() ? 1 : 0
  )),
  VECTOR_BLOCK_WEIGHTS.category
);

const getGenderBlock = (product) => {
  const gender = typeof product?.gender === "string" ? product.gender.toLowerCase() : "";
  const values = gender === "men"
    ? [1, 0]
    : gender === "women"
      ? [0, 1]
      : gender === "unisex"
        ? [0.7, 0.7]
        : [0, 0];
  return l2NormalizeAndWeight(values, VECTOR_BLOCK_WEIGHTS.gender);
};

const getPriceValue = (product) => {
  const price = Number(product?.price);
  if (!Number.isFinite(price) || price <= 0 || PRICE_MAX <= PRICE_MIN) return 0;
  const normalized = (Math.log(price) - Math.log(PRICE_MIN))
    / (Math.log(PRICE_MAX) - Math.log(PRICE_MIN));
  return Math.sqrt(VECTOR_BLOCK_WEIGHTS.price) * Math.min(1, Math.max(0, normalized));
};

const getSizesBlock = (product) => {
  const quantities = Array.isArray(product?.quantities) ? product.quantities : [];
  const sizes = quantities.map((quantity) => {
    const match = String(quantity).match(/(\d+(?:\.\d+)?)\s*ml\b/i);
    return match ? Number(match[1]) : null;
  });
  return l2NormalizeAndWeight(
    SIZE_LIST.map((size) => sizes.includes(size) ? 1 : 0),
    VECTOR_BLOCK_WEIGHTS.sizes
  );
};

export const buildProductVector = (product) => [
  ...getScentBlock(product),
  ...getCategoryBlock(product),
  ...getGenderBlock(product),
  getPriceValue(product),
  ...getSizesBlock(product),
].map(round);
