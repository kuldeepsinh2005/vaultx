import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Sidebar from "../components/layout/Sidebar";
import Header from "../components/layout/Header";
import { Loader2, AlertTriangle, CheckCircle } from "lucide-react";

const Billing = () => {
  const { api } = useAuth();

  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

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
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        <Header />

        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-4xl mx-auto space-y-8">

            <h1 className="text-2xl font-bold">Billing & Usage</h1>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400">
                {error}
              </div>
            )}

            {/* Usage Card */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-bold mb-4">Current Usage</h2>

              <div className="text-sm text-slate-400 mb-2">
                Plan: <span className="text-white font-bold">{usage.plan}</span>
              </div>

              <div className="text-sm text-slate-400 mb-4">
                {Math.round(usage.usedStorage / (1024 * 1024))} MB of{" "}
                {Math.round(usage.maxStorage / (1024 * 1024))} MB used
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-indigo-500 h-3"
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
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-bold mb-4">Current Bill</h2>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">
                    Period: {usage.billing.period}
                  </p>
                  <p className="text-sm text-slate-400">
                    Amount: ₹{usage.billing.amount}
                  </p>
                </div>

                {usage.billing.status === "PAID" ? (
                  <span className="flex items-center gap-2 text-emerald-400 font-bold">
                    <CheckCircle size={18} /> PAID
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-yellow-400 font-bold">
                    <AlertTriangle size={18} /> UNPAID
                  </span>
                )}
              </div>
            </div>

            {/* Billing History */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
              <h2 className="font-bold mb-4">Billing History</h2>

              <table className="w-full text-sm">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="text-left py-2">Period</th>
                    <th className="text-left py-2">Amount</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((bill) => (
                    <tr key={bill._id} className="border-b border-slate-800/50">
                      <td className="py-2">{bill.period}</td>
                      <td className="py-2">₹{bill.amount}</td>
                      <td className="py-2">
                        {bill.status === "PAID" ? (
                          <span className="text-emerald-400">PAID</span>
                        ) : (
                          <span className="text-yellow-400">UNPAID</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default Billing;
