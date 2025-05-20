import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, XCircle, Clock, Mail } from 'lucide-react';

export default function VerifyEmailChangePage() {
  const [location, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email change...');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        // Extract token from URL
        const params = new URLSearchParams(window.location.search);
        const token = params.get('token');
        
        if (!token) {
          setStatus('error');
          setMessage('Invalid verification link');
          setErrorDetails('The verification link is missing a token. Please try again or contact support.');
          return;
        }

        // Call API to verify email change
        const response = await fetch(`/api/auth/verify-email-change?token=${token}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          setStatus('success');
          setMessage('Email updated successfully');
        } else {
          const errorData = await response.json();
          setStatus('error');
          setMessage('Failed to verify email');
          setErrorDetails(errorData.message || 'An unknown error occurred');
        }
      } catch (error) {
        console.error('Error verifying email:', error);
        setStatus('error');
        setMessage('Failed to verify email');
        setErrorDetails('An unexpected error occurred while verifying your email.');
      }
    };

    verifyEmail();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl font-semibold flex items-center">
            {status === 'loading' && <Clock className="mr-2 h-5 w-5 text-blue-500 animate-pulse" />}
            {status === 'success' && <CheckCircle className="mr-2 h-5 w-5 text-green-500" />}
            {status === 'error' && <XCircle className="mr-2 h-5 w-5 text-red-500" />}
            Email Verification
          </CardTitle>
          <CardDescription>
            {status === 'loading' && 'We are processing your request...'}
            {status === 'success' && 'Your email has been verified successfully.'}
            {status === 'error' && 'There was a problem verifying your email.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <div className="flex justify-center py-4">
              <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div>
            </div>
          )}
          
          {status === 'success' && (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle>Success</AlertTitle>
              <AlertDescription>
                Your email address has been updated successfully. You can now use your new email to log in.
              </AlertDescription>
            </Alert>
          )}
          
          {status === 'error' && (
            <Alert className="bg-red-50 border-red-200">
              <XCircle className="h-4 w-4 text-red-500" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {errorDetails}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button 
            variant={status === 'error' ? 'destructive' : 'default'} 
            onClick={() => setLocation('/account')}
          >
            {status === 'success' ? 'Go to Account' : 'Return to Account'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}