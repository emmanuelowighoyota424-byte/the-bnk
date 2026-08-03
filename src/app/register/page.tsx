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

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password }) });
      const data = await res.json();
      if (!data.success) { if (data.errors) setFieldErrors(data.errors); setError(data.error || 'Registration failed'); return; }
      router.push('/dashboard');
      router.refresh();
    } catch { setError('Something went wrong.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6"><div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center"><span className="text-white font-bold text-xl">B</span></div><span className="text-gray-900 font-bold text-2xl">The Bnk</span></Link>
          <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-1">Start your financial journey</p>
        </div>
        <div className="card">
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label-text">First Name</label><input type="text" className="input-field" value={form.firstName} onChange={handleChange('firstName')} required /></div>
              <div><label className="label-text">Last Name</label><input type="text" className="input-field" value={form.lastName} onChange={handleChange('lastName')} required /></div>
            </div>
            <div><label className="label-text">Email</label><input type="email" className="input-field" placeholder="you@example.com" value={form.email} onChange={handleChange('email')} required /></div>
            <div><label className="label-text">Password</label><input type="password" className="input-field" placeholder="Min. 8 chars, 1 uppercase, 1 number" value={form.password} onChange={handleChange('password')} required /></div>
            <div><label className="label-text">Confirm Password</label><input type="password" className="input-field" value={form.confirmPassword} onChange={handleChange('confirmPassword')} required /></div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create Account'}</button>
          </form>
          <p className="mt-6 text-center text-sm text-gray-500">Already have an account? <Link href="/login" className="text-indigo-600 hover:text-indigo-500 font-medium">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}