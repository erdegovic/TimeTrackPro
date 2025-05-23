import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import EmailVerification from '../components/Auth/EmailVerification';
import AuthLayout from '../components/layouts/AuthLayout';
import { useToast } from '@/hooks/use-toast';

export default function VerifyEmailPage() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Get token from URL query parameters
    const searchParams = new URLSearchParams(location.split('?')[1]);
    const urlToken = searchParams.get('token') || '';
    
    if (!urlToken) {
      toast({
        title: "Error",
        description: "Missing verification token. Please check your verification link.",
        variant: "destructive",
      });
      setIsVerifying(false);
      return;
    }
    
    // Set the token and start verification
    setToken(urlToken);
    console.log("Processing verification with token:", urlToken);
    
    // Automatically verify the token
    const verifyToken = async () => {
      try {
        // Create the URL with the token as a parameter
        const apiUrl = `/api/auth/verify-email?token=${encodeURIComponent(urlToken)}`;
        console.log("Sending verification request to:", apiUrl);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("Verification response error:", response.status, errorText);
          throw new Error(`Verification failed with status ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Verification response:", data);
        
        toast({
          title: "Success",
          description: "Your email has been verified successfully!",
        });
        
        setIsSuccess(true);
        
        // Redirect to login page with success message after a short delay
        setTimeout(() => {
          navigate("/login?verified=true");
        }, 2000);
      } catch (error) {
        console.error("Verification error:", error);
        
        toast({
          title: "Verification Failed",
          description: "Email verification failed. The link may have expired or is invalid.",
          variant: "destructive",
        });
        
        setErrorMessage("Verification failed. The link may have expired or is invalid.");
      } finally {
        setIsVerifying(false);
      }
    };
    
    verifyToken();
  }, [location, toast, navigate]);

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-8 min-h-[calc(100vh-100px)]">
        <div className="max-w-md w-full">
          <EmailVerification token={token} manualVerification={false} isVerifying={isVerifying} />
        </div>
      </div>
    </AuthLayout>
  );
}