import assert from "node:assert/strict";
import test from "node:test";
import { createProductStore } from "./productStoreCore.js";

test("cache hit within TTL makes no request", async () => {
  let calls = 0;
  const store = createProductStore(async () => [{ id: ++calls }]);
  await store.getProducts();
  assert.equal((await store.getProducts())[0].id, 1);
  assert.equal(calls, 1);
});

test("concurrent callers share one request", async () => {
  let calls = 0;
  const store = createProductStore(async () => { calls += 1; await Promise.resolve(); return [{ id: 1 }]; });
  const [left, right] = await Promise.all([store.getProducts(), store.getProducts()]);
  assert.equal(calls, 1);
  assert.equal(left, right);
});

test("invalidate forces a refetch", async () => {
  let calls = 0;
  const store = createProductStore(async () => [{ id: ++calls }]);
  await store.getProducts();
  store.invalidate();
  assert.equal((await store.getProducts())[0].id, 2);
});

test("failed refresh keeps serving cached data", async () => {
  let time = 0;
  let fail = false;
  const store = createProductStore(async () => {
    if (fail) throw new Error("offline");
    return [{ id: 1 }];
  }, () => time);
  await store.getProducts();
  time = 3 * 60 * 1000;
  fail = true;
  assert.deepEqual(await store.getProducts(), [{ id: 1 }]);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(store.peek(), [{ id: 1 }]);
});
