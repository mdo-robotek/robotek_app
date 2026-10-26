"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserIcon as UserIconSolid,
  LockClosedIcon as LockClosedIconSolid
} from "@heroicons/react/24/solid";
import {
  EyeIcon,
  EyeSlashIcon
} from "@heroicons/react/24/outline";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username: identifier,
        password: password,
        redirect: false,
      });

      if (result?.error) {
        // If login fails, check if it's because the user is inactive
        try {
          const statusRes = await fetch(`/api/users/status?identifier=${encodeURIComponent(identifier)}`);
          const statusData = await statusRes.json();
          
          if (statusData.exists && statusData.isActive === false) {
            setError("Now you are not an active user for this company. If it's wrong, then contact administration.");
          } else {
            setError("Invalid username/email or password");
          }
        } catch (e) {
          // Fallback if status check fails
          setError("Invalid username/email or password");
        }
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen bg-[length:100%_100%] bg-no-repeat flex items-stretch justify-center lg:justify-end font-sans relative overflow-hidden"
      style={{ backgroundImage: "url('https://i.ibb.co/qLRjwyjf/1dfsd.png')" }}
    >
      {/* Dark overlay to ensure text/form readability if the image is too bright in some areas */}
      <div className="absolute inset-0 bg-black/10 lg:bg-transparent z-0"></div>

      <div className="w-full max-w-md lg:max-w-[500px] p-8 sm:p-12 lg:p-16 relative z-10 flex flex-col justify-center min-h-screen">
        
        <h2 className="text-3xl font-semibold text-white text-center mb-8 tracking-tight drop-shadow-lg">
          Welcome Back
        </h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/20 text-red-200 px-4 py-3 rounded-xl text-sm font-medium border border-red-500/50 flex items-start gap-3 backdrop-blur-sm">
              <div className="w-2 h-2 mt-1.5 bg-red-400 rounded-full animate-pulse shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="identifier" className="text-white/90 text-sm font-medium ml-1 drop-shadow-md">
              Employee ID or Email
            </label>
            <div className="relative group">
              <UserIconSolid className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70 group-focus-within:text-white transition-colors z-10" />
              <input
                type="text"
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter ID / Email"
                required
                className="w-full pl-12 pr-4 py-4 bg-black/30 border border-white/20 rounded-xl focus:bg-black/50 focus:border-[#0070f3] transition-all outline-none text-white placeholder:text-white/50 backdrop-blur-sm shadow-inner"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-white/90 text-sm font-medium ml-1 drop-shadow-md">
              Password
            </label>
            <div className="relative group">
              <LockClosedIconSolid className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70 group-focus-within:text-white transition-colors z-10" />
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                required
                className="w-full pl-12 pr-12 py-4 bg-black/30 border border-white/20 rounded-xl focus:bg-black/50 focus:border-[#0070f3] transition-all outline-none text-white placeholder:text-white/50 backdrop-blur-sm shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-white/50 hover:text-white transition-colors z-10"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" />
                ) : (
                  <EyeIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center px-1 py-2">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input type="checkbox" className="w-4 h-4 rounded bg-black/30 border-white/20 text-[#0070f3] focus:ring-[#0070f3] focus:ring-offset-0 cursor-pointer accent-[#0070f3]" />
              <span className="text-sm text-white/80 group-hover:text-white transition-colors">Remember Me</span>
            </label>
            <a href="#" className="text-sm text-white/80 hover:text-white transition-colors">
              Forgot Password?
            </a>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#0052d4] hover:bg-[#4364f7] text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(0,112,243,0.4)] transition-all duration-300 disabled:opacity-50 active:scale-[0.98] tracking-wider text-sm mt-4 border border-white/10"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
            ) : (
              "Login"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

