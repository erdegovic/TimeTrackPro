import { useEffect, useState } from "react";
import { Link } from "wouter";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Check, Loader2, MailCheck, RefreshCw, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/layouts/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function RegistrationSuccessPage() {
  const { toast } = useToast();
  const initialEmail = new URLSearchParams(window.location.search).get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [nextUrl, setNextUrl] = useState("/login?verified=true");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const verifyCode = async () => {
    if (!email || !email.includes("@")) {
      toast({ title: "Email required", description: "Enter the email address used during registration.", variant: "destructive" });
      return;
    }
    if (code.length !== 6) {
      toast({ title: "Enter the complete code", description: "The verification code contains six digits.", variant: "destructive" });
      return;
    }

    setIsVerifying(true);
    try {
      const response = await fetch("/api/auth/verify-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "The code could not be verified.");
      setNextUrl(result.next || "/login?verified=true");
      setIsVerified(true);
    } catch (error) {
      setCode("");
      toast({
        title: "Verification failed",
        description: error instanceof Error ? error.message : "The code could not be verified.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const resendCode = async () => {
    if (!email || !email.includes("@") || resendCooldown > 0) return;
    setIsResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "A new code could not be sent.");
      setCode("");
      setResendCooldown(60);
      toast({ title: "New code sent", description: "Check your inbox for the latest six-digit code." });
    } catch (error) {
      toast({
        title: "Could not resend code",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-[#dfe5ee] bg-white p-6 shadow-[0_18px_55px_rgba(17,32,61,0.1)] sm:p-8">
          {isVerified ? (
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <Check className="h-7 w-7" />
              </div>
              <h1 className="mt-6 text-2xl font-bold text-[#071127]">Email verified</h1>
              <p className="mt-3 text-sm leading-6 text-[#667085]">Your Tickd account is active. You can now sign in and start tracking.</p>
              <Button className="mt-7 h-11 w-full" asChild><Link href={nextUrl}>Continue to login</Link></Button>
            </div>
          ) : (
            <>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#edf4ff] text-[#096cfb]">
                <MailCheck className="h-6 w-6" />
              </div>
              <div className="mt-5 text-center">
                <h1 className="text-2xl font-bold text-[#071127]">Check your email</h1>
                <p className="mt-2 text-sm leading-6 text-[#667085]">Enter the six-digit code we sent to finish creating your account.</p>
              </div>

              <div className="mt-6">
                {initialEmail ? (
                  <div className="rounded-md border border-[#dfe5ee] bg-[#f8fafc] px-4 py-3 text-center text-sm font-semibold text-[#344054]">{email}</div>
                ) : (
                  <div>
                    <Label htmlFor="verification-email">Registration email</Label>
                    <Input id="verification-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 h-11" autoComplete="email" />
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-center">
                <InputOTP
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={code}
                  onChange={setCode}
                  onComplete={() => undefined}
                  disabled={isVerifying}
                  autoFocus
                  aria-label="Six-digit email verification code"
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot key={index} index={index} className="h-12 w-11 text-lg font-semibold sm:w-12" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button onClick={verifyCode} disabled={isVerifying || code.length !== 6} className="mt-6 h-11 w-full text-base font-semibold">
                {isVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Verifying...</> : <><ShieldCheck className="mr-2 h-4 w-4" />Verify email</>}
              </Button>

              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-[#667085]">
                <span>Didn't receive it?</span>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={isResending || resendCooldown > 0 || !email}
                  className="inline-flex items-center font-semibold text-[#096cfb] hover:text-[#075bcf] disabled:cursor-not-allowed disabled:text-[#98a2b3]"
                >
                  {isResending && <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
                </button>
              </div>
              <p className="mt-5 text-center text-xs leading-5 text-[#98a2b3]">The latest code expires after 15 minutes. Check your spam folder if the message is missing.</p>
            </>
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
