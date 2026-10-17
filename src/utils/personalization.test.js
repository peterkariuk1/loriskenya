import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProfile, addAffinity } from "./visitorProfile.js";
import { rankProducts, getProductScore } from "./personalization.js";

const products = [
  { id: "men-1", name: "Men One", gender: "men", category: "Cologne", price: 4000 },
  { id: "women-1", name: "Women One", gender: "women", category: "Floral", price: 4000 },
];

test("cold-start profiles preserve the original order", () => {
  const profile = createEmptyProfile("visitor", "session");
  assert.deepEqual(rankProducts(products, profile, "session"), products);
});

test("recent affinity ranks matching products first", () => {
  let profile = createEmptyProfile("visitor", "session");
  profile = addAffinity(profile, "audienceAffinity", "men", 5);
  profile = addAffinity(profile, "categoryAffinity", "Cologne", 5);
  profile.meaningfulActivity.clicks = 1;
  const menScore = getProductScore(products[0], profile).score;
  const womenScore = getProductScore(products[1], profile).score;
  assert.ok(menScore > womenScore);
});

test("product scores penalize repeated impression-only views", () => {
  const profile = createEmptyProfile("visitor", "session");
  profile.meaningfulActivity.clicks = 1;
  profile.seenWithoutClick["men-1"] = 5;
  const score = getProductScore(products[0], profile);
  assert.ok(score.reasons.some((reason) => reason.includes("impression-only")));
});
