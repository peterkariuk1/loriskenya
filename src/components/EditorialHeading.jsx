import { createElement } from "react";

const EditorialHeading = ({ as = "h2", className = "", children }) =>
  createElement(
    as,
    { className: `editorial-heading ${className}`.trim() },
    <span>{children}</span>,
    <svg
      className="editorial-heading-underline"
      viewBox="0 0 180 14"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 8.5c27-3.5 50 1.7 77-.2 29-2.1 57-2.7 97-1.1" />
    </svg>,
  );

export default EditorialHeading;
