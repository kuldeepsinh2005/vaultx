// frontend/src/components/ui/Card.jsx
export const Card = ({ children, className = "" }) => (
  // Pure white card, soft border, very elegant diffused shadow
  <div className={`bg-white border border-slate-200/60 rounded-2xl shadow-xl shadow-slate-200/50 ${className}`}>
    {children}
  </div>
);