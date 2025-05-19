import { useLocation } from 'wouter';
import EmailVerification from '../components/Auth/EmailVerification';
import AuthLayout from '../components/layouts/AuthLayout';

export default function VerifyEmailPage() {
  // Get token from URL query parameters
  const [location] = useLocation();
  const searchParams = new URLSearchParams(location.split('?')[1]);
  const token = searchParams.get('token') || '';

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-8">
        <div className="max-w-md w-full">
          <EmailVerification token={token} />
        </div>
      </div>
    </AuthLayout>
  );
}