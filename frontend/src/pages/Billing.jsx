import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import { Loader2, AlertTriangle, CheckCircle, X, Download, CreditCard } from "lucide-react";

const Billing = () => {
  const { api } = useAuth();

  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [breakdown, setBreakdown] = useState([]);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  const loadBreakdown = async (period) => {
    try {
      setLoadingBreakdown(true);
      const res = await api.get(`/billing/breakdown?period=${period}`);
      setBreakdown(res.data.breakdown);
      setSelectedPeriod(period);
    } catch (err) {
      alert("Failed to load usage breakdown");
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const handlePayment = async (billId) => {
    try {
      const res = await api.post("/billing/create-checkout-session", { billId });
      if (res.data.url) {
        window.location.href = res.data.url; // Redirect to Stripe's secure page
      }
    } catch (err) {
      alert("Failed to initiate payment");
    }
  };

  const downloadInvoice = async (billId, period) => {
    try {
      const response = await api.get(`/billing/invoice/${billId}`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `VaultX_Invoice_${period}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert("Could not download invoice");
    }
  };

  useEffect(() => {
    const fetchBilling = async () => {
      try {
        const [usageRes, historyRes] = await Promise.all([
          api.get("/billing/usage"),
          api.get("/billing/history"),
        ]);

        setUsage(usageRes.data);
        setHistory(historyRes.data.bills);
      } catch (err) {
        setError("Failed to load billing data");
      } finally {
        setLoading(false);
      }
    };

    fetchBilling();
  }, [api]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <Header />

        <div className="flex-1 overflow-y-auto p-6 lg:p-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto space-y-8">

            <div className="flex items-center gap-3 mb-2">
               <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                  <CreditCard size={20} />
               </div>
               <h1 className="text-2xl font-bold tracking-tight">Billing & Usage</h1>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-red-600 flex items-center gap-3 font-medium shadow-sm">
                <AlertTriangle size={18} />
                {error}
              </div>
            )}

            {/* Usage Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <h2 className="font-bold text-lg mb-6 text-slate-900 tracking-tight">Current Usage</h2>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Current Plan</p>
                  <p className="text-xl font-bold text-blue-600">{usage.plan}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Storage Used</p>
                  <p className="text-lg font-bold text-slate-900">
                    {Math.round(usage.usedStorage / (1024 * 1024))} MB <span className="text-slate-400 text-sm font-medium">/ {Math.round(usage.maxStorage / (1024 * 1024))} MB</span>
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                <div
                  className="bg-blue-600 h-3 transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.min(
                      (usage.usedStorage / usage.maxStorage) * 100,
                      100
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* Current Bill */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <h2 className="font-bold text-lg mb-1 text-slate-900 tracking-tight">Current Bill</h2>
                <p className="text-sm font-medium text-slate-500">
                  Billing Period: <span className="font-bold text-slate-700">{usage.billing.period}</span>
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-500 uppercase tracking-widest mb-1">Amount Due</p>
                  <p className="text-2xl font-bold text-slate-900">₹{usage.billing.amount}</p>
                </div>

                <div className="flex flex-col gap-2 min-w-[120px]">
                  {usage.billing.status === "PAID" && (
                    <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm">
                      <CheckCircle size={14} /> Paid
                    </span>
                  )}

                  {usage.billing.status === "PENDING" && (
                    <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">
                       Processing
                    </span>
                  )}

                  {usage.billing.status === "UNPAID" && (
                    <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                      <AlertTriangle size={14} /> Unpaid
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Billing History */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                <h2 className="font-bold text-lg text-slate-900 tracking-tight">Billing History</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-slate-500 bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Period</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Amount</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px]">Status</th>
                      <th className="px-6 py-4 font-bold uppercase tracking-widest text-[10px] text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((bill) => (
                      <tr key={bill._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-5 font-semibold text-slate-700">{bill.period}</td>
                        <td className="px-6 py-5 font-bold text-slate-900">₹{bill.amount}</td>
                        <td className="px-6 py-5">
                          {bill.status === "PAID" ? (
                              <div className="flex items-center gap-3">
                                <span className="text-emerald-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                                  <CheckCircle size={14} /> PAID
                                </span>
                              </div>
                            ) : (
                              <span className="text-amber-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1">
                                <AlertTriangle size={14} /> {bill.status}
                              </span>
                            )
                          }
                        </td>

                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => loadBreakdown(bill.period)}
                              className="text-slate-500 hover:text-blue-600 text-xs font-semibold transition-colors"
                            >
                              View Usage
                            </button>

                            {bill.status === "PAID" && (
                              <button 
                                onClick={() => downloadInvoice(bill._id, bill.period)}
                                className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg transition-all shadow-sm flex items-center gap-1 text-xs font-semibold"
                                title="Download PDF Invoice"
                              >
                                <Download size={14} /> PDF
                              </button>
                            )}

                            {bill.status === "UNPAID" && (
                              <button 
                                  onClick={() => handlePayment(bill._id)} 
                                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                              >
                                  Pay Now
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
        
        {/* Crisp Modal for Breakdown */}
        {selectedPeriod && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white w-full max-w-3xl max-h-[80vh] rounded-3xl border border-slate-100 flex flex-col shadow-2xl">
                
                <div className="flex justify-between items-center p-6 border-b border-slate-100">
                  <h3 className="font-bold text-lg text-slate-900 tracking-tight">
                    Usage Breakdown — <span className="text-blue-600">{selectedPeriod}</span>
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedPeriod(null);
                      setBreakdown([]);
                    }}
                    className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                  {loadingBreakdown ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="animate-spin text-blue-600 w-8 h-8" />
                    </div>
                  ) : breakdown.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-slate-500 font-medium">
                        No billable usage for this period.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="text-slate-500 border-b border-slate-200 bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-6 py-3 font-bold uppercase tracking-widest text-[10px]">File Name</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Size (MB)</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Days Stored</th>
                            <th className="px-6 py-3 font-bold uppercase tracking-widest text-[10px] text-right">MB-Days</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {breakdown.map((b, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-3 font-semibold text-slate-700 truncate max-w-[200px]">{b.fileName}</td>
                              <td className="px-6 py-3 text-slate-600">{b.sizeMB}</td>
                              <td className="px-6 py-3 text-slate-600">{b.daysStored}</td>
                              <td className="px-6 py-3 font-bold text-slate-900 text-right">{b.mbDays}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default Billing;