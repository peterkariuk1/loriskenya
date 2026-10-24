import React, { useEffect, useState } from 'react';
import {
  FiDollarSign, FiShoppingCart, FiUsers, FiPackage,
  FiArrowRight, FiEye, FiAlertCircle, FiCalendar, FiLoader, FiRefreshCw
} from 'react-icons/fi';
import { db } from '../../firebase/firebaseConfig';
import { collection, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { getStockQuantity } from '../utils/inventory';
import { aggregateTodayPosSales, nairobiDayBounds } from '../utils/todayPosSales.js';
import '../styles/dashboard.css';

const Dashboard = ({ onNavigateToTab }) => {
  // State for storing Firebase data
  const [stats, setStats] = useState({
    revenue: 0,
    orders: 0,
    customers: 0,
    products: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [todaySales, setTodaySales] = useState(null);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState(null);
  const [salesUpdatedAt, setSalesUpdatedAt] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [movementsError, setMovementsError] = useState(null);

  const refreshTodaySales = async () => {
    setSalesLoading(true);
    setSalesError(null);
    try {
      const { start, end } = nairobiDayBounds();
      const snapshot = await getDocs(query(
        collection(db, 'orders'),
        where('createdAt', '>=', Timestamp.fromDate(start)),
        where('createdAt', '<', Timestamp.fromDate(end))
      ));
      const sales = aggregateTodayPosSales(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
      setTodaySales(sales);
      setSalesUpdatedAt(new Date());
    } catch (err) {
      console.error('Error fetching POS sales today:', err);
      setSalesError('Could not load today’s POS sales. Refresh to try again.');
    } finally {
      setSalesLoading(false);
    }
  };

  // Get formatted date for the header
  const getCurrentDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  useEffect(() => {
    refreshTodaySales();
    getDocs(query(collection(db, 'stock_movements'), orderBy('createdAt', 'desc'), limit(10)))
      .then((snapshot) => setStockMovements(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))))
      .catch((err) => {
        console.error('Error fetching stock movements:', err);
        setMovementsError('Could not load recent stock movements.');
      });
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch order data for revenue and order count
        const ordersSnapshot = await getDocs(collection(db, 'orders'));
        const ordersData = ordersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })).sort((first, second) => {
          const firstDate = first.createdAt?.toDate ? first.createdAt.toDate().getTime() : new Date(first.createdAt || 0).getTime();
          const secondDate = second.createdAt?.toDate ? second.createdAt.toDate().getTime() : new Date(second.createdAt || 0).getTime();
          return secondDate - firstDate;
        });

        // Calculate revenue from orders
        const totalRevenue = ordersData.reduce((sum, order) => {
          return sum + (parseFloat(order.total) || 0);
        }, 0);

        // Get recent orders (last 5)
        const recentOrdersData = ordersData.slice(0, 5).map(order => ({
          id: order.orderNumber || order.id,
          customer: order.shippingAddress?.fullName || order.customerName || 'Anonymous',
          date: order.createdAt?.toDate ? order.createdAt.toDate().toISOString().split('T')[0] : (order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : 'Unknown'),
          total: `KSh ${parseFloat(order.total).toLocaleString()}`,
          status: order.status || 'Processing'
        }));

        // Fetch customers
        const customersQuery = query(
          collection(db, 'users'),
          where('role', '==', 'customer')
        );
        const customersSnapshot = await getDocs(customersQuery);
        const customersCount = customersSnapshot.size;

        // Fetch products
        const productsQuery = query(collection(db, 'products'));
        const productsSnapshot = await getDocs(productsQuery);
        const productsData = productsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        const productsCount = productsSnapshot.size;

        // Identify low stock products (for alerts)
        const lowStockProducts = productsData.filter(product =>
          getStockQuantity(product) < 5
        );

        // Calculate top selling products based on orders
        // This is a simplified version - in real life you might track this differently
        const productSalesMap = {};

        ordersData.forEach(order => {
          // Only process orders with items
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              const productId = item.productId || item.id;
              const quantity = item.quantity || 1;
              const price = item.price || 0;

              if (!productSalesMap[productId]) {
                productSalesMap[productId] = {
                  name: item.name || 'Unknown Product',
                  sales: 0,
                  revenue: 0
                };
              }

              productSalesMap[productId].sales += quantity;
              productSalesMap[productId].revenue += (quantity * price);
            });
          }
        });

        // Convert to array and sort by sales
        const topProductsData = Object.keys(productSalesMap)
          .map(id => ({
            id,
            name: productSalesMap[id].name,
            sales: productSalesMap[id].sales,
            revenue: `KSh ${productSalesMap[id].revenue.toLocaleString()}`
          }))
          .sort((a, b) => b.sales - a.sales)
          .slice(0, 4); // Get top 4

        // Create alerts
        const alertsData = [];

        // Add low stock alert
        if (lowStockProducts.length > 0) {
          alertsData.push({
            id: 1,
            message: `${lowStockProducts.length} products are low in stock`,
            type: 'warning'
          });
        }

        // Add new customers alert (if any in last 7 days)
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const newCustomersSnapshot = await getDocs(query(
          collection(db, 'users'),
          where('createdAt', '>=', oneWeekAgo)
        ));
        const newCustomersCount = newCustomersSnapshot.size;

        if (newCustomersCount > 0) {
          alertsData.push({
            id: 2,
            message: `${newCustomersCount} new customer registrations this week`,
            type: 'info'
          });
        }

        // Update state with fetched data
        setStats({
          revenue: totalRevenue,
          orders: ordersData.length,
          customers: customersCount,
          products: productsCount
        });

        setRecentOrders(recentOrdersData);
        setTopProducts(topProductsData);
        setAlerts(alertsData);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Transform data for display
  const statsForDisplay = [
    {
      id: 1,
      title: "Total Revenue",
      value: `KSh ${stats.revenue.toLocaleString()}`,
      icon: <FiDollarSign />
    },
    {
      id: 2,
      title: "Orders",
      value: stats.orders.toString(),
      icon: <FiShoppingCart />
    },
    {
      id: 3,
      title: "Customers",
      value: stats.customers.toString(),
      icon: <FiUsers />
    },
    {
      id: 4,
      title: "Products",
      value: stats.products.toString(),
      icon: <FiPackage />
    }
  ];

  if (loading) {
    return (
      <div className="dashboard-loading">
        <FiLoader className="spinner" size={32} />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <FiAlertCircle size={32} />
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <div className="dashboard-title">
          <h2>Dashboard Overview</h2>
          <p className="subtitle">Welcome back to Loris Admin</p>
        </div>
        <div className="dashboard-date">
          <FiCalendar size={16} />
          <span>{getCurrentDate()}</span>
        </div>
      </div>

      {/* Stats Section */}
      <div className="stats-container">
        {statsForDisplay.map(stat => (
          <div className="stat-card" key={stat.id}>
            <div className="stat-icon">{stat.icon}</div>
            <div className="stat-details">
              <h3>{stat.title}</h3>
              <p className="stat-value">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid dashboard-extra-grid">
        <section className="dashboard-card today-sales-card">
          <div className="card-header">
            <h3>POS Sales Today</h3>
            <button className="view-all-btn" onClick={refreshTodaySales} disabled={salesLoading} aria-label="Refresh POS sales">
              <FiRefreshCw className={salesLoading ? 'spinner' : ''} /> Refresh
            </button>
          </div>
          {salesError ? <p className="dashboard-inline-error" role="alert">{salesError}</p> : salesLoading && !todaySales ? <p>Loading sales…</p> : todaySales && <>
            <div className="today-sales-stats">
              <div><span>Revenue received</span><strong>KSh {todaySales.revenue.toLocaleString()}</strong></div>
              <div><span>Transactions</span><strong>{todaySales.transactions}</strong></div>
              <div><span>Average sale</span><strong>KSh {todaySales.averageSale.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong></div>
            </div>
            {todaySales.transactions === 0 && <p className="empty-state">No qualifying POS sales today.</p>}
            <div className="payment-breakdown"><strong>By payment method</strong>{Object.entries(todaySales.paymentBreakdown).length ? Object.entries(todaySales.paymentBreakdown).map(([method, amount]) => <span key={method}>{method.toUpperCase()}: KSh {amount.toLocaleString()}</span>) : <span>—</span>}</div>
            {todaySales.unclassified.length > 0 && <p className="dashboard-inline-error">{todaySales.unclassified.length} POS order(s) could not be classified.</p>}
            <small>Updated {salesUpdatedAt?.toLocaleTimeString('en-KE') || '—'} (Africa/Nairobi)</small>
          </>}
        </section>
        <section className="dashboard-card stock-movements-card">
          <div className="card-header"><h3>Recent Stock Movements</h3></div>
          {movementsError ? <p className="dashboard-inline-error" role="alert">{movementsError}</p> : stockMovements.length === 0 ? <p className="empty-state">No stock movements recorded.</p> : <div className="table-container"><table className="orders-table"><thead><tr><th>Time</th><th>Product</th><th>Change</th><th>Type</th><th>Stock</th><th>Note / who</th></tr></thead><tbody>{stockMovements.map((movement) => {
            const date = movement.createdAt?.toDate ? movement.createdAt.toDate() : new Date(movement.createdAt || 0);
            return <tr key={movement.id}><td>{Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('en-KE')}</td><td><a href={`/product/?pid=${encodeURIComponent(movement.productId || '')}`}>{movement.productName || movement.productId || 'Product'}</a></td><td>{Number(movement.change) > 0 ? '+' : ''}{movement.change}</td><td>{movement.type || '—'}</td><td>{movement.previousQty} → {movement.newQty}</td><td>{movement.note || '—'}{movement.createdBy ? ` · ${movement.createdBy}` : ''}</td></tr>;
          })}</tbody></table></div>}
        </section>
      </div>

      <div className="dashboard-grid">
        {/* Recent Orders */}
        <div className="dashboard-card orders-card">
          <div className="card-header">
            <h3>Recent Orders</h3>
            <button 
              className="view-all-btn"
              onClick={() => onNavigateToTab && onNavigateToTab("orders")}
            >
              View All <FiArrowRight size={14} />
            </button>
          </div>
          <div className="table-container">
            {recentOrders.length > 0 ? (
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map(order => (
                    <tr key={order.id}>
                      <td className="order-id">{order.id}</td>
                      <td>{order.customer}</td>
                      <td>{order.date}</td>
                      <td>{order.total}</td>
                      <td>
                        <span className={`status-badge ${order.status.toLowerCase()}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty-state">No orders found</div>
            )}
          </div>
        </div>

        {/* Top Products & Alerts */}
        <div className="dashboard-side">
          {/* Top Products */}
          <div className="dashboard-card products-card">
            <div className="card-header">
              <h3>Top Selling Products</h3>
              <button className="view-all-btn">
                <FiEye size={14} />
              </button>
            </div>
            {topProducts.length > 0 ? (
              <ul className="top-products-list">
                {topProducts.map(product => (
                  <li key={product.id}>
                    <div className="product-info">
                      <h4>{product.name}</h4>
                      <p>{product.sales} Sales</p>
                    </div>
                    <div className="product-revenue">{product.revenue}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">No product sales data available</div>
            )}
          </div>

          {/* Alerts */}
          <div className="dashboard-card alerts-card">
            <div className="card-header">
              <h3>Alerts</h3>
            </div>
            {alerts.length > 0 ? (
              <ul className="alerts-list">
                {alerts.map(alert => (
                  <li key={alert.id} className={`alert-item ${alert.type}`}>
                    <FiAlertCircle size={16} />
                    <span>{alert.message}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">No alerts at this time</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Add the default prop to prevent errors if the prop isn't passed
Dashboard.defaultProps = {
  onNavigateToTab: () => console.log('Navigation handler not provided to Dashboard')
};

export default Dashboard;
