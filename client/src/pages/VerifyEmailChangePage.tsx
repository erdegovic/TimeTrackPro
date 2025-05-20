import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function VerifyEmailChangePage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/verify-email-change');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    async function verifyEmail() {
      try {
        // Get the token from URL search params
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (!token) {
          setStatus('error');
          setMessage('Verification token is missing. Please check your email and try again.');
          return;
        }

        // Call the verification API
        const response = await fetch(`/api/auth/verify-email-change?token=${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus('success');
          setMessage(data.message || 'Your email has been verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.message || 'Failed to verify your email. The token may be invalid or expired.');
        }
      } catch (error) {
        console.error('Email verification error:', error);
        setStatus('error');
        setMessage('An error occurred during verification. Please try again later.');
      }
    }

    verifyEmail();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center space-y-4 py-6">
          {status === 'loading' && (
            <>
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
              <p className="text-lg text-center">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="h-16 w-16 text-green-500" />
              <Alert className="bg-green-50 border-green-200">
                <AlertTitle className="text-green-800">Success!</AlertTitle>
                <AlertDescription className="text-green-700">{message}</AlertDescription>
              </Alert>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="h-16 w-16 text-red-500" />
              <Alert className="bg-red-50 border-red-200">
                <AlertTitle className="text-red-800">Verification Failed</AlertTitle>
                <AlertDescription className="text-red-700">{message}</AlertDescription>
              </Alert>
            </>
          )}
        </CardContent>
        <CardFooter className="flex justify-center pb-6">
          {status !== 'loading' && (
            <Button 
              onClick={() => navigate('/login')} 
              variant={status === 'success' ? 'default' : 'outline'}>
              {status === 'success' ? 'Go to Login' : 'Back to Login'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}