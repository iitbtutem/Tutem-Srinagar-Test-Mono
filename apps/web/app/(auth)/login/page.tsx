import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/app/(auth)/login/_loginForm";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign In | Tutem Admin",
  description: "Sign in to Tutem Admin Dashboard",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel – branding */}
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 dark:from-slate-950 dark:via-brand-950 dark:to-brand-900 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-brand-400/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-6 h-6 text-white"
              >
                <path
                  d="M12 2L4 7v10l8 5 8-5V7l-8-5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 22V12M4 7l8 5 8-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">
              Tutem Admin
            </span>
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Manage your <br />
            <span className="text-brand-300">ride platform</span> <br />
            with confidence
          </h1>
          <p className="text-white/60 text-lg max-w-xs">
            Real-time monitoring, driver tracking, and complete operational
            control at your fingertips.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-2 gap-4">
          {[
            { label: "Active Drivers", value: "Live" },
            { label: "Rides Today", value: "Track" },
            { label: "Organizations", value: "Manage" },
            { label: "Revenue", value: "Monitor" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
            >
              <div className="text-white font-semibold">{stat.value}</div>
              <div className="text-white/50 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel – form */}
      <div className="flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="w-6 h-6 text-primary"
              >
                <path
                  d="M12 2L4 7v10l8 5 8-5V7l-8-5z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 22V12M4 7l8 5 8-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight">
              Tutem Admin
            </span>
          </div>

          <div>
            <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-muted-foreground mt-2">
              Sign in with your admin phone number
            </p>
          </div>

          <Suspense
            fallback={
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
