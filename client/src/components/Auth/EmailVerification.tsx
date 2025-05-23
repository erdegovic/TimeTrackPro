import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface EmailVerificationProps {
  token: string;
  manualVerification?: boolean;
  isVerifying?: boolean;
}

export default function EmailVerification({ 
  token, 
  manualVerification = true, 
  isVerifying: initialVerifying 
}: EmailVerificationProps) {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(initialVerifying ?? true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // If the parent component is handling verification, don't do anything here
    if (!manualVerification) {
      return;
    }

    const verifyEmail = async () => {
      try {
        if (!token) {
          setErrorMessage("Missing verification token.");
          setIsVerifying(false);
          return;
        }

        const response = await fetch(`/api/auth/verify-email?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setIsSuccess(true);
          toast({
            title: "Success",
            description: "Your email has been verified successfully!",
          });
          
          // Redirect to login page with success message after a short delay
          setTimeout(() => {
            navigate("/login?verified=true");
          }, 2000);
        } else {
          setErrorMessage(data.message || "Email verification failed. Please try again.");
          toast({
            title: "Verification Failed",
            description: data.message || "Email verification failed. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        setErrorMessage("An unexpected error occurred. Please try again.");
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsVerifying(false);
      }
    };

    if (token && manualVerification) {
      verifyEmail();
    } else if (!token) {
      setIsVerifying(false);
      setErrorMessage("Invalid verification token.");
      toast({
        title: "Error",
        description: "Missing verification token.",
        variant: "destructive",
      });
    }
  }, [token, toast, navigate, manualVerification]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl text-center">Email Verification</CardTitle>
        <CardDescription className="text-center">
          {isVerifying ? "Verifying your email address..." : isSuccess ? "Your email has been verified!" : "Verification failed"}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        {isVerifying ? (
          <div className="flex justify-center py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        ) : isSuccess ? (
          <div className="py-6">
            <svg className="h-16 w-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="mt-4 text-gray-600">Your account is now active and you can sign in.</p>
            <p className="mt-2 text-gray-500 text-sm">Redirecting to login page...</p>
          </div>
        ) : (
          <div className="py-6">
            <svg className="h-16 w-16 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <p className="mt-4 text-gray-600">{errorMessage}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-center">
        {!isVerifying && (
          <Button
            onClick={() => navigate("/login")}
            className="w-full max-w-xs"
          >
            {isSuccess ? "Sign In" : "Back to Login"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}