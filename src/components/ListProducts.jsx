import { useState, useEffect } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import '../styles/list.css';
import { FiSearch, FiFilter, FiChevronDown, FiGrid, FiList, FiTag, FiBox } from 'react-icons/fi';

function ListProducts() {
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  
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
        const uniqueCategories = [...new Set(productsData.map(p => p.category || 'Uncategorized'))];
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
      result = result.filter(product => 
        (product.category || 'Uncategorized') === activeCategory
      );
    }
    
    // Filter by search term
    if (searchTerm) {
      const lowercaseTerm = searchTerm.toLowerCase();
      result = result.filter(product => 
        product.name?.toLowerCase().includes(lowercaseTerm) || 
        product.description?.toLowerCase().includes(lowercaseTerm) ||
        product.category?.toLowerCase().includes(lowercaseTerm)
      );
    }
    
    setFilteredProducts(result);
  }, [products, searchTerm, activeCategory]);

  // Handle category selection
  const handleCategoryChange = (category) => {
    setActiveCategory(category);
  };

  // Format price with KSh prefix
  const formatPrice = (price) => {
    return `KSh ${parseFloat(price).toLocaleString()}`;
  };

  return (
    <div className="list-products-container">
      {/* Header with search and filters */}
      <div className="products-list-header">
        <h2>All Products</h2>
        
        <div className="products-actions">
          {/* Search */}
          <div className="search-box">
            <FiSearch className="search-icon" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* View mode toggle */}
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <FiGrid />
            </button>
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <FiList />
            </button>
          </div>
        </div>
      </div>
      
      {/* Categories */}
      <div className="categories-container">
        <div className="categories-header">
          <FiTag /> <span>Categories</span>
        </div>
        <div className="categories-list">
          <button 
            className={activeCategory === 'all' ? 'active' : ''}
            onClick={() => handleCategoryChange('all')}
          >
            All Products
          </button>
          
          {categories.map(category => (
            <button 
              key={category} 
              className={activeCategory === category ? 'active' : ''}
              onClick={() => handleCategoryChange(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Product count */}
      <div className="products-count">
        {filteredProducts.length} products found
      </div>
      
      {/* Loading, Error and Empty states */}
      {loading ? (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading products...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <p>{error}</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="empty-container">
          <FiBox size={40} />
          <h3>No products found</h3>
          <p>Try adjusting your search or filter</p>
        </div>
      ) : (
        <>
          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="products-grid">
              {filteredProducts.map(product => (
                <div key={product.id} className="product-card">
                  <div className="product-image">
                    {product.image ? (
                      <img src={product.image} alt={product.name} />
                    ) : (
                      <div className="no-image">No Image</div>
                    )}
                    {!product.inStock && <div className="out-of-stock-badge">Out of Stock</div>}
                  </div>
                  <div className="product-details">
                    <h3 className="product-name">{product.name}</h3>
                    <div className="product-category">{product.category || 'Uncategorized'}</div>
                    <div className="product-price">{formatPrice(product.price)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* List View */}
          {viewMode === 'list' && (
            <div className="products-list">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Quantity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id}>
                      <td className="product-cell">
                        <div className="product-image-small">
                          {product.image ? (
                            <img src={product.image} alt={product.name} />
                          ) : (
                            <div className="no-image-small">No Image</div>
                          )}
                        </div>
                        <div className="product-name-id">
                          <div>{product.name}</div>
                          <div className="product-id">{product.id}</div>
                        </div>
                      </td>
                      <td>{product.category || 'Uncategorized'}</td>
                      <td>{formatPrice(product.price)}</td>
                      <td>{Number(product.stockQuantity) || 0} units</td>
                      <td>
                        <span className={`status-badge ${product.inStock ? 'in-stock' : 'out-of-stock'}`}>
                          {product.inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ListProducts;