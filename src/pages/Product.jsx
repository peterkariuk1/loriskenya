import { useState, useEffect, useLayoutEffect } from "react";
import { useParams, useSearchParams, Link, useNavigate, useLocation, useNavigationType } from "react-router-dom";
import { db } from "../../firebase/firebaseConfig.js";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "../context/CartContext.jsx";
import "../styles/product.css";
import logoImage from "../assets/lorislogo.png";
import shareIcon from "../assets/share-icon.png";
import categoryIcon from "../assets/category-icon.png";
import { getStockQuantity, isProductAvailable } from "../utils/inventory";
import { getCachedProduct, updateCachedProduct } from "../data/productStore.js";

const Product = () => {
  // Use both route params (for backward compatibility) and search params
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("pid") || routeId; // Use query param or fallback to route param
  const categoryFromUrl = searchParams.get("category");

  const navigate = useNavigate();
  const location = useLocation();
  const navigationType = useNavigationType();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(() => productId ? getCachedProduct(productId) : null);
  const [loading, setLoading] = useState(() => !productId || !getCachedProduct(productId));
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [notification, setNotification] = useState({
    visible: false,
    message: '',
  });
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useLayoutEffect(() => {
    if (navigationType === "PUSH") window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.key, navigationType]);

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        setError("No product ID provided");
        setLoading(false);
        return;
      }

      const cachedProduct = getCachedProduct(productId);
      if (cachedProduct) {
        setProduct(cachedProduct);
        setError(null);
        setLoading(false);
      } else {
        setProduct(null);
        setError(null);
        setLoading(true);
      }
      try {
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const freshProduct = { id: productSnap.id, ...productSnap.data() };
          setProduct(freshProduct);
          updateCachedProduct(freshProduct);
        } else {
          setError("Product not found");
        }
      } catch (err) {
        console.error("Error fetching product:", err);
        if (!cachedProduct) setError("Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Update quantity
  const updateQuantity = (newQty) => {
    if (newQty >= 1 && newQty <= getStockQuantity(product)) {
      setQuantity(newQty);
    }
  };

  // Add to cart
  const handleAddToCart = () => {
    if (product && isProductAvailable(product)) {
      const added = addToCart(product, quantity);
      if (!added) {
        setNotification({ visible: true, message: "This product is out of stock." });
        return;
      }

      setNotification({
        visible: true,
        message: `Added ${quantity} ${quantity > 1 ? 'items' : 'item'} to cart`,
      });

      setTimeout(() => {
        setNotification(prev => ({ ...prev, visible: false }));
      }, 3000);
    }
  };

  // Share product
  const handleShare = async () => {
    if (!product) return;

    const productUrl = `${window.location.origin}/product/${product.id}`;
    const title = capitalizeWords(product.name);
    const text = product.description ||
      `Check out this ${product.category || ''} perfume from Loris Kenya!`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
          url: productUrl,
        });
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(productUrl);

        setNotification({
          visible: true,
          message: 'Link copied to clipboard!',
        });

        setTimeout(() => {
          setNotification(prev => ({ ...prev, visible: false }));
        }, 3000);
      } catch (error) {
        console.error('Clipboard copy failed:', error);
        alert(`Share this link: ${productUrl}`);
      }
    }
  };

  // Helper functions
  function capitalizeWords(str) {
    if (!str) return '';
    return str
      .toString()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  const formatPrice = (price) => {
    if (price === undefined || price === null) return 'KSh 0';
    return `KSh ${Number(price).toLocaleString()}`;
  };

  const getProductImage = (product) => {
    if (!product) return "https://placehold.co/300x300?text=No+Image";

    const imageUrl =
      product.image ||
      product.image_url ||
      product.img ||
      product.thumbnail ||
      product.photo;

    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
      if (imageUrl.startsWith('/')) {
        return `https://pos.loriskenya.com${imageUrl}`;
      }
      return imageUrl;
    }

    return "https://placehold.co/300x300?text=No+Image";
  };

  // Update the Back button to use the category if available
  const handleBackNavigation = () => {
    if (location.state?.fromStorefront && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(categoryFromUrl ? `/all-products?category=${encodeURIComponent(categoryFromUrl)}` : "/all-products");
  };

  if (loading) {
    return (
      <div className="product-page loading">
        <div className="product-page-header">
          <Link to="/">
            <img src={logoImage} alt="Loris Perfume" className="logo" />
          </Link>
        </div>
        <div className="loading-container">
          <p>Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="product-page error">
        <div className="product-page-header">
          <Link to="/">
            <img src={logoImage} alt="Loris Perfume" className="logo" />
          </Link>
        </div>
        <div className="error-container">
          <h2>Oops! {error || "Something went wrong"}</h2>
          <button onClick={() => navigate('/')} className="back-button">
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="product-page">
      {/* Notification */}
      {notification.visible && (
        <div className="cart-notification">
          <div className="notification-content">
            <div className="notification-icon">✓</div>
            <div className="notification-message">
              <strong>{notification.message}</strong>
            </div>
            <button
              className="notification-close"
              onClick={() => setNotification(prev => ({ ...prev, visible: false }))}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Product Page Header */}
      <div className="product-page-header">
        <Link to="/">
          <img src={logoImage} alt="Loris Perfume" className="logo" />
        </Link>
      </div>

      {/* Back to Products */}
      <div className="back-to-products">
        <button onClick={handleBackNavigation} className="back-link">
          {"<"} Back to {categoryFromUrl ? `${categoryFromUrl} Products` : 'Products'}
        </button>
      </div>

      <div className="product-page-container">
        {/* Left: Product Image */}
        <div className="product-page-image">
          <img
            src={getProductImage(product)}
            alt={product.name}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://placehold.co/300x300?text=No+Image";
            }}
          />
        </div>

        {/* Right: Product Details */}
        <div className="product-page-details">
          <h1 className="product-page-name">{capitalizeWords(product.name)}</h1>

          <div className="product-page-category">
            <img src={categoryIcon} alt="Category" />
            <span>{product.category || 'Uncategorized'}</span>
            {product["sub-category"] && <span> - {product["sub-category"]}</span>}
          </div>

          <div className="product-page-price">
            {formatPrice(product.price)}
          </div>
          <p className={`product-stock-status ${isProductAvailable(product) ? "in-stock" : "out-of-stock"}`}>
            {isProductAvailable(product) ? `${getStockQuantity(product)} available` : "Out of Stock"}
          </p>

          {product.description && (
            <div className="product-page-description">
              <h3>Description</h3>
              <p className={isDescriptionExpanded ? "expanded" : ""}>
                {product.description}
              </p>
              {product.description.length > 220 && (
                <button
                  type="button"
                  className="description-toggle"
                  onClick={() => setIsDescriptionExpanded((expanded) => !expanded)}
                >
                  {isDescriptionExpanded ? "Read Less" : "Read More"}
                </button>
              )}
            </div>
          )}

          <div className="product-page-actions">
            <div className="product-page-quantity">
              <span>Quantity:</span>
              <div className="quantity-controls">
                <button onClick={() => updateQuantity(quantity - 1)} disabled={quantity <= 1}>-</button>
                <span>{quantity}</span>
                <button onClick={() => updateQuantity(quantity + 1)} disabled={quantity >= getStockQuantity(product)}>+</button>
              </div>
            </div>

            <button className="add-to-cart-btn" onClick={handleAddToCart} disabled={!isProductAvailable(product)}>
              {isProductAvailable(product) ? "Add to Cart" : "Out of Stock"}
            </button>

            <button className="product-share-btn" onClick={handleShare}>
              <img src={shareIcon} alt="Share" />
              Share
            </button>
          </div>

          {product.sku_leave_blank_to_auto_generate_sku && (
            <div className="product-page-sku">
              SKU: {product.sku_leave_blank_to_auto_generate_sku}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Product;
