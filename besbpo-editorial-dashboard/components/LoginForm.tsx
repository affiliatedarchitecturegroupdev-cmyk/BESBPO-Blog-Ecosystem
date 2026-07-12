'use client';

import { useState, useTransition, type FormEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '../app/login/actions.ts';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await loginAction(email, password);
      if (result.ok) {
        router.push('/');
        router.refresh(); // re-run the layout's server-side session check
      } else {
        setError(result.error ?? 'Login failed');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="login-form">
      {error && <p className="article-editor__message article-editor__message--error">{error}</p>}

      <label className="article-editor__field">
        Email
        <input
          type="email"
          value={email}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
      </label>

      <label className="article-editor__field">
        Password
        <input
          type="password"
          value={password}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <button type="submit" disabled={isPending}>
        {isPending ? 'Logging in…' : 'Log in'}
      </button>
    </form>
  );
}
