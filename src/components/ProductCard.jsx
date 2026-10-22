import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion, useReducedMotion } from "motion/react";
import categoryIcon from "../assets/category-icon.png";
import shareIcon from "../assets/share-icon.png";
import { STOREFRONT_SCROLL_KEY } from "../hooks/useStorefrontScrollRestoration";
import { getStockQuantity, isProductAvailable } from "../utils/inventory";
import { recordClick } from "../utils/personalizationStore.js";

const capitalizeWords = (value) => {
  if (!value) return "";
  return value
    .toString()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const getProductImage = (product) => {
  const imageUrl =
    product.image ||
    product.image_url ||
    product.img ||
    product.thumbnail ||
    product.photo;

  if (imageUrl && typeof imageUrl === "string" && imageUrl.trim() !== "") {
    return imageUrl.startsWith("/")
      ? `https://pos.loriskenya.com${imageUrl}`
      : imageUrl;
  }

  return "https://placehold.co/300x300?text=No+Image";
};

const ProductCard = ({ product, formatPrice, onAddToCart, onShare }) => {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [quantity, setQuantity] = useState(1);
  const isAvailable = isProductAvailable(product);
  const maxQuantity = getStockQuantity(product);
  const productUrl = `/product/?category=${encodeURIComponent(
    product.category || "Uncategorized"
  )}&pid=${product.id}`;

  const openDetails = () => {
    recordClick(product);
    sessionStorage.setItem(
      STOREFRONT_SCROLL_KEY,
      JSON.stringify({
        path: `${window.location.pathname}${window.location.search}`,
        scrollY: window.scrollY,
      })
    );
    navigate(productUrl);
  };

  const handleCardKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails();
    }
  };

  const stopCardNavigation = (event) => event.stopPropagation();

  const updateQuantity = (nextQuantity) => {
    if (nextQuantity >= 1 && nextQuantity <= maxQuantity) {
      setQuantity(nextQuantity);
    }
  };

  const handleAddToCart = () => {
    if (isAvailable) {
      onAddToCart(product, quantity);
    }
  };

  return (
    <article
      className="grid-item product-card"
      onClick={openDetails}
      onKeyDown={handleCardKeyDown}
      tabIndex={0}
      role="link"
      aria-label={`View details for ${capitalizeWords(product.name)}`}
    >
      {product.isBestSeller && (
        <div className="bestseller-badge" title="Best Seller">
          <span className="star">★</span>
          <span className="bestseller-text">Best Seller</span>
        </div>
      )}

      <div className="product-card-image-wrap">
        <Motion.img
          src={getProductImage(product)}
          alt={product.name || "Product Image"}
          className="grid-image"
          loading="lazy"
          initial={
            prefersReducedMotion ? false : { opacity: 0, y: 8 }
          }
          whileInView={
            prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
          }
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          onError={(event) => {
            event.currentTarget.onerror = null;
            event.currentTarget.src =
              "https://placehold.co/300x300?text=No+Image";
          }}
        />
        {!isAvailable && (
          <div className="out-of-stock-overlay">
            <span>Out of Stock</span>
          </div>
        )}
      </div>

      <div className="product-card-content">
        <div className="product-card-price-row">
          <p className="grid-item-price">{formatPrice(product.price)}</p>
          {product.discount && (
            <span className="product-discount-badge">{product.discount}% off</span>
          )}
        </div>
        <h3 className="grid-name" title={product.name || ""}>{capitalizeWords(product.name)}</h3>
        <p className="category-name">
          <img src={categoryIcon} alt="" aria-hidden="true" />
          {product.category || "Uncategorized"}
        </p>

        {product.quantities && product.quantities.length > 0 && (
          <div className="grid-item-quantities">
            {product.quantities.map((itemQuantity, index) => (
              <span key={index} className="quantity-chip">
                {itemQuantity}
              </span>
            ))}
          </div>
        )}

        <div
          className="product-card-controls"
          onClick={stopCardNavigation}
          onKeyDown={stopCardNavigation}
        >
          <div className="product-card-control-row">
            <div className="card-quantity-controls" aria-label="Select quantity">
              <button
                type="button"
                onClick={() => updateQuantity(quantity - 1)}
                disabled={!isAvailable || quantity <= 1}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span aria-live="polite">{quantity}</span>
              <button
                type="button"
                onClick={() => updateQuantity(quantity + 1)}
                disabled={!isAvailable || quantity >= maxQuantity}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="card-share-button"
              onClick={() => onShare(product)}
              aria-label={`Share ${capitalizeWords(product.name)}`}
              title="Share product"
            >
              <img src={shareIcon} alt="" aria-hidden="true" />
            </button>
          </div>
          <Motion.button
            type="button"
            className="card-add-to-cart"
            onClick={handleAddToCart}
            disabled={!isAvailable}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.015 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            {isAvailable ? "Add to Cart" : "Out of Stock"}
          </Motion.button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
