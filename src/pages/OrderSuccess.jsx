import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "../styles/order-success.css";
import logoImage from "../assets/lorislogo.png";
import successIcon from "../assets/check-circle.png";
import { db, auth } from "../../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";

const OrderSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const via = searchParams.get("via"); // Get the order method from URL
  
  const [orderDetails, setOrderDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch the existing order from Firestore
  useEffect(() => {
    const fetchOrderFromFirestore = async () => {
      try {
        if (!orderId) {
          setError("No order ID provided");
          setLoading(false);
          return;
        }

        // First try to get from public orders collection
        const orderRef = doc(db, "orders", orderId);
        let orderSnap = await getDoc(orderRef);

        // If not found in public collection and user is logged in, try user's collection
        if (!orderSnap.exists()) {
          const user = auth.currentUser;
          if (user) {
            const userOrderRef = doc(db, "users", user.uid, "orders", orderId);
            orderSnap = await getDoc(userOrderRef);
          }
        }

        if (orderSnap.exists()) {
          const data = orderSnap.data();

          // Format date if timestamp exists
          let formattedDate = "Just now";
          if (data.createdAt) {
            const date = data.createdAt.toDate
              ? data.createdAt.toDate()
              : new Date(data.createdAt);

            formattedDate = date.toLocaleString("en-KE", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          }

          // Set order details for display
          setOrderDetails({
            id: orderId,
            date: formattedDate,
            total: data.total.toLocaleString() + " KSh",
            items: data.items.length,
            status: data.status,
            orderMethod: data.orderMethod || (via === 'whatsapp' ? 'whatsapp' : 'website')
          });
        } else {
          setError("Order not found");
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        setError("Could not load order details");
      } finally {
        setLoading(false);
      }
    };

    fetchOrderFromFirestore();
  }, [orderId, via]);

  // Determine the order method - from database, URL param, or default
  const orderMethod = orderDetails?.orderMethod || (via === 'whatsapp' ? 'whatsapp' : 'website');
  
  // Get appropriate messaging based on order method
  const getOrderMethodMessage = () => {
    if (orderMethod === 'whatsapp') {
      return {
        title: "Your WhatsApp Order is Confirmed!",
        confirmation: "We've received your WhatsApp order request and it has been recorded in our system. Please check your WhatsApp for further communication.",
        nextSteps: [
          "Continue your conversation in WhatsApp",
          "Our team will confirm your order details via WhatsApp",
          "You'll arrange payment and delivery through WhatsApp"
        ]
      };
    } else {
      return {
        title: "Thank You for Your Order!",
        confirmation: "We've received your order and an attendant will reach out to you shortly. A confirmation has been sent to your email address.",
        nextSteps: [
          "Check your email for order confirmation",
          "Our team will call you to confirm your order details",
          "You'll arrange for payment and delivery during the call"
        ]
      };
    }
  };
  
  const methodMessage = getOrderMethodMessage();

  return (
    <div className="order-success-page">
      <div className="success-header">
        <Link to="/">
          <img src={logoImage} alt="Loris Kenya" className="logo" />
        </Link>
      </div>

      <div className="success-container">
        {loading ? (
          <div className="loading">Loading order details...</div>
        ) : error ? (
          <div className="error-message">
            <p>{error}</p>
            <p>Please contact support if you believe this is a mistake.</p>
          </div>
        ) : (
          <>
            <div className="success-icon-container">
              <img
                src={successIcon}
                alt="Success"
                className="success-icon"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://placehold.co/100x100?text=✓";
                }}
              />
            </div>

            <h1>{methodMessage.title}</h1>

            <div className="order-details">
              <p className="order-number">
                Order Number: <span>{orderId || "Unknown"}</span>
              </p>
              {orderDetails && (
                <>
                  <p className="order-date">Placed on: {orderDetails.date}</p>
                  <p className="order-total">Total: {orderDetails.total}</p>
                  <p className="order-items">Items: {orderDetails.items}</p>
                </>
              )}
              <p className="order-confirmation">
                {methodMessage.confirmation}
              </p>
            </div>

            <div className="delivery-info">
              <h2>Delivery Information</h2>
              <p>
                Your order will be delivered within 2-3 business days in
                Nairobi, or 3-5 business days for other locations in Kenya.
              </p>
              <p>Our team will contact you to confirm delivery details.</p>
            </div>

            <div className="next-steps">
              <h2>What's Next?</h2>
              <ul>
                {methodMessage.nextSteps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ul>
            </div>

            <div className="actions">
              <Link to="/" className="button primary">
                Continue Shopping
              </Link>
              <Link to="/orders" className="button secondary">
                View My Orders
              </Link>
            </div>

            <div className="contact-info">
              <p>Questions about your order? Contact us at:</p>
              <p>
                <strong>Email:</strong> loriskenyaltd@gmail.com
              </p>
              <p>
                <strong>Phone:</strong> +254753380900
              </p>
              {orderMethod === 'whatsapp' && (
                <p>
                  <strong>WhatsApp:</strong> +254753380900
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderSuccess;