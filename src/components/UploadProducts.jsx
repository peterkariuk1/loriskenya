import { useState, useRef, useEffect } from "react";
import "../styles/upload.css";
import { FiPlus, FiCheckCircle } from "react-icons/fi";
import { BiImageAdd } from "react-icons/bi";
import { MdOutlineInventory2, MdOutlineSell } from "react-icons/md";
import { BsGenderAmbiguous } from "react-icons/bs";
import { TbCategory } from "react-icons/tb";
import { db } from "../../firebase/firebaseConfig";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";
import axios from "axios";

const BACKEND_URL = "https://loriskenya-backend.onrender.com/api";

const UploadProducts = () => {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    quantities: "",
    price: "",
    description: "",
    inStock: true,
    isBestSeller: false,
    gender: "unisex",
    category: "",
    image: null
  });
  
  // UI state
  const [imagePreview, setImagePreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [uploadSuccess, setUploadSuccess] = useState(false);
  
  // Stats (from Firestore)
  const [productStats, setProductStats] = useState({
    total: 0,
    inStock: 0,
    outOfStock: 0
  });
  
  // Refs
  const fileInputRef = useRef(null);
  
  // Fetch product stats from Firestore
  useEffect(() => {
    const fetchProductStats = async () => {
      try {
        // Get all products
        const productsRef = collection(db, "products");
        const productsSnapshot = await getDocs(productsRef);
        
        // Count products
        const total = productsSnapshot.size;
        
        // Count in-stock products
        const inStockQuery = query(productsRef, where("inStock", "==", true));
        const inStockSnapshot = await getDocs(inStockQuery);
        const inStockCount = inStockSnapshot.size;
        
        // Update stats
        setProductStats({
          total,
          inStock: inStockCount,
          outOfStock: total - inStockCount
        });
      } catch (error) {
        console.error("Error fetching product stats:", error);
      }
    };
    
    fetchProductStats();
  }, [uploadSuccess]); // Refresh stats after successful upload
  
  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when field is updated
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: null
      }));
    }
  };
  
  // Handle radio button changes
  const handleRadioChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle image selection
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors(prev => ({
        ...prev,
        image: "Image size should be less than 5MB"
      }));
      return;
    }
    
    // Check file type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setFormErrors(prev => ({
        ...prev,
        image: "Please upload a valid image (JPEG, PNG, or WEBP)"
      }));
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      image: file
    }));
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
    
    // Clear error
    setFormErrors(prev => ({
      ...prev,
      image: null
    }));
  };
  
  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) errors.name = "Product name is required";
    if (!formData.quantities.trim()) errors.quantities = "Quantity is required";
    if (!formData.price || formData.price <= 0) errors.price = "Valid price is required";
    if (!formData.description.trim()) errors.description = "Description is required";
    if (!formData.category) errors.category = "Category is required";
    if (!formData.image) errors.image = "Product image is required";
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.error-message');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    
    setShowConfirmation(true);
  };
  
  // Cancel confirmation
  const handleCancel = () => {
    setShowConfirmation(false);
  };
  
  // Upload image to B2 through the backend API
  const uploadImageToB2 = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('category', 'products');
    
    // Create axios instance with progress monitoring
    const axiosInstance = axios.create();
    
    // Upload file with progress tracking
    const response = await axiosInstance.post(
      `${BACKEND_URL}/storage/upload`, 
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      }
    );
    
    return response.data;
  };
  
  // Process upload after confirmation
  const handleConfirmedUpload = async () => {
    setUploading(true);
    setUploadProgress(0);
    setShowConfirmation(false);
    
    try {
      // 1. Upload image to Backblaze B2 via backend API
      const uploadResult = await uploadImageToB2(formData.image);
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.message || "Failed to upload image");
      }
      
      // 2. Add product to Firestore with B2 image URL
      const productData = {
        name: formData.name,
        quantities: formData.quantities.split(' ').filter(Boolean),
        price: parseFloat(formData.price),
        description: formData.description,
        inStock: formData.inStock,
        isBestSeller: formData.isBestSeller,
        gender: formData.gender,
        category: formData.category,
        image: uploadResult.data.fileUrl, // Use B2 image URL
        fileName: uploadResult.data.fileName, // Store the B2 filename for potential deletion later
        createdAt: Timestamp.now()
      };
      
      await addDoc(collection(db, "products"), productData);
      
      // Success!
      setUploadProgress(100);
      setUploading(false);
      setUploadSuccess(true);
      
      // Reset form after 2 seconds
      setTimeout(() => {
        resetForm();
        setUploadSuccess(false);
      }, 2000);
      
    } catch (error) {
      console.error("Upload error:", error);
      setFormErrors(prev => ({ 
        ...prev, 
        upload: error.message || "Upload failed" 
      }));
      setUploading(false);
    }
  };
  
  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      quantities: "",
      price: "",
      description: "",
      inStock: true,
      isBestSeller: false,
      gender: "unisex",
      category: ""
    });
    setImagePreview(null);
    setFormErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  return (
    <div className="admin-upload-container">
      <div className="admin-header">
        <div className="admin-title">
          <h1>Product Management</h1>
          <p>Add new products to your inventory</p>
        </div>
        
        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-value">{productStats.total}</div>
            <div className="stat-label">Total Products</div>
          </div>
          <div className="stat-card in-stock">
            <div className="stat-value">{productStats.inStock}</div>
            <div className="stat-label">In Stock</div>
          </div>
          <div className="stat-card out-of-stock">
            <div className="stat-value">{productStats.outOfStock}</div>
            <div className="stat-label">Out of Stock</div>
          </div>
        </div>
      </div>
      
      <div className="upload-form-container">
        <h2>Add New Product</h2>
        <div className="upload-form">
          <div className="form-section image-upload-section">
            <h3>Product Image</h3>
            <div 
              className={`image-upload-area ${formErrors.image ? 'error' : ''}`}
              onClick={() => fileInputRef.current.click()}
            >
              {imagePreview ? (
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Product preview" className="image-preview" />
                  <button 
                    className="change-image-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current.click();
                    }}
                  >
                    Change Image
                  </button>
                </div>
              ) : (
                <div className="upload-placeholder">
                  <BiImageAdd className="upload-icon" />
                  <p>Click to upload product image</p>
                  <span>JPEG, PNG or WEBP, max 5MB</span>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/jpeg,image/png,image/webp"
                className="hidden-input"
              />
            </div>
            {formErrors.image && <div className="error-message">{formErrors.image}</div>}
          </div>
          
          <div className="form-grid">
            <div className="form-section">
              <h3>Basic Information</h3>
              
              <div className="form-group">
                <label htmlFor="name">Product Name</label>
                <input 
                  type="text" 
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Chanel No. 5"
                  className={formErrors.name ? 'error' : ''}
                />
                {formErrors.name && <div className="error-message">{formErrors.name}</div>}
                <p className="input-help">Enter the name without the quantity (ml)</p>
              </div>
              
              <div className="form-group">
                <label htmlFor="quantities">Available Quantities</label>
                <input 
                  type="text" 
                  id="quantities"
                  name="quantities"
                  value={formData.quantities}
                  onChange={handleChange}
                  placeholder="e.g. 50ml 100ml 200ml"
                  className={formErrors.quantities ? 'error' : ''}
                />
                {formErrors.quantities && <div className="error-message">{formErrors.quantities}</div>}
                <p className="input-help">List up to 3 quantities separated by spaces (e.g. 20ml 50ml 120ml)</p>
              </div>
              
              <div className="form-group">
                <label htmlFor="price">Base Price (KSh)</label>
                <input 
                  type="number" 
                  id="price"
                  name="price"
                  value={formData.price}
                  onChange={handleChange}
                  placeholder="e.g. 2500"
                  className={formErrors.price ? 'error' : ''}
                />
                {formErrors.price && <div className="error-message">{formErrors.price}</div>}
                <p className="input-help">Enter the price for the smallest quantity</p>
              </div>
              
              <div className="form-group">
                <label htmlFor="description">Product Description</label>
                <textarea 
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe the product's scent profile, longevity, etc."
                  rows="4"
                  className={formErrors.description ? 'error' : ''}
                ></textarea>
                {formErrors.description && <div className="error-message">{formErrors.description}</div>}
              </div>
            </div>
            
            <div className="form-section">
              <h3>Product Attributes</h3>
              
              <div className="attribute-section">
                <div className="attribute-header">
                  <MdOutlineInventory2 className="attribute-icon" />
                  <label>Availability</label>
                </div>
                <div className="radio-group">
                  <div 
                    className={`radio-button ${formData.inStock ? 'active' : ''}`}
                    onClick={() => handleRadioChange('inStock', true)}
                  >
                    <div className="radio-dot"></div>
                    <span>In Stock</span>
                  </div>
                  <div 
                    className={`radio-button ${!formData.inStock ? 'active' : ''}`}
                    onClick={() => handleRadioChange('inStock', false)}
                  >
                    <div className="radio-dot"></div>
                    <span>Out of Stock</span>
                  </div>
                </div>
              </div>
              
              <div className="attribute-section">
                <div className="attribute-header">
                  <MdOutlineSell className="attribute-icon" />
                  <label>Featured Status</label>
                </div>
                <div className="radio-group">
                  <div 
                    className={`radio-button ${formData.isBestSeller ? 'active' : ''}`}
                    onClick={() => handleRadioChange('isBestSeller', true)}
                  >
                    <div className="radio-dot"></div>
                    <span>Best Seller</span>
                  </div>
                  <div 
                    className={`radio-button ${!formData.isBestSeller ? 'active' : ''}`}
                    onClick={() => handleRadioChange('isBestSeller', false)}
                  >
                    <div className="radio-dot"></div>
                    <span>Regular Product</span>
                  </div>
                </div>
              </div>
              
              <div className="attribute-section">
                <div className="attribute-header">
                  <BsGenderAmbiguous className="attribute-icon" />
                  <label>Target Gender</label>
                </div>
                <div className="radio-group gender-group">
                  <div 
                    className={`radio-button ${formData.gender === 'men' ? 'active' : ''}`}
                    onClick={() => handleRadioChange('gender', 'men')}
                  >
                    <div className="radio-dot"></div>
                    <span>Men</span>
                  </div>
                  <div 
                    className={`radio-button ${formData.gender === 'women' ? 'active' : ''}`}
                    onClick={() => handleRadioChange('gender', 'women')}
                  >
                    <div className="radio-dot"></div>
                    <span>Women</span>
                  </div>
                  <div 
                    className={`radio-button ${formData.gender === 'unisex' ? 'active' : ''}`}
                    onClick={() => handleRadioChange('gender', 'unisex')}
                  >
                    <div className="radio-dot"></div>
                    <span>Unisex</span>
                  </div>
                </div>
              </div>
              
              <div className="attribute-section">
                <div className="attribute-header">
                  <TbCategory className="attribute-icon" />
                  <label>Product Category</label>
                </div>
                <div className={`category-grid ${formErrors.category ? 'error' : ''}`}>
                  {[
                    'Auto Perfumes', 'Body Care', 'Cologne', 'Diffusers', 
                    'Dmar', 'Frequence', 'Loris Perfumes', 'Lotion', 
                    'Mist', 'Niche Perfumes', 'Niche Diffusers', 
                    'Room Spray', 'Mystery Perfume', 'Others'
                  ].map(cat => (
                    <div 
                      key={cat}
                      className={`category-item ${formData.category === cat ? 'active' : ''}`}
                      onClick={() => handleRadioChange('category', cat)}
                    >
                      {cat}
                    </div>
                  ))}
                </div>
                {formErrors.category && <div className="error-message">{formErrors.category}</div>}
              </div>
            </div>
          </div>
        </div>
        
        <div className="form-actions">
          {formErrors.upload && <div className="error-message upload-error">{formErrors.upload}</div>}
          
          {uploading ? (
            <div className="upload-progress">
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <span className="progress-text">{Math.round(uploadProgress)}% Uploading to B2...</span>
            </div>
          ) : uploadSuccess ? (
            <div className="upload-success">
              <FiCheckCircle className="success-icon" />
              <span>Product uploaded successfully!</span>
            </div>
          ) : (
            <button 
              className="submit-button"
              onClick={handleSubmit}
              disabled={uploading}
            >
              <FiPlus className="button-icon" />
              Add Product
            </button>
          )}
        </div>
      </div>
      
      {showConfirmation && (
        <div className="confirmation-modal">
          <div className="confirmation-content">
            <h3>Confirm Product Upload</h3>
            <p>Once submitted, changes can't be made unless you delete the entire product. Are you sure you want to proceed?</p>
            <div className="confirmation-actions">
              <button className="cancel-button" onClick={handleCancel}>Cancel</button>
              <button className="confirm-button" onClick={handleConfirmedUpload}>Yes, Upload Product</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadProducts;
