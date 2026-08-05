import RegisterForm from "../components/Auth/RegisterForm";
import AuthLayout from "../components/layouts/AuthLayout";

export default function RegisterPage() {
  return (
    <AuthLayout>
      <div className="flex w-full items-center justify-center py-8">
        <div className="w-full max-w-2xl">
          <RegisterForm />
        </div>
      </div>
    </AuthLayout>
  );
}
