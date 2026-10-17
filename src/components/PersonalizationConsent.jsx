import { useVisitor } from "../context/VisitorContext";
import "../styles/personalization.css";

const PersonalizationConsent = () => {
  const { optedOut, consentGiven, acknowledgeConsent } = useVisitor();
  if (optedOut || consentGiven) return null;

  return (
    <aside className="personalization-consent" aria-label="Personalized recommendations">
      <span>Use your browsing activity to tailor product recommendations?</span>
      <div className="personalization-consent-actions">
        <button
          type="button"
          className="personalization-consent-accept"
          onClick={() => acknowledgeConsent(false)}
        >
          Yes, improve my experience
        </button>
        <button
          type="button"
          className="personalization-consent-decline"
          onClick={() => acknowledgeConsent(true)}
        >
          No thanks
        </button>
      </div>
    </aside>
  );
};

export default PersonalizationConsent;
