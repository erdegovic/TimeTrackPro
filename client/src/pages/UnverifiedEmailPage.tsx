import { useState } from 'react';
import { useLocation } from 'wouter';
import AuthLayout from '@/components/layouts/AuthLayout';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

// Schema for resend form
const resendSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ResendFormValues = z.infer<typeof resendSchema>;

export default function UnverifiedEmailPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  
  // Get email from query params if available
  const params = new URLSearchParams(window.location.search);
  const emailFromParams = params.get('email') || '';
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendFormValues>({
    resolver: zodResolver(resendSchema),
    defaultValues: {
      email: emailFromParams,
    }
  });

  const onSubmit = async (data: ResendFormValues) => {
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setResendSuccess(true);
        toast({
          title: "Email Sent",
          description: "Verification email has been sent. Please check your inbox.",
        });
      } else {
        toast({
          title: "Failed to Resend",
          description: result.message || "Failed to send verification email.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
      console.error('Resend verification error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-8 min-h-[calc(100vh-100px)]">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Email Verification Required</CardTitle>
            <CardDescription className="text-center">
              Your account needs to be verified before you can log in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-amber-50 p-4 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Verification Required</p>
                <p className="text-sm text-amber-700 mt-1">
                  You tried to log in with an unverified email address. Please check your inbox for the verification 
                  email we sent when you registered, or request a new verification email below.
                </p>
              </div>
            </div>
            
            {resendSuccess ? (
              <div className="bg-green-50 p-4 rounded-md flex items-start">
                <Mail className="h-5 w-5 text-green-600 mt-0.5 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-green-800">Verification Email Sent!</p>
                  <p className="text-sm text-green-700 mt-1">
                    We've sent a verification email to <span className="font-medium">{emailFromParams}</span>.
                    Please check your inbox and click the verification link to activate your account.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Your Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    placeholder="name@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Resend Verification Email"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button variant="outline" onClick={() => navigate("/login")}>
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}