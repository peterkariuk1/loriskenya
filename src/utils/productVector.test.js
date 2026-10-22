import assert from "node:assert/strict";
import test from "node:test";
import { buildProductVector, VECTOR_LABELS } from "./productVector.js";

const vectorFor = (product) => buildProductVector(product);

test("always returns a fixed-length vector", () => {
  assert.equal(vectorFor({}).length, VECTOR_LABELS.length);
  assert.equal(vectorFor(null).length, VECTOR_LABELS.length);
  assert.equal(vectorFor({ quantities: "bad", price: {} }).length, VECTOR_LABELS.length);
});

test("is deterministic and contains no NaN", () => {
  const product = { name: "Oud Vanilla", description: null, category: "Cologne", gender: "men", price: "2500", quantities: ["50ml"] };
  const vector = vectorFor(product);
  assert.deepEqual(vector, vectorFor(product));
  assert.equal(vector.some(Number.isNaN), false);
});

test("unisex has non-zero similarity with both gender vectors", () => {
  const unisex = vectorFor({ gender: "unisex" });
  const men = vectorFor({ gender: "men" });
  const women = vectorFor({ gender: "women" });
  const dot = (left, right) => left.reduce((sum, value, index) => sum + value * right[index], 0);
  assert.ok(dot(unisex, men) > 0);
  assert.ok(dot(unisex, women) > 0);
});

test("unknown category and size produce zero blocks", () => {
  const vector = vectorFor({ category: "Unknown", quantities: ["77oz"] });
  const categoryStart = 23;
  const sizeStart = VECTOR_LABELS.length - 10;
  assert.equal(vector.slice(categoryStart, categoryStart + 14).every((value) => value === 0), true);
  assert.equal(vector.slice(sizeStart).every((value) => value === 0), true);
});

test("scent matching uses whole words", () => {
  const floral = vectorFor({ name: "floral" });
  const florally = vectorFor({ name: "florally" });
  assert.ok(floral[4] > 0);
  assert.equal(florally[4], 0);
});

test("identical products produce identical vectors and values are rounded", () => {
  const product = { name: "Coconut Oud", category: "Niche Perfumes", gender: "women", price: 1234, quantities: ["100 ML"] };
  const vector = vectorFor(product);
  assert.deepEqual(vector, vectorFor({ ...product }));
  assert.equal(vector.every((value) => Number.isInteger(value * 10000)), true);
});
