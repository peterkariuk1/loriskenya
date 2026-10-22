import { useState, useEffect } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { collection, getDocs, doc, query, orderBy, updateDoc, serverTimestamp } from 'firebase/firestore';
import '../styles/update.css';
import { FiSearch, FiEdit, FiCheck, FiX } from 'react-icons/fi';
import { getStockQuantity, getStockLabel } from '../utils/inventory';
import { buildProductVector, VECTOR_VERSION } from '../utils/productVector.js';
import {
  countDescriptionWords,
  DESCRIPTION_WORD_LIMIT,
  trimDescriptionToLimit,
} from '../utils/description.js';

function UpdateProducts({ onAddProduct }) {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [categories, setCategories] = useState([]);

  // Fetch products on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const productsQuery = query(collection(db, 'products'), orderBy('name'));
        const querySnapshot = await getDocs(productsQuery);

        const productsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Extract unique categories
        const uniqueCategories = [...new Set(productsData.map(p => p.category))].filter(Boolean);
        setCategories(uniqueCategories);

        setProducts(productsData);
        setFilteredProducts(productsData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching products:", err);
        setError("Failed to load products. Please try again.");
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Filter products when search term or category changes
  useEffect(() => {
    let result = products;

    // Filter by category
    if (activeCategory !== 'all') {
      result = result.filter(product => product.category === activeCategory);
    }

    // Filter by search term
    if (searchTerm) {
      const lowercaseTerm = searchTerm.toLowerCase();
      result = result.filter(product =>
        product.name.toLowerCase().includes(lowercaseTerm) ||
        product.category?.toLowerCase().includes(lowercaseTerm) ||
        product.description?.toLowerCase().includes(lowercaseTerm)
      );
    }

    setFilteredProducts(result);
  }, [searchTerm, activeCategory, products]);

  // Start editing a product
  const handleEdit = (product) => {
    setEditingProduct(product.id);
    setEditForm({
      price: product.price,
      stockQuantity: getStockQuantity(product),
      description: product.description || ""
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingProduct(null);
    setEditForm({});
  };

  // Save product changes
  const handleSaveEdit = async (productId) => {
    try {
      const productRef = doc(db, 'products', productId);
      const nextStock = Math.max(0, Number(editForm.stockQuantity) || 0);
      const descriptionWordCount = countDescriptionWords(editForm.description);
      if (descriptionWordCount > DESCRIPTION_WORD_LIMIT) {
        alert(`Description must be ${DESCRIPTION_WORD_LIMIT} words or fewer before saving.`);
        return;
      }
      const updates = {
        price: parseFloat(editForm.price),
        inStock: nextStock > 0,
        stockQuantity: nextStock,
        description: editForm.description || ""
      };
      try {
        updates.vec = buildProductVector({
          ...products.find((product) => product.id === productId),
          price: updates.price,
          description: updates.description,
        });
        updates.vecVersion = VECTOR_VERSION;
        updates.vecUpdatedAt = serverTimestamp();
      } catch (error) {
        console.warn("Product vector could not be computed during update.", error);
      }
      await updateDoc(productRef, updates);

      // Update local state
      const updatedProducts = products.map(product => {
        if (product.id === productId) {
          return {
            ...product,
            price: parseFloat(editForm.price),
            inStock: Math.max(0, Number(editForm.stockQuantity) || 0) > 0,
            stockQuantity: Math.max(0, Number(editForm.stockQuantity) || 0),
            description: editForm.description || ""
          };
        }
        return product;
      });

      setProducts(updatedProducts);
      setEditingProduct(null);
    } catch (err) {
      console.error("Error updating product:", err);
      alert("Failed to update product. Please try again.");
    }
  };

  // Handle form changes
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    const nextValue = name === "description" && countDescriptionWords(value) > DESCRIPTION_WORD_LIMIT
      ? trimDescriptionToLimit(value)
      : value;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : nextValue
    }));
  };

  // Filter by category
  const handleCategoryFilter = (category) => {
    setActiveCategory(category);
  };

  return (
    <div className="update-products-container">
      <div className="update-header">
        <div className="update-header-title">
          <h2>Update Products</h2>
          <p>Manage your product inventory, prices and availability</p>
        </div>

        <div className="update-actions">
          {onAddProduct && <button type="button" className="upload-button" onClick={onAddProduct}>Add Product</button>}
          <div className="update-search-container">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <FiSearch className="update-search-icon" />
          </div>
        </div>
      </div>

      {/* Category filters */}
      <div className="update-category-filters">
        <button
          className={activeCategory === 'all' ? 'active' : ''}
          onClick={() => handleCategoryFilter('all')}
        >
          All Products
        </button>
        {categories.map(category => (
          <button
            key={category}
            className={activeCategory === category ? 'active' : ''}
            onClick={() => handleCategoryFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Products table or grid */}
      {loading ? (
        <div className="update-loading-state">Loading products...</div>
      ) : error ? (
        <div className="update-error-state">{error}</div>
      ) : filteredProducts.length === 0 ? (
        <div className="update-empty-state">
          <p>No products found matching your criteria</p>
        </div>
      ) : (
        <div className="update-table-container">
          <table className="update-products-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock Status</th>
                <th>Quantity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className={editingProduct === product.id ? 'editing' : ''}>
                  <td className="update-product-image">
                    {product.image ? (
                      <img src={product.image} alt={product.name} />
                    ) : (
                      <div className="update-no-image">No Image</div>
                    )}
                  </td>
                  <td className="update-product-name">
                    <div>{product.name}</div>
                    <span className="update-product-id">{product.id}</span>
                    {editingProduct === product.id && (
                      <>
                        <textarea
                          name="description"
                          value={editForm.description}
                          onChange={handleFormChange}
                          rows="3"
                          className="update-description-input"
                          aria-label={`Description for ${product.name}`}
                        />
                        <span className={`update-description-count ${countDescriptionWords(editForm.description) > DESCRIPTION_WORD_LIMIT ? "warning" : ""}`}>
                          {countDescriptionWords(editForm.description)}/{DESCRIPTION_WORD_LIMIT} words
                        </span>
                        {countDescriptionWords(editForm.description) > DESCRIPTION_WORD_LIMIT && (
                          <span className="update-description-warning">
                            Shorten this description before saving.
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td>{product.category || 'Uncategorized'}</td>
                  <td>
                    {editingProduct === product.id ? (
                      <input
                        type="number"
                        name="price"
                        value={editForm.price}
                        onChange={handleFormChange}
                        className="update-edit-input"
                      />
                    ) : (
                      `KSh ${parseFloat(product.price).toLocaleString()}`
                    )}
                  </td>
                  <td>
                    {editingProduct === product.id ? (
                      <span className={`update-status-badge ${getStockQuantity(product) > 0 ? 'in-stock' : 'out-stock'}`}>
                        {getStockLabel({ ...product, stockQuantity: editForm.stockQuantity })}
                      </span>
                    ) : (
                      <span className={`update-status-badge ${getStockQuantity(product) > 0 ? 'in-stock' : 'out-stock'}`}>
                        {getStockLabel(product)}
                      </span>
                    )}
                  </td>
                  <td>
                    {editingProduct === product.id ? (
                      <input
                        type="number"
                        min="0"
                        name="stockQuantity"
                        value={editForm.stockQuantity}
                        onChange={handleFormChange}
                        className="update-edit-input"
                      />
                    ) : (
                      `${Number(product.stockQuantity) || 0} units`
                    )}
                  </td>
                  <td className="update-actions-cell">
                    {editingProduct === product.id ? (
                      <>
                        <button
                          className="update-action-btn update-save-btn"
                          onClick={() => handleSaveEdit(product.id)}
                        >
                          <FiCheck /> Save
                        </button>
                        <button
                          className="update-action-btn update-cancel-btn"
                          onClick={handleCancelEdit}
                        >
                          <FiX /> Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="update-action-btn update-edit-btn"
                          onClick={() => handleEdit(product)}
                        >
                          <FiEdit /> Edit
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default UpdateProducts;