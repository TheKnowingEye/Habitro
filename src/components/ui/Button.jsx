export default function Button({ children, onClick, disabled, loading, variant = 'primary', className = '', type = 'button' }) {
  return (
    <button
      type={type}
      className={`btn btn--${variant} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {children}
    </button>
  );
}
