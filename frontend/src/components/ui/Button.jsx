// frontend/src/components/ui/Button.jsx
import { Loader2 } from "lucide-react";

export const Button = ({ children, loading, variant = "primary", ...props }) => {
  const variants = {
    // Trustworthy deep blue for primary actions
    primary: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20",
    // Clean white button with a subtle gray border for secondary actions
    secondary: "bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 shadow-sm",
    // Crisp emerald green for success states
    success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
    // Ghost button for less important actions
    outline: "bg-transparent text-slate-600 hover:bg-slate-100"
  };

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`${variants[variant]} w-full rounded-xl font-semibold py-3.5 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
};