export const DESCRIPTION_WORD_LIMIT = 50;

export const countDescriptionWords = (value) => (
  String(value || "").trim() ? String(value).trim().split(/\s+/).length : 0
);

export const trimDescriptionToLimit = (value) => (
  String(value || "").trim().split(/\s+/).slice(0, DESCRIPTION_WORD_LIMIT).join(" ")
);
