"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import SarthiMark from "@/components/SarthiMark";

/**
 * Sarthi login (Sahil, 25 Oct 2026).
 * Before: a gold product-collage background image from an outside image host,
 * white text on top of it, a "Remember Me" box that did nothing and a
 * "Forgot Password?" link that went nowhere. Now: one calm white card, one
 * blue accent, labels above inputs, and only controls that actually work.
 * The sign-in logic itself is unchanged.
 */
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

          if (statusData.sharedEmail) {
            setError("This email is used by more than one person. Please log in with your username instead.");
          } else if (statusData.exists && statusData.isActive === false) {
            setError("This account is no longer active. If that's a mistake, please contact your admin.");
          } else {
            setError("Wrong ID or password. Please check and try again.");
          }
        } catch {
          setError("Wrong ID or password. Please check and try again.");
        }
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "w-full h-12 px-4 bg-white dark:bg-navy-900 border border-[#D1D5DB] dark:border-navy-700 rounded-xl text-[16px] text-[#1A1D21] dark:text-white placeholder:text-[#9CA3AF] outline-none transition-shadow focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/15";

  return (
    <div className="min-h-screen bg-[#F7F8FA] dark:bg-navy-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center mb-4">
            <SarthiMark className="w-9 h-9" />
          </div>
          <h1 className="text-[28px] leading-tight font-semibold text-[#1A1D21] dark:text-white">
            Sarthi
          </h1>
          <p className="text-[15px] text-[#5B6472] dark:text-gray-400 mt-1">
            Your guide to every win
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-navy-900 border border-[#E5E7EB] dark:border-navy-800 rounded-2xl p-6 sm:p-8">
          <h2 className="text-[20px] font-semibold text-[#1A1D21] dark:text-white mb-6">
            Sign in
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {error && (
              <div
                role="alert"
                className="bg-[#FEF2F2] dark:bg-rose-500/10 border border-[#FECACA] dark:border-rose-500/20 text-[#DC2626] text-[14px] leading-snug px-4 py-3 rounded-xl"
              >
                {error}
              </div>
            )}

            <div>
              <label htmlFor="identifier" className="block text-[14px] font-semibold text-[#1A1D21] dark:text-white mb-2">
                Username or email
              </label>
              <input
                type="text"
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Your ERP username"
                autoComplete="username"
                autoCapitalize="none"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[14px] font-semibold text-[#1A1D21] dark:text-white mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className={`${inputClass} pr-24`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-10 px-3 flex items-center gap-1.5 rounded-lg text-[14px] font-semibold text-[#5B6472] hover:text-[#1A1D21] dark:hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !identifier.trim() || !password}
              className="w-full h-12 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[16px] font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[14px] text-[#5B6472] dark:text-gray-400 mt-6">
          Forgot your password? Ask your admin to reset it.
        </p>
      </div>
    </div>
  );
}
