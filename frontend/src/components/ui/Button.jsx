import { Loader2 } from "lucide-react";

export const Button = ({ children, loading, variant = "primary", ...props }) => {
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20 text-white",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white",
    outline: "border border-slate-700 hover:bg-slate-800 text-slate-300"
  };

  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`${variants[variant]} w-full font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm uppercase tracking-wider`}
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : children}
    </button>
  );
};