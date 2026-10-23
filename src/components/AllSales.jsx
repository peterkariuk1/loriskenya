import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { FiMessageCircle, FiRefreshCw } from "react-icons/fi";
import { db } from "../../firebase/firebaseConfig";
import { toWhatsAppPhone } from "../utils/phone";
import { getReceiptGreeting } from "../utils/receipt.js";
import { REVIEW_URL } from "../utils/reviewConfig.js";
import { shouldIncludeReviewLink } from "../utils/reviewLink.js";
import "../styles/sales.css";

const formatPrice = (value) => `KSh ${Number(value || 0).toLocaleString()}`;

const formatDate = (value) => {
  if (!value) return "—";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
};

const createMessage = (sale, includeReviewLink = false) => {
  const items = (sale.items || []).map((item) => `${item.name} x${item.quantity}`).join(", ");
  const reviewLine = includeReviewLink
    ? `\n\nEnjoyed shopping with us? Rate us here: ${REVIEW_URL}`
    : "";
  return `${getReceiptGreeting(sale.customerName)} thank you for shopping with Loris Kenya! Your receipt ${sale.receiptNumber} is ready.\n\nItems: ${items}\nTotal: ${formatPrice(sale.total)}${reviewLine}`;
};

function AllSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSales = async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, "orders"), orderBy("createdAt", "desc")));
      setSales(snapshot.docs
        .map((sale) => ({ id: sale.id, ...sale.data() }))
        .filter((sale) => sale.orderMethod === "pos"));
      setError("");
    } catch (loadError) {
      console.error("Unable to load sales:", loadError);
      setError("Unable to load sales history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const openWhatsApp = async (sale) => {
    if (!sale.customerPhone) return;
    const whatsappPhone = toWhatsAppPhone(sale.customerPhone);
    if (!whatsappPhone) return;
    const includeReviewLink = await shouldIncludeReviewLink(sale);
    if (includeReviewLink) {
      setSales((current) => current.map((item) => (
        item.id === sale.id ? { ...item, reviewLinkIncluded: true } : item
      )));
    }
    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(createMessage(sale, includeReviewLink))}`, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="sales-page">
      <div className="sales-header">
        <div><h2>All Sales</h2><p>Review completed point-of-sale transactions and receipts.</p></div>
        <button type="button" className="sales-refresh-button" onClick={loadSales}><FiRefreshCw /> Refresh</button>
      </div>
      {error && <div className="sales-message error">{error}</div>}
      {loading ? <p>Loading sales...</p> : sales.length === 0 ? <p>No POS sales recorded yet.</p> : (
        <div className="sales-history-table">
          <table>
            <thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Payment</th><th>Total</th><th>Receipt</th></tr></thead>
            <tbody>{sales.map((sale) => <tr key={sale.id}>
              <td>{sale.receiptNumber}</td>
              <td>{formatDate(sale.createdAt)}</td>
              <td>{sale.customerName || "Walk-in"}<small>{sale.customerPhone || ""}</small></td>
              <td>{String(sale.paymentMethod || "—").toUpperCase()}</td>
              <td>{formatPrice(sale.total)}</td>
              <td>{sale.customerPhone ? <button type="button" className="receipt-action" onClick={() => openWhatsApp(sale)}><FiMessageCircle /> WhatsApp</button> : "No phone"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AllSales;
