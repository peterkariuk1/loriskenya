import "../styles/grid.css";
import { useState, useEffect } from "react";
import categoryIcon from "../assets/category-icon.png";
import shareIcon from "../assets/share-icon.png";
import addToCartIcon from "../assets/bag-icon.png";
import seeMoreIcon from "../assets/see-more.png";
import { db } from "../../firebase/firebaseConfig.js";
import { collection, getDocs, query, limit, orderBy } from "firebase/firestore";
import { useCart } from "../context/CartContext";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FiArrowLeft } from 'react-icons/fi';

const Grid = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const itemsPerPage = 18;

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

  // Add search params from URL
  const [searchParams] = useSearchParams();

  // Add navigate function near other hooks
  const navigate = useNavigate();

  // Get filter values from URL
  const minPrice = searchParams.get("min_price") ? parseInt(searchParams.get("min_price")) : 0;
  const maxPrice = searchParams.get("max_price") ? parseInt(searchParams.get("max_price")) : Infinity;
  const category = searchParams.get("category") || "";
  const sortBy = searchParams.get("sort") || "newest";
  const searchQuery = searchParams.get("search") || "";

  // Add handleBack function
  const handleBack = () => {
    navigate('/');
  };

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

  // Function to open modal with product details
  const openProductModal = (product) => {
    setSelectedProduct(product);
    setQuantity(1); // Reset quantity when opening a new product
    setIsModalOpen(true);
    // Prevent scrolling on body when modal is open
    document.body.style.overflow = 'hidden';
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

  // Fetch products from Firestore
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        console.log("Fetching products from products collection...");

        // Reference to the products collection
        const productsRef = collection(db, "products");
        
        // First check if there are any products at all (for debugging)
        const testSnapshot = await getDocs(productsRef);
        console.log(`Total products in collection: ${testSnapshot.docs.length}`);
        
        if (testSnapshot.docs.length === 0) {
          console.log("Collection is empty - no products found");
          setProducts([]);
          setLoading(false);
          return;
        }
        
        // Check if inStock field exists and is causing filtering issues
        let sampleDoc = testSnapshot.docs[0].data();
        console.log("Sample document fields:", Object.keys(sampleDoc));
        console.log("Sample inStock value:", sampleDoc.inStock);
        
        // Create query - temporarily remove the inStock filter if it's causing issues
        let productsQuery;

        // Choose sort order based on URL parameter
        switch(sortBy) {
          case "price-high-to-low":
            productsQuery = query(
              productsRef, 
              // Only add inStock filter if needed
              // where("inStock", "==", true),
              orderBy("price", "desc"), 
              limit(1000)
            );
            break;
          case "price-low-to-high":
            productsQuery = query(
              productsRef, 
              // where("inStock", "==", true),
              orderBy("price", "asc"), 
              limit(1000)
            );
            break;
          case "newest":
          default:
            productsQuery = query(
              productsRef, 
              // where("inStock", "==", true),
              orderBy("createdAt", "desc"), 
              limit(1000)
            );
            break;
        }

        // Get products
        const querySnapshot = await getDocs(productsQuery);

        // Process products data
        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          // Set default values for critical fields if missing
          price: doc.data().price || 0,
          inStock: doc.data().inStock !== false, // Default to true if not explicitly false
          name: doc.data().name || "Unnamed Product",
          category: doc.data().category || "Uncategorized"
        }));

        console.log(`Fetched ${productsData.length} products from products collection`);
        
        // Log first product for debugging
        if (productsData.length > 0) {
          console.log("Sample product data:", productsData[0]);
        }
        
        setProducts(productsData);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching products:", error);
        setLoading(false);
      }
    }

    fetchProducts();
  }, [sortBy]); // Re-fetch when sort order changes

  // Filter products based on URL parameters
  const filteredProducts = products.filter(product => {
    const productPrice = product.price || 0;
    
    // Price filter
    if (productPrice < minPrice || productPrice > maxPrice) {
      return false;
    }
    
    // Handle both category and gender filtering
    if (category) {
      // Special handling for Men/Women categories which should filter by gender
      if (category === "Men Perfume" || category === "Men") {
        return product.gender === "men";
      }
      
      if (category === "Ladies Perfume" || category === "Women") {
        return product.gender === "women";
      }
      
      // For other categories, filter by category field
      if (product.category) {
        // Try exact match (case insensitive)
        if (product.category.toLowerCase() === category.toLowerCase()) {
          return true;
        }
        
        // Try contains match
        if (product.category.toLowerCase().includes(category.toLowerCase())) {
          return true;
        }
        
        // No match found for category
        return false;
      }
    }
    
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      
      // Search in name
      if (product.name && product.name.toLowerCase().includes(query)) {
        return true;
      }
      
      // Search in category
      if (product.category && product.category.toLowerCase().includes(query)) {
        return true;
      }
      
      // Search in description
      if (product.description && product.description.toLowerCase().includes(query)) {
        return true;
      }
      
      // No match found for search query
      return false;
    }
    
    // Include the product if it passed all filters or no filters are active
    return true;
  });

  // Calculate total pages based on filtered products
  useEffect(() => {
    const total = Math.ceil(filteredProducts.length / itemsPerPage);
    setTotalPages(total);

    // Reset to page 1 when filters change
    setCurrentPage(1);
  }, [filteredProducts.length]);

  // Calculate which products to display based on current page
  const startIndex = (currentPage - 1) * itemsPerPage;
  const visibleProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  // Page navigation
  const goToPage = (pageNum) => {
    if (pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
  
      setTimeout(() => {
        const gridElement = document.getElementById("grid-section");
        if (gridElement) {
          gridElement.scrollIntoView({ behavior: "smooth" });
        }
      }, 100); // small delay after state update to let DOM update
    }
  };

  // Capitalize every word in the item's title
  function capitalizeWords(str) {
    if (!str) return '';
    return str
      .toString()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

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
    const imageUrl = product.image;

    // Check if URL is valid
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim() !== '') {
      return imageUrl;
    }

    return defaultImage;
  };

  return (
    <div id='grid-section' className="paginated-grid-section">
      {/* Add back button at the top */}
      <button onClick={handleBack} className="back-button">
        <FiArrowLeft /> Back to Home
      </button>
      
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

      <h2 className="grid-title">
        {searchQuery ? (
          <>
            Search Results for "{searchQuery}"
            <span>{filteredProducts.length} items found</span>
          </>
        ) : category ? (
          <>
            {category} Products
            <span>{filteredProducts.length} items found</span>
          </>
        ) : filteredProducts.length === products.length ? (
          <>All Products <span>Find your Signature Scent</span></>
        ) : (
          <>Filtered Results <span>({filteredProducts.length} items found)</span></>
        )}
      </h2>

      {loading ? (
        <section className="paginated-grid-section">
        <div className="skeleton-grid">
          {Array.from({ length: 24 }).map((_, i) => (
            <div className="skeleton-card" key={i}>
              <div className="skeleton-image" />
              <div className="skeleton-text short" />
              <div className="skeleton-text long" />
            </div>
          ))}
        </div>
      </section>
      ) : products.length === 0 ? (
        <div className="no-products">
          <p>No products found</p>
        </div>
      ) : (
        <>
          <div className="grid-container">
            {visibleProducts.map((product) => (
              <div className="grid-item" key={product.id}>
                {product.isBestSeller && (
                  <div className="bestseller-badge" title="Best Seller">
                    <span className="star">★</span>
                    <span className="bestseller-text">Best Seller</span>
                  </div>
                )}
                
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
                    title={product.inStock === false ? "Out of Stock" : "Add to Cart"} 
                    onClick={() => product.inStock !== false && quickAddToCart(product, 1)}
                    className={product.inStock === false ? "disabled-cart-option" : ""}
                  >
                    <img className="cart--icon" src={addToCartIcon} alt="Add to cart" />
                  </div>
                  <div
                    title="View Details"
                    onClick={() => openProductModal(product)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img className="more--icon" src={seeMoreIcon} alt="View details" />
                  </div>
                </div>
                <img
                  src={getProductImage(product)}
                  alt={product.name || 'Product Image'}
                  className="grid-image"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = defaultImage;
                  }}
                />
                <p className="grid-name">{capitalizeWords(product.name)}</p>
                <p className="category-name">
                  <img src={categoryIcon} alt="Category" />
                  {product.category || 'Uncategorized'}
                </p>
                
                {/* Add quantities display */}
                {product.quantities && product.quantities.length > 0 && (
                  <div className="grid-item-quantities">
                    {product.quantities.map((qty, index) => (
                      <span key={index} className="quantity-chip">{qty}</span>
                    ))}
                  </div>
                )}
                
                <p className="grid-item-price">{formatPrice(product.price)}</p>
              </div>
            ))}
          </div>

          {/* Product Detail Modal */}
          {isModalOpen && selectedProduct && (
            <div className="product-modal-overlay" onClick={closeModal}>
              <div className="product-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={closeModal}>×</button>

                <div className="product-modal-container">
                  {/* Left Section - Product Image */}
                  <div className="product-modal-image">
                    {selectedProduct.isBestSeller && (
                      <div className="modal-bestseller-badge">
                        <span className="star">★</span> Best Seller
                      </div>
                    )}
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
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="pagination">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ← Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                return (
                  page === 1 || // always show first page
                  page === totalPages || // always show last page
                  Math.abs(currentPage - page) <= 1 // show current, previous, next
                );
              })
              .reduce((acc, page, index, array) => {
                if (index > 0 && page - array[index - 1] > 1) {
                  acc.push("ellipsis");
                }
                acc.push(page);
                return acc;
              }, [])
              .map((item, index) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${index}`} className="ellipsis">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    className={currentPage === item ? "active" : ""}
                    onClick={() => goToPage(item)}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Grid;
