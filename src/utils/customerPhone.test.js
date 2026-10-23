import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCustomerPhone, validateCustomerPhoneInput } from "./customerPhone.js";

test("accepts the create-client local formats", () => {
  assert.equal(validateCustomerPhoneInput("0712345678").valid, true);
  assert.equal(validateCustomerPhoneInput("0112345678").valid, true);
  assert.equal(normalizeCustomerPhone("0712345678"), "0712345678");
});

test("rejects the create-client invalid formats", () => {
  assert.equal(validateCustomerPhoneInput("+254712345678").message, "Use only digits, up to 10 characters, starting with 07 or 01.");
  assert.equal(validateCustomerPhoneInput("254712345678").message, "Use only digits, up to 10 characters, starting with 07 or 01.");
  assert.equal(validateCustomerPhoneInput("0612345678").message, "Kenyan numbers must start with 07 or 01.");
  assert.equal(validateCustomerPhoneInput("071234567", { requireComplete: true }).message, "The number must be 10 digits and start with 07 or 01.");
});
