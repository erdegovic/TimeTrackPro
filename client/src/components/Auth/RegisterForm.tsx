import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import ReCAPTCHA from 'react-google-recaptcha';
import { useLocation } from 'wouter';
import { Check, Eye, EyeOff, Loader2 } from 'lucide-react';
import GoogleSignInButton from './GoogleSignInButton';
import { planDetails } from '@/lib/plans';
import { Link } from 'wouter';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '@shared/legal';
import type { BillingInterval, SubscriptionPlan } from '@shared/subscriptions';
import BillingCycleToggle from '@/components/billing/BillingCycleToggle';

const registerSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  acceptedLegal: z.boolean().refine(value => value, "You must agree before creating an account"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const RECAPTCHA_TEST_SITE_KEY = "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";

export default function RegisterForm() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const registrationParams = new URLSearchParams(window.location.search);
  const initialPlan = registrationParams.get('plan');
  const needsPlanForGoogle = registrationParams.get('error') === 'choose-plan';
  const needsLegalForGoogle = registrationParams.get('error') === 'accept-terms';
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(
    initialPlan === 'free' || initialPlan === 'pro' || initialPlan === 'ultimate' ? initialPlan : null,
  );
  const [billingInterval, setBillingInterval] = useState<BillingInterval>(
    registrationParams.get('billing') === 'annual' ? 'annual' : 'monthly',
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const captchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY
    || (import.meta.env.DEV ? RECAPTCHA_TEST_SITE_KEY : "");

  const { register, control, handleSubmit, formState: { errors }, reset, watch } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '', firstName: '', lastName: '', acceptedLegal: false },
  });
  const acceptedLegal = watch('acceptedLegal');

  const onSubmit = async (data: RegisterFormValues) => {
    if (!selectedPlan) {
      toast({ title: "Choose a plan", description: "Select a Tickd plan before creating your account.", variant: "destructive" });
      return;
    }
    if (!captchaToken) {
      toast({ title: "CAPTCHA required", description: "Please complete the CAPTCHA verification.", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          acceptedTerms: data.acceptedLegal,
          termsVersion: CURRENT_TERMS_VERSION,
          privacyVersion: CURRENT_PRIVACY_VERSION,
          captchaToken,
          plan: selectedPlan,
          billingInterval,
        }),
      });
      const result = await response.json();

      if (response.ok) {
        reset();
        setCaptchaToken(null);
        navigate(`/registration-success?email=${encodeURIComponent(data.email)}`);
      } else {
        toast({ title: "Registration failed", description: result.message || "An error occurred.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl">
      <div className="bg-white rounded-lg shadow-lg border border-gray-100 p-6 sm:p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create an account</h1>
          <p className="text-gray-500 mt-1.5 text-sm">Choose your plan, then create your Tickd account</p>
        </div>

        {needsPlanForGoogle && <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Choose a plan before creating a new account with Google.</div>}
        {needsLegalForGoogle && <div className="mb-5 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">Review and accept the current Terms of Service and Privacy Policy before creating an account.</div>}

        <fieldset className="mb-7">
          <legend className="mb-3 text-sm font-semibold text-gray-900">1. Choose a plan</legend>
          <BillingCycleToggle value={billingInterval} onChange={setBillingInterval} compact />
          <div className="grid gap-3 sm:grid-cols-3">
            {planDetails.map((plan) => {
              const selected = selectedPlan === plan.id;
              const available = plan.available;
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={!available}
                  onClick={() => available && setSelectedPlan(plan.id)}
                  className={`relative min-h-28 rounded-md border p-4 text-left transition ${selected ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : available ? 'border-gray-200 hover:border-blue-300' : 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-70'}`}
                  aria-pressed={selected}
                >
                  {selected && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white"><Check className="h-3 w-3" /></span>}
                  <span className="block text-sm font-bold text-gray-900">{plan.name}</span>
                  <span className="mt-2 block text-xl font-bold text-gray-900">
                    ${billingInterval === 'annual' ? plan.annualPrice.toFixed(2) : plan.monthlyPrice.toFixed(2)}
                    <span className="text-xs font-medium text-gray-500">{plan.id === 'free' ? ' forever' : `/${billingInterval === 'annual' ? 'yr' : 'mo'}`}</span>
                  </span>
                  {billingInterval === 'annual' && plan.id !== 'free' && (
                    <span className="mt-1 block text-xs font-semibold text-emerald-700">
                      Save {plan.annualDiscount}% · ${(plan.annualPrice / 12).toFixed(2)}/mo
                    </span>
                  )}
                  {plan.emphasis && <span className="mt-2 block text-xs font-semibold text-blue-700">{plan.emphasis}</span>}
                </button>
              );
            })}
          </div>
          {!selectedPlan && <p className="mt-2 text-xs font-medium text-blue-700">Select a plan to continue.</p>}
        </fieldset>

        <div className={!selectedPlan ? 'pointer-events-none opacity-45' : ''} aria-disabled={!selectedPlan}>
        <p className="mb-3 text-sm font-semibold text-gray-900">2. Review the agreement</p>
        <Controller
          name="acceptedLegal"
          control={control}
          render={({ field }) => (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="acceptedLegal"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="acceptedLegal" className="text-sm font-normal leading-5 text-gray-700">
                  I agree to the <Link href="/terms" target="_blank" className="font-semibold text-blue-600 hover:underline">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank" className="font-semibold text-blue-600 hover:underline">Privacy Policy</Link>.
                </Label>
              </div>
              {errors.acceptedLegal && <p className="ml-7 mt-2 text-xs text-red-500">{errors.acceptedLegal.message}</p>}
            </div>
          )}
        />

        <p className="mb-3 mt-6 text-sm font-semibold text-gray-900">3. Create your account</p>
        {selectedPlan && <GoogleSignInButton label="Sign up with Google" plan={selectedPlan} billingInterval={billingInterval} legalAccepted={acceptedLegal} termsVersion={CURRENT_TERMS_VERSION} privacyVersion={CURRENT_PRIVACY_VERSION} />}

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs font-medium uppercase text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First name</Label>
              <Input id="firstName" {...register("firstName")} placeholder="First" className="mt-1 h-11" />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last name</Label>
              <Input id="lastName" {...register("lastName")} placeholder="Last" className="mt-1 h-11" />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
            <Input
              id="email" type="email" autoComplete="email"
              {...register("email")} placeholder="you@example.com"
              className="mt-1 h-11"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
            <div className="relative mt-1">
              <Input
                id="password" type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                {...register("password")} placeholder="At least 8 characters"
                className="h-11 pr-10"
              />
              <button type="button" tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowPassword(v => !v)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm password</Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword" type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                {...register("confirmPassword")} placeholder="Repeat your password"
                className="h-11 pr-10"
              />
              <button type="button" tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => setShowConfirm(v => !v)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="text-xs text-red-500 mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <div className="flex justify-center pt-1">
            {captchaSiteKey ? (
              <ReCAPTCHA
                sitekey={captchaSiteKey}
                onChange={token => setCaptchaToken(token)}
                onExpired={() => setCaptchaToken(null)}
                onErrored={() => {
                  setCaptchaToken(null);
                  toast({
                    title: "Verification unavailable",
                    description: "The CAPTCHA could not load. Please refresh the page and try again.",
                    variant: "destructive",
                  });
                }}
              />
            ) : (
              <p role="alert" className="text-sm text-red-600">
                Registration verification is temporarily unavailable.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isSubmitting || !selectedPlan || !acceptedLegal || !captchaSiteKey}>
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating account...</>
            ) : "Create account"}
          </Button>
        </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <button
            type="button"
            className="text-blue-600 hover:text-blue-700 font-medium hover:underline"
            onClick={() => navigate("/login")}
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
