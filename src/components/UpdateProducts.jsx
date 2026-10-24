import { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { auth } from '../../firebase/firebaseConfig';
import {
  collection,
  getDocs,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  startAfter,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import '../styles/update.css';
import { FiSearch, FiEdit, FiCheck, FiX } from 'react-icons/fi';
import { getStockQuantity, getStockLabel } from '../utils/inventory';
import { buildProductVector, VECTOR_VERSION } from '../utils/productVector.js';
import { invalidateProducts } from '../data/productStore.js';
import {
  countDescriptionWords,
  DESCRIPTION_WORD_LIMIT,
  trimDescriptionToLimit,
} from '../utils/description.js';

const movementDate = (value) => {
  if (!value) return new Date(0);
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
};

const formatMovementDate = (value) => {
  const date = movementDate(value);
  return date.getTime() ? date.toLocaleString('en-KE') : 'Pending';
};

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
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockForm, setStockForm] = useState({ type: 'Restock/Add', amount: '', note: '' });
  const [movements, setMovements] = useState([]);
  const [movementFilter, setMovementFilter] = useState('all');
  const [movementSearch, setMovementSearch] = useState('');
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [movementSaveError, setMovementSaveError] = useState('');
  const [movementSaving, setMovementSaving] = useState(false);
  const [movementCursor, setMovementCursor] = useState(null);
  const [movementHasMore, setMovementHasMore] = useState(false);

  const filteredMovements = useMemo(() => movements.filter((movement) => (
    (movementFilter === 'all' || movement.type === movementFilter)
    && (!movementSearch.trim() || String(movement.note || '').toLowerCase().includes(movementSearch.trim().toLowerCase()))
  )), [movements, movementFilter, movementSearch]);

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

  const loadMovements = async (product, cursor = null, replace = true) => {
    setMovementLoading(true);
    try {
      const movementConstraints = [
        where('productId', '==', product.id),
        orderBy('createdAt', 'desc'),
        ...(cursor ? [startAfter(cursor)] : []),
        limit(50),
      ];
      const snapshot = await getDocs(query(collection(db, 'stock_movements'), ...movementConstraints));
      const loadedMovements = snapshot.docs.map((movementDoc) => ({
        id: movementDoc.id,
        ...movementDoc.data(),
      }));
      setMovements((current) => replace ? loadedMovements : [...current, ...loadedMovements]);
      setMovementCursor(snapshot.docs[snapshot.docs.length - 1] || null);
      setMovementHasMore(snapshot.docs.length === 50);
    } catch (error) {
      if (error.code !== 'failed-precondition') {
        setMovementError(`Unable to load stock history (${error.code || 'unknown-error'}).`);
        return;
      }
      try {
        const fallbackSnapshot = await getDocs(query(
          collection(db, 'stock_movements'),
          where('productId', '==', product.id),
          limit(50)
        ));
        const fallbackMovements = fallbackSnapshot.docs.map((movementDoc) => ({
          id: movementDoc.id,
          ...movementDoc.data(),
        }));
        fallbackMovements.sort((left, right) => (
          movementDate(right.createdAt).getTime() - movementDate(left.createdAt).getTime()
        ));
        setMovements(fallbackMovements);
        setMovementCursor(null);
        setMovementHasMore(false);
        setMovementError(
          `History loaded without server ordering (${error.code}). ` +
          'Create a composite index on stock_movements: productId ASC, createdAt DESC.'
        );
      } catch (fallbackError) {
        setMovementError(`Unable to load stock history (${fallbackError.code || 'unknown-error'}).`);
      }
    } finally {
      setMovementLoading(false);
    }
  };

  const openStockModal = async (product) => {
    setSelectedProduct(product);
    setStockModalOpen(true);
    setStockForm({ type: 'Restock/Add', amount: '', note: '' });
    setMovementFilter('all');
    setMovementSearch('');
    setMovementError('');
    setMovementSaveError('');
    await loadMovements(product);
  };

  const closeStockModal = () => {
    if (movementSaving) return;
    setStockModalOpen(false);
    setSelectedProduct(null);
  };

  const handleStockAdjustment = async (event) => {
    event.preventDefault();
    const amount = Number(stockForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setMovementSaveError('Enter an amount greater than zero.');
      return;
    }
    if (!selectedProduct) return;

    const previousQty = getStockQuantity(selectedProduct);
    const change = stockForm.type === 'Restock/Add' ? amount : -amount;
    const newQty = Math.max(0, previousQty + change);
    if (stockForm.type === 'Remove/Correction' && amount > previousQty) {
      setMovementSaveError('The removal cannot exceed the current quantity.');
      return;
    }

    setMovementSaving(true);
    setMovementSaveError('');
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'products', selectedProduct.id), {
        stockQuantity: newQty,
        inStock: newQty > 0,
      });
      const movementRef = doc(collection(db, 'stock_movements'));
      batch.set(movementRef, {
        productId: selectedProduct.id,
        productName: selectedProduct.name || '',
        change,
        previousQty,
        newQty,
        type: stockForm.type,
        note: stockForm.note.trim(),
        createdBy: auth.currentUser?.uid || null,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      invalidateProducts();

      const updatedProduct = { ...selectedProduct, stockQuantity: newQty, inStock: newQty > 0 };
      setSelectedProduct(updatedProduct);
      setProducts((current) => current.map((product) => (
        product.id === updatedProduct.id ? updatedProduct : product
      )));
      setMovements((current) => [{
        id: movementRef.id,
        productId: updatedProduct.id,
        productName: updatedProduct.name || '',
        change,
        previousQty,
        newQty,
        type: stockForm.type,
        note: stockForm.note.trim(),
        createdBy: auth.currentUser?.uid || null,
        createdAt: new Date(),
      }, ...current]);
      setStockForm({ type: 'Restock/Add', amount: '', note: '' });
    } catch (error) {
      setMovementSaveError(`Stock update failed (${error.code || 'unknown-error'}). No changes were saved.`);
    } finally {
      setMovementSaving(false);
    }
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
      invalidateProducts();

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
                <tr
                  key={product.id}
                  className={editingProduct === product.id ? 'editing' : ''}
                  onClick={() => openStockModal(product)}
                >
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
                  <td onClick={(event) => event.stopPropagation()}>
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
                  <td onClick={(event) => event.stopPropagation()}>
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
                  <td className="update-actions-cell" onClick={(event) => event.stopPropagation()}>
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

      {stockModalOpen && selectedProduct && (
        <div className="update-modal-backdrop" onClick={closeStockModal}>
          <div className="stock-trace-modal" onClick={(event) => event.stopPropagation()}>
            <div className="update-modal-header">
              {selectedProduct.image && <img src={selectedProduct.image} alt="" />}
              <div>
                <h3>{selectedProduct.name}</h3>
                <p>{selectedProduct.category || 'Uncategorized'} · KSh {Number(selectedProduct.price || 0).toLocaleString()}</p>
                <strong>{getStockQuantity(selectedProduct)} units · {getStockLabel(selectedProduct)}</strong>
              </div>
              <button type="button" className="update-modal-close" onClick={closeStockModal} aria-label="Close stock details">×</button>
            </div>
            <div className="update-modal-content">
              <form className="stock-adjustment-form" onSubmit={handleStockAdjustment}>
                <h4>Adjust quantity</h4>
                <label>Type
                  <select value={stockForm.type} onChange={(event) => setStockForm({ ...stockForm, type: event.target.value })}>
                    <option>Restock/Add</option>
                    <option>Remove/Correction</option>
                  </select>
                </label>
                <label>Amount
                  <input type="number" min="1" step="1" value={stockForm.amount} onChange={(event) => setStockForm({ ...stockForm, amount: event.target.value })} required />
                </label>
                <label>Note (optional)
                  <input type="text" value={stockForm.note} onChange={(event) => setStockForm({ ...stockForm, note: event.target.value })} />
                </label>
                {movementSaveError && <p className="update-stock-error" role="alert">{movementSaveError}</p>}
                <button type="submit" className="update-action-btn update-save-btn" disabled={movementSaving}>
                  {movementSaving ? 'Saving...' : 'Save adjustment'}
                </button>
              </form>

              <div className="stock-history">
                <div className="stock-history-heading"><h4>Stock history</h4><span>Latest 50</span></div>
                <div className="stock-history-filters">
                  <select value={movementFilter} onChange={(event) => setMovementFilter(event.target.value)}>
                    <option value="all">All types</option>
                    <option value="Restock/Add">Restock/Add</option>
                    <option value="Remove/Correction">Remove/Correction</option>
                    <option value="sale">Sale</option>
                  </select>
                  <input type="search" placeholder="Search notes" value={movementSearch} onChange={(event) => setMovementSearch(event.target.value)} />
                </div>
                {movementError && <p className="update-stock-error" role="alert">{movementError}</p>}
                {movementLoading ? <p>Loading history...</p> : filteredMovements.length === 0 ? <p>No stock movements recorded.</p> : (
                  <div className="inventory-movement-list">
                    {filteredMovements.map((movement) => (
                      <div className="inventory-movement" key={movement.id}>
                        <strong>{movement.change > 0 ? '+' : ''}{movement.change}</strong>
                        <div><strong>{movement.type}</strong><span>{movement.note || 'No note'}</span></div>
                        <span>{formatMovementDate(movement.createdAt)}</span>
                        <span>{movement.previousQty} → {movement.newQty}</span>
                      </div>
                    ))}
                  </div>
                )}
                {movementHasMore && movementCursor && (
                  <button type="button" className="admin-back-button" onClick={() => loadMovements(selectedProduct, movementCursor, false)}>Load more</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UpdateProducts;
