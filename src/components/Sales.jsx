import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  FiCheckCircle,
  FiMinus,
  FiPlus,
  FiSearch,
  FiShoppingCart,
  FiTrash2,
  FiMessageCircle
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import { BsCashCoin } from "react-icons/bs";
import { MdOutlineSendToMobile } from "react-icons/md";



import { db, auth } from "../../firebase/firebaseConfig";
import { getStockQuantity } from "../utils/inventory";
import { invalidateProducts } from "../data/productStore.js";
import { isValidLocalKenyanPhone, normalizeKenyanPhone, toWhatsAppPhone } from "../utils/phone";
import { getReceiptGreeting } from "../utils/receipt.js";
import { REVIEW_URL } from "../utils/reviewConfig.js";
import { shouldIncludeReviewLink } from "../utils/reviewLink.js";
import "../styles/sales.css";

const paymentMethods = [
  { value: "cash", label: "Cash", icon: <BsCashCoin/> },
  { value: "mpesa", label: "M-PESA", icon: <MdOutlineSendToMobile/> },
  { value: "card", label: "Card", icon: "💳" },
];

const getStock = getStockQuantity;

const formatPrice = (value) => `KSh ${Number(value || 0).toLocaleString()}`;

const createReceiptMessage = (sale, includeReviewLink = false) => {
  const items = sale.items.map((item) => `${item.name} x${item.quantity}`).join(", ");
  const reviewLine = includeReviewLink
    ? `\n\nEnjoyed shopping with us? Rate us here: ${REVIEW_URL}`
    : "";
  return `${getReceiptGreeting(sale.customerName)} thank you for shopping with Loris Kenya! Your receipt ${sale.receiptNumber} is ready.\n\nItems: ${items}\nTotal: ${formatPrice(sale.total)}\n\nWe appreciate your support.${reviewLine}`;
};

function Sales() {
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [phone, setPhone] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [whatsappReceipt, setWhatsappReceipt] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState(null);
  const [lastSale, setLastSale] = useState(null);
  const salesPageRef = useRef(null);

  const loadData = async () => {
    const [productSnapshot, customerSnapshot] = await Promise.all([
      getDocs(query(collection(db, "products"), orderBy("name"))),
      getDocs(query(collection(db, "users"), limit(500))),
    ]);
    setProducts(productSnapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    setCustomers(customerSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((customer) => customer.role !== "admin"));
  };

  useEffect(() => {
    loadData().catch((error) => {
      console.error("Unable to load POS data:", error);
      setMessage({ type: "error", text: "Unable to load products and customers." });
    });
  }, []);

  const categories = useMemo(
    () => ["all", ...new Set(products.map((product) => product.category).filter(Boolean))],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesSearch = !term || [product.name, product.category, product.sku, product.barcode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [products, search, category]);

  const visibleProducts = filteredProducts.slice(0, 8);

  const matchingCustomers = useMemo(() => {
    const term = phone.trim().toLowerCase();
    if (!term) return [];
    return customers.filter((customer) => [customer.whatsappNumber, customer.phone, customer.firstName, customer.secondName]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(term)))
      .slice(0, 5);
  }, [customers, phone]);

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const total = subtotal * (1 - discount / 100);

  const addProduct = (product) => {
    const stock = getStock(product);
    if (stock < 1) {
      setMessage({ type: "error", text: `${product.name} has no confirmed stock quantity.` });
      return;
    }
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= stock) return current;
        return current.map((item) => item.id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item);
      }
      return [...current, { id: product.id, name: product.name, price: Number(product.price) || 0, quantity: 1, stock }];
    });
  };

  const changeQuantity = (id, delta) => {
    setCart((current) => current.map((item) => {
      if (item.id !== id) return item;
      return { ...item, quantity: Math.min(item.stock, item.quantity + delta) };
    }).filter((item) => item.quantity > 0));
  };

  const selectCustomer = (customer) => {
    setSelectedCustomer(customer);
    setPhone(normalizeKenyanPhone(customer.whatsappNumber || customer.phone || "") || "");
  };

  const registerCustomer = async () => {
    const normalizedPhone = normalizeKenyanPhone(phone, { allowInternational: false });
    if (!normalizedPhone) {
      setMessage({ type: "error", text: "Use exactly 10 digits starting with 07 or 01. Other formats are not accepted." });
      return;
    }
    const [firstName = "", ...rest] = newCustomerName.trim().split(/\s+/);
    try {
      const customerRef = doc(db, "users", `client_${normalizedPhone.slice(1)}`);
      await setDoc(customerRef, {
        uid: customerRef.id,
        firstName,
        secondName: rest.join(" "),
        whatsappNumber: normalizedPhone,
        phone: normalizedPhone,
        role: "customer",
        source: "internal-client",
        loyaltyPoints: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      const customer = { id: customerRef.id, firstName, secondName: rest.join(" "), whatsappNumber: normalizedPhone };
      setCustomers((current) => [...current.filter((item) => item.id !== customer.id), customer]);
      setSelectedCustomer(customer);
      setNewCustomerName("");
      setMessage({ type: "success", text: "Customer registered and selected." });
    } catch (error) {
      console.error("Unable to register POS customer:", error);
      setMessage({ type: "error", text: "Customer could not be registered." });
    }
  };

  const completeSale = async () => {
    if (!cart.length || processing) return;
    if (phone && !isValidLocalKenyanPhone(phone)) {
      setMessage({ type: "error", text: "Use exactly 10 digits starting with 07 or 01. Other formats are not accepted." });
      return;
    }
    const normalizedPhone = normalizeKenyanPhone(phone, { allowInternational: false });
    setProcessing(true);
    setMessage(null);
    try {
      const receiptNumber = `POS-${Date.now()}`;
      const productSnapshots = await Promise.all(
        cart.map((item) => getDoc(doc(db, "products", item.id)))
      );
      const authoritativeItems = productSnapshots.map((snapshot, index) => {
          if (!snapshot.exists()) throw new Error("A product in this sale no longer exists.");
          const data = snapshot.data();
          const stock = getStock(data);
          const quantity = cart[index].quantity;
          if (stock < quantity) throw new Error(`${data.name} no longer has enough stock.`);
          return {
            id: snapshot.id,
            name: data.name || cart[index].name,
            category: data.category || "",
            image: data.image || "",
            price: Number(data.price) || 0,
            quantity,
            lineTotal: (Number(data.price) || 0) * quantity,
          };
        });
        const authoritativeSubtotal = authoritativeItems.reduce((sum, item) => sum + item.lineTotal, 0);
        const authoritativeDiscount = Math.min(100, Math.max(0, Number(discountPercent) || 0));
        const authoritativeTotal = authoritativeSubtotal * (1 - authoritativeDiscount / 100);
        const saleData = {
          receiptNumber,
          orderMethod: "pos",
          items: authoritativeItems,
          subtotal: authoritativeSubtotal,
          discount: authoritativeSubtotal - authoritativeTotal,
          discountPercent: authoritativeDiscount,
          total: authoritativeTotal,
          paymentMethod,
          paymentStatus: "confirmed",
          customerId: selectedCustomer?.id || null,
          customerName: selectedCustomer ? `${selectedCustomer.firstName || ""} ${selectedCustomer.secondName || selectedCustomer.lastName || ""}`.trim() : "Walk-in",
          customerPhone: normalizedPhone || null,
          whatsappReceiptRequested: whatsappReceipt,
          cashierId: auth.currentUser?.uid || null,
          createdAt: serverTimestamp(),
        };
      await Promise.all(authoritativeItems.map((item, index) => {
        const previousStock = getStock(productSnapshots[index].data());
        return updateDoc(doc(db, "products", item.id), {
          stockQuantity: previousStock - item.quantity,
          inStock: previousStock - item.quantity > 0,
        });
      }));
      invalidateProducts();
      const saleRef = await addDoc(collection(db, "orders"), saleData);
      const sale = { ...saleData, id: saleRef.id };
      setCart([]);
      setPhone("");
      setSelectedCustomer(null);
      setNewCustomerName("");
      setDiscountPercent(0);
      setSearch("");
      setCategory("all");
      setLastSale(sale);
      setMessage({ type: "success", text: `${sale.receiptNumber} completed successfully.` });
      requestAnimationFrame(() => {
        salesPageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      await loadData();
    } catch (error) {
      console.error("Unable to complete POS sale:", error);
      setMessage({ type: "error", text: error.message || "Sale could not be completed." });
    } finally {
      setProcessing(false);
    }
  };

  const openWhatsApp = async () => {
    if (!lastSale?.customerPhone) return;
    const whatsappPhone = toWhatsAppPhone(lastSale.customerPhone);
    if (!whatsappPhone) return;
    let includeReviewLink = lastSale.reviewLinkIncluded === true;
    if (!includeReviewLink) {
      includeReviewLink = await shouldIncludeReviewLink(lastSale);
      if (includeReviewLink) {
        setLastSale((current) => current ? { ...current, reviewLinkIncluded: true } : current);
      }
    }
    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(createReceiptMessage(lastSale, includeReviewLink))}`, "_blank", "noopener,noreferrer");
  };

  const handlePhoneChange = (event) => {
    const nextValue = event.target.value;
    if (!/^\d*$/.test(nextValue) || nextValue.length > 10) {
      setMessage({ type: "error", text: "Use only digits, up to 10 characters, starting with 07 or 01." });
      return;
    }
    if (nextValue && nextValue[0] !== "0") {
      setMessage({ type: "error", text: "Kenyan numbers must start with 07 or 01." });
      return;
    }
    if (nextValue.length > 1 && !["1", "7"].includes(nextValue[1])) {
      setMessage({ type: "error", text: "Kenyan numbers must start with 07 or 01." });
      return;
    }
    setPhone(nextValue);
    setSelectedCustomer(null);
    if (nextValue && nextValue.length === 10 && !isValidLocalKenyanPhone(nextValue)) {
      setMessage({ type: "error", text: "The number must be 10 digits and start with 07 or 01." });
    }
  };

  return (
    <div className="sales-page" ref={salesPageRef}>
      <div className="sales-header">
        <div><h2>Sales / POS</h2><p>Process an in-store sale and keep inventory accurate.</p></div>
        <div className={`receipt-toggle-card ${whatsappReceipt ? "enabled" : ""}`}>
          <div>
            <FaWhatsapp/>
            <strong>WhatsApp Receipt</strong>
            <small>{whatsappReceipt ? "ON" : "OFF"}</small>
          </div>
          <label className="receipt-toggle-switch">
            <input type="checkbox" checked={whatsappReceipt} onChange={(event) => setWhatsappReceipt(event.target.checked)} />
            <span aria-hidden="true" />
          </label>
        </div>
      </div>
      {message && <div className={`sales-message ${message.type}`}>{message.text}</div>}
      {lastSale && (
        <div className="sale-success">
          <FiCheckCircle /><span>{lastSale.receiptNumber} · {formatPrice(lastSale.total)}</span>
          {whatsappReceipt && lastSale.customerPhone && <button type="button" onClick={openWhatsApp}>Open WhatsApp Receipt</button>}
          <button type="button" onClick={() => setLastSale(null)}>Dismiss</button>
        </div>
      )}
      <div className="sales-layout">
        <section className="sales-products">
          <div className="sales-toolbar">
            <div className="sales-search"><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, SKU or barcode" /></div>
            <div className="sales-categories">{categories.map((item) => <button type="button" className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>{item === "all" ? "All" : item}</button>)}</div>
          </div>
          <div className="sales-product-grid">
            {visibleProducts.map((product) => {
              const stock = getStock(product);
              return <button type="button" className="sales-product-card" key={product.id} onClick={() => addProduct(product)} disabled={stock < 1}>
                <span className="sales-product-image">{product.image ? <img src={product.image} alt="" /> : "No image"}</span>
                <strong>{product.name}</strong><span>{formatPrice(product.price)}</span><small>{stock} units</small>
              </button>;
            })}
          </div>
        </section>
        <aside className="sales-cart">
          <h3><FiShoppingCart /> Current Sale</h3>
          <div className="customer-field"><label htmlFor="pos-phone">Customer WhatsApp / phone</label><input id="pos-phone" inputMode="numeric" maxLength={10} value={phone} onChange={handlePhoneChange} placeholder="Use 07... or 01..." /><small>Enter exactly 10 digits starting with 07 or 01.</small>
            {matchingCustomers.length > 0 && <div className="customer-suggestions">{matchingCustomers.map((customer) => <button type="button" key={customer.id} onClick={() => selectCustomer(customer)}>{customer.firstName} {customer.secondName || customer.lastName || ""}<small>{customer.whatsappNumber || customer.phone}</small></button>)}</div>}
            {phone && !selectedCustomer && matchingCustomers.length === 0 && <div className="new-customer"><input value={newCustomerName} onChange={(event) => setNewCustomerName(event.target.value)} placeholder="Optional customer name" /><button type="button" onClick={registerCustomer}>Register customer</button><small>Or continue as a walk-in.</small></div>}
          </div>
          {cart.length === 0 ? <p className="empty-sale">Add products to begin.</p> : cart.map((item) => <div className="sale-line" key={item.id}><div><strong>{item.name}</strong><span>{formatPrice(item.price)} each</span></div><div className="sale-line-controls"><button type="button" onClick={() => changeQuantity(item.id, -1)}><FiMinus /></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} disabled={item.quantity >= item.stock}><FiPlus /></button><button type="button" onClick={() => setCart((current) => current.filter((line) => line.id !== item.id))}><FiTrash2 /></button></div></div>)}
          <div className="payment-options"><strong>Payment method</strong>{paymentMethods.map((method) => <button type="button" key={method.value} className={paymentMethod === method.value ? "active" : ""} onClick={() => setPaymentMethod(method.value)}><span>{method.icon}</span>{method.label}</button>)}</div>
          <label className="discount-field">Discount (%)
            <input type="number" min="0" max="100" value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
          </label>
          <div className="sale-total"><span>Subtotal</span><strong>{formatPrice(subtotal)}</strong><span>Payable</span><strong>{formatPrice(total)}</strong></div>
          <button type="button" className="complete-sale-button" disabled={!cart.length || processing} onClick={completeSale}>{processing ? "Completing..." : "Complete Sale"}</button>
        </aside>
      </div>
    </div>
  );
}

export default Sales;
