import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import logoImage from "../assets/lorislogo.png";
import searchIcon from "../assets/search.png";
import cartIcon from "../assets/cart.png";
import profileIcon from "../assets/user.png";
import "../styles/nav.css";
import { useCart } from "../context/CartContext";
import { db, auth } from "../../firebase/firebaseConfig.js";
import { collection, getDocs, query, limit, getDoc, doc } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { FiLogOut, FiUser, FiSettings, FiShoppingBag } from "react-icons/fi";

const placeholders = [
  "Loris Peach Reed Diffuser",
  "Search by Category",
  "Loris No. 102 Ocean Breeze",
  "Search by Name",
  "Loris Oud Touch",
  "Search by Type",
  "Loris Tobacco Vanilla",
  "Search by Category",
  "Loris Inspired by Sauvage",
  "Search by Name",
  "Loris Velvet Rose",
  "Search by Type",
  "Loris Black Orchid",
  "Search by Category",
  "Search by Name",
  "Loris No. 201 Floral Musk",
  "Search by Type",
  "Loris No. 54 Woody Citrus",
  "Search by Category",
  "Loris Intense Leather",
  "Search by Name",
  "Loris Sweet Caramel",
  "Search by Type",
  "Loris Amber Elixir",
  "Search by Category",
  "Search by Name",
  "Loris Dark Vanilla",
  "Search by Type",
  "Loris White Musk",
  "Search by Category",
  "Loris Fresh Aqua",
  "Search by Name",
  "Loris Fruity Bloom",
  "Search by Type",
];

const Header = () => {
  const navigate = useNavigate();
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  const profileDropdownRef = useRef(null);
  const cartIconRef = useRef(null);
  const pendingCartShakeRef = useRef(false);

  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState("bounce-in");
  const [inputValue, setInputValue] = useState("");
  const headerRef = useRef(null);
  const { cartItemCount } = useCart();

  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem("recentSearches");
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error loading recent searches:", e);
      return [];
    }
  });

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, "products");
        const productsQuery = query(productsRef, limit(500));
        const snapshot = await getDocs(productsQuery);
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAllProducts(productsData);
      } catch (error) {
        console.error("Error fetching products for search:", error);
      }
    };

    fetchProducts();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setIsAuthenticated(true);
        setCurrentUser(user);

        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().role === "admin") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim().length > 1) {
      setIsLoading(true);

      const results = allProducts.filter((product) => {
        if (product.name && product.name.toLowerCase().includes(value.toLowerCase())) {
          return true;
        }

        if (product.category && product.category.toLowerCase().includes(value.toLowerCase())) {
          return true;
        }

        if (product.description && product.description.toLowerCase().includes(value.toLowerCase())) {
          return true;
        }

        return false;
      });

      const productSuggestions = results.slice(0, 5).map((p) => ({
        type: "product",
        id: p.id,
        name: p.name,
        category: p.category,
      }));

      const categories = [...new Set(results.map((p) => p.category).filter(Boolean))];
      const categorySuggestions = categories.slice(0, 3).map((c) => ({
        type: "category",
        name: c,
      }));

      const combinedSuggestions = [...productSuggestions, ...categorySuggestions];

      setSuggestions(combinedSuggestions);
      setShowSuggestions(true);
      setIsLoading(false);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSearch = (term = inputValue) => {
    if (term.trim()) {
      const newRecent = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
      setRecentSearches(newRecent);
      localStorage.setItem("recentSearches", JSON.stringify(newRecent));

      navigate(`/?search=${encodeURIComponent(term)}`);

      setInputValue("");
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    if (suggestion.type === "product") {
      navigate(`/product/?category=${encodeURIComponent(suggestion.category || "Uncategorized")}&pid=${suggestion.id}`);
    } else if (suggestion.type === "category") {
      navigate(`/?category=${encodeURIComponent(suggestion.name)}`);
    }

    const newRecent = [suggestion.name, ...recentSearches.filter((s) => s !== suggestion.name)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem("recentSearches", JSON.stringify(newRecent));

    setInputValue("");
    setShowSuggestions(false);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setShowProfileMenu(false);
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }

      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target)
      ) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
      e.preventDefault();
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    if (inputValue !== "") return;

    const interval = setInterval(() => {
      setAnimate("fade-out");

      setTimeout(() => {
        setIndex((prev) => (prev + 1) % placeholders.length);
        setAnimate("bounce-in");
      }, 200);
    }, 4000);

    return () => clearInterval(interval);
  }, [inputValue]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;

    let animationFrame = null;
    let stopTimeout = null;
    let suppressionTimeout = null;
    let lastScrollY = Math.max(0, window.scrollY);
    let suppressScrollHide = Boolean(sessionStorage.getItem("loris-storefront-scroll"));

    const playCartShake = () => {
      const icon = cartIconRef.current;
      if (!icon || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      icon.classList.remove("cart-icon-shake");
      void icon.offsetWidth;
      icon.classList.add("cart-icon-shake");
    };

    const keepHeaderVisible = () => {
      const activeElement = document.activeElement;
      return (
        window.scrollY <= 2 ||
        header.contains(activeElement) ||
        Boolean(header.querySelector(".profile-dropdown")) ||
        Boolean(header.querySelector('[data-mobile-menu-open="true"], [data-cart-drawer-open="true"]')) ||
        Boolean(document.querySelector('[aria-modal="true"]')) ||
        suppressScrollHide
      );
    };

    const revealHeader = () => {
      header.dataset.hidden = "false";
      if (pendingCartShakeRef.current) {
        pendingCartShakeRef.current = false;
        playCartShake();
      }
    };

    const handleScroll = () => {
      if (animationFrame !== null) return;

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        if (suppressScrollHide && !sessionStorage.getItem("loris-storefront-scroll")) {
          suppressScrollHide = false;
          if (suppressionTimeout !== null) window.clearTimeout(suppressionTimeout);
          suppressionTimeout = null;
        }
        const currentScrollY = Math.max(0, window.scrollY);
        header.dataset.scrolled = currentScrollY > 2 ? "true" : "false";
        const delta = Math.abs(currentScrollY - lastScrollY);
        if (delta >= 3) lastScrollY = currentScrollY;

        if (stopTimeout !== null) window.clearTimeout(stopTimeout);

        if (keepHeaderVisible()) {
          revealHeader();
        } else {
          header.dataset.hidden = "true";
        }

        stopTimeout = window.setTimeout(() => {
          stopTimeout = null;
          revealHeader();
        }, 180);
      });
    };

    const handleScrollEnd = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      if (stopTimeout !== null) window.clearTimeout(stopTimeout);
      stopTimeout = null;
      revealHeader();
    };

    const handleCartItemAdded = () => {
      if (header.dataset.hidden === "true") {
        pendingCartShakeRef.current = true;
        return;
      }
      playCartShake();
    };

    if (suppressScrollHide) {
      suppressionTimeout = window.setTimeout(() => {
        suppressScrollHide = false;
        suppressionTimeout = null;
      }, 2500);
    }

    header.dataset.hidden = "false";
    header.dataset.scrolled = window.scrollY > 2 ? "true" : "false";
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("scrollend", handleScrollEnd, { passive: true });
    window.addEventListener("cart:item-added", handleCartItemAdded);

    const handleAnimationEnd = (event) => {
      if (event.animationName === "cart-icon-shake") {
        event.currentTarget.classList.remove("cart-icon-shake");
      }
    };
    const cartIcon = cartIconRef.current;
    cartIcon?.addEventListener("animationend", handleAnimationEnd);

    return () => {
      if (stopTimeout !== null) window.clearTimeout(stopTimeout);
      if (suppressionTimeout !== null) window.clearTimeout(suppressionTimeout);
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scrollend", handleScrollEnd);
      window.removeEventListener("cart:item-added", handleCartItemAdded);
      cartIcon?.removeEventListener("animationend", handleAnimationEnd);
    };
  }, []);

  return (
    <>
      <nav ref={headerRef} className="header" aria-label="Main navigation">
      <Link to="/">
        <img className="loris-logo" src={logoImage} alt="Loris Logo" />
      </Link>

      <div className="searchbox">
        <input
          ref={searchInputRef}
          type="text"
          className="search-input"
          autoComplete="off"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => inputValue.trim().length > 1 && setShowSuggestions(true)}
        />
        {inputValue === "" && (
          <span className={`placeholder-text ${animate}`}>
            {placeholders[index]}
          </span>
        )}
        <button
          type="button"
          className="search-button-container"
          aria-label="Search"
          onClick={() => handleSearch()}
        >
          <img src={searchIcon} alt="" />
        </button>

        {showSuggestions && (
          <div className="search-suggestions" ref={suggestionsRef}>
            {isLoading ? (
              <div className="suggestion-loading">
                <p>Loading suggestions...</p>
              </div>
            ) : suggestions.length > 0 ? (
              <ul>
                {suggestions.map((suggestion, index) => (
                  <li
                    key={`${suggestion.type}-${index}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className={suggestion.type === "category" ? "category-suggestion" : ""}
                  >
                    {suggestion.type === "category" ? (
                      <>
                        <span className="suggestion-icon">🏷️</span>
                        <span>Category: {suggestion.name}</span>
                      </>
                    ) : (
                      <>
                        <span className="suggestion-icon">🔍</span>
                        <span className="product-suggestion">
                          <strong>{suggestion.name}</strong>
                          {suggestion.category && <small>{suggestion.category}</small>}
                        </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : recentSearches.length > 0 ? (
              <div className="recent-searches">
                <h4>Recent Searches</h4>
                <ul>
                  {recentSearches.map((term, index) => (
                    <li key={index} onClick={() => handleSearch(term)}>
                      <span className="suggestion-icon">⏱️</span>
                      <span>{term}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="no-suggestions">No matches found</p>
            )}
          </div>
        )}
      </div>

      <div className="right">
        <div className="nav-profile-container" ref={profileDropdownRef}>
          <button
            type="button"
            className="profile-icon-wrapper" 
            aria-label={isAuthenticated ? "Open account menu" : "Sign in"}
            onClick={() => isAuthenticated ? setShowProfileMenu(!showProfileMenu) : navigate("/login")}
          >
            <img src={profileIcon} alt="" />
            {isAuthenticated && <span className="auth-indicator" />}
          </button>
          
          {isAuthenticated && showProfileMenu && (
            <div className="profile-dropdown">
              <div className="user-info">
                <span className="user-email">{currentUser.email}</span>
              </div>
              
              <div className="dropdown-divider"></div>
              
              <div className="dropdown-menu">
                <Link to="/profile" className="dropdown-item">
                  <FiUser /> My Account
                </Link>
                
                <Link to="/orders" className="dropdown-item">
                  <FiShoppingBag /> My Orders
                </Link>
                
                {isAdmin && (
                  <Link to="/admin" className="dropdown-item admin-link">
                    <FiSettings /> Admin Dashboard
                  </Link>
                )}
                
                <button onClick={handleLogout} className="dropdown-item logout-btn">
                  <FiLogOut /> Logout
                </button>
              </div>
            </div>
          )}
        </div>
        
        <Link to="/checkout" aria-label={`Shopping cart, ${cartItemCount} items`}>
          <div className="cart-container">
            <img ref={cartIconRef} src={cartIcon} alt="" />
            {cartItemCount > 0 && (
              <div className="cart-counter-container">
                <p>{cartItemCount > 999 ? "999+" : cartItemCount}</p>
              </div>
            )}
          </div>
        </Link>
      </div>
      </nav>
      <div className="header-spacer" aria-hidden="true" />
    </>
  );
};

export default Header;
