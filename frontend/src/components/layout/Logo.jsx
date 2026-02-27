// frontend/src/components/layout/Logo.jsx
import { ShieldCheck } from "lucide-react";

export const Logo = ({ size = "md" }) => {
  // Slightly refined sizes for a more balanced, professional scale
  const iconSizes = { sm: 16, md: 22, lg: 32 };
  const textSizes = { sm: "text-lg", md: "text-xl", lg: "text-3xl" };

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Crisp blue icon container with a soft, diffused shadow */}
      <div className="bg-blue-600 p-2 rounded-xl shadow-sm shadow-blue-600/20 flex items-center justify-center">
        <ShieldCheck size={iconSizes[size]} className="text-white" strokeWidth={2.5} />
      </div>
      
      {/* Deep slate text for 'Vault', vibrant blue for 'X' */}
      <span className={`${textSizes[size]} font-bold text-slate-900 tracking-tight`}>
        Vault<span className="text-blue-600">X</span>
      </span>
    </div>
  );
};