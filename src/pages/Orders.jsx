import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "../styles/orders.css";
import { auth, db } from "../../firebase/firebaseConfig";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Header from "../components/Header";
import { useCart } from "../context/CartContext"; // Import the cart context

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [reorderSuccess, setReorderSuccess] = useState(null); // State for success message
  const navigate = useNavigate();
  
  // Get cart functions
  const { addToCart } = useCart();
  
  // First, handle the auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      if (!currentUser) {
        // Only redirect if auth has finished loading and no user exists
        navigate("/login?redirect=/orders");
      }
    });
    
    // Clean up the auth listener
    return () => unsubscribe();
  }, [navigate]);
  
  // Then fetch orders once auth state is resolved
  useEffect(() => {
    // Don't try to fetch orders if still checking auth or if no user
    if (authLoading || !user) {
      return;
    }
    
    setLoading(true);
    
    // Use Firestore listener for real-time updates
    const ordersRef = collection(db, "users", user.uid, "orders");
    const q = query(ordersRef, orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, 
      (querySnapshot) => {
        const ordersList = [];
        querySnapshot.forEach((doc) => {
          // Convert Firestore timestamp to JavaScript Date
          const data = doc.data();
          let createdAtStr = "Unknown date";
          
          if (data.createdAt) {
            // Handle both Firestore Timestamp and JS Date objects
            const createdAt = data.createdAt.toDate ? 
              data.createdAt.toDate() : 
              new Date(data.createdAt);
              
            createdAtStr = createdAt.toLocaleString('en-KE', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
          
          ordersList.push({
            ...data,
            createdAt: createdAtStr
          });
        });
        
        setOrders(ordersList);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching orders:", err);
        setError("Failed to load your orders: " + err.message);
        setLoading(false);
      }
    );
    
    // Clean up the Firestore listener
    return () => unsubscribe();
  }, [user, authLoading]);
  
  // Function to format price
  const formatPrice = (price) => {
    return `KSh ${parseFloat(price).toLocaleString()}`;
  };
  
  // Handle reordering
  const handleReorder = (order) => {
    // Add each item from the order to the cart
    order.items.forEach(item => {
      addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        category: item.category,
        image: item.image,
      }, item.quantity);
    });
    
    // Show success message
    setReorderSuccess(`Items from Order #${order.id} added to your cart`);
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setReorderSuccess(null);
    }, 3000);
  };
  
  // Show auth loading state
  if (authLoading) {
    return (
      <div className="orders-page">
        <Header />
        <div className="orders-container">
          <div className="loading-orders">Checking authentication...</div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="orders-page">
      <Header />
      
      <div className="orders-container">
        <div className="orders-header">
          <h1>My Orders</h1>
          <Link to="/" className="back-to-shopping">Continue Shopping</Link>
        </div>
        
        {/* Show reorder success notification if exists */}
        {reorderSuccess && (
          <div className="reorder-success">
            <div className="success-icon">✓</div>
            <div className="success-message">{reorderSuccess}</div>
            <Link to="/cart" className="view-cart-btn">View Cart</Link>
            <button className="close-notification" onClick={() => setReorderSuccess(null)}>×</button>
          </div>
        )}
        
        {loading ? (
          <div className="loading-orders">Loading your orders...</div>
        ) : error ? (
          <div className="error-message">{error}</div>
        ) : orders.length === 0 ? (
          <div className="no-orders">
            <h2>You haven't placed any orders yet</h2>
            <p>Once you place an order, it will appear here.</p>
            <Link to="/" className="shop-now-btn">Shop Now</Link>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <div className="order-card" key={order.id}>
                <div className="order-header">
                  <div>
                    <h2>Order #{order.id}</h2>
                    <p className="order-date">{order.createdAt}</p>
                  </div>
                  <div className="order-status">
                    <span className={`status-badge ${order.status}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                </div>
                
                <div className="order-items">
                  {order.items.map((item, index) => (
                    <div className="order-item" key={index}>
                      <div className="item-image">
                        <img 
                          src={item.image || "https://placehold.co/100x100?text=No+Image"} 
                          alt={item.name}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "https://placehold.co/100x100?text=No+Image";
                          }}
                        />
                      </div>
                      <div className="item-details">
                        <h3>{item.name}</h3>
                        <p className="item-category">{item.category}</p>
                        <p className="item-price">
                          {formatPrice(item.price)} × {item.quantity}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="order-footer">
                  <div className="order-summary">
                    <div className="summary-row total">
                      <span>Total:</span>
                      <span>{formatPrice(order.total)}</span>
                    </div>
                  </div>
                  
                  <div className="order-actions">
                    <button 
                      className="reorder-btn" 
                      onClick={() => handleReorder(order)}
                    >
                      Add to Cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;