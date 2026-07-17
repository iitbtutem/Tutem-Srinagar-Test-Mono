"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useConvex } from "convex/react";
import { api } from "@tutem/api";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Phone, Shield, ArrowRight, ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const phoneSchema = z.object({
  phoneNumber: z
    .string()
    .min(10, "Enter a valid phone number")
    .max(15, "Phone number too long"),
});

const otpSchema = z.object({
  otp: z
    .string()
    .min(4, "OTP must be at least 4 digits")
    .max(6, "OTP must be at most 6 digits")
    .regex(/^\d+$/, "OTP must contain only digits"),
});

type PhoneForm = z.infer<typeof phoneSchema>;
type OtpForm = z.infer<typeof otpSchema>;
type Step = "phone" | "otp";

// Extract clean message from ConvexError or standard Error
function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const convexErr = err as any;
    if (convexErr.data !== undefined) {
      return typeof convexErr.data === "string"
        ? convexErr.data
        : JSON.stringify(convexErr.data);
    }
    if (convexErr.message) return convexErr.message;
  }
  return typeof err === "string" ? err : "An unexpected error occurred";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const convex = useConvex();

  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Convex actions and mutations – called directly from client
  const sendOtp = useAction(api.actions.auth.sendOtp);
  const verifyOtp = useAction(api.actions.auth.verifyOtp);
  const deleteSession = useMutation(api.routes.auth.deleteSession);

  const phoneForm = useForm<PhoneForm>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phoneNumber: "" },
  });

  const otpForm = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: "" },
  });

  async function onSendOtp(data: PhoneForm) {
    setIsLoading(true);
    try {
      await sendOtp({ phoneNumber: data.phoneNumber });
      setPhoneNumber(data.phoneNumber);
      setStep("otp");
      toast.success("OTP sent to your phone number");
    } catch (err) {
      const msg = getErrorMessage(err);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function onVerifyOtp(data: OtpForm) {
    setIsLoading(true);
    try {
      const result = await verifyOtp({ phoneNumber, otp: data.otp });

      if (!result.userExists || !result.sessionToken) {
        throw new Error(
          "No account found for this phone number. Please contact an administrator.",
        );
      }

      const token = result.sessionToken as string;

      // Verify Admin permission directly before calling signIn
      try {
        await convex.query(api.routes.admin.getAdminProfile, {
          sessionToken: token,
        });
      } catch (err) {
        // Clean up the session we just created
        try {
          await deleteSession({ sessionToken: token });
        } catch {
          /* ignore */
        }
        throw new Error("Access denied. Only Admin users can sign in here.");
      }

      signIn(token);

      const redirect = searchParams.get("redirect") ?? "/";
      toast.success("Signed in successfully");
      router.replace(redirect);
    } catch (err) {
      const msg = getErrorMessage(err);
      console.error("Login verification failed:", msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function onResendOtp() {
    setIsLoading(true);
    try {
      await sendOtp({ phoneNumber });
      toast.success("OTP resent successfully");
      otpForm.reset();
    } catch (err) {
      const msg = getErrorMessage(err);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  if (step === "otp") {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setStep("phone")}
          className="flex items-center gap-1 text-sm hover:text-foreground transition-colors"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="space-y-2">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-green-500" />
          </div>
          <h3 className="text-xl font-semibold">Enter verification code</h3>
          <p
            className="text-sm"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            We sent a code to{" "}
            <span
              className="font-medium"
              style={{ color: "var(--color-foreground)" }}
            >
              {phoneNumber}
            </span>
          </p>
        </div>

        <form
          onSubmit={otpForm.handleSubmit(onVerifyOtp)}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="otp">
              Verification Code
            </label>
            <input
              id="otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter OTP"
              maxLength={6}
              className="w-full h-12 px-4 rounded-lg border text-center text-xl tracking-[0.5em] font-mono focus:outline-none focus:ring-2 transition-shadow"
              style={{
                borderColor: "var(--color-input)",
                backgroundColor: "var(--color-background)",
              }}
              {...otpForm.register("otp")}
            />
            {otpForm.formState.errors.otp && (
              <p
                className="text-xs"
                style={{ color: "var(--color-destructive)" }}
              >
                {otpForm.formState.errors.otp.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--color-primary)",
              color: "var(--color-primary-foreground)",
            }}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Verify &amp; Sign In
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onResendOtp}
            disabled={isLoading}
            className="w-full text-sm transition-colors"
            style={{ color: "var(--color-muted-foreground)" }}
          >
            Didn&apos;t receive the code?{" "}
            <span
              className="font-medium"
              style={{ color: "var(--color-primary)" }}
            >
              Resend
            </span>
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            backgroundColor:
              "color-mix(in oklch, var(--color-primary) 12%, transparent)",
          }}
        >
          <Phone
            className="h-6 w-6"
            style={{ color: "var(--color-primary)" }}
          />
        </div>
        <h3 className="text-xl font-semibold">Enter your phone number</h3>
        <p
          className="text-sm"
          style={{ color: "var(--color-muted-foreground)" }}
        >
          We&apos;ll send a verification code to your registered admin number.
        </p>
      </div>

      <form onSubmit={phoneForm.handleSubmit(onSendOtp)} className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="phoneNumber">
            Phone Number
          </label>
          <div className="relative">
            <Phone
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
              style={{ color: "var(--color-muted-foreground)" }}
            />
            <input
              id="phoneNumber"
              type="tel"
              placeholder="+91 9876543210"
              className="w-full h-12 pl-10 pr-4 rounded-lg border focus:outline-none focus:ring-2 transition-shadow"
              style={{
                borderColor: "var(--color-input)",
                backgroundColor: "var(--color-background)",
              }}
              {...phoneForm.register("phoneNumber")}
            />
          </div>
          {phoneForm.formState.errors.phoneNumber && (
            <p
              className="text-xs"
              style={{ color: "var(--color-destructive)" }}
            >
              {phoneForm.formState.errors.phoneNumber.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full h-12 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--color-primary)",
            color: "var(--color-primary-foreground)",
          }}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              Send Verification Code
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <p
        className="text-xs text-center"
        style={{ color: "var(--color-muted-foreground)" }}
      >
        Only users with Admin permission can access this dashboard.
      </p>
    </div>
  );
}
