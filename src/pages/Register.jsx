import { useState } from "react";
import "../styles/login.css";
import logoImage from "../assets/lorislogo.png";
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from "../../firebase/firebaseConfig.js";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { normalizeKenyanPhone } from "../utils/phone";

const Register = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusType, setStatusType] = useState(""); // success or error

  const handleSignUp = async (e) => {
    e.preventDefault();
    
    // Form validation
    if (!firstName || !lastName || !email || !password || !phone) {
      setStatusType("error");
      setStatusMessage("Please fill out all fields");
      return;
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatusType("error");
      setStatusMessage("Please enter a valid email address");
      return;
    }
    
    // Password validation (at least 6 characters)
    if (password.length < 6) {
      setStatusType("error");
      setStatusMessage("Password must be at least 6 characters long");
      return;
    }
    
    setIsLoading(true);
    setStatusMessage("");
    setStatusType("");
    const normalizedPhone = normalizeKenyanPhone(phone, { allowInternational: false });
    if (!normalizedPhone) {
      setStatusType("error");
      setStatusMessage("Enter a Kenyan number starting with 07 or 01, for example 0712345678.");
      setIsLoading(false);
      return;
    }
    
    try {
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Save additional user data to Firestore
      await setDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        email: user.email,
        phone: normalizedPhone,
        uid: user.uid,
        role: "customer", // Default role
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      // Show success message
      setStatusType("success");
      setStatusMessage("Registration successful! Redirecting to homepage...");
      
      // Reset form
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setPhone("");
      
      // Redirect to home page after a delay
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (error) {
      console.error("Registration error:", error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        setStatusMessage("This email is already registered. Please log in instead.");
      } else if (error.code === 'auth/weak-password') {
        setStatusMessage("Please use a stronger password.");
      } else {
        setStatusMessage(error.message || "Registration failed. Please try again.");
      }
      
      setStatusType("error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="backdrop-filter-container"></div>
      <div className="inner-login-container">
        <div className="top">
          <img src={logoImage} alt="Loris Perfume" />
        </div>
        <div className="center">
          <h1>Get Started</h1>
          <h2>Create Your Loris Perfume Account in Simple Steps!</h2>
          
          {statusMessage && (
            <div className={`status-message ${statusType}`}>
              {statusMessage}
            </div>
          )}
          
          <div className="register-names">
            <input 
              type="text" 
              placeholder="Enter your First Name" 
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
            <input 
              type="text" 
              placeholder="Enter your Last Name" 
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
          <input 
            type="email" 
            placeholder="Enter your Email Address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input 
            type="password" 
            placeholder="Enter your Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input 
            type="tel" 
            placeholder="Enter phone starting with 07 or 01"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <button 
            onClick={handleSignUp}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Sign Up"}
          </button>
          <Link style={{ textDecoration: "none" }} to="/login">
            <h2>Already have an account? Log back to your account</h2>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
