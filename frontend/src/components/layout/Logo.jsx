import { ShieldCheck } from "lucide-react";

export const Logo = ({ size = "md" }) => {
  const iconSizes = { sm: 16, md: 24, lg: 40 };
  const textSizes = { sm: "text-lg", md: "text-2xl", lg: "text-4xl" };

  return (
    <div className="flex items-center gap-3 select-none">
      <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
        <ShieldCheck size={iconSizes[size]} className="text-white" />
      </div>
      <span className={`${textSizes[size]} font-black text-white tracking-tighter`}>
        VAULT<span className="text-indigo-500 text-opacity-80">X</span>
      </span>
    </div>
  );
};