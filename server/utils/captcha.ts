/**
 * Validates a Google reCAPTCHA token
 * @param token The reCAPTCHA token to validate
 * @returns A promise that resolves to a boolean indicating if the token is valid
 */
export async function validateCaptcha(token: string): Promise<boolean> {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    // If no secret key is available, return true to allow development without captcha
    if (!secretKey) {
      console.warn('RECAPTCHA_SECRET_KEY not set. Captcha validation bypassed.');
      return true;
    }
    
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `secret=${secretKey}&response=${token}`,
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Captcha validation error:', error);
    // In case of error, fail closed for security
    return false;
  }
}