import "../styles/grid.css";
import React, { useState, useEffect } from "react";
import shareIcon from "../assets/share-icon.png";
import ProductCard from "./ProductCard";
import EditorialHeading from "./EditorialHeading";
import { useCart } from "../context/CartContext.jsx";
import { getCachedProducts, getProducts } from "../data/productStore.js";
import { rankProducts } from "../utils/personalizationRanking.js";
import { recordAddToCart } from "../utils/personalizationStore.js";
import { useLocation, useNavigationType } from "react-router-dom";
import { getStorefrontGridState, useStorefrontGridState } from "../hooks/useStorefrontScrollRestoration.js";

const BestSellerGrid = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const savedGridState = getStorefrontGridState(location.key, "home-best-sellers");
  // State for products
  const [products, setProducts] = useState(() => rankProducts(getCachedProducts().filter((product) => product.isBestSeller === true)));
  const [loading, setLoading] = useState(() => getCachedProducts().length === 0);
  const [visibleCount, setVisibleCount] = useState(savedGridState.visibleCount || 8);
  const [visibleProducts, setVisibleProducts] = useState(() => rankProducts(getCachedProducts().filter((product) => product.isBestSeller === true)).slice(0, savedGridState.visibleCount || 8));
  const [isAllLoaded, setIsAllLoaded] = useState(false);
  useStorefrontGridState(location.key, "home-best-sellers", { visibleCount });
  useEffect(() => {
    const saved = getStorefrontGridState(location.key, "home-best-sellers").visibleCount;
    if (navigationType === "POP" && saved) setVisibleCount(saved);
  }, [location.key, navigationType]);

  // Modal state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  // Notification state
  const [notification, setNotification] = useState({
    visible: false,
    message: '',
    product: null
  });
  
  const { addToCart } = useCart();

  // Fetch best seller products from Firestore
  useEffect(() => {
    const fetchBestSellerProducts = async () => {
      try {
        if (getCachedProducts().length === 0) setLoading(true);
        
        // Create a query against the "products" collection where isBestSeller is true
        const allProducts = await getProducts();
        const bestSellerProducts = allProducts.filter((product) => product.isBestSeller === true);
        
        const rankedProducts = rankProducts(bestSellerProducts);
        setProducts(rankedProducts);
        setVisibleProducts(rankedProducts.slice(0, visibleCount));
        setIsAllLoaded(visibleCount >= bestSellerProducts.length);
        
        
      } catch (error) {
        console.error("Error fetching best seller products:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchBestSellerProducts();
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
      message: `Added ${qty} ${qty > 1 ? 'items' : 'item'} to cart`,
      product: product
    });

    // Hide notification after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  // Function to close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
    // Re-enable scrolling
    document.body.style.overflow = 'auto';
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
    recordAddToCart(product);
    addToCart(product, qty);
    showNotification(product, qty);
  };

  // Share product function
  const handleShare = async (product) => {
    // Construct a shareable URL with the new format
    const productUrl = `${window.location.origin}/product/?category=${encodeURIComponent(product.category || "Uncategorized")}&pid=${product.id}`;
    
    // Product details for sharing
    const title = capitalizeWords(product.name);
    const text = product.description || 
      `Check out this ${product.category || ''} perfume from Loris Kenya!`;
    
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
          message: 'Product shared successfully!',
          product: product
        });
        
        setTimeout(() => {
          setNotification(prev => ({ ...prev, visible: false }));
        }, 3000);
        
      } catch (error) {
        // User cancelled or share failed
        console.error('Share failed:', error);
      }
    } else {
      // Fallback for browsers that don't support the Web Share API
      // Copy the product URL to clipboard
      try {
        await navigator.clipboard.writeText(productUrl);
        
        setNotification({
          visible: true,
          message: 'Link copied to clipboard!',
          product: product
        });
        
        setTimeout(() => {
          setNotification(prev => ({ ...prev, visible: false }));
        }, 3000);
        
      } catch (error) {
        console.error('Clipboard copy failed:', error);
        
        // Ultimate fallback: show the link in an alert
        alert(`Share this link: ${productUrl}`);
      }
    }
  };

  // Format price as currency
  const formatPrice = (price) => {
    if (price === undefined || price === null) return 'KSh 0';
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
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
      // If it's a relative path, convert to absolute URL
      if (imageUrl.startsWith('/')) {
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
    <section className="paginated-grid-section">
      {/* Add notification component at the top */}
      {notification.visible && (
        <div className="cart-notification">
          <div className="notification-content">
            <div className="notification-icon">✓</div>
            <div className="notification-message">
              <strong>{notification.message}</strong>
              {notification.product && (
                <span className="product-name">{notification.product.name}</span>
              )}
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
      <EditorialHeading as="p" className="generic-text">
        Discover our most popular picks!
      </EditorialHeading>
      <h2 className="title-mini-grid">Best Sellers</h2>
      
      {visibleProducts.length === 0 ? (
        <p className="no-products-message">No best seller products available at the moment.</p>
      ) : (
        <div className="grid-container">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              formatPrice={formatPrice}
              onAddToCart={quickAddToCart}
              onShare={handleShare}
            />
          ))}
        </div>
      )}
      
      {/* Product Detail Modal */}
      {isModalOpen && selectedProduct && (
        <div className="product-modal-overlay" onClick={closeModal}>
          <div className="product-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeModal}>×</button>

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
                <h2 className="product-modal-name">{capitalizeWords(selectedProduct.name)}</h2>
                
                <p className="product-modal-category">
                  <span className="category-label">Category: </span>
                  {selectedProduct.category || 'Uncategorized'}
                </p>
                
                {/* Add quantities display in modal */}
                {selectedProduct.quantities && selectedProduct.quantities.length > 0 && (
                  <div className="product-modal-quantities">
                    <h4>Available Sizes:</h4>
                    <div className="quantities-list">
                      {selectedProduct.quantities.map((qty, index) => (
                        <span key={index} className="quantity-badge">{qty}</span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Share button */}
                <button className="product-share-btn" onClick={() => handleShare(selectedProduct)}>
                  <img src={shareIcon} alt="Share" />
                  Share
                </button>
                
                <div className="product-modal-description">
                  <p>{selectedProduct.description || 'No description available for this product.'}</p>
                </div>

                <div className="product-modal-quantity">
                  <span>Quantity:</span>
                  <div className="quantity-controls">
                    <button onClick={() => updateQuantity(quantity - 1)} disabled={quantity <= 1}>-</button>
                    <span>{quantity}</span>
                    <button onClick={() => updateQuantity(quantity + 1)}>+</button>
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

export default BestSellerGrid;
