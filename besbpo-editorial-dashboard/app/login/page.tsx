import { LoginForm } from '../../components/LoginForm.tsx';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <section className="login-page">
      <h1>Log in</h1>
      <LoginForm />
    </section>
  );
}
