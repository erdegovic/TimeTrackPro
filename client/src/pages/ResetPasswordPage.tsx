import { useParams } from 'wouter';
import ResetPasswordForm from "../components/Auth/ResetPasswordForm";
import AuthLayout from "../components/layouts/AuthLayout";

export default function ResetPasswordPage() {
  // Get token from URL parameters
  const params = useParams<{ token: string }>();
  const token = params?.token || '';

  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-8">
        <div className="max-w-md w-full">
          <ResetPasswordForm token={token} />
        </div>
      </div>
    </AuthLayout>
  );
}