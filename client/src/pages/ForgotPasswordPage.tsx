import ForgotPasswordForm from "../components/Auth/ForgotPasswordForm";
import AuthLayout from "../components/layouts/AuthLayout";

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-8">
        <div className="max-w-md w-full">
          <ForgotPasswordForm />
        </div>
      </div>
    </AuthLayout>
  );
}