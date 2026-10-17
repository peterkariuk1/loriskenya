import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase/firebaseConfig.js";
import {
  OPT_OUT_STORAGE_KEY,
  CONSENT_STORAGE_KEY,
  PERSONALIZATION_WEIGHTS,
  PROFILE_STORAGE_KEY,
  SESSION_ID_STORAGE_KEY,
  VISITOR_ID_STORAGE_KEY,
} from "../utils/personalizationConfig";
import {
  addAffinity,
  getAudience,
  getVisitorStorage,
  readStoredProfile,
  saveStoredProfile,
} from "../utils/visitorProfile";
import { getPriceBand } from "../utils/personalization";

const VisitorContext = createContext(null);

const createId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getOrCreateId = (storage, key) => {
  const current = storage.getItem(key);
  if (current) return current;
  const next = createId();
  storage.setItem(key, next);
  return next;
};

export const VisitorProvider = ({ children }) => {
  const [visitorState, setVisitorState] = useState(null);
  const [optedOut, setOptedOut] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [userId, setUserId] = useState(null);
  const profileRef = useRef(null);
  const meaningfulRef = useRef(false);
  const flushedRef = useRef(false);

  useEffect(() => {
    const storage = getVisitorStorage();
    if (!storage) return;
    try {
      const visitorId = getOrCreateId(storage.local, VISITOR_ID_STORAGE_KEY);
      const sessionId = getOrCreateId(storage.session, SESSION_ID_STORAGE_KEY);
      const profile = readStoredProfile(visitorId, sessionId);
      const savedOptOut = storage.local.getItem(OPT_OUT_STORAGE_KEY) === "true";
      const savedConsent = storage.local.getItem(CONSENT_STORAGE_KEY) === "true";
      profileRef.current = profile;
      setOptedOut(savedOptOut);
      setConsentGiven(savedConsent);
      setVisitorState({ visitorId, sessionId, profile });
    } catch (error) {
      console.warn("Visitor personalization could not be initialized.", error);
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setUserId(user?.uid || null);
    if (profileRef.current && user?.uid) {
      profileRef.current = { ...profileRef.current, userId: user.uid };
      saveStoredProfile(profileRef.current);
      setVisitorState((current) => current ? { ...current, profile: profileRef.current } : current);
    }
  }), []);

  const updateProfile = useCallback((updater, meaningful = false) => {
    if (optedOut || !profileRef.current) return;
    const next = updater(profileRef.current);
    profileRef.current = next;
    meaningfulRef.current = meaningfulRef.current || meaningful;
    saveStoredProfile(next);
    setVisitorState((current) => current ? { ...current, profile: next } : current);
  }, [optedOut]);

  const trackEvent = useCallback((eventType, product) => {
    if (!product || optedOut || !profileRef.current || window.location.pathname.startsWith("/admin")) return;
    const timestamp = Date.now();
    const audience = getAudience(product);
    const category = product.category;
    const priceBand = getPriceBand(product.price);
    updateProfile((current) => {
      let next = current;
      if (eventType === "impression") {
        next = {
          ...next,
          seenWithoutClick: {
            ...next.seenWithoutClick,
            [product.id]: (next.seenWithoutClick[product.id] || 0) + 1,
          },
          lastUpdated: timestamp,
        };
        next = addAffinity(next, "audienceAffinity", audience, PERSONALIZATION_WEIGHTS.impression, timestamp);
        next = addAffinity(next, "categoryAffinity", category, PERSONALIZATION_WEIGHTS.impression, timestamp);
        next = addAffinity(next, "priceBandAffinity", priceBand, PERSONALIZATION_WEIGHTS.impression, timestamp);
      } else {
        const weight = {
          click: PERSONALIZATION_WEIGHTS.click,
          dwell: PERSONALIZATION_WEIGHTS.dwell,
          add_to_cart: PERSONALIZATION_WEIGHTS.addToCart,
          purchase: PERSONALIZATION_WEIGHTS.purchase,
        }[eventType];
        if (!weight) return next;
        next = addAffinity(next, "audienceAffinity", audience, weight, timestamp);
        next = addAffinity(next, "categoryAffinity", category, weight, timestamp);
        next = addAffinity(next, "priceBandAffinity", priceBand, weight, timestamp);
        next = {
          ...next,
          meaningfulActivity: {
            ...next.meaningfulActivity,
            clicks: next.meaningfulActivity.clicks + (eventType === "click" ? 1 : 0),
            addToCart: next.meaningfulActivity.addToCart + (eventType === "add_to_cart" ? 1 : 0),
            purchases: next.meaningfulActivity.purchases + (eventType === "purchase" ? 1 : 0),
            dwells: next.meaningfulActivity.dwells + (eventType === "dwell" ? 1 : 0),
          },
        };
        if (eventType === "purchase") {
          next.purchasedProductIds = [...new Set([...next.purchasedProductIds, product.id])];
        }
      }
      return next;
    }, eventType !== "impression");
  }, [optedOut, updateProfile]);

  const trackDwell = useCallback((product, dwellMs) => {
    if (dwellMs >= PERSONALIZATION_WEIGHTS.dwellThresholdMs) {
      trackEvent("dwell", product);
    }
  }, [trackEvent]);

  const setOptOut = useCallback((nextValue) => {
    const storage = getVisitorStorage();
    if (storage) storage.local.setItem(OPT_OUT_STORAGE_KEY, String(nextValue));
    setOptedOut(nextValue);
  }, []);

  const acknowledgeConsent = useCallback((nextOptOut) => {
    const storage = getVisitorStorage();
    if (storage) storage.local.setItem(CONSENT_STORAGE_KEY, "true");
    setConsentGiven(true);
    setOptOut(nextOptOut);
  }, [setOptOut]);

  const flushProfile = async () => {
    if (flushedRef.current || !meaningfulRef.current || optedOut || !profileRef.current || !visitorState) return;
    flushedRef.current = true;
    try {
      await setDoc(doc(db, "visitors", visitorState.visitorId), {
        ...profileRef.current,
        userId,
        profileVersion: profileRef.current.version,
        syncedAt: new Date(),
        source: "web-local-profile",
      }, { merge: true });
    } catch (error) {
      console.warn("Visitor personalization sync skipped.", error);
    }
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushProfile();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", flushProfile);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", flushProfile);
    };
  });

  const value = useMemo(() => ({
    visitorId: visitorState?.visitorId || null,
    sessionId: visitorState?.sessionId || null,
    profile: visitorState?.profile || null,
    optedOut,
    consentGiven,
    trackEvent,
    trackImpression: (product) => trackEvent("impression", product),
    trackClick: (product) => trackEvent("click", product),
    trackAddToCart: (product) => trackEvent("add_to_cart", product),
    trackPurchase: (product) => trackEvent("purchase", product),
    trackDwell,
    setOptOut,
    acknowledgeConsent,
  }), [visitorState, optedOut, consentGiven, acknowledgeConsent, setOptOut, trackDwell, trackEvent]);

  return <VisitorContext.Provider value={value}>{children}</VisitorContext.Provider>;
};

export const useVisitor = () => {
  const context = useContext(VisitorContext);
  if (!context) throw new Error("useVisitor must be used within VisitorProvider");
  return context;
};

export { PROFILE_STORAGE_KEY };
