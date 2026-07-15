type BrandProps = {
  size?: "sm" | "lg";
  tagline?: string;
};

export default function Brand({ size = "sm", tagline }: BrandProps) {
  return (
    <div className={`brand brand-${size}`}>
      <div className="brand-mark" aria-hidden>
        <span className="brand-icon">S</span>
      </div>
      <div className="brand-text">
        <span className="brand-name">Sheldon</span>
        {tagline && <span className="brand-tagline">{tagline}</span>}
      </div>
    </div>
  );
}
