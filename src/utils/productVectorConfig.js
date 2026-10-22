export const VECTOR_BLOCK_WEIGHTS = {
  scent: 0.35,
  category: 0.25,
  gender: 0.20,
  price: 0.10,
  sizes: 0.10,
};

export const PRODUCT_CATEGORIES = [
  "Auto Perfumes",
  "Body Care",
  "Cologne",
  "Diffusers",
  "Dmar",
  "Frequence",
  "Loris Perfumes",
  "Lotion",
  "Mist",
  "Niche Perfumes",
  "Niche Diffusers",
  "Room Spray",
  "Mystery Perfume",
  "Others",
];

export const SCENT_VOCABULARY = [
  "oud",
  "vanilla",
  "musk",
  "citrus",
  "floral",
  "woody",
  "amber",
  "fresh",
  "sweet",
  "spicy",
  "rose",
  "jasmine",
  "leather",
  "aquatic",
  "fruity",
  "powdery",
  "tobacco",
  "coffee",
  "sandalwood",
  "lavender",
  "bergamot",
  "patchouli",
  "caramel",
  "coconut",
];

export const SIZE_LIST = [10, 50, 100, 120, 150, 180, 236, 250, 430, 500];

// These are the current catalog's selling-price bounds. Changing them requires
// bumping VECTOR_VERSION because it changes every product's price dimension.
export const PRICE_MIN = 400;
export const PRICE_MAX = 6250;
