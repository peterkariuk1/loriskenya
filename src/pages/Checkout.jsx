import { useState, useEffect } from "react";
import "../styles/checkout.css";
import logoImage from "../assets/lorislogo.png";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { db, auth } from "../../firebase/firebaseConfig";
import { setDoc, doc, getDoc } from "firebase/firestore";
import emailjs from "@emailjs/browser";

const Checkout = () => {
  const navigate = useNavigate();
  const [orderMethod, setOrderMethod] = useState("whatsapp");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    deliveryNotes: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const {
    cart: cartItems,
    updateQuantity,
    removeFromCart: removeItem,
    clearCart,
  } = useCart();
  const [emailStatus, setEmailStatus] = useState(null);

  const EMAILJS_SERVICE_ID = "service_dcl2ixr";
  const EMAILJS_TEMPLATE_ID = "template_n8yvs08";
  const EMAILJS_USER_ID = "v5NvpmkGpBwe7W6nZ";

  // Calculate the total without separate tax and shipping
  const total = cartItems.reduce(
    (total, item) =>
      total +
      (item.price
        ? item.price * item.quantity
        : item.selling_price * item.quantity),
    0
  );

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getOrderId = () => {
    return `LOR-${Date.now().toString().substring(7)}`;
  };

  const sendOrderConfirmationEmail = async (orderData) => {
    try {
      const formattedItems = orderData.items.map((item) => ({
        name: item.name,
        image_url: item.image || "https://placehold.co/64x64?text=No+Image",
        units: item.quantity,
        price: item.price.toLocaleString(),
      }));

      // Simplified costs without tax and shipping
      const formattedCosts = {
        total: orderData.total.toLocaleString(),
      };

      const templateParams = {
        order_id: orderData.id,
        orders: formattedItems,
        cost: formattedCosts,
        email: orderData.shippingAddress.email,
        to_name: orderData.shippingAddress.fullName,
        reply_to: "loriskenyaltd@gmail.com",
        logo_url:
          "https://f003.backblazeb2.com/file/loris-product-images/lorislogo.png",
      };

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_USER_ID
      );

      console.log("Email sent successfully:", response);
      setEmailStatus("success");
      return true;
    } catch (error) {
      console.error("Failed to send email:", error);
      setEmailStatus("error");
      return false;
    }
  };

  const handleNormalOrder = async (orderId) => {
    try {
      setIsProcessing(true);

      const user = auth.currentUser;

      const orderData = {
        id: orderId,
        userId: user ? user.uid : "guest",
        userEmail: user ? user.email : formData.email,
        items: cartItems.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price || item.selling_price,
          quantity: item.quantity,
          category: item.category || "Uncategorized",
          image: item.image || "",
        })),
        total,
        status: "pending",
        orderMethod: "website",
        shippingAddress: {
          fullName: formData.fullName,
          phone: formData.phone,
          email: formData.email,
          notes: formData.deliveryNotes,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (user) {
        await setDoc(doc(db, "users", user.uid, "orders", orderId), orderData);
      }

      await setDoc(doc(db, "orders", orderId), {
        ...orderData,
        userDisplayName: user ? user.displayName || "" : formData.fullName,
      });

      await sendOrderConfirmationEmail(orderData);

      clearCart();

      navigate(`/order-success?orderId=${orderId}`);
    } catch (error) {
      console.error("Error saving order:", error);
      alert(
        "We encountered an error processing your order. Please try again or contact customer support."
      );
      setIsProcessing(false);
    }
  };

  const handleWhatsAppOrder = (orderId) => {
    let message = `Hello Loris Kenya, I would like to place an order (${orderId}):\n\n`;

    message += `*Order Details*\n`;
    message += `------------------\n\n`;

    cartItems.forEach((item, index) => {
      message += `${index + 1}) ${item.name} x${item.quantity} - KSh ${
        (item.price || item.selling_price) * item.quantity
      }\n`;
    });

    message += `\n*Order Summary*\n`;
    message += `Total: KSh ${total}\n\n`;

    const whatsappNumber = "254753380900";
    const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
      message
    )}`;

    const OpenWhatsApp = async () => {
      clearCart();
      window.open(whatsappURL, "_blank");
    };

    OpenWhatsApp();
  };

  const handleCheckout = () => {
    const orderId = getOrderId();

    if (orderMethod === "whatsapp") {
      handleWhatsAppOrder(orderId);
    } else {
      if (!formData.fullName || !formData.email || !formData.phone) {
        alert("Please fill in all required fields");
        return;
      }
      handleNormalOrder(orderId);
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();

            setFormData((prev) => ({
              ...prev,
              fullName:
                userData.firstName && userData.lastName
                  ? `${userData.firstName} ${userData.lastName}`
                  : prev.fullName,
              email: user.email || prev.email,
              phone: userData.phone || prev.phone,
            }));
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    };

    fetchUserData();
  }, []);

  return (
    <div className="checkout-page">
      <div className="checkout-header">
        <img src={logoImage} alt="Loris Perfume" />
        <h1>Checkout</h1>
      </div>

      <div className="checkout-container">
        <div className="cart-section">
          <h2>Your Cart ({cartItems.length} items)</h2>

          {cartItems.length === 0 ? (
            <div className="empty-cart">
              <p>Your cart is empty</p>
              <Link to="/">Continue Shopping</Link>
            </div>
          ) : (
            <div className="cart-items">
              {cartItems.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-item-image">
                    <img
                      src={
                        item.image ||
                        "https://placehold.co/300x300?text=No+Image"
                      }
                      alt={item.name}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src =
                          "https://placehold.co/300x300?text=No+Image";
                      }}
                    />
                  </div>
                  <div className="cart-item-details">
                    <h3>{item.name}</h3>
                    <p className="item-category">
                      {item.category || "Uncategorized"}
                    </p>
                    <p className="item-price">
                      KSh {(item.price || item.selling_price).toLocaleString()}
                    </p>
                    <div className="quantity-controls">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                      >
                        -
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.quantity + 1)
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-subtotal">
                    <p>
                      KSh{" "}
                      {(
                        (item.price || item.selling_price) * item.quantity
                      ).toLocaleString()}
                    </p>
                    <button
                      className="remove-item"
                      onClick={() => removeItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="checkout-section">
          <div className="order-summary">
            <h2>Order Summary</h2>
            {/* Remove tax and shipping rows, keep only the total */}
            <div className="summary-row total">
              <span>Total</span>
              <span>KSh {total.toLocaleString()}</span>
            </div>
            <p className="included-info">Prices are inclusive of taxes</p>
          </div>

          <div className="order-method">
            <h2>How would you like to place your order?</h2>
            <div className="order-options">
              <div
                className={`order-option ${
                  orderMethod === "whatsapp" ? "selected" : ""
                }`}
                onClick={() => setOrderMethod("whatsapp")}
              >
                <div className="option-radio">
                  {orderMethod === "whatsapp" && (
                    <div className="radio-inner"></div>
                  )}
                </div>
                <div className="option-label">
                  <span>WhatsApp Order</span>
                  <small>
                    Place your order via WhatsApp for direct communication
                  </small>
                </div>
              </div>
            </div>

            {orderMethod === "whatsapp" && (
              <div className="whatsapp-info">
                <p className="order-instructions">
                  When you click "Place Order", we'll open WhatsApp with your
                  order details pre-filled. You can add any additional comments
                  before sending.
                </p>
              </div>
            )}
          </div>

          <div
            className={`order-option ${
              orderMethod === "normal" ? "selected" : ""
            }`}
            onClick={() => setOrderMethod("normal")}
          >
            <div className="option-radio">
              {orderMethod === "normal" && <div className="radio-inner"></div>}
            </div>
            <div className="option-label">
              <span>Standard Order</span>
              <small>Place your order through our website directly</small>
            </div>
          </div>

          {orderMethod === "normal" && (
            <div className="shipping-info">
              <h2>Contact Information</h2>
              <div className="form-row">
                <input
                  type="text"
                  name="fullName"
                  placeholder="Full Name"
                  value={formData.fullName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <input
                  type="email"
                  name="email"
                  placeholder="Email Address"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-row">
                <textarea
                  name="deliveryNotes"
                  placeholder="Any Special Instructions (Optional)"
                  value={formData.deliveryNotes}
                  onChange={handleInputChange}
                ></textarea>
              </div>
            </div>
          )}

          <button
            className="checkout-button"
            onClick={handleCheckout}
            disabled={isProcessing}
          >
            {isProcessing
              ? "Processing..."
              : orderMethod === "whatsapp"
              ? "Order via WhatsApp"
              : "Place Order"}
          </button>

          <p className="back-to-shopping">
            <Link to="/products">Continue Shopping</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
