import React, { useState, useEffect } from 'react';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { FiLoader, FiEdit, FiSave, FiX, FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import '../styles/profile.css';

const Profile = () => {
  const navigate = useNavigate();

  // State for user data
  const [userData, setUserData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  
  // State for password change
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [passwordError, setPasswordError] = useState(null);
  const [passwordSuccess, setPasswordSuccess] = useState(null);
  
  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData({
              firstName: data.firstName || '',
              lastName: data.lastName || '',
              email: currentUser.email || '',
              phone: data.phone || ''
            });
          }
        }
      } catch (error) {
        setError("Error fetching user data");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;   
      setUserData({
        ...userData,
        [name]: value
      });
  };
  
  // Handle password input changes
  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value
    });
  };
  
  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError(null);
    setSuccess(null);

    try {
      const currentUser = auth.currentUser;
      
      // Update Firestore document with firstName and lastName
      await updateDoc(doc(db, "users", currentUser.uid), {
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        updatedAt: new Date()
      });
      
      // Update email if changed by user
      if (userData.email !== currentUser.email) {
        await updateEmail(currentUser, userData.email);
      }
      
      setSuccess("Profile updated successfully!");
      setEditMode(false);
    } catch (error) {
      setError(`Error updating profile: ${error.message}`);
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };
  
  // Handle password update
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setPasswordError(null);
    setPasswordSuccess(null);
    
    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords don't match");
      setUpdating(false);
      return;
    }
    
    try {
      const currentUser = auth.currentUser;
      
      // Re-authenticate user before password change
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordData.currentPassword
      );
      
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordData.newPassword);
      
      setPasswordSuccess("Password updated successfully!");
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      if (error.code === 'auth/wrong-password') {
        setPasswordError("Current password is incorrect");
      } else {
        setPasswordError(`Error updating password: ${error.message}`);
      }
      console.error(error);
    } finally {
      setUpdating(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };
  
  if (loading) {
    return (
      <div className="profile-loading">
        <FiLoader className="spinner" size={32} />
        <p>Loading profile information...</p>
      </div>
    );
  }
  
  return (
    <div className="profile-page">
      <button onClick={handleBack} className="back-button">
        <FiArrowLeft /> Back to Home
      </button>
      
      <div className="profile-container">
        <h1>My Account</h1>
        
        {/* Personal Information Section */}
        <div className="profile-section">
          <div className="section-header">
            <h2>Personal Information</h2>
            <button 
              type="button" 
              className={`edit-toggle-btn ${editMode ? 'active' : ''}`}
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? (
                <>
                  <FiX /> Cancel
                </>
              ) : (
                <>
                  <FiEdit /> Edit
                </>
              )}
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}
          
          <form onSubmit={handleProfileUpdate}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="firstName">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  value={userData.firstName}
                  onChange={handleChange}
                  disabled={!editMode}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="lastName">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  value={userData.lastName}
                  onChange={handleChange}
                  disabled={!editMode}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={userData.email}
                onChange={handleChange}
                disabled={!editMode}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="phone">Phone Number</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={userData.phone}
                onChange={handleChange}
                disabled={!editMode}
                placeholder="e.g., 0712345678"
              />
            </div>

            {editMode && (
              <div className="form-actions">
                <button 
                  type="submit" 
                  className="update-btn"
                  disabled={updating}
                >
                  {updating ? (
                    <>
                      <FiLoader className="spinner" /> Updating...
                    </>
                  ) : (
                    <>
                      <FiSave /> Update Profile
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
        
        {/* Password Section */}
        <div className="profile-section">
          <h2>Change Password</h2>
          
          {passwordError && <div className="error-message">{passwordError}</div>}
          {passwordSuccess && <div className="success-message">{passwordSuccess}</div>}
          
          <form onSubmit={handlePasswordUpdate}>
            <div className="form-group">
              <label htmlFor="currentPassword">Current Password</label>
              <input
                type="password"
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordChange}
                required
                minLength="6"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordChange}
                required
              />
            </div>
            
            <div className="form-actions">
              <button 
                type="submit" 
                className="update-btn"
                disabled={updating}
              >
                {updating ? (
                  <>
                    <FiLoader className="spinner" /> Updating...
                  </>
                ) : (
                  <>
                      <FiSave /> Update Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
        
        {/* Order History Section */}
        <div className="profile-section">
          <h2>Order History</h2>
          <p className="view-orders">
            View your <a href="/orders">order history</a> to track recent purchases
          </p>
        </div>
      </div>
    </div>
  );
};

export default Profile;