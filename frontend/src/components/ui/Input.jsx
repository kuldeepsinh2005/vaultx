export const Input = ({ icon: Icon, ...props }) => (
  <div className="relative group w-full">
    {Icon && (
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
    )}
    <input
      {...props}
      className={`w-full bg-slate-950/40 border border-slate-800 text-white ${Icon ? 'pl-12' : 'px-6'} pr-4 py-4 rounded-2xl focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600 font-medium`}
    />
  </div>
);