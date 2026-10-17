import "../styles/loader.css";

const ProductSkeletons = ({ count = 6 }) => (
  <div className="storefront-skeleton-grid" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <div className="storefront-skeleton-card" key={index}>
        <div className="storefront-skeleton-image" />
        <div className="storefront-skeleton-line short" />
        <div className="storefront-skeleton-line" />
        <div className="storefront-skeleton-line tiny" />
      </div>
    ))}
  </div>
);

const StorefrontSkeleton = ({ fullPage = false }) => (
  <div className={fullPage ? "storefront-skeleton-page" : "storefront-skeleton-section"} aria-label="Loading content">
    {fullPage && (
      <>
        <div className="storefront-skeleton-header">
          <div className="storefront-skeleton-logo" />
          <div className="storefront-skeleton-nav" />
          <div className="storefront-skeleton-nav short" />
        </div>
        <div className="storefront-skeleton-hero">
          <div className="storefront-skeleton-hero-copy" />
        </div>
        <div className="storefront-skeleton-categories">
          <div /><div /><div /><div />
        </div>
      </>
    )}
    <ProductSkeletons count={fullPage ? 8 : 6} />
    {fullPage && <div className="storefront-skeleton-footer" />}
  </div>
);

export { ProductSkeletons };
export default StorefrontSkeleton;
