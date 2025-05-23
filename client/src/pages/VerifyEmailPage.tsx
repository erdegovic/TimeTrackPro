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
    
    // Automatically verify the token
    const verifyToken = async () => {
      try {
        const response = await fetch(`/api/auth/verify-email?token=${urlToken}`);
        const data = await response.json();
        
        if (response.ok) {
          toast({
            title: "Success",
            description: "Your email has been verified successfully!",
          });
          
          // Redirect to login page with success message after a short delay
          setTimeout(() => {
            navigate("/login?verified=true");
          }, 2000);
        } else {
          toast({
            title: "Verification Failed",
            description: data.message || "Email verification failed. Please try again.",
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
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