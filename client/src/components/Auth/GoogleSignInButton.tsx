import { useEffect, useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { Button } from '@/components/ui/button';

type GoogleSignInButtonProps = {
  label: string;
};

export default function GoogleSignInButton({ label }: GoogleSignInButtonProps) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/auth/google/status', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { enabled: false })
      .then((result) => setEnabled(result.enabled === true))
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  if (!enabled) return null;

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
      onClick={() => window.location.assign('/api/auth/google?returnTo=/')}
    >
      <FcGoogle className="mr-2 h-5 w-5" />
      {label}
    </Button>
  );
}
