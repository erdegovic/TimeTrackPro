import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import LoginForm from "../components/Auth/LoginForm";
import AuthLayout from "../components/layouts/AuthLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    needsResend?: boolean;
  } | null>(null);
  
  const [resendEmail, setResendEmail] = useState('');
  const [isResending, setIsResending] = useState(false);

  // Handle resending verification email
  const handleResendVerification = async () => {
    if (!resendEmail || !resendEmail.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }
    
    setIsResending(true);
    
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: resendEmail })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Email Sent",
          description: "Verification email has been sent. Please check your inbox.",
        });
        // Clear resend form
        setStatusMessage(null);
      } else {
        toast({
          title: "Failed to Resend",
          description: data.message || "Could not resend verification email. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.split('?')[1]);
    
    // Check for verification success
    if (searchParams.get('verified') === 'true') {
      setStatusMessage({
        type: 'success',
        title: 'Email Verified',
        message: 'Your email has been verified successfully. You can now log in.'
      });
    }
    
    // Check for logout
    if (searchParams.get('logout') === 'true') {
      setStatusMessage({
        type: 'success',
        title: 'Logged Out',
        message: 'You have been successfully logged out.'
      });
    }
    
    // Check for verification needed
    if (searchParams.get('needsVerification') === 'true') {
      const email = searchParams.get('email') || '';
      if (email) {
        setResendEmail(email);
      }
      
      setStatusMessage({
        type: 'error',
        title: 'Email Not Verified',
        message: 'Your email address has not been verified. Please check your inbox for the verification email, or request a new one.',
        needsResend: true
      });
    }
    
    // Check for verification error
    const error = searchParams.get('error');
    if (error) {
      let errorTitle = 'Verification Failed';
      let errorMessage = 'There was a problem verifying your email.';
      
      // Display more user-friendly messages based on error code
      if (error === 'missing-token') {
        errorMessage = 'The verification link is missing a token.';
      } else if (error === 'invalid-token') {
        errorMessage = 'The verification link is invalid or has expired.';
      } else if (error === 'user-not-found') {
        errorMessage = 'The user associated with this verification link was not found.';
      } else if (error === 'verification-failed') {
        errorMessage = 'There was a problem processing your verification. Please try again.';
      } else {
        errorMessage = decodeURIComponent(error);
      }
      
      setStatusMessage({
        type: 'error',
        title: errorTitle,
        message: errorMessage,
        needsResend: true
      });
    }
  }, [location]);

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-8">
        <div className="max-w-md w-full">
          {statusMessage && (
            <Alert 
              className={`mb-6 ${statusMessage.type === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              <AlertTitle className={statusMessage.type === 'success' ? 'text-green-800' : 'text-red-800'}>
                {statusMessage.title}
              </AlertTitle>
              <AlertDescription className={statusMessage.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                {statusMessage.message}
              </AlertDescription>
            </Alert>
          )}
          
          {statusMessage?.needsResend ? (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Resend Verification Email</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Enter your email address below to receive a new verification link.
                </p>
                <div className="flex gap-2">
                  <Input 
                    type="email" 
                    placeholder="your@email.com" 
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleResendVerification} 
                    disabled={isResending || !resendEmail}
                  >
                    {isResending ? "Sending..." : "Resend"}
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button 
                  variant="ghost" 
                  onClick={() => setStatusMessage(null)}
                >
                  Cancel
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <LoginForm />
          )}
        </div>
      </div>
    </AuthLayout>
  );
}