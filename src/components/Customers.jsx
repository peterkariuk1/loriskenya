import { useState, useEffect } from 'react';
import { db } from '../../firebase/firebaseConfig';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import '../styles/customers.css';
import { FiSearch, FiUser, FiMail, FiPhone, FiShoppingBag, FiCalendar, FiFilter, FiEye, FiArrowDown, FiArrowUp } from 'react-icons/fi';

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ field: 'joinDate', direction: 'desc' });

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true);
        const customersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(customersQuery);

        const customersData = await Promise.all(
          querySnapshot.docs.map(async (doc) => {
            const userData = doc.data();
            const userId = doc.id;

            let ltv = 0;
            let orderCount = 0;

            try {
              const ordersSnapshot = await getDocs(collection(db, 'users', userId, 'orders'));

              ordersSnapshot.forEach(orderDoc => {
                const orderData = orderDoc.data();
                if (orderData.total) {
                  const orderTotal = parseFloat(orderData.total);
                  if (!isNaN(orderTotal)) {
                    ltv += orderTotal;
                  }
                }
              });

              orderCount = ordersSnapshot.size;
            } catch (err) {
              console.error(`Error fetching orders for user ${userId}:`, err);
            }

            return {
              id: userId,
              ...userData,
              joinDate: userData.createdAt ? new Date(userData.createdAt.seconds * 1000) : new Date(),
              ltv: ltv,
              orderCount: orderCount
            };
          })
        );

        setCustomers(customersData);
        setFilteredCustomers(customersData);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching customers:", err);
        setError("Failed to load customer data. Please try again.");
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  useEffect(() => {
    let result = customers;

    if (activeFilter === 'recent') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      result = result.filter(customer => customer.joinDate > oneMonthAgo);
    } else if (activeFilter === 'highValue') {
      result = result.filter(customer => customer.ltv > 5000);
    }

    if (searchTerm) {
      const lowercaseTerm = searchTerm.toLowerCase();
      result = result.filter(customer =>
        customer.firstName?.toLowerCase().includes(lowercaseTerm) ||
        customer.lastName?.toLowerCase().includes(lowercaseTerm) ||
        `${customer.firstName || ''} ${customer.lastName || ''}`.toLowerCase().includes(lowercaseTerm) ||
        customer.email?.toLowerCase().includes(lowercaseTerm) ||
        customer.phone?.toLowerCase().includes(lowercaseTerm) ||
        customer.address?.toLowerCase().includes(lowercaseTerm)
      );
    }

    if (sortConfig.field) {
      result = [...result].sort((a, b) => {
        if (sortConfig.field === 'name') {
          const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim().toLowerCase();
          const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim().toLowerCase();

          if (nameA < nameB) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (nameA > nameB) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        } else {
          if (a[sortConfig.field] < b[sortConfig.field]) {
            return sortConfig.direction === 'asc' ? -1 : 1;
          }
          if (a[sortConfig.field] > b[sortConfig.field]) {
            return sortConfig.direction === 'asc' ? 1 : -1;
          }
          return 0;
        }
      });
    }

    setFilteredCustomers(result);
  }, [searchTerm, activeFilter, sortConfig, customers]);

  const handleSort = (field) => {
    setSortConfig(prevConfig => ({
      field,
      direction: prevConfig.field === field && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const viewCustomerDetails = (customer) => {
    setSelectedCustomer(customer);
    setShowModal(true);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="customers-container">
      <div className="customers-header">
        <div className="header-title">
          <h2>Customers</h2>
          <p>Manage and view customer information</p>
        </div>

        <div className="header-actions">
          <div className="search-container">
            <FiSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="filter-dropdown">
            <button className="filter-button">
              <FiFilter /> Filter
            </button>
            <div className="filter-menu">
              <button
                className={activeFilter === 'all' ? 'active' : ''}
                onClick={() => setActiveFilter('all')}
              >
                All Customers
              </button>
              <button
                className={activeFilter === 'recent' ? 'active' : ''}
                onClick={() => setActiveFilter('recent')}
              >
                New (Last 30 days)
              </button>
              <button
                className={activeFilter === 'highValue' ? 'active' : ''}
                onClick={() => setActiveFilter('highValue')}
              >
                High Value
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="customers-stats">
        <div className="stat-card">
          <div className="stat-icon customers-icon">
            <FiUser />
          </div>
          <div className="stat-details">
            <h3>Total Customers</h3>
            <p>{customers.length}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon calender-icon">
            <FiCalendar />
          </div>
          <div className="stat-details">
            <h3>New This Month</h3>
            <p>
              {customers.filter(c => {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                return c.joinDate > oneMonthAgo;
              }).length}
            </p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon revenue-icon">
            <FiShoppingBag />
          </div>
          <div className="stat-details">
            <h3>Avg. Lifetime Value</h3>
            <p>
              {customers.length ?
                `KSh ${(customers.reduce((sum, c) => sum + c.ltv, 0) / customers.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}` :
                'KSh 0'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading customer data...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>{error}</p>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state">
          <FiUser size={48} />
          <h3>No customers found</h3>
          <p>Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <div className="customers-table-container">
          <table className="customers-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')}>
                  Customer
                  {sortConfig.field === 'name' && (
                    sortConfig.direction === 'asc' ? <FiArrowUp /> : <FiArrowDown />
                  )}
                </th>
                <th>Contact</th>
                <th onClick={() => handleSort('joinDate')}>
                  Joined
                  {sortConfig.field === 'joinDate' && (
                    sortConfig.direction === 'asc' ? <FiArrowUp /> : <FiArrowDown />
                  )}
                </th>
                <th onClick={() => handleSort('ltv')}>
                  Lifetime Value
                  {sortConfig.field === 'ltv' && (
                    sortConfig.direction === 'asc' ? <FiArrowUp /> : <FiArrowDown />
                  )}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map(customer => (
                <tr key={customer.id}>
                  <td className="customer-name-cell">
                    <div className="customer-avatar">
                      {customer.firstName
                        ? customer.firstName.charAt(0).toUpperCase()
                        : (customer.lastName
                          ? customer.lastName.charAt(0).toUpperCase()
                          : "?")}
                    </div>
                    <div>
                      <div className="customer-name">
                        {(customer.firstName || customer.lastName)
                          ? `${customer.firstName || ''} ${customer.lastName || ''}`.trim()
                          : 'Guest User'}
                      </div>
                      <div className="customer-id">{customer.id}</div>
                    </div>
                  </td>
                  <td className="contact-cell">
                    <div className="contact-info">
                      <FiMail /> <span>{customer.email || 'N/A'}</span>
                    </div>
                    <div className="contact-info">
                      <FiPhone /> <span>{customer.phone || 'N/A'}</span>
                    </div>
                  </td>
                  <td>{formatDate(customer.joinDate)}</td>
                  <td>KSh {customer.ltv.toLocaleString()}</td>
                  <td>
                    <button
                      className="view-details-btn"
                      onClick={() => viewCustomerDetails(customer)}
                    >
                      <FiEye /> Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="customer-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="customer-modal-avatar">
                {selectedCustomer.firstName
                  ? selectedCustomer.firstName.charAt(0).toUpperCase()
                  : (selectedCustomer.lastName
                    ? selectedCustomer.lastName.charAt(0).toUpperCase()
                    : "?")}
              </div>
              <div>
                <h3>
                  {(selectedCustomer.firstName || selectedCustomer.lastName)
                    ? `${selectedCustomer.firstName || ''} ${selectedCustomer.lastName || ''}`.trim()
                    : 'Guest User'}
                </h3>
                <p className="customer-since">Customer since {formatDate(selectedCustomer.joinDate)}</p>
              </div>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h4>Contact Information</h4>
                <div className="detail-row">
                  <div className="detail-label">
                    <FiMail /> Email
                  </div>
                  <div className="detail-value">
                    {selectedCustomer.email || 'Not provided'}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">
                    <FiPhone /> Phone
                  </div>
                  <div className="detail-value">
                    {selectedCustomer.phone || 'Not provided'}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Account History</h4>
                <div className="detail-row">
                  <div className="detail-label">Total Orders</div>
                  <div className="detail-value">
                    {selectedCustomer.orderCount || 0}
                  </div>
                </div>
                <div className="detail-row">
                  <div className="detail-label">Lifetime Spend</div>
                  <div className="detail-value">
                    KSh {selectedCustomer.ltv.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="close-btn" onClick={() => setShowModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;