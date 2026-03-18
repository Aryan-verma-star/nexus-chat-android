import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Lock, Eye, EyeOff, Loader2 } from "lucide-react";
import { api, isAuthenticated } from "@/lib/api";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("All fields are required");
      return;
    }
    setLoading(true);
    setError("");

    try {
      await api.auth.login(username, password);
      navigate("/chat");
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background scan-lines">
      {/* Grid background */}
      <div className="grid-bg absolute inset-0" />
      
      <div className="relative z-10 w-full max-w-[400px] px-6 animate-scale-in">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-[32px] font-bold text-primary glow-text tracking-wider">
            NEXUS
          </h1>
          <p className="mt-2 font-body text-xs uppercase tracking-[3px] text-muted-foreground">
            Private Network • Encrypted • Secure
          </p>
        </div>

        {/* Login card */}
        <div className="glass rounded-2xl border border-border p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Username */}
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Enter your handle"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                className={`w-full rounded-xl border bg-background py-3 pl-10 pr-4 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200 ${
                  error ? "border-destructive shadow-[0_0_10px_rgba(255,51,102,0.3)]" : "border-border focus:border-primary focus:glow"
                }`}
              />
            </div>

            {/* Password */}
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter passphrase"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                className={`w-full rounded-xl border bg-background py-3 pl-10 pr-12 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none transition-all duration-200 ${
                  error ? "border-destructive shadow-[0_0_10px_rgba(255,51,102,0.3)]" : "border-border focus:border-primary focus:glow"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error && (
              <p className="font-body text-xs text-destructive animate-fade-in">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="press w-full rounded-xl bg-gradient-sent py-3 font-display text-sm font-bold uppercase tracking-[2px] text-primary-foreground transition-all duration-200 hover:brightness-110 disabled:opacity-70"
            >
              {loading ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "ACCESS NEXUS"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center font-body text-xs text-muted-foreground">
          Access restricted. Contact admin for credentials.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
