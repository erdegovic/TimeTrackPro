import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface EmailVerificationProps {
  token: string;
}

export default function EmailVerification({ token }: EmailVerificationProps) {
  const [_, navigate] = useLocation();
  const { toast } = useToast();
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email/${token}`);
        const data = await response.json();

        if (response.ok) {
          setIsSuccess(true);
          toast({
            title: "Success",
            description: "Your email has been verified successfully!",
          });
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

    if (token) {
      verifyEmail();
    } else {
      setIsVerifying(false);
      setErrorMessage("Invalid verification token.");
    }
  }, [token, toast]);

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
            <Spinner size="lg" />
          </div>
        ) : isSuccess ? (
          <div className="py-6">
            <svg className="h-16 w-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="mt-4 text-gray-600">Your account is now active and you can sign in.</p>
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