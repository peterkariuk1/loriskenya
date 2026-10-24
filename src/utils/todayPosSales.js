const EXCLUDED_STATUSES = new Set(["cancelled", "canceled", "void", "voided", "refunded", "refund", "failed"]);
const UNPAID_STATUSES = new Set(["unpaid", "pending", "failed", "declined"]);
const PARTIAL_STATUSES = new Set(["partial", "partially paid", "partially_paid"]);
const PAID_STATUSES = new Set(["confirmed", "paid", "completed", ...PARTIAL_STATUSES]);

export function nairobiDayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  const start = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - 3 * 60 * 60 * 1000;
  return { start: new Date(start), end: new Date(start + 24 * 60 * 60 * 1000) };
}

const amount = (value) => {
  if (typeof value === "string") value = value.replace(/[\s,]/g, "");
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const statusText = (value) => String(value ?? "").trim().toLowerCase();

export function aggregateTodayPosSales(orders = []) {
  const seen = new Set();
  const paymentBreakdown = {};
  const unclassified = [];
  let revenue = 0;
  let transactions = 0;

  for (const order of orders) {
    const id = order?.id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (order.orderMethod !== "pos") continue;
    const status = statusText(order.status);
    const paymentStatus = statusText(order.paymentStatus);
    if (EXCLUDED_STATUSES.has(status) || EXCLUDED_STATUSES.has(paymentStatus)
      || UNPAID_STATUSES.has(status) || UNPAID_STATUSES.has(paymentStatus)) continue;
    if (order.refunded === true || order.voided === true || order.cancelled === true) continue;
    const total = amount(order.total);
    const paidField = order.amountPaid ?? order.paidAmount ?? order.amountReceived;
    const paid = paidField === undefined ? (PARTIAL_STATUSES.has(paymentStatus) ? null : total) : amount(paidField);
    const refundField = order.refundedAmount ?? order.refundAmount ?? 0;
    const refundAmounts = Array.isArray(order.refunds)
      ? order.refunds.map((refund) => amount(refund?.amount ?? refund?.total ?? refund))
      : [amount(refundField)];
    const refunds = refundAmounts.every((value) => value !== null)
      ? refundAmounts.reduce((sum, value) => sum + value, 0)
      : null;
    if (paid === null || refunds === null || !PAID_STATUSES.has(paymentStatus) || !String(order.paymentMethod ?? "").trim()) {
      unclassified.push(id);
      continue;
    }
    const received = Math.max(0, paid - refunds);
    revenue += received;
    transactions += 1;
    const method = statusText(order.paymentMethod) || "unknown";
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + received;
  }

  return { revenue, transactions, averageSale: transactions ? revenue / transactions : 0, paymentBreakdown, unclassified };
}
