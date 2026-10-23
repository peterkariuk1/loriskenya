import { collection, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig.js";
import { REVIEW_LINK_MAX_PER_CLIENT } from "./reviewConfig.js";

export const shouldIncludeReviewLink = async (sale) => {
  if (sale?.reviewLinkIncluded === true) return true;
  if (!sale?.customerPhone || !sale?.id) return false;

  try {
    const reviewOrders = await getDocs(query(
      collection(db, "orders"),
      where("customerPhone", "==", sale.customerPhone),
      where("orderMethod", "==", "pos"),
      where("reviewLinkIncluded", "==", true),
      limit(REVIEW_LINK_MAX_PER_CLIENT)
    ));
    if (reviewOrders.docs.some((reviewOrder) => reviewOrder.id === sale.id)) return true;
    if (reviewOrders.size >= REVIEW_LINK_MAX_PER_CLIENT) return false;
    await updateDoc(doc(db, "orders", sale.id), { reviewLinkIncluded: true });
    return true;
  } catch (error) {
    console.error("Unable to determine review-link eligibility:", error);
    return false;
  }
};
