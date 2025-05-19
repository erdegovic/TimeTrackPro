import RegisterForm from "../components/Auth/RegisterForm";
import AuthLayout from "../components/layouts/AuthLayout";

export default function RegisterPage() {
  return (
    <AuthLayout>
      <div className="flex items-center justify-center py-8">
        <div className="max-w-md w-full">
          <RegisterForm />
        </div>
      </div>
    </AuthLayout>
  );
}