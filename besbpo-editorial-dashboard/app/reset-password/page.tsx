'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './page.module.css';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(pwd)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/[0-9]/.test(pwd)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate token
    if (!token) {
      setError('Invalid or expired reset link. Please request a new one.');
      return;
    }

    // Validate password
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    // Check password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_CMS_API_URL}/auth/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token, password }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to reset password');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: 'Weak', color: '#dc2626' };
    if (score <= 4) return { score, label: 'Medium', color: '#f59e0b' };
    return { score, label: 'Strong', color: '#10b981' };
  };

  const passwordStrength = password ? getPasswordStrength(password) : null;

  if (!token) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.errorIcon}>!</div>
          <h1 className={styles.title}>Invalid Reset Link</h1>
          <p className={styles.message}>
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <button
            className={styles.button}
            onClick={() => router.push('/forgot-password')}
          >
            Request New Link
          </button>
          <button
            className={styles.secondaryButton}
            onClick={() => router.push('/login')}
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.successIcon}>✓</div>
          <h1 className={styles.title}>Password Reset</h1>
          <p className={styles.message}>
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <button
            className={styles.button}
            onClick={() => router.push('/login')}
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset Password</h1>
        <p className={styles.subtitle}>
          Enter your new password below.
        </p>

        {error && (
          <div className={styles.error}>
            {error}
            <button onClick={() => setError(null)}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>
              New Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="Enter new password"
              autoComplete="new-password"
              disabled={loading}
            />
            {passwordStrength && (
              <div className={styles.passwordStrength}>
                <div className={styles.strengthBar}>
                  <div
                    className={styles.strengthFill}
                    style={{
                      width: `${(passwordStrength.score / 6) * 100}%`,
                      backgroundColor: passwordStrength.color,
                    }}
                  />
                </div>
                <span style={{ color: passwordStrength.color }}>
                  {passwordStrength.label}
                </span>
              </div>
            )}
            <div className={styles.requirements}>
              <span className={password.length >= 8 ? styles.met : styles.unmet}>
                {password.length >= 8 ? '✓' : '○'} At least 8 characters
              </span>
              <span className={/[A-Z]/.test(password) ? styles.met : styles.unmet}>
                {/[A-Z]/.test(password) ? '✓' : '○'} One uppercase letter
              </span>
              <span className={/[a-z]/.test(password) ? styles.met : styles.unmet}>
                {/[a-z]/.test(password) ? '✓' : '○'} One lowercase letter
              </span>
              <span className={/[0-9]/.test(password) ? styles.met : styles.unmet}>
                {/[0-9]/.test(password) ? '✓' : '○'} One number
              </span>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={styles.input}
              placeholder="Confirm new password"
              autoComplete="new-password"
              disabled={loading}
            />
            {confirmPassword && password !== confirmPassword && (
              <span className={styles.mismatch}>Passwords do not match</span>
            )}
          </div>

          <button
            type="submit"
            className={styles.button}
            disabled={loading || !password || password !== confirmPassword}
          >
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              'Reset Password'
            )}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Remember your password?{' '}
            <a href="/login" className={styles.link}>
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
