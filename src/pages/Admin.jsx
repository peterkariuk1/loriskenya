import React, { useState, useEffect } from "react";
import "../styles/admin.css";
import { Link, useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase/firebaseConfig";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  FiMenu, FiX, FiHome, FiShoppingBag, FiUsers, FiPackage,
  FiLogOut, FiChevronLeft, FiChevronRight,
  FiChevronDown, FiList, FiPlus, FiEdit, FiLoader
} from "react-icons/fi";
import logoImage from "../assets/lorislogo.png";
import AdminOrders from "../components/AdminOrders";
import UploadProducts from "../components/UploadProducts";
import UpdateProducts from "../components/UpdateProducts";
import Customers from "../components/Customers";
import ListProducts from "../components/ListProducts";
import Dashboard from "../components/Dashboard";
import { Helmet } from 'react-helmet'

const Admin = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSubTab, setActiveSubTab] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null);
  const [logoutLoading, setLogoutLoading] = useState(false); // Track logout state
  const [authChecking, setAuthChecking] = useState(true);
  const [authError, setAuthError] = useState(null);

  const navigate = useNavigate();

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        // Get the current user
        const currentUser = auth.currentUser;

        if (!currentUser) {
          // No user is logged in, redirect to login
          console.log("No user logged in, redirecting to login");
          navigate("/login");
          return;
        }

        // Get user data from Firestore to check role
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));

        if (!userDoc.exists()) {
          console.log("User document does not exist");
          navigate("/");
          return;
        }

        const userData = userDoc.data();

        // Check if user has admin role
        if (userData.role !== "admin") {
          console.log("User is not an admin, redirecting to homepage");
          navigate("/");
          return;
        }

        // User is admin, allow access
        console.log("Admin access granted");
        setAuthChecking(false);

      } catch (error) {
        console.error("Error checking admin status:", error);
        setAuthError("Failed to verify permissions. Please try again.");
        // Keep authChecking true so we show an error state
      }
    };

    // Set up auth state listener
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        checkAdminStatus();
      } else {
        // No user, redirect to login
        navigate("/login");
      }
    });

    return () => unsubscribe(); // Clean up listener
  }, [navigate]);

  // Handle logout functionality
  const handleLogout = async () => {
    try {
      setLogoutLoading(true); // Show loading state

      // Sign out from Firebase Authentication
      await signOut(auth);

      // Redirect to login page or home page
      navigate("/login");

      console.log("User logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
      alert("Failed to log out. Please try again.");
    } finally {
      setLogoutLoading(false); // Reset loading state
    }
  };

  // Toggle sidebar collapse state
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileOpen(!mobileOpen);
  };

  // Toggle dropdown menu
  const toggleDropdown = (dropdown) => {
    setOpenDropdown(openDropdown === dropdown ? null : dropdown);
  };

  // Handle navigation tab change
  const handleTabChange = (tab, subTab = "") => {
    setActiveTab(tab);
    setActiveSubTab(subTab);
    if (window.innerWidth < 992) {
      setMobileOpen(false);
    }
  };

  // Render the appropriate content based on active tab and subtab
  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard onNavigateToTab={handleTabChange} />;
      case "orders":
        return <AdminOrders isAdmin={true} />;
      case "products":
        if (activeSubTab === "add") {
          return <UploadProducts />;
        } else if (activeSubTab === "update") {
          return <UpdateProducts />;
        }
        return <ListProducts />;
      case "customers":
        return <Customers />;
      default:
        return <Dashboard onNavigateToTab={handleTabChange} />;
    }
  };

  // If still checking auth or there was an error
  if (authChecking) {
    return (
      <div className="admin-auth-checking">
        {authError ? (
          <div className="admin-auth-error">
            <p>{authError}</p>
            <button onClick={() => window.location.reload()}>
              Try Again
            </button>
          </div>
        ) : (
          <div className="admin-loading">
            <FiLoader className="spinner" size={32} />
            <p>Verifying permissions...</p>
          </div>
        )}
      </div>
    );
  }

  // Original Admin component render - only shown to admins
  return (
    <>
      <Helmet>
        <title>Loris | Admin</title>
        <meta name="description" content="Admin dashboard for Loris Kenya" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" href={logoImage} />
        <meta property="og:title" content="Loris Kenya Admin" />
        <meta property="og:description" content="Admin dashboard for Loris Kenya" />
        <meta property="og:image" content={logoImage} />
        <meta property="og:url" content="https://www.loriskenya.com/admin" />
      </Helmet>
      <div className={`admin-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sidebar */}
        <aside className={`admin-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
          {/* Sidebar Header */}
          <div className="sidebar-header">
            <div className="logo-container">
              <Link to="/">
                <img src={logoImage} alt="Loris Kenya" className="sidebar-logo" />
              </Link>
              <h1 className="logo">Admin</h1>
            </div>

            {/* Mobile close button */}
            <button className="mobile-close-btn" onClick={toggleMobileMenu}>
              <FiX size={24} />
            </button>

            {/* Desktop collapse button */}
            <button className="collapse-btn" onClick={toggleSidebar}>
              {sidebarCollapsed ? <FiChevronRight size={20} /> : <FiChevronLeft size={20} />}
            </button>
          </div>

          {/* Navigation */}
          <div className="sidebar-nav">
            <ul>
              <li className={activeTab === "dashboard" ? "active" : ""}>
                <button onClick={() => handleTabChange("dashboard")}>
                  <FiHome size={18} />
                  <span>Dashboard</span>
                </button>
              </li>
              <li className={activeTab === "orders" ? "active" : ""}>
                <button onClick={() => handleTabChange("orders")}>
                  <FiShoppingBag size={18} />
                  <span>Orders</span>
                </button>
              </li>

              {/* Products with dropdown */}
              <li className={activeTab === "products" ? "active" : ""}>
                <button
                  className={`dropdown-toggle ${openDropdown === "products" ? "open" : ""}`}
                  onClick={() => toggleDropdown("products")}
                >
                  <FiPackage size={18} />
                  <span>Products</span>
                  <FiChevronDown
                    size={16}
                    className="dropdown-icon"
                  />
                </button>

                {/* Dropdown menu */}
                {openDropdown === "products" && (
                  <ul className="dropdown-menu">
                    <li className={activeSubTab === "" ? "active-subtab" : ""}>
                      <button onClick={() => handleTabChange("products", "")}>
                        <FiList size={18} />
                        <span>All Products</span>
                      </button>
                    </li>
                    <li className={activeSubTab === "add" ? "active-subtab" : ""}>
                      <button onClick={() => handleTabChange("products", "add")}>
                        <FiPlus size={14} />
                        <span>Add Product</span>
                      </button>
                    </li>
                    <li className={activeSubTab === "update" ? "active-subtab" : ""}>
                      <button onClick={() => handleTabChange("products", "update")}>
                        <FiEdit size={14} />
                        <span>Update Products</span>
                      </button>
                    </li>
                  </ul>
                )}
              </li>

              <li className={activeTab === "customers" ? "active" : ""}>
                <button onClick={() => handleTabChange("customers")}>
                  <FiUsers size={18} />
                  <span>Customers</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Sidebar Footer */}
          <div className="sidebar-footer">
            <button 
              className={`logout-btn ${logoutLoading ? 'loading' : ''}`} 
              onClick={handleLogout}
              disabled={logoutLoading}
            >
              {logoutLoading ? (
                <span className="logout-loading">Logging out...</span>
              ) : (
                <>
                  <FiLogOut size={18} />
                  <span>Logout</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="admin-content">
          {/* Mobile menu button only */}
          <div className="mobile-menu-container">
            <button className="mobile-menu-btn" onClick={toggleMobileMenu}>
              <FiMenu size={24} />
            </button>
          </div>

          {/* Page content */}
          <div className="admin-page-content">
            {renderContent()}
          </div>
        </main>
      </div>
    </>
  );
};

export default Admin;
