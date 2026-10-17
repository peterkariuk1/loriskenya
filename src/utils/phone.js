const KENYAN_NUMBER = /^(?:254|0)?([17]\d{8})$/;

export const normalizeKenyanPhone = (value, { allowInternational = true } = {}) => {
  const input = String(value || "").trim();
  const compact = input.replace(/[()\s.-]/g, "");
  if (!/^\+?(?:\d+)$/.test(compact)) return null;

  const digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (!allowInternational && (digits.startsWith("254") || compact.startsWith("+"))) return null;
  const match = digits.match(KENYAN_NUMBER);
  return match ? `0${match[1]}` : null;
};

export const toWhatsAppPhone = (value) => {
  const localNumber = normalizeKenyanPhone(value);
  return localNumber ? `254${localNumber.slice(1)}` : null;
};

export const isValidLocalKenyanPhone = (value) => /^0[17]\d{8}$/.test(String(value || ""));
