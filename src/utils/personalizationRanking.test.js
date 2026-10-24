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

test("cold start partitions in-stock first and preserves relative order", () => {
  const products = [
    product("out-a", [1, 0], { stockQuantity: 0 }),
    product("in-a", [0, 1]),
    product("out-b", [1, 1], { inStock: false, stockQuantity: 4 }),
    product("in-b", [-1, 0]),
  ];
  assert.deepEqual(rankProducts(products, { products: {} }).map(({ id }) => id), ["in-a", "in-b", "out-a", "out-b"]);
});

test("ranks products by the weighted taste vector", () => {
  const products = [product("a", [1, 0]), product("b", [0, 1])];
  const snapshot = { products: { taste: { c: 0, a: 1, t: 1, v: [1, 0], vv: 1 } } };
  assert.equal(rankProducts(products, snapshot)[0].id, "a");
});

test("small availability bonus permits a clearly higher semantic score to lead", () => {
  const products = [
    product("exact-match-out", [1, 0], { inStock: false, stockQuantity: 0 }),
    product("weak-match-in", [0.7, Math.sqrt(1 - 0.7 ** 2)]),
  ];
  const snapshot = { products: { taste: { c: 0, a: 1, t: 1, v: [1, 0], vv: 1 } } };
  assert.equal(rankProducts(products, snapshot)[0].id, "exact-match-out");
});

test("equal semantic scores prioritize stock and malformed stock is safe", () => {
  const products = [
    product("out", [1, 0], { stockQuantity: "bad" }),
    product("in", [1, 0]),
    product("missing", [1, 0], { stockQuantity: undefined, inStock: undefined }),
  ];
  const snapshot = { products: { taste: { c: 0, a: 1, t: 1, v: [1, 0], vv: 1 } } };
  assert.deepEqual(rankProducts(products, snapshot).map(({ id }) => id), ["in", "out", "missing"]);
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
