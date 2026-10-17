import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../../firebase/firebaseConfig.js";
import { onAuthStateChanged } from "firebase/auth";
import { getStockQuantity } from "../utils/inventory";
import { useVisitor } from "./VisitorContext";

// Create the context
const CartContext = createContext();

// Custom hook for easier access to the context
export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { trackAddToCart } = useVisitor();
  
  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      loadCartForUser(currentUser);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Load cart data specific to the user
  const loadCartForUser = (currentUser) => {
    setIsLoading(true);
    try {
      // Generate a key specific to this user, or use 'guestCart' for non-logged in users
      const cartKey = currentUser ? `lorisCart_${currentUser.uid}` : 'lorisCart_guest';
      
      // Get cart data from localStorage with this key
      const localCart = localStorage.getItem(cartKey);
      
      // If a user just logged in and has items in their guest cart, 
      // merge with their existing cart
      setCart(localCart ? JSON.parse(localCart) : []);
    } catch (error) {
      console.error("Error loading cart from localStorage:", error);
      setCart([]);
    }
    setIsLoading(false);
  };
  
  // Calculate total items count
  const cartItemCount = cart.reduce((total, item) => total + item.quantity, 0);
  
  // Add item to cart
  const addToCart = (product, quantity = 1) => {
    const availableStock = getStockQuantity(product);
    if (availableStock < 1 || quantity < 1) return false;

    setCart(prevCart => {
      // Check if item already exists in cart
      const existingItemIndex = prevCart.findIndex(item => item.id === product.id);
      
      if (existingItemIndex >= 0) {
        // Item exists, update quantity
        const updatedCart = [...prevCart];
        const nextQuantity = Math.min(
          availableStock,
          updatedCart[existingItemIndex].quantity + quantity
        );
        updatedCart[existingItemIndex] = {
          ...updatedCart[existingItemIndex],
          quantity: nextQuantity,
          stockQuantity: availableStock
        };
        return updatedCart;
      } else {
        // Item doesn't exist, add new item
        return [...prevCart, { ...product, quantity: Math.min(quantity, availableStock) }];
      }
    });
    trackAddToCart(product);
    return true;
  };
  
  // Remove item from cart
  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };
  
  // Update item quantity
  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }
    
    setCart(prevCart => prevCart.map(item => {
      if (item.id !== productId) return item;
      return {
        ...item,
        quantity: Math.min(newQuantity, getStockQuantity(item)),
        stockQuantity: getStockQuantity(item)
      };
    }));
  };
  
  // Clear cart
  const clearCart = () => {
    setCart([]);
  };
  
  // Save cart to localStorage whenever it changes or user changes
  useEffect(() => {
    if (isLoading) return;
    
    // Generate the correct storage key based on user status
    const cartKey = user ? `lorisCart_${user.uid}` : 'lorisCart_guest';
    
    // Save to localStorage with this key
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, user, isLoading]);
  
  return (
    <CartContext.Provider value={{ 
      cart, 
      cartItemCount, 
      addToCart, 
      removeFromCart, 
      updateQuantity, 
      clearCart,
      isLoading
    }}>
      {children}
    </CartContext.Provider>
  );
};