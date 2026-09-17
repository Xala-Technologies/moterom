export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-mark${className ? ` ${className}` : ""}`}>
      <img src="/digilist-logo.svg" alt="" className="brand-mark-img" />
      <span className="brand-mark-text">
        <span className="brand-mark-name">DIGILIST</span>
        <span className="brand-mark-tagline">ENKEL BOOKING</span>
      </span>
    </span>
  );
}
