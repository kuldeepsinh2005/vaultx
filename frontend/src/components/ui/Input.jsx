// frontend/src/components/ui/Input.jsx
export const Input = ({ icon: Icon, ...props }) => (
  <div className="relative group w-full">
    {Icon && (
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
    )}
    <input
      {...props}
      // Crisp white input, clear border, beautiful blue focus ring
      className={`w-full bg-white border border-slate-300 text-slate-900 ${Icon ? 'pl-11' : 'px-4'} pr-4 py-3.5 rounded-xl focus:border-blue-600 focus:ring-[3px] focus:ring-blue-600/10 outline-none transition-all placeholder:text-slate-400 font-medium text-sm shadow-sm`}
    />
  </div>
);