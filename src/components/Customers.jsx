import { useEffect, useMemo, useState } from 'react';
import '../styles/customers.css';
import {
  collection,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  doc,
  where
} from 'firebase/firestore';
import { db } from '../../firebase/firebaseConfig';
import { isValidLocalKenyanPhone, normalizeKenyanPhone } from '../utils/phone';
import {
  FiArrowDown,
  FiArrowUp,
  FiCalendar,
  FiCheckCircle,
  FiEye,
  FiFilter,
  FiPhone,
  FiPlus,
  FiSearch,
  FiShoppingBag,
  FiUser,
  FiX
} from 'react-icons/fi';

const REPORTING_PERIODS = [
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
  { value: 'year', label: 'Year' },
  { value: 'custom', label: 'Custom Range' },
  { value: 'all', label: 'All Time' }
];

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getDateRange = (period, monthValue, dayValue, yearValue, startValue, endValue) => {
  if (period === 'all') return null;

  if (period === 'month') {
    const [year, month] = monthValue.split('-').map(Number);
    return { start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
  }

  if (period === 'day') {
    const start = new Date(`${dayValue}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  if (period === 'year') {
    const year = Number(yearValue);
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
  }

  if (period === 'custom' && startValue && endValue) {
    const start = new Date(`${startValue}T00:00:00`);
    const end = new Date(`${endValue}T00:00:00`);
    end.setDate(end.getDate() + 1);
    return { start, end };
  }

  return null;
};

const isEligibleOrder = (order) => order.status !== 'cancelled' && order.status !== 'refunded';

function Customers() {
  const today = new Date();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [formMessage, setFormMessage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ field: 'joinDate', direction: 'desc' });
  const [period, setPeriod] = useState('all');
  const [monthValue, setMonthValue] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  );
  const [dayValue, setDayValue] = useState(today.toISOString().slice(0, 10));
  const [yearValue, setYearValue] = useState(String(today.getFullYear()));
  const [startValue, setStartValue] = useState('');
  const [endValue, setEndValue] = useState('');
  const [clientForm, setClientForm] = useState({ whatsappNumber: '', firstName: '', secondName: '' });

  const dateRange = useMemo(
    () => getDateRange(period, monthValue, dayValue, yearValue, startValue, endValue),
    [period, monthValue, dayValue, yearValue, startValue, endValue]
  );

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const [usersSnapshot, ordersSnapshot] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'orders'))
      ]);

      const ordersData = ordersSnapshot.docs.map((orderDoc) => ({
        id: orderDoc.id,
        ...orderDoc.data(),
        date: toDate(orderDoc.data().createdAt)
      }));
      const ordersByUser = ordersData.reduce((result, order) => {
        const customerId = order.customerId || (order.userId !== 'guest' && order.userId);
        if (customerId) {
          result[customerId] = [...(result[customerId] || []), order];
        }
        return result;
      }, {});

      const customerData = usersSnapshot.docs
        .filter((userDoc) => userDoc.data().role !== 'admin')
        .map((userDoc) => {
          const data = userDoc.data();
          const customerOrders = ordersByUser[userDoc.id] || [];
          const eligibleOrders = customerOrders.filter(isEligibleOrder);
          const lifetimeValue = eligibleOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
          const joinDate = toDate(data.createdAt) || new Date(0);
              const storedPhone = normalizeKenyanPhone(data.whatsappNumber || data.phone || '')
            || data.whatsappNumber || data.phone || '';
          const loyaltyPoints = Number.isFinite(Number(data.loyaltyPoints))
            ? Number(data.loyaltyPoints)
            : Math.floor(lifetimeValue / 100);

          return {
            id: userDoc.id,
            ...data,
            whatsappNumber: storedPhone,
            joinDate,
            orders: customerOrders.sort((a, b) => (b.date || 0) - (a.date || 0)),
            orderCount: eligibleOrders.length,
            lifetimeValue,
            loyaltyPoints
          };
        });

      setCustomers(customerData);
    } catch (loadError) {
      console.error('Error fetching customers:', loadError);
      setError('Failed to load customer data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const customersWithPeriodMetrics = useMemo(() => customers.map((customer) => {
    const periodOrders = customer.orders.filter((order) => {
      if (!isEligibleOrder(order) || !dateRange || !order.date) return dateRange === null && isEligibleOrder(order);
      return order.date >= dateRange.start && order.date < dateRange.end;
    });
    return {
      ...customer,
      periodOrders,
      periodRevenue: periodOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
    };
  }), [customers, dateRange]);

  const filteredCustomers = useMemo(() => {
    let result = customersWithPeriodMetrics.filter((customer) => (
      dateRange === null ||
      customer.periodOrders.length > 0 ||
      (customer.joinDate >= dateRange.start && customer.joinDate < dateRange.end)
    ));
    if (activeFilter === 'recent') {
      const currentDate = new Date();
      const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      result = result.filter((customer) => customer.joinDate >= monthStart);
    } else if (activeFilter === 'highValue') {
      result = result.filter((customer) => customer.lifetimeValue > 5000);
    }

    const term = searchTerm.trim().toLowerCase();
    if (term) {
      result = result.filter((customer) => (
        `${customer.firstName || ''} ${customer.secondName || customer.lastName || ''}`.toLowerCase().includes(term) ||
        (customer.whatsappNumber || '').toLowerCase().includes(term) ||
        (customer.phone || '').toLowerCase().includes(term) ||
        (customer.email || '').toLowerCase().includes(term)
      ));
    }

    return [...result].sort((a, b) => {
      const first = sortConfig.field === 'name'
        ? `${a.firstName || ''} ${a.secondName || a.lastName || ''}`.toLowerCase()
        : a[sortConfig.field];
      const second = sortConfig.field === 'name'
        ? `${b.firstName || ''} ${b.secondName || b.lastName || ''}`.toLowerCase()
        : b[sortConfig.field];
      if (first < second) return sortConfig.direction === 'asc' ? -1 : 1;
      if (first > second) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [customersWithPeriodMetrics, activeFilter, searchTerm, sortConfig, dateRange]);

  const summary = useMemo(() => {
    const newClients = customersWithPeriodMetrics.filter((customer) => (
      dateRange && customer.joinDate >= dateRange.start && customer.joinDate < dateRange.end
    )).length;
    const periodRevenue = customersWithPeriodMetrics.reduce((sum, customer) => sum + customer.periodRevenue, 0);
    return {
      newClients,
      periodRevenue,
      averageLifetimeValue: customers.length
        ? customers.reduce((sum, customer) => sum + customer.lifetimeValue, 0) / customers.length
        : 0
    };
  }, [customersWithPeriodMetrics, customers, dateRange]);

  const handleSort = (field) => {
    setSortConfig((previous) => ({
      field,
      direction: previous.field === field && previous.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const closeOverlays = () => {
    setShowDetails(false);
    setShowAddClient(false);
    setSelectedCustomer(null);
    setFormMessage(null);
    setClientForm({ whatsappNumber: '', firstName: '', secondName: '' });
  };

  const handleCreateClient = async (event) => {
    event.preventDefault();
    setFormMessage(null);
    const normalizedPhone = normalizeKenyanPhone(clientForm.whatsappNumber.trim(), { allowInternational: false });
    if (!normalizedPhone) {
      setFormMessage({ type: 'error', text: 'Enter a valid Kenyan WhatsApp number, for example 0712345678.' });
      return;
    }
    if (!clientForm.firstName.trim()) {
      setFormMessage({ type: 'error', text: 'First name is required.' });
      return;
    }

    const existingClient = customers.find((customer) => (
      normalizeKenyanPhone(customer.whatsappNumber || customer.phone || '') === normalizedPhone
    ));
    if (existingClient) {
      setFormMessage({
        type: 'duplicate',
        text: `A client with this number already exists: ${existingClient.firstName || 'Unnamed client'}.`
      });
      return;
    }

    try {
      setSaving(true);
      const existingSnapshot = await getDocs(query(
        collection(db, 'users'),
        where('whatsappNumber', '==', normalizedPhone)
      ));
      if (!existingSnapshot.empty) {
        setFormMessage({ type: 'duplicate', text: 'A client with this WhatsApp number already exists.' });
        return;
      }

      const clientId = `client_${normalizedPhone.slice(1)}`;
      await setDoc(doc(db, 'users', clientId), {
        uid: clientId,
        firstName: clientForm.firstName.trim(),
        secondName: clientForm.secondName.trim(),
        whatsappNumber: normalizedPhone,
        phone: normalizedPhone,
        role: 'customer',
        source: 'internal-client',
        loyaltyPoints: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await loadCustomers();
      closeOverlays();
    } catch (saveError) {
      console.error('Error creating client:', saveError);
      setFormMessage({ type: 'error', text: 'The client could not be created. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleClientPhoneChange = (event) => {
    const nextValue = event.target.value;
    if (!/^\d*$/.test(nextValue) || nextValue.length > 10) {
      setFormMessage({ type: 'error', text: 'Use only digits, up to 10 characters, starting with 07 or 01.' });
      return;
    }
    if (nextValue && nextValue[0] !== '0') {
      setFormMessage({ type: 'error', text: 'Kenyan numbers must start with 07 or 01.' });
      return;
    }
    if (nextValue.length > 1 && !['1', '7'].includes(nextValue[1])) {
      setFormMessage({ type: 'error', text: 'Kenyan numbers must start with 07 or 01.' });
      return;
    }
    setClientForm({ ...clientForm, whatsappNumber: nextValue });
    if (nextValue && nextValue.length === 10 && !isValidLocalKenyanPhone(nextValue)) {
      setFormMessage({ type: 'error', text: 'The number must be 10 digits and start with 07 or 01.' });
    } else {
      setFormMessage(null);
    }
  };

  const formatCurrency = (value) => `KSh ${Math.round(value || 0).toLocaleString('en-KE')}`;
  const formatDate = (value) => value && value.getTime() > 0
    ? value.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'N/A';
  const customerName = (customer) => `${customer.firstName || ''} ${customer.secondName || customer.lastName || ''}`.trim() || 'Unnamed client';
  const sortIcon = (field) => sortConfig.field === field
    ? (sortConfig.direction === 'asc' ? <FiArrowUp /> : <FiArrowDown />)
    : null;

  return (
    <div className="customers-container">
      <div className="customers-header">
        <div className="header-title">
          <h2>Clients</h2>
          <p>Manage client records and purchase activity.</p>
        </div>
        <div className="header-actions">
          <button className="add-client-button" onClick={() => setShowAddClient(true)}>
            <FiPlus /> Add Client
          </button>
          <div className="search-container">
            <FiSearch className="search-icon" />
            <input
              aria-label="Search clients"
              type="search"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <div className="filter-dropdown">
            <button className="filter-button"><FiFilter /> Filter</button>
            <div className="filter-menu">
              {[
                ['all', 'All Clients'],
                ['recent', 'New This Month'],
                ['highValue', 'High Value']
              ].map(([value, label]) => (
                <button key={value} className={activeFilter === value ? 'active' : ''} onClick={() => setActiveFilter(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="reporting-controls">
        <span className="reporting-label">Reporting period</span>
        <div className="period-tabs">
          {REPORTING_PERIODS.map((option) => (
            <button key={option.value} className={period === option.value ? 'active' : ''} onClick={() => setPeriod(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
        {period === 'month' && <input type="month" aria-label="Select month" value={monthValue} onChange={(event) => setMonthValue(event.target.value)} />}
        {period === 'day' && <input type="date" aria-label="Select day" value={dayValue} onChange={(event) => setDayValue(event.target.value)} />}
        {period === 'year' && <input type="number" aria-label="Select year" min="2000" max="2100" value={yearValue} onChange={(event) => setYearValue(event.target.value)} />}
        {period === 'custom' && (
          <div className="custom-date-fields">
            <input type="date" aria-label="Start date" value={startValue} onChange={(event) => setStartValue(event.target.value)} />
            <span>to</span>
            <input type="date" aria-label="End date" value={endValue} onChange={(event) => setEndValue(event.target.value)} />
          </div>
        )}
      </div>

      <div className="customers-stats">
        <div className="stat-card"><div className="stat-icon customers-icon"><FiUser /></div><div className="stat-details"><h3>Total Clients</h3><p>{customers.length}</p></div></div>
        <div className="stat-card"><div className="stat-icon calender-icon"><FiCalendar /></div><div className="stat-details"><h3>New in Period</h3><p>{summary.newClients}</p></div></div>
        <div className="stat-card"><div className="stat-icon revenue-icon"><FiShoppingBag /></div><div className="stat-details"><h3>Period Client Sales</h3><p>{formatCurrency(summary.periodRevenue)}</p></div></div>
        <div className="stat-card"><div className="stat-icon loyalty-icon"><FiCheckCircle /></div><div className="stat-details"><h3>Avg. Lifetime Value</h3><p>{formatCurrency(summary.averageLifetimeValue)}</p></div></div>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" /><p>Loading client data...</p></div>
      ) : error ? (
        <div className="error-state"><p>{error}</p></div>
      ) : filteredCustomers.length === 0 ? (
        <div className="empty-state"><FiUser size={48} /><h3>No clients found</h3><p>Try adjusting your search or reporting filters.</p></div>
      ) : (
        <div className="customers-table-container">
          <table className="customers-table">
            <thead><tr>
              <th onClick={() => handleSort('name')}>Client {sortIcon('name')}</th>
              <th>WhatsApp Number</th>
              <th>Orders</th>
              <th onClick={() => handleSort('lifetimeValue')}>Lifetime Value {sortIcon('lifetimeValue')}</th>
              <th>Loyalty Points</th>
              <th onClick={() => handleSort('joinDate')}>Joined {sortIcon('joinDate')}</th>
              <th>Actions</th>
            </tr></thead>
            <tbody>{filteredCustomers.map((customer) => (
              <tr key={customer.id}>
                <td className="customer-name-cell"><div className="customer-avatar">{(customer.firstName || '?').charAt(0).toUpperCase()}</div><div><div className="customer-name">{customerName(customer)}</div><div className="customer-id">{customer.id}</div></div></td>
                <td><div className="contact-info"><FiPhone /> {customer.whatsappNumber || customer.phone || 'Not provided'}</div></td>
                <td>{customer.periodOrders.length} <span className="period-hint">({customer.orderCount} all time)</span></td>
                <td>{formatCurrency(dateRange ? customer.periodRevenue : customer.lifetimeValue)}{dateRange && <div className="period-hint">in selected period</div>}</td>
                <td>{customer.loyaltyPoints.toLocaleString('en-KE')}</td>
                <td>{formatDate(customer.joinDate)}</td>
                <td><button className="view-details-btn" onClick={() => { setSelectedCustomer(customer); setShowDetails(true); }}><FiEye /> Details</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {(showDetails && selectedCustomer) && (
        <div className="modal-backdrop" onClick={closeOverlays}>
          <div className="customer-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div className="customer-modal-avatar">{(selectedCustomer.firstName || '?').charAt(0).toUpperCase()}</div><div><h3>{customerName(selectedCustomer)}</h3><p className="customer-since">Client since {formatDate(selectedCustomer.joinDate)}</p></div><button className="modal-close" onClick={closeOverlays} aria-label="Close details"><FiX /></button></div>
            <div className="modal-body">
              <div className="detail-section"><h4>Client Information</h4><div className="detail-row"><div className="detail-label"><FiPhone /> WhatsApp</div><div className="detail-value">{selectedCustomer.whatsappNumber || selectedCustomer.phone || 'Not provided'}</div></div><div className="detail-row"><div className="detail-label">Lifetime Spend</div><div className="detail-value">{formatCurrency(selectedCustomer.lifetimeValue)}</div></div><div className="detail-row"><div className="detail-label">Loyalty Points</div><div className="detail-value">{selectedCustomer.loyaltyPoints.toLocaleString('en-KE')}</div></div></div>
              <div className="detail-section"><h4>Purchase History</h4>{selectedCustomer.orders.length === 0 ? <p className="history-empty">No purchases recorded for this client.</p> : <div className="purchase-history">{selectedCustomer.orders.map((order) => <div className="purchase-row" key={order.id}><div><strong>{order.id}</strong><span>{formatDate(order.date)}</span></div><strong>{formatCurrency(order.total)}</strong></div>)}</div>}</div>
            </div>
            <div className="modal-footer"><button className="close-btn" onClick={closeOverlays}>Close</button></div>
          </div>
        </div>
      )}

      {showAddClient && (
        <div className="modal-backdrop" onClick={closeOverlays}>
          <div className="customer-modal add-client-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header"><div><h3>Add Client</h3><p className="customer-since">Create a client record using their WhatsApp number.</p></div><button className="modal-close" onClick={closeOverlays} aria-label="Close add client form"><FiX /></button></div>
            <form onSubmit={handleCreateClient}>
              <div className="modal-body">
                {formMessage && <div className={`form-message ${formMessage.type}`} role="alert">{formMessage.text}{formMessage.type === 'duplicate' && <button type="button" onClick={() => { const match = customers.find((customer) => normalizeKenyanPhone(customer.whatsappNumber || customer.phone || '') === normalizeKenyanPhone(clientForm.whatsappNumber)); if (match) { setSelectedCustomer(match); setShowAddClient(false); setShowDetails(true); } }}>View existing client</button>}</div>}
                <label htmlFor="client-whatsapp">WhatsApp Number <span>*</span></label>
                <input id="client-whatsapp" type="tel" inputMode="numeric" maxLength={10} placeholder="0712345678" value={clientForm.whatsappNumber} onChange={handleClientPhoneChange} required />
                <label htmlFor="client-first-name">First Name <span>*</span></label>
                <input id="client-first-name" type="text" value={clientForm.firstName} onChange={(event) => setClientForm({ ...clientForm, firstName: event.target.value })} required />
                <label htmlFor="client-second-name">Second Name <small>(optional)</small></label>
                <input id="client-second-name" type="text" value={clientForm.secondName} onChange={(event) => setClientForm({ ...clientForm, secondName: event.target.value })} />
              </div>
              <div className="modal-footer"><button type="button" className="close-btn" onClick={closeOverlays}>Cancel</button><button type="submit" className="save-client-btn" disabled={saving}>{saving ? 'Saving...' : 'Save Client'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Customers;
