import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import AuthLayout from '../components/layouts/AuthLayout';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [verificationState, setVerificationState] = useState<{
    status: 'verifying' | 'success' | 'error';
    message: string;
  }>({
    status: 'verifying',
    message: 'Verifying your email address...'
  });

  useEffect(() => {
    // This page will now just show a loading state - the verification is handled by the server
    // The actual verification happens when the server processes the link before redirecting here
    // We wait for a short delay for user experience and aesthetic reasons, then redirect to login
    
    // Simulate verification for user feedback
    const timer = setTimeout(() => {
      // After a brief delay, redirect to login page
      navigate("/login?verified=true");
    }, 3000);
    
    // Clear timeout if component unmounts
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-8 min-h-[calc(100vh-100px)]">
        <div className="max-w-md w-full">
          <Card className="w-full">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Email Verification</CardTitle>
              <CardDescription>
                Processing your email verification
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-6">
              <Loader2 className="h-16 w-16 text-primary animate-spin mb-4" />
              <p className="text-center text-gray-600">
                Your email is being verified. 
                <br />
                You will be redirected automatically...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthLayout>
  );
}