import "../styles/grid.css";
import React, { useState, useEffect } from "react";
import categoryIcon from "../assets/category-icon.png";
import shareIcon from "../assets/share-icon.png";
import addToCartIcon from "../assets/bag-icon.png";
import seeMoreIcon from "../assets/see-more.png";
import { useCart } from "../context/CartContext.jsx";
import { db } from "../../firebase/firebaseConfig.js";
import { collection, getDocs, query, where } from "firebase/firestore";

const MenPerfumes = () => {
  // State for products
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(8);
  const [visibleProducts, setVisibleProducts] = useState([]);
  const [isAllLoaded, setIsAllLoaded] = useState(false);

  // Modal state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);

  // Notification state
  const [notification, setNotification] = useState({
    visible: false,
    message: "",
    product: null,
  });

  const { addToCart } = useCart();

  // Fetch men's products from Firestore
  useEffect(() => {
    const fetchMenProducts = async () => {
      try {
        setLoading(true);

        // Create a query against the "products" collection where gender is "men"
        const productsRef = collection(db, "products");
        const menQuery = query(productsRef, where("gender", "==", "men"));

        const querySnapshot = await getDocs(menQuery);

        // Process and set products
        const menProducts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setProducts(menProducts);
        setVisibleProducts(menProducts.slice(0, visibleCount));
        setIsAllLoaded(visibleCount >= menProducts.length);

        console.log("Total Men's Products:", menProducts.length);
        console.log(
          "Visible Men's Products Count:",
          Math.min(visibleCount, menProducts.length)
        );
      } catch (error) {
        console.error("Error fetching men's products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMenProducts();
  }, []);

  // Update visible products when visibleCount changes
  useEffect(() => {
    const slicedProducts = products.slice(0, visibleCount);
    setVisibleProducts(slicedProducts);
    setIsAllLoaded(visibleCount >= products.length);
  }, [visibleCount, products]);

  const handleViewMore = () => {
    setVisibleCount((prev) => prev + 12);
  };

  function capitalizeWords(str) {
    if (!str) return "";
    return str
      .toString()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  // Function to show notification
  const showNotification = (product, qty = 1) => {
    setNotification({
      visible: true,
      message: `Added ${qty} ${qty > 1 ? "items" : "item"} to cart`,
      product: product,
    });

    // Hide notification after 3 seconds
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Function to open modal with product details
  const openProductModal = (product) => {
    setSelectedProduct(product);
    setQuantity(1); // Reset quantity when opening a new product
    setIsModalOpen(true);
    // Prevent scrolling on body when modal is open
    document.body.style.overflow = "hidden";
  };

  // Function to close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    // Re-enable scrolling
    document.body.style.overflow = "auto";
  };

  // Handle quantity change
  const updateQuantity = (newQty) => {
    if (newQty >= 1) {
      setQuantity(newQty);
    }
  };

  // Add to cart function
  const handleAddToCart = () => {
    if (selectedProduct && selectedProduct.inStock !== false) {
      // Add the selected product with quantity
      addToCart(selectedProduct, quantity);

      // Show notification
      showNotification(selectedProduct, quantity);

      // Close the modal
      closeModal();
    }
  };

  // Quick add to cart function
  const quickAddToCart = (product, qty = 1) => {
    addToCart(product, qty);
    showNotification(product, qty);
  };

  // Share product function
  const handleShare = async (product) => {
    // Construct a shareable URL with the new format
    const productUrl = `${
      window.location.origin
    }/product/?category=${encodeURIComponent(
      product.category || "Uncategorized"
    )}&pid=${product.id}`;

    // Product details for sharing
    const title = capitalizeWords(product.name);
    const text =
      product.description ||
      `Check out this ${product.category || ""} perfume from Loris Kenya!`;

    // Check if the Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: title,
          text: text,
          url: productUrl,
        });

        // Show a success notification
        setNotification({
          visible: true,
          message: "Product shared successfully!",
          product: product,
        });

        setTimeout(() => {
          setNotification((prev) => ({ ...prev, visible: false }));
        }, 3000);
      } catch (error) {
        // User cancelled or share failed
        console.error("Share failed:", error);
      }
    } else {
      // Fallback for browsers that don't support the Web Share API
      // Copy the product URL to clipboard
      try {
        await navigator.clipboard.writeText(productUrl);

        setNotification({
          visible: true,
          message: "Link copied to clipboard!",
          product: product,
        });

        setTimeout(() => {
          setNotification((prev) => ({ ...prev, visible: false }));
        }, 3000);
      } catch (error) {
        console.error("Clipboard copy failed:", error);

        // Ultimate fallback: show the link in an alert
        alert(`Share this link: ${productUrl}`);
      }
    }
  };

  // Format price as currency
  const formatPrice = (price) => {
    if (price === undefined || price === null) return "KSh 0";
    return `KSh ${Number(price).toLocaleString()}`;
  };

  // Default image for products without images
  const defaultImage = "https://placehold.co/300x300?text=No+Image";

  // Get product image with multiple possible field names
  const getProductImage = (product) => {
    // Try different possible image field names
    const imageUrl =
      product.image ||
      product.image_url ||
      product.img ||
      product.thumbnail ||
      product.photo;

    // Check if URL is valid
    if (imageUrl && typeof imageUrl === "string" && imageUrl.trim() !== "") {
      // If it's a relative path, convert to absolute URL
      if (imageUrl.startsWith("/")) {
        return `https://pos.loriskenya.com${imageUrl}`;
      }
      // If it's already a full URL, use it
      return imageUrl;
    }

    return defaultImage;
  };

  if (loading) {
    return (
      <section className="paginated-grid-section">
        <div className="skeleton-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="skeleton-card" key={i}>
              <div className="skeleton-image" />
              <div className="skeleton-text short" />
              <div className="skeleton-text long" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="paginated-grid-section" id="men">
      {/* Add notification component at the top */}
      {notification.visible && (
        <div className="cart-notification">
          <div className="notification-content">
            <div className="notification-icon">✓</div>
            <div className="notification-message">
              <strong>{notification.message}</strong>
              {notification.product && (
                <span className="product-name">
                  {notification.product.name}
                </span>
              )}
            </div>
            <button
              className="notification-close"
              onClick={() =>
                setNotification((prev) => ({ ...prev, visible: false }))
              }
            >
              ×
            </button>
          </div>
        </div>
      )}
      <p className="generic-text">Confident, Crisp, Bold!</p>
      <h2 className="title-mini-grid">Men Best Sellers</h2>

      {visibleProducts.length === 0 ? (
        <p className="no-products-message">
          No men's perfumes available at the moment.
        </p>
      ) : (
        <div className="grid-container">
          {visibleProducts.map((product) => (
            <div className="grid-item" key={product.id}>
              {/* Add out of stock overlay */}
              {product.inStock === false && (
                <div className="out-of-stock-overlay">
                  <span>Out of Stock</span>
                </div>
              )}
              <div className="cart-options">
                <div title="Share" onClick={() => handleShare(product)}>
                  <img className="share--icon" src={shareIcon} alt="Share" />
                </div>
                <div
                  title="Add to Cart"
                  onClick={() => quickAddToCart(product, 1)}
                >
                  <img
                    className="cart--icon"
                    src={addToCartIcon}
                    alt="Add to cart"
                  />
                </div>
                <div
                  title="View Details"
                  onClick={() => openProductModal(product)}
                  style={{ cursor: "pointer" }}
                >
                  <img
                    className="more--icon"
                    src={seeMoreIcon}
                    alt="View details"
                  />
                </div>
              </div>
              <img
                src={getProductImage(product)}
                alt={product.name || "Product Image"}
                className="grid-image"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = defaultImage;
                }}
              />
              <p className="grid-name">{capitalizeWords(product.name)}</p>
              <p className="category-name">
                <img src={categoryIcon} alt="Category" />
                {product.category || "Uncategorized"}
              </p>

              {/* Add quantities display */}
              {product.quantities && product.quantities.length > 0 && (
                <div className="grid-item-quantities">
                  {product.quantities.map((qty, index) => (
                    <span key={index} className="quantity-chip">
                      {qty}
                    </span>
                  ))}
                </div>
              )}

              <p className="grid-item-price">{formatPrice(product.price)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Product Detail Modal */}
      {isModalOpen && selectedProduct && (
        <div className="product-modal-overlay" onClick={closeModal}>
          <div
            className="product-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close-btn" onClick={closeModal}>
              ×
            </button>

            <div className="product-modal-container">
              {/* Left Section - Product Image */}
              <div className="product-modal-image">
                <img
                  src={getProductImage(selectedProduct)}
                  alt={selectedProduct.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = defaultImage;
                  }}
                />
              </div>

              {/* Right Section - Product Details */}
              <div className="product-modal-details">
                <h2 className="product-modal-name">
                  {capitalizeWords(selectedProduct.name)}
                </h2>

                <p className="product-modal-category">
                  <span className="category-label">Category: </span>
                  {selectedProduct.category || "Uncategorized"}
                </p>

                {/* Add quantities display in modal */}
                {selectedProduct.quantities &&
                  selectedProduct.quantities.length > 0 && (
                    <div className="product-modal-quantities">
                      <h4>Available Sizes:</h4>
                      <div className="quantities-list">
                        {selectedProduct.quantities.map((qty, index) => (
                          <span key={index} className="quantity-badge">
                            {qty}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Share button */}
                <button
                  className="product-share-btn"
                  onClick={() => handleShare(selectedProduct)}
                >
                  <img src={shareIcon} alt="Share" />
                  Share
                </button>

                <div className="product-modal-description">
                  <p>
                    {selectedProduct.description ||
                      "No description available for this product."}
                  </p>
                </div>

                <div className="product-modal-quantity">
                  <span>Quantity:</span>
                  <div className="quantity-controls">
                    <button
                      onClick={() => updateQuantity(quantity - 1)}
                      disabled={quantity <= 1}
                    >
                      -
                    </button>
                    <span>{quantity}</span>
                    <button onClick={() => updateQuantity(quantity + 1)}>
                      +
                    </button>
                  </div>
                </div>

                <div className="product-modal-purchase">
                  <div className="product-modal-price">
                    {formatPrice(selectedProduct.price)}
                  </div>
                  <button className="add-to-cart-btn" onClick={handleAddToCart}>
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!isAllLoaded && visibleProducts.length > 0 && (
        <button className="view-collection-button" onClick={handleViewMore}>
          View Collection
        </button>
      )}
    </section>
  );
};

export default MenPerfumes;
