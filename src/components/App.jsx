import { Route, Routes } from "react-router-dom";
import { useState, useEffect } from "react";
import emailjs from '@emailjs/browser';
import { CartProvider } from "../context/CartContext";
import "../styles/App.css";
import Home from "../pages/Home.jsx";
import Admin from "../pages/Admin.jsx";
import Login from "../pages/Login.jsx";
import Register from "../pages/Register.jsx";
import Reset from "../pages/Reset.jsx";
import Checkout from "../pages/Checkout.jsx";
import Product from "../pages/Product.jsx";
import OrderSuccess from "../pages/OrderSuccess.jsx";
import Orders from "../pages/Orders.jsx";
import { bannerImages } from "../components/BannerImages.jsx";
import Loader from "../components/Loader.jsx";
import NotFound from "../pages/NotFound.jsx";
// import Maintenance from "../pages/Maintenance.jsx";
import AllProducts from "../pages/AllProducts.jsx";
import Profile from "../pages/Profile.jsx";
import ProtectedRoute from "../components/ProtectedRoute.jsx";

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const firstImage = new Image();
    firstImage.src = bannerImages[0]?.url;
  
    firstImage.onload = () => {
      setIsLoading(false);
    };
  }, []);

  useEffect(() => {
    // Initialize EmailJS
    emailjs.init("v5NvpmkGpBwe7W6nZ");
  }, []);

  return (
    <div></div>
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <CartProvider>
          <Routes>
            <Route path="/" element={<Home />}></Route>
            {/* Maintenance page during build time */}
            {/* <Route path="/" element={<Maintenance />}></Route> */}
            <Route path="/load-test" element={<Loader />}></Route>
            <Route path="/admin" element={<Admin />}></Route>
            <Route path="/login" element={<Login />}></Route>
            <Route path="/register" element={<Register />}></Route>
            <Route path="/reset" element={<Reset />}></Route>
            <Route path="/checkout" element={<Checkout />}></Route>
            <Route path="/product/:id" element={<Product />}></Route>
            <Route path="/product/" element={<Product />}></Route>
            <Route path="/order-success" element={<OrderSuccess />}></Route>
            <Route path="/orders" element={<Orders />}></Route>
            <Route path="*" element={<NotFound />}></Route>
            <Route path="/all-products" element={<AllProducts />}></Route>
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }>
            </Route>
          </Routes>
        </CartProvider>
      )}
    </>
  );
}

<Routes />;
export default App;
