export const isWalkInName = (value) => (
  /^(?:walk[-\s]?in|walk[-\s]?in\s+customer)$/i.test(String(value || '').trim())
);

export const getReceiptGreeting = (customerName) => {
  if (isWalkInName(customerName)) return 'Hello,';
  const firstName = String(customerName || '').trim().split(/\s+/)[0];
  return firstName ? `Hello ${firstName},` : 'Hello,';
};
