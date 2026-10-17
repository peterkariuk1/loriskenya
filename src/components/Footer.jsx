import "../styles/footer.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig.js";
import addToCartIcon from "../assets/shopping.png";
import placeOrderIcon from "../assets/order.png";
import deliveryIcon from "../assets/delivery.png";
import mpesaIcon from "../assets/mpesapp.png";
import visaIcon from "../assets/visa.png";
import mastercardIcon from "../assets/mastercard.png";
import cashIcon from "../assets/cash.png";
import instagramIcon from "../assets/ig.png";
import whatsappIcon from "../assets/wapp.png";
import newsletterImage from "../assets/oudperfume.jpeg";
import logoImage from "../assets/lorislogo.png";

const mapsUrl = "https://maps.app.goo.gl/eo7fAai59BYPWZGr6";
const mapsEmbedUrl = "https://www.google.com/maps?q=Loris+Parfum%2C+-1.2812723%2C36.8185782&output=embed";

const Footer = () => {
  const [email, setEmail] = useState("");
  const [subscriptionState, setSubscriptionState] = useState("idle");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");

  const handleNewsletterSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setSubscriptionState("error");
      setSubscriptionMessage("Enter a valid email address to subscribe.");
      return;
    }

    setSubscriptionState("loading");
    setSubscriptionMessage("");

    try {
      const documentId = normalizedEmail;
      await setDoc(doc(db, "newsletter_emails", documentId), {
        email: normalizedEmail,
        emailNormalized: normalizedEmail,
        subscribedAt: serverTimestamp(),
        source: "website_footer",
        status: "subscribed",
      }, { merge: true });

      setSubscriptionState("success");
      setSubscriptionMessage("You're on the list. Thank you for subscribing.");
      setEmail("");
    } catch (error) {
      console.error("Newsletter subscription failed:", error);
      setSubscriptionState("error");
      setSubscriptionMessage(
        error?.code === "permission-denied"
          ? "Newsletter subscriptions are temporarily unavailable. Please try again later."
          : "We couldn't save your subscription. Please try again."
      );
    }
  };

  return (
    <footer className="site-footer">
      <section className="newsletter-banner" aria-labelledby="newsletter-title">
        <div className="newsletter-image-wrap">
          <img src={newsletterImage} alt="Loris fragrance collection" />
        </div>
        <div className="newsletter-content">
          <p className="footer-eyebrow">The Loris Edit</p>
          <h2 id="newsletter-title">Stay in the Scent of Things</h2>
          <p>Discover new arrivals, considered offers, and fragrances worth remembering.</p>
          <form className="newsletter-form" onSubmit={handleNewsletterSubmit}>
            <label className="sr-only" htmlFor="newsletter-email">Email address</label>
            <input
              id="newsletter-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email address"
              disabled={subscriptionState === "loading"}
              required
            />
            <button type="submit" disabled={subscriptionState === "loading"}>
              {subscriptionState === "loading" ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
          <p className={`newsletter-message ${subscriptionState}`} aria-live="polite">
            {subscriptionMessage || "Subscribe for fragrance updates. You can unsubscribe at any time."}
          </p>
        </div>
      </section>

      <div className="footer-process">
        <h2>Our Seamless 3-Step Delivery Process</h2>
        <div className="orders-desc">
          <div><img src={addToCartIcon} alt="" /><p>Select your favourite products</p></div>
          <div><img src={placeOrderIcon} alt="" /><p>Place your order</p></div>
          <div><img src={deliveryIcon} alt="" /><p>Speedy delivery to your doorstep</p></div>
        </div>
      </div>

      <div className="footer-main">
        <div className="footer-brand">
          <img src={logoImage} alt="Loris Kenya" className="footer-logo" />
          <h3>Loris Kenya</h3>
          <p>Curating timeless scents that speak louder than words, designed for every season and every story.</p>
          <div className="footer-socials">
            <a href="https://www.instagram.com/lorisparfumekenya?igsh=Ymd5bTFiY3pwdG42" target="_blank" rel="noreferrer" aria-label="Loris Kenya on Instagram">
              <img src={instagramIcon} alt="" />
            </a>
            <a href="https://wa.me/254753380900" target="_blank" rel="noreferrer" aria-label="Contact Loris Kenya on WhatsApp">
              <img src={whatsappIcon} alt="" />
            </a>
          </div>
        </div>

        <nav className="footer-column" aria-label="Explore">
          <h3>Explore</h3>
          <Link to="/">Home</Link>
          <Link to="/all-products">Shop All</Link>
          <Link to="/?category=Women">Women</Link>
          <Link to="/?category=Men">Men</Link>
        </nav>

        <nav className="footer-column" aria-label="Customer support">
          <h3>Customer Care</h3>
          <Link to="/login">Login</Link>
          <Link to="/register">Create an account</Link>
          <Link to="/checkout">Checkout</Link>
          <a href="mailto:info@loriskenya.com">Email us</a>
        </nav>

        <div className="footer-contact">
          <h3>Visit Us</h3>
          <p>Loris Parfum, Nairobi, Kenya</p>
          <a href="tel:+254753380900">0753 380 900</a>
          <a href={mapsUrl} target="_blank" rel="noreferrer" className="directions-link">Get Directions</a>
          <div className="map-preview">
            <iframe
              src={mapsEmbedUrl}
              title="Live map showing Loris Parfum in Nairobi"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

      <div className="payments-container" aria-label="Accepted payment methods">
        <span>Mode of payments</span>
        <img src={mpesaIcon} alt="M-PESA" />
        <img src={visaIcon} alt="VISA" />
        <img src={mastercardIcon} alt="Mastercard" />
        <img src={cashIcon} alt="Cash" />
      </div>

      <div className="footer-bottom">
        <span>Copyright © {new Date().getFullYear()} Loris Kenya.</span>
        <span>Made for memorable moments.</span>
      </div>
    </footer>
  );
};

export default Footer;
