export const Card = ({ children, className = "" }) => (
  <div className={`bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl ${className}`}>
    {children}
  </div>
);