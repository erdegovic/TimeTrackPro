import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Check, Timer, AlertCircle } from 'lucide-react';
import AuthLayout from '@/components/layouts/AuthLayout';
import { Link } from 'wouter';

export default function RegistrationSuccessPage() {
  const [location, navigate] = useLocation();
  const [email, setEmail] = useState<string>('');
  
  // Extract email from query parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, []);
  
  return (
    <AuthLayout>
      <div className="w-full flex justify-center items-center min-h-[calc(100vh-100px)]">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 flex flex-col items-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-center">Registration Successful!</CardTitle>
            <CardDescription className="text-center">
              We've sent a verification email to your inbox
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-md flex items-start">
              <Mail className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">Verification Required</p>
                <p className="text-sm text-blue-700 mt-1">
                  We've sent an email to <span className="font-medium">{email || 'your email address'}</span>. 
                  Please check your inbox and click the verification link to activate your account.
                </p>
              </div>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-md flex items-start">
              <Timer className="h-5 w-5 text-amber-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Didn't receive the email?</p>
                <p className="text-sm text-amber-700 mt-1">
                  Please check your spam folder. If you still don't see it, you can request a new verification email after a few minutes.
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-3">
            <Button variant="default" className="w-full" asChild>
              <Link href="/login">
                Go to Login Page
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </AuthLayout>
  );
}