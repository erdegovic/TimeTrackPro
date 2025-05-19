import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import LoginForm from "../components/Auth/LoginForm";
import AuthLayout from "../components/layouts/AuthLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [location] = useLocation();
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

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
    
    // Check for verification error
    const error = searchParams.get('error');
    if (error) {
      setStatusMessage({
        type: 'error',
        title: 'Verification Failed',
        message: decodeURIComponent(error)
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
          <LoginForm />
        </div>
      </div>
    </AuthLayout>
  );
}