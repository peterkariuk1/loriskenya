import React, { useState, useEffect } from "react";
import "../styles/adminOrder.css";
import { db } from "../../firebase/firebaseConfig";
import { collection, query, getDocs, updateDoc, doc, orderBy, Timestamp } from "firebase/firestore";
import { BiSearch, BiExport, BiRefresh, BiX } from "react-icons/bi";
import { FaBox, FaCheckCircle, FaTruck, FaPhoneAlt } from "react-icons/fa";
import { MdEmail, MdLocationOn } from "react-icons/md";

const AdminOrders = () => {
  const [activeTab, setActiveTab] = useState("ongoing");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  
  const [ongoingOrders, setOngoingOrders] = useState([]);
  const [deliveredOrders, setDeliveredOrders] = useState([]);
  
  const statusColors = {
    confirmed: { bg: "#e6f7ff", text: "#1890ff", icon: <FaBox /> },
    processing: { bg: "#fff7e6", text: "#fa8c16", icon: <BiRefresh /> },
    shipped: { bg: "#f6ffed", text: "#52c41a", icon: <FaTruck /> },
    delivered: { bg: "#f6ffed", text: "#389e0d", icon: <FaCheckCircle /> },
    cancelled: { bg: "#fff1f0", text: "#cf1322", icon: <BiX /> },
  };
  
  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const ongoing = [];
      const delivered = [];
      
      querySnapshot.forEach((doc) => {
        const orderData = {
          id: doc.id,
          ...doc.data(),
        };
        
        if (orderData.createdAt) {
          const date = orderData.createdAt.toDate 
            ? orderData.createdAt.toDate() 
            : new Date(orderData.createdAt);
            
          orderData.createdAtFormatted = new Intl.DateTimeFormat('en-KE', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }).format(date);
          
          orderData.createdAtRaw = date;
        } else {
          orderData.createdAtFormatted = "Unknown";
          orderData.createdAtRaw = new Date(0);
        }
        
        if (orderData.total) {
          orderData.totalFormatted = `KSh ${orderData.total.toLocaleString()}`;
        }

        if (!orderData.status) {
          orderData.status = "confirmed";
        }
        
        if (orderData.status === "delivered") {
          delivered.push(orderData);
        } else {
          ongoing.push(orderData);
        }
      });
      
      setOngoingOrders(ongoing);
      setDeliveredOrders(delivered);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError("Failed to load orders. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    fetchOrders();
  }, []);
  
  const handleSearch = (order) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      (order.userDisplayName || "").toLowerCase().includes(query) ||
      order.id.toLowerCase().includes(query) ||
      (order.userEmail || "").toLowerCase().includes(query) ||
      (order.shippingAddress?.phone || "").toLowerCase().includes(query) ||
      (order.shippingAddress?.address || "").toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query) ||
      (order.items?.some(item => item.name.toLowerCase().includes(query)) || false)
    );
  };

  const handleStatusFilter = (order) => {
    if (filterStatus === "all") return true;
    return order.status === filterStatus;
  };
  
  const markAsDelivered = async (orderId) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: "delivered",
        updatedAt: Timestamp.now()
      });
      
      try {
        const order = ongoingOrders.find(o => o.id === orderId);
        if (order && order.userId) {
          const userOrderRef = doc(db, "users", order.userId, "orders", orderId);
          await updateDoc(userOrderRef, {
            status: "delivered",
            updatedAt: Timestamp.now()
          });
        }
      } catch (err) {
        console.log("Note: Could not update user's order subcollection", err);
      }
      
      const order = ongoingOrders.find((o) => o.id === orderId);
      if (order) {
        order.status = "delivered";
        setDeliveredOrders([order, ...deliveredOrders]);
        setOngoingOrders(ongoingOrders.filter((o) => o.id !== orderId));
        setSelectedOrders(selectedOrders.filter(id => id !== orderId));
      }
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("Failed to update order status. Please try again.");
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, {
        status: newStatus,
        updatedAt: Timestamp.now()
      });
      
      const updatedOngoing = ongoingOrders.map(order => {
        if (order.id === orderId) {
          return { ...order, status: newStatus };
        }
        return order;
      });
      
      setOngoingOrders(updatedOngoing);
      
      if (newStatus === "delivered") {
        markAsDelivered(orderId);
      }
    } catch (err) {
      console.error("Error updating order status:", err);
      alert("Failed to update order status. Please try again.");
    }
  };
  
  const handleBulkAction = async (action) => {
    if (selectedOrders.length === 0) return;
    
    if (action === "mark-delivered") {
      const confirmed = window.confirm(`Mark ${selectedOrders.length} orders as delivered?`);
      if (!confirmed) return;
      
      try {
        for (const orderId of selectedOrders) {
          await markAsDelivered(orderId);
        }
        
        setSelectedOrders([]);
      } catch (err) {
        console.error("Error in bulk update:", err);
        alert("Some orders could not be updated. Please try again.");
      }
    }
  };
  
  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId) 
        : [...prev, orderId]
    );
  };
  
  const toggleOrderExpansion = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const toggleAllSelection = () => {
    if (allSelected) {
      // If all are selected, deselect all
      setSelectedOrders([]);
    } else {
      // If not all are selected, select all orders currently visible
      setSelectedOrders(orders.map(order => order.id));
    }
  };
  
  const refreshOrders = () => {
    setRefreshing(true);
    fetchOrders();
  };
  
  const orders = (
    activeTab === "ongoing" ? ongoingOrders : deliveredOrders
  )
    .filter(handleSearch)
    .filter(handleStatusFilter)
    .sort((a, b) => {
      return sortOrder === "newest"
        ? b.createdAtRaw - a.createdAtRaw
        : a.createdAtRaw - b.createdAtRaw;
    });
  
  const allSelected = orders.length > 0 && orders.every(order => 
    selectedOrders.includes(order.id)
  );

  const handleExport = () => {
    let csvContent = "Order ID,Customer,Email,Phone,Address,Items,Subtotal,Shipping,Tax,Total,Date,Status\n";
    
    orders.forEach(order => {
      const row = [
        `"${order.id}"`,
        `"${order.userDisplayName || 'Unknown'}"`,
        `"${order.userEmail || ''}"`,
        `"${order.shippingAddress?.phone || ''}"`,
        `"${order.shippingAddress?.address || ''} ${order.shippingAddress?.city || ''}"`,
        `"${order.items?.map(item => `${item.quantity}x ${item.name}`).join(', ') || ''}"`,
        `"${order.subtotal || 0}"`,
        `"${order.shipping || 0}"`,
        `"${order.tax || 0}"`,
        `"${order.total || 0}"`,
        `"${order.createdAtFormatted || ''}"`,
        `"${order.status || 'confirmed'}"`
      ].join(',');
      
      csvContent += row + "\n";
    });
      
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${activeTab}-orders.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Order Management</h1>
        <div className="dashboard-actions">
          <button className="action-button refresh" onClick={refreshOrders} disabled={refreshing}>
            <BiRefresh className={refreshing ? "spin" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={activeTab === "ongoing" ? "tab active" : "tab"}
          onClick={() => setActiveTab("ongoing")}
        >
          <div className="tab-content">
            <FaBox className="tab-icon" />
            <span>Ongoing Orders</span>
            {ongoingOrders.length > 0 && <span className="count">{ongoingOrders.length}</span>}
          </div>
        </button>
        <button
          className={activeTab === "delivered" ? "tab active" : "tab"}
          onClick={() => setActiveTab("delivered")}
        >
          <div className="tab-content">
            <FaCheckCircle className="tab-icon" />
            <span>Delivered Orders</span>
            {deliveredOrders.length > 0 && <span className="count">{deliveredOrders.length}</span>}
          </div>
        </button>
      </div>

      <div className="filter-bar">
        <div className="search-container">
          <BiSearch className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search orders by name, ID, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="filter-options">
          <select
            className="filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <select
            className="filter-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
          
          <button 
            className="export-btn" 
            onClick={handleExport}
            disabled={orders.length === 0}
          >
            <BiExport /> Export CSV
          </button>
        </div>
      </div>
      
      {selectedOrders.length > 0 && (
        <div className="bulk-actions">
          <span>{selectedOrders.length} order{selectedOrders.length !== 1 ? 's' : ''} selected</span>
          <div className="action-buttons">
            {activeTab === "ongoing" && (
              <button onClick={() => handleBulkAction("mark-delivered")}>
                Mark as Delivered
              </button>
            )}
            <button onClick={() => setSelectedOrders([])}>Clear Selection</button>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="loading-container">
          <div className="loader"></div>
          <p>Loading orders...</p>
        </div>
      ) : error ? (
        <div className="error-container">
          <p>{error}</p>
          <button onClick={refreshOrders}>Try Again</button>
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-orders">
          {searchQuery || filterStatus !== "all" ? (
            <>
              <h3>No orders match your filters</h3>
              <p>Try adjusting your search criteria or filters</p>
              <button onClick={() => {
                setSearchQuery("");
                setFilterStatus("all");
              }}>Clear Filters</button>
            </>
          ) : (
            <>
              <h3>No {activeTab} orders to display</h3>
              <p>New orders will appear here when they are placed</p>
            </>
          )}
        </div>
      ) : (
        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input 
                    type="checkbox" 
                    checked={allSelected && orders.length > 0}
                    onChange={toggleAllSelection}
                  />
                </th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <React.Fragment key={order.id}>
                  <tr className={selectedOrders.includes(order.id) ? 'selected' : ''}>
                    <td className="checkbox-cell">
                      <input 
                        type="checkbox" 
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                      />
                    </td>
                    <td className="order-id">{order.id}</td>
                    <td>
                      <div className="customer-info">
                        <span>{order.shippingAddress?.fullName || "Guest Order"}</span>
                        {order.userEmail && <span className="customer-email">{order.userEmail}</span>}
                      </div>
                    </td>
                    <td>{order.createdAtFormatted}</td>
                    <td>{order.items?.length || 0} items</td>
                    <td className="order-total">{order.totalFormatted}</td>
                    <td>
                      <span className="status-badge" 
                        style={{ 
                          backgroundColor: statusColors[order.status]?.bg || '#f5f5f5',
                          color: statusColors[order.status]?.text || '#999'
                        }}
                      >
                        {statusColors[order.status]?.icon}
                        <span>{order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="view-details-btn"
                          onClick={() => toggleOrderExpansion(order.id)}
                        >
                          {expandedOrder === order.id ? "Hide" : "View"}
                        </button>
                        
                        {activeTab === "ongoing" && (
                          <select
                            className="status-update"
                            value={order.status}
                            onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          >
                            <option value="confirmed">Confirmed</option>
                            <option value="processing">Processing</option>
                            <option value="shipped">Shipped</option>
                            <option value="delivered">Delivered</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {expandedOrder === order.id && (
                    <tr className="order-details-row">
                      <td colSpan="8">
                        <div className="expanded-details">
                          <div className="details-grid">
                            <div className="details-section customer-details">
                              <h4>Customer Details</h4>
                              <p>
                                <MdEmail className="details-icon" />
                                <span>Email:</span> 
                                {order.userEmail ? 
                                  <a href={`mailto:${order.userEmail}`}>{order.userEmail}</a> : 
                                  "Not provided"}
                              </p>
                              <p>
                                <FaPhoneAlt className="details-icon" />
                                <span>Phone:</span> 
                                {order.shippingAddress?.phone ? 
                                  <a href={`tel:${order.shippingAddress.phone}`}>{order.shippingAddress.phone}</a> : 
                                  "Not provided"}
                              </p>
                            </div>

                          </div>
                          
                          <div className="order-items-table">
                            <h4>Order Items</h4>
                            <table>
                              <thead>
                                <tr>
                                  <th>Item</th>
                                  <th>Price</th>
                                  <th>Quantity</th>
                                  <th>Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.items?.map((item, idx) => (
                                  <tr key={idx}>
                                    <td>
                                      <div className="item-info">
                                        {item.image && (
                                          <div className="item-image">
                                            <img 
                                              src={item.image} 
                                              alt={item.name}
                                              onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = "https://placehold.co/100x100?text=No+Image";
                                              }}
                                            />
                                          </div>
                                        )}
                                        <div className="item-details">
                                          <span className="item-name">{item.name}</span>
                                          {item.category && (
                                            <span className="item-category">{item.category}</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td>KSh {item.price.toLocaleString()}</td>
                                    <td>{item.quantity}</td>
                                    <td>KSh {(item.price * item.quantity).toLocaleString()}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr>
                                  <td colSpan="3" align="right">Subtotal:</td>
                                  <td>KSh {order.subtotal?.toLocaleString() || "-"}</td>
                                </tr>
                                <tr>
                                  <td colSpan="3" align="right">Shipping:</td>
                                  <td>
                                    {order.shipping === 0 ? 
                                      "Free" : 
                                      `KSh ${order.shipping?.toLocaleString() || "-"}`}
                                  </td>
                                </tr>
                                <tr>
                                  <td colSpan="3" align="right">Tax:</td>
                                  <td>KSh {order.tax?.toLocaleString() || "-"}</td>
                                </tr>
                                <tr className="total-row">
                                  <td colSpan="3" align="right">Total:</td>
                                  <td>KSh {order.total?.toLocaleString() || "-"}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                          
                          <div className="order-timeline">
                            <h4>Order Timeline</h4>
                            <div className="timeline">
                              <div className={`timeline-item ${order.status === "confirmed" || order.status === "processing" || order.status === "shipped" || order.status === "delivered" ? "completed" : ""}`}>
                                <div className="timeline-icon">✓</div>
                                <div className="timeline-content">
                                  <h5>Order Confirmed</h5>
                                  <p>{order.createdAtFormatted}</p>
                                </div>
                              </div>
                              
                              <div className={`timeline-item ${order.status === "processing" || order.status === "shipped" || order.status === "delivered" ? "completed" : ""}`}>
                                <div className="timeline-icon">✓</div>
                                <div className="timeline-content">
                                  <h5>Processing</h5>
                                  <p>{order.status === "processing" || order.status === "shipped" || order.status === "delivered" ? "Order is being prepared" : "Pending"}</p>
                                </div>
                              </div>
                              
                              <div className={`timeline-item ${order.status === "shipped" || order.status === "delivered" ? "completed" : ""}`}>
                                <div className="timeline-icon">✓</div>
                                <div className="timeline-content">
                                  <h5>Shipped</h5>
                                  <p>{order.status === "shipped" || order.status === "delivered" ? "Order has been shipped" : "Pending"}</p>
                                </div>
                              </div>
                              
                              <div className={`timeline-item ${order.status === "delivered" ? "completed" : ""}`}>
                                <div className="timeline-icon">✓</div>
                                <div className="timeline-content">
                                  <h5>Delivered</h5>
                                  <p>{order.status === "delivered" ? "Order has been delivered" : "Pending"}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;


