import assert from "node:assert/strict";
import test from "node:test";
import { aggregateTodayPosSales, nairobiDayBounds } from "./todayPosSales.js";

test("only counts confirmed POS orders, deduplicated, and supports string/partial payments", () => {
  const summary = aggregateTodayPosSales([
    { id: "pos", orderMethod: "pos", paymentStatus: "confirmed", paymentMethod: "cash", total: "1,200" },
    { id: "pos", orderMethod: "pos", paymentStatus: "confirmed", paymentMethod: "cash", total: 1200 },
    { id: "web", orderMethod: "online", paymentStatus: "confirmed", paymentMethod: "card", total: 900 },
    { id: "cancel", orderMethod: "pos", status: "cancelled", paymentStatus: "confirmed", paymentMethod: "cash", total: 900 },
    { id: "partial", orderMethod: "pos", paymentStatus: "confirmed", paymentMethod: "mpesa", total: 500, amountPaid: "200" },
  ]);
  assert.equal(summary.revenue, 1400);
  assert.equal(summary.transactions, 2);
  assert.equal(summary.averageSale, 700);
  assert.deepEqual(summary.paymentBreakdown, { cash: 1200, mpesa: 200 });
});

test("uses Nairobi midnight boundaries across UTC dates", () => {
  const { start, end } = nairobiDayBounds(new Date("2026-10-24T21:00:00Z"));
  assert.equal(start.toISOString(), "2026-10-24T21:00:00.000Z");
  assert.equal(end.toISOString(), "2026-10-25T21:00:00.000Z");
  assert.ok(new Date("2026-10-24T20:59:59.999Z") < start);
  assert.ok(new Date("2026-10-25T21:00:00.000Z") >= end);
});

test("reports POS records with missing or malformed payment data", () => {
  const result = aggregateTodayPosSales([
    { id: "missing", orderMethod: "pos", paymentStatus: "confirmed", total: "10" },
    { id: "bad", orderMethod: "pos", paymentStatus: "confirmed", paymentMethod: "cash", total: "oops" },
  ]);
  assert.deepEqual(result.unclassified, ["missing", "bad"]);
  assert.equal(result.revenue, 0);
});
