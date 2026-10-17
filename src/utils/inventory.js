export const getStockQuantity = (product) => {
  const quantity = Number(product?.stockQuantity);
  return Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
};

export const isProductAvailable = (product) => getStockQuantity(product) > 0;

export const getStockLabel = (product) => (
  isProductAvailable(product) ? "In Stock" : "Out of Stock"
);
