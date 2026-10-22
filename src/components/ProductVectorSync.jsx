import { useState } from "react";
import { collection, getDocs, serverTimestamp, writeBatch, doc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { buildProductVector, VECTOR_VERSION, VECTOR_LABELS } from "../utils/productVector.js";

const BATCH_SIZE = 400;

const ProductVectorSync = () => {
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);

  const syncVectors = async () => {
    setRunning(true);
    setSummary(null);
    try {
      const snapshot = await getDocs(collection(db, "products"));
      const products = snapshot.docs.map((productDoc) => ({ id: productDoc.id, ...productDoc.data() }));
      const result = { updated: 0, skipped: 0, failed: [] };
      let processed = 0;
      setProgress({ processed: 0, total: products.length });

      for (let start = 0; start < products.length; start += BATCH_SIZE) {
        const batch = writeBatch(db);
        let writes = 0;
        for (const product of products.slice(start, start + BATCH_SIZE)) {
          try {
            const vector = buildProductVector(product);
            if (!force && product.vecVersion === VECTOR_VERSION
              && Array.isArray(product.vec) && product.vec.length === VECTOR_LABELS.length) {
              result.skipped += 1;
              continue;
            }
            batch.update(doc(db, "products", product.id), {
              vec: vector,
              vecVersion: VECTOR_VERSION,
              vecUpdatedAt: serverTimestamp(),
            });
            writes += 1;
            result.updated += 1;
          } catch (error) {
            result.failed.push({ id: product.id, error: error.message || String(error) });
          }
          processed += 1;
          setProgress({ processed, total: products.length });
        }
        if (writes) await batch.commit();
      }
      setProgress({ processed: products.length, total: products.length });
      setSummary(result);
    } catch (error) {
      setSummary({ updated: 0, skipped: 0, failed: [{ id: "collection", error: error.message || String(error) }] });
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="admin-vector-sync">
      <h2>Sync product vectors</h2>
      <p>Temporary one-time backfill for existing product documents.</p>
      <label>
        <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} disabled={running} />
        Force recompute all
      </label>
      <button type="button" onClick={syncVectors} disabled={running}>
        {running ? "Syncing..." : "Sync product vectors"}
      </button>
      {progress && <p>Processed {progress.processed}/{progress.total}</p>}
      {summary && (
        <div>
          <p>Updated: {summary.updated}; Skipped: {summary.skipped}; Failed: {summary.failed.length}</p>
          {summary.failed.length > 0 && (
            <ul>
              {summary.failed.map(({ id, error }) => <li key={id}>{id}: {error}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

export default ProductVectorSync;
