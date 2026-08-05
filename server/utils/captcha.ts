type CaptchaVerificationOptions = {
  fetchImpl?: typeof fetch;
  isProduction?: boolean;
  secretKey?: string;
};

type CaptchaVerificationResponse = {
  success?: boolean;
};

export async function validateCaptcha(
  token: string,
  options: CaptchaVerificationOptions = {},
): Promise<boolean> {
  try {
    const secretKey = options.secretKey ?? process.env.RECAPTCHA_SECRET_KEY;
    const isProduction = options.isProduction ?? process.env.NODE_ENV === 'production';

    if (!token.trim()) {
      return false;
    }

    if (!secretKey) {
      if (isProduction) {
        console.error('RECAPTCHA_SECRET_KEY is required in production.');
        return false;
      }

      console.warn('RECAPTCHA_SECRET_KEY not set. Captcha validation bypassed in development.');
      return true;
    }

    const response = await (options.fetchImpl ?? fetch)('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ secret: secretKey, response: token }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json() as CaptchaVerificationResponse;
    return data.success === true;
  } catch (error) {
    console.error('Captcha validation error:', error);
    return false;
  }
}
