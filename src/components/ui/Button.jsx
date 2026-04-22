export default function Button({ children, onClick, disabled, loading, variant = 'primary', className = '' }) {
  return (
    <button
      className={`btn btn--${variant} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {children}
    </button>
  );
}
