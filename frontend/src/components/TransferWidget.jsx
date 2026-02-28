// frontend/src/components/TransferWidget.jsx
import React, { useState } from "react";
import { useTransfers } from "../context/TransferContext";
import { 
  X, 
  ChevronDown, 
  ChevronUp, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  UploadCloud, 
  DownloadCloud,
  Ban
} from "lucide-react";

export default function TransferWidget() {
  const { transfers, cancelTransfer, removeTransfer } = useTransfers();
  const [isMinimized, setIsMinimized] = useState(false);

  const transferList = Object.values(transfers);
  
  if (transferList.length === 0) return null;

  const activeCount = transferList.filter(t => t.status === "PROCESSING").length;

  return (
    <div className="fixed bottom-6 right-6 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] z-[100] flex flex-col overflow-hidden transition-all duration-300 animate-in slide-in-from-bottom-5">
      
      {/* Header Bar */}
      <div 
        className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2.5">
          {activeCount > 0 ? (
            <Loader2 size={18} className="animate-spin text-blue-400" />
          ) : (
            <CheckCircle size={18} className="text-emerald-400" />
          )}
          <span className="font-bold text-sm tracking-tight">
            {activeCount > 0 ? `${activeCount} active transfers` : "Transfers complete"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-white/10 rounded-md transition-colors">
            {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Body - Transfer List */}
      {!isMinimized && (
        <div className="max-h-80 overflow-y-auto custom-scrollbar bg-slate-50 p-2 space-y-2">
          {transferList.map((job) => (
            <div key={job.id} className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-sm relative group">
              
              <div className="flex items-start justify-between mb-2.5">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${
                    job.type === 'UPLOAD' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                  }`}>
                    {job.type === 'UPLOAD' ? <UploadCloud size={16} /> : <DownloadCloud size={16} />}
                  </div>
                  
                  <div className="overflow-hidden">
                    <p className="text-sm font-bold text-slate-900 truncate pr-2" title={job.name}>
                      {job.name}
                    </p>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                      job.status === 'ERROR' ? 'text-red-500' : 
                      job.status === 'CANCELLED' ? 'text-slate-400' : 
                      'text-slate-500'
                    }`}>
                      {job.phase || job.status}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {job.status === "PROCESSING" ? (
                    <button 
                      onClick={() => cancelTransfer(job.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Cancel Transfer"
                    >
                      <Ban size={14} />
                    </button>
                  ) : (
                    <button 
                      onClick={() => removeTransfer(job.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
                      title="Clear"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div 
                    id={`progress-bar-${job.id}`}
                    className={`h-full transition-all duration-200 ease-out relative ${
                      job.status === "ERROR" ? "bg-red-500" :
                      job.status === "CANCELLED" ? "bg-slate-300" :
                      job.status === "DONE" ? "bg-emerald-500" :
                      "bg-blue-600"
                    }`}
                    style={{ width: `${job.progress || 0}%` }}
                  >
                     {job.status === "PROCESSING" && (
                       <div className="absolute top-0 right-0 bottom-0 w-20 bg-white/30 blur-[6px] -translate-x-full animate-[shimmer_2s_infinite]" />
                     )}
                  </div>
                </div>
                {job.status === "PROCESSING" && (
                  <span id={`progress-text-${job.id}`} className="text-[10px] font-black text-blue-600 min-w-[3rem] text-right">
                    {job.isFolder ? `${job.completedFiles || 0}/${job.totalFiles}` : `${job.progress || 0}%`}
                  </span>
                )}
              </div>

              {job.status === "ERROR" && (
                <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 font-bold">
                  <AlertCircle size={10} /> Network error or access denied
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      {!isMinimized && activeCount > 0 && (
        <div className="px-4 py-2 bg-white border-t border-slate-100 text-[10px] text-slate-400 font-medium italic text-center">
          Closing your browser will terminate active transfers.
        </div>
      )}
    </div>
  );
}