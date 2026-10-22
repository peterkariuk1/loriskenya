import assert from "node:assert/strict";
import test from "node:test";
import { getSectionOrder, rankProducts } from "./personalizationRanking.js";

const product = (id, vec, extra = {}) => ({
  id,
  vec,
  vecVersion: 1,
  inStock: true,
  stockQuantity: 1,
  ...extra,
});

test("keeps original order on cold start", () => {
  const products = [product("a", [1, 0]), product("b", [0, 1])];
  assert.deepEqual(rankProducts(products, { products: {} }), products);
  assert.deepEqual(getSectionOrder({ products: {} }), ["bestSellers", "ladies", "men"]);
});

test("ranks products by the weighted taste vector", () => {
  const products = [product("a", [1, 0]), product("b", [0, 1])];
  const snapshot = { products: { taste: { c: 0, a: 1, t: 1, v: [1, 0], vv: 1 } } };
  assert.equal(rankProducts(products, snapshot)[0].id, "a");
});

test("ranks landing sections by membership score", () => {
  const snapshot = {
    products: {
      men: { c: 0, a: 1, t: 1, g: "men" },
      women: { c: 1, a: 0, t: 2, g: "women" },
      best: { c: 1, a: 0, t: 3, b: true },
    },
  };
  assert.deepEqual(getSectionOrder(snapshot), ["men", "bestSellers", "ladies"]);
});
