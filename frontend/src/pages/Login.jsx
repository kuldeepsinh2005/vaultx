import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { Mail, LockKeyhole, LogIn, ShieldAlert } from "lucide-react";

// Importing the reusable UI elements
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";
import { Logo } from "../components/layout/Logo";
import { Footer } from "../components/layout/Footer";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false); 

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true); 

    const success = await login(email, password, true);
    if (success) {
      navigate("/dashboard");
    } else {
      setError("Invalid email or password");
      setLoading(false);
    }
  };

  return (
    // Clean, soft slate background
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Professional subtle blue gradient background accents */}
      <div className="absolute top-0 right-0 -mr-40 -mt-40 w-[600px] h-[600px] bg-blue-100/50 blur-[100px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 -ml-40 -mb-40 w-[600px] h-[600px] bg-slate-200/50 blur-[100px] rounded-full pointer-events-none" />

      <main className="w-full max-w-[420px] z-10">
        <div className="flex justify-center mb-8 text-slate-900">
          <Logo size="lg" />
        </div>

        <Card className="p-8 md:p-10">
          <header className="mb-8 text-center">
            <h2 className="text-slate-900 text-2xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">Log in to your secure workspace</p>
          </header>

          {/* Clean, high-contrast error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-600 text-sm font-medium animate-in fade-in duration-300 shadow-sm">
              <ShieldAlert size={18} className="text-red-500" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-slate-700 text-sm font-semibold ml-1 block">
                Work Email
              </label>
              <Input
                type="email"
                placeholder="you@company.com"
                icon={Mail}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-slate-700 text-sm font-semibold">
                  Passphrase
                </label>
                <Link 
                  to="/forgot-password" 
                  className="text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors"
                >
                  Forgot?
                </Link>
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                icon={LockKeyhole}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="pt-2">
              <Button type="submit" loading={loading} variant="primary">
                {!loading && <LogIn size={18} className="mr-1.5" />}
                {loading ? "Authenticating..." : "Sign In"}
              </Button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-500 text-sm font-medium">
              Don't have an account? 
              <Link to="/register" className="text-blue-600 font-semibold ml-1.5 hover:text-blue-700 transition-colors">
                Create workspace
              </Link>
            </p>
          </div>
        </Card>
      </main>

      <div className="mt-auto pt-8 text-slate-500">
        <Footer />
      </div>
    </div>
  );
};

export default Login;