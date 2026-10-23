import { isValidLocalKenyanPhone, normalizeKenyanPhone } from "./phone.js";

export const validateCustomerPhoneInput = (value, { requireComplete = false } = {}) => {
  const nextValue = String(value || "");
  if (!/^\d*$/.test(nextValue) || nextValue.length > 10) {
    return { valid: false, message: "Use only digits, up to 10 characters, starting with 07 or 01." };
  }
  if (nextValue && nextValue[0] !== "0") {
    return { valid: false, message: "Kenyan numbers must start with 07 or 01." };
  }
  if (nextValue.length > 1 && !["1", "7"].includes(nextValue[1])) {
    return { valid: false, message: "Kenyan numbers must start with 07 or 01." };
  }
  if ((requireComplete || nextValue.length === 10) && !isValidLocalKenyanPhone(nextValue)) {
    return { valid: false, message: "The number must be 10 digits and start with 07 or 01." };
  }
  return { valid: true, message: null };
};

export const normalizeCustomerPhone = (value) => (
  normalizeKenyanPhone(value, { allowInternational: false })
);
