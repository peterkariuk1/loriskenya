import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig.js";
import { createProductStore } from "./productStoreCore.js";

const store = createProductStore(async () => {
  const snapshot = await getDocs(query(collection(db, "products"), orderBy("createdAt", "desc"), limit(1000)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
});

export const getProducts = () => store.getProducts();
export const getCachedProducts = () => store.isExpired() ? [] : store.peek() || [];
export const invalidateProducts = () => store.invalidate();
export const refreshProducts = () => store.forceRefresh();
export const getCachedProduct = (id) => (store.peek() || []).find((product) => product.id === id) || null;
export const updateCachedProduct = (product) => {
  const cached = store.peek();
  if (cached) {
    const index = cached.findIndex((item) => item.id === product.id);
    if (index >= 0) cached[index] = product;
  }
};
