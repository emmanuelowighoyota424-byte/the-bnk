'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError('');
    setFieldErrors((prev) => ({ ...prev, [field]: [] }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const clientErrors: Record<string, string[]> = {};
    if (form.password.length < 8) clientErrors.password = ['Password must be at least 8 characters'];
    if (!/[A-Z]/.test(form.password)) (clientErrors.password ??= []).push('Password must contain at least one uppercase letter');
    if (!/[a-z]/.test(form.password)) (clientErrors.password ??= []).push('Password must contain at least one lowercase letter');
    if (!/[0-9]/.test(form.password)) (clientErrors.password ??= []).push('Password must contain at least one number');
    if (form.password !== form.confirmPassword) clientErrors.confirmPassword = ['Passwords do not match'];

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError('Please correct the highlighted fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!data.success) {
        if (data.errors) setFieldErrors(data.errors);
        setError(data.error || 'Registration failed');
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldError = (field: string) => fieldErrors[field]?.filter(Boolean) ?? [];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6"><div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-xl">B</span></div><span className="text-gray-900 font-bold text-2xl">The Bnk</span></Link>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1">Start your financial journey</p>
        </div>
        <div className="card">
          {error && <div role="alert" className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label-text">First Name</label><input type="text" className="input-field" value={form.firstName} onChange={handleChange('firstName')} required aria-invalid={fieldError('firstName').length > 0} />{fieldError('firstName').map((message) => <p key={message} className="mt-1 text-xs text-red-600">{message}</p>)}</div>
              <div><label className="label-text">Last Name</label><input type="text" className="input-field" value={form.lastName} onChange={handleChange('lastName')} required aria-invalid={fieldError('lastName').length > 0} />{fieldError('lastName').map((message) => <p key={message} className="mt-1 text-xs text-red-600">{message}</p>)}</div>
            </div>
            <div><label className="label-text">Email</label><input type="email" className="input-field" placeholder="you@example.com" value={form.email} onChange={handleChange('email')} required aria-invalid={fieldError('email').length > 0} />{fieldError('email').map((message) => <p key={message} className="mt-1 text-xs text-red-600">{message}</p>)}</div>
            <div><label className="label-text">Password</label><input type="password" className="input-field" placeholder="Min. 8 chars, 1 uppercase, 1 number" value={form.password} onChange={handleChange('password')} required aria-invalid={fieldError('password').length > 0} />{fieldError('password').map((message) => <p key={message} className="mt-1 text-xs text-red-600">{message}</p>)}</div>
            <div><label className="label-text">Confirm Password</label><input type="password" className="input-field" value={form.confirmPassword} onChange={handleChange('confirmPassword')} required aria-invalid={fieldError('confirmPassword').length > 0} />{fieldError('confirmPassword').map((message) => <p key={message} className="mt-1 text-xs text-red-600">{message}</p>)}</div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">Already have an account? <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
