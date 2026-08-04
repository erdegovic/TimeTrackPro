import { useSearch } from 'wouter';
import ResetPasswordForm from "../components/Auth/ResetPasswordForm";
import AuthLayout from "../components/layouts/AuthLayout";

export default function ResetPasswordPage() {
  const search = useSearch();
  const token = new URLSearchParams(search).get('token')?.trim() || '';

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
