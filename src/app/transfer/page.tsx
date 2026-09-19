'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import BankNav from '../../components/BankNav';

type Account = {
  id: string;
  accountType: string;
  accountNumber: string;
  balance: string | number;
  availableBalance: string | number;
  currency: string;
  status: string;
};

type TransferResult = {
  transfer?: {
    id: string;
    reference: string;
    amount: string | number;
    fee: string | number;
    totalDebit: string | number;
    currency: string;
    status: string;
    completedAt?: string | null;
  };
  replayed?: boolean;
};

type ApiResponse = {
  success?: boolean;
  data?: Account[] | TransferResult;
  error?: string;
  errors?: Record<string, string[]>;
};

const steps = ['From account', 'Recipient', 'Amount', 'Review', 'Confirmation'];

function asNumber(value: string | number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function money(value: string | number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(asNumber(value));
}

function maskAccount(accountNumber: string) {
  return `•••• ${accountNumber.slice(-4)}`;
}

export default function TransferPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({ senderAccountId: '', recipientAccountNumber: '', amount: '', description: '' });
  const [step, setStep] = useState(0);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [result, setResult] = useState<TransferResult | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch('/api/v1/accounts')
      .then(async (response) => {
        const data = (await response.json()) as ApiResponse;
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load your accounts');
        if (mounted) setAccounts(Array.isArray(data.data) ? data.data : []);
      })
      .catch((requestError: unknown) => {
        if (mounted) setError(requestError instanceof Error ? requestError.message : 'Unable to load your accounts');
      })
      .finally(() => {
        if (mounted) setLoadingAccounts(false);
      });
    return () => { mounted = false; };
  }, []);

  const selectedAccount = useMemo(() => accounts.find((account) => account.id === form.senderAccountId), [accounts, form.senderAccountId]);
  const amount = asNumber(form.amount);
  const available = asNumber(selectedAccount?.availableBalance ?? 0);
  const currency = selectedAccount?.currency || 'USD';
  const canContinue = selectedAccount && amount > 0 && amount <= available && form.recipientAccountNumber.trim().length >= 4;

  function next() {
    setError('');
    setFieldError('');
    if (step === 0 && !selectedAccount) return setFieldError('Select an active account to send from.');
    if (step === 1 && form.recipientAccountNumber.trim().length < 4) return setFieldError('Enter a valid recipient account number.');
    if (step === 2) {
      if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(form.amount) || amount <= 0) return setFieldError('Enter an amount greater than zero, using up to two decimal places.');
      if (amount > available) return setFieldError('The transfer amount exceeds your available balance.');
    }
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function back() {
    setError('');
    setFieldError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  async function submit() {
    if (!selectedAccount || !canContinue) {
      setError('Review the transfer details before confirming.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (!verificationCode) {
        const codeResponse = await fetch('/api/v1/transaction-codes', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ type:'TRANSFER', payload:{senderAccountId:form.senderAccountId,recipientAccountNumber:form.recipientAccountNumber.trim(),amount:form.amount,description:form.description.trim()||''} }) });
        const codeData = await codeResponse.json();
        if (!codeResponse.ok || !codeData.success) throw new Error(codeData.error || 'Unable to send security code.');
        setCodeSent(true);
        return;
      }
      const response = await fetch('/api/v1/transfers', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({
          senderAccountId: form.senderAccountId,
          recipientAccountNumber: form.recipientAccountNumber.trim(),
          amount: form.amount,
          description: form.description.trim() || undefined,
          verificationCode,
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || !data.success) {
        const validation = data.errors ? Object.values(data.errors).flat()[0] : undefined;
        throw new Error(validation || data.error || 'We could not complete the transfer.');
      }
      setResult((data.data as TransferResult) || null);
      setStep(4);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : 'We could not complete the transfer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <BankNav />
      <main className="min-h-[calc(100vh-4rem)] bg-[#f6f5f2] pb-24 lg:pb-10">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-700">Money</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Transfer money</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">Move money securely from one of your accounts to another Crestline Capital account.</p>
            </div>
            <Link href="/transactions" className="hidden shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-[#f6f5f2] sm:inline-flex">Activity</Link>
          </div>

          <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2">
              {steps.map((label, index) => (
                <div key={label} className="flex min-w-0 flex-1 items-center">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index <= step ? 'bg-red-700 text-white' : 'bg-slate-100 text-slate-400'}`} aria-current={index === step ? 'step' : undefined}>
                      {index < step ? '✓' : index + 1}
                    </span>
                    <span className={`hidden truncate text-xs font-semibold sm:block ${index === step ? 'text-slate-950' : 'text-slate-400'}`}>{label}</span>
                  </div>
                  {index < steps.length - 1 && <span className={`mx-2 h-px flex-1 ${index < step ? 'bg-red-600' : 'bg-slate-200'}`} aria-hidden="true" />}
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-500 sm:hidden">Step {step + 1} of {steps.length}: {steps[step]}</p>
          </div>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            {error && <div role="alert" className="mx-5 mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 sm:mx-7">{error}</div>}
            {fieldError && <div role="alert" className="mx-5 mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 sm:mx-7">{fieldError}</div>}

            {loadingAccounts ? <LoadingState /> : step === 0 ? <AccountStep accounts={accounts} selectedId={form.senderAccountId} onSelect={(id) => setForm((current) => ({ ...current, senderAccountId: id }))} /> : null}
            {!loadingAccounts && step === 1 ? <RecipientStep value={form.recipientAccountNumber} onChange={(value) => setForm((current) => ({ ...current, recipientAccountNumber: value }))} /> : null}
            {!loadingAccounts && step === 2 ? <AmountStep currency={currency} amount={form.amount} available={available} description={form.description} onAmountChange={(value) => setForm((current) => ({ ...current, amount: value }))} onDescriptionChange={(value) => setForm((current) => ({ ...current, description: value }))} /> : null}
            {!loadingAccounts && step === 3 ? <ReviewStep account={selectedAccount} recipient={form.recipientAccountNumber} amount={amount} description={form.description} /> : null}
            {!loadingAccounts && step === 4 ? <SuccessStep result={result} recipient={form.recipientAccountNumber} currency={currency} /> : null}

            {!loadingAccounts && step < 4 && (
              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-[#f6f5f2]/70 p-5 sm:flex-row sm:justify-between sm:p-7">
                <button type="button" onClick={back} disabled={step === 0} className="btn-secondary w-full sm:w-auto disabled:invisible">Back</button>
                {step < 3 ? <button type="button" onClick={next} className="btn-primary w-full sm:min-w-40 sm:w-auto">Continue</button> : <div className="flex w-full flex-col gap-3 sm:w-auto sm:min-w-72"><input inputMode="numeric" maxLength={6} placeholder={codeSent ? 'Enter 6-digit email code' : 'Email code required'} value={verificationCode} onChange={e=>setVerificationCode(e.target.value.replace(/\D/g,''))} className="input-field w-full"/>{codeSent&&<p className="text-xs text-slate-500">A security code was sent to your email. Enter it above to confirm.</p>}<button type="button" onClick={submit} disabled={submitting || !canContinue || (codeSent && verificationCode.length!==6)} className="btn-primary w-full">{submitting ? 'Processing…' : codeSent ? 'Confirm transfer' : 'Email me a security code'}</button></div>}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function LoadingState() {
  return <div className="space-y-4 p-5 sm:p-7" aria-label="Loading accounts"><div className="h-5 w-32 animate-pulse rounded bg-slate-200" /><div className="h-20 animate-pulse rounded-2xl bg-slate-100" /><div className="h-20 animate-pulse rounded-2xl bg-slate-100" /></div>;
}

function AccountStep({ accounts, selectedId, onSelect }: { accounts: Account[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="p-5 sm:p-7">
      <div className="mb-6"><h2 className="text-lg font-bold text-slate-950">Choose a source account</h2><p className="mt-1 text-sm text-slate-500">Select the account you want to send money from.</p></div>
      {accounts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center"><p className="font-semibold text-slate-900">No eligible accounts</p><p className="mt-1 text-sm text-slate-500">There are no open accounts available for transfers.</p></div> : <div className="grid gap-3 sm:grid-cols-2">{accounts.filter((account) => account.status === 'active').map((account) => <button type="button" key={account.id} onClick={() => onSelect(account.id)} className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-red-600 ${selectedId === account.id ? 'border-red-600 bg-red-50/60 ring-1 ring-red-600' : 'border-slate-200 hover:border-slate-300 hover:bg-[#f6f5f2]'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-900">{account.accountType.replaceAll('_', ' ')}</p><p className="mt-1 text-xs text-slate-500">{maskAccount(account.accountNumber)}</p></div><span className={`mt-1 h-4 w-4 rounded-full border-2 ${selectedId === account.id ? 'border-indigo-700 bg-red-700 ring-2 ring-white' : 'border-slate-300'}`} aria-hidden="true" /></div><p className="mt-5 text-xl font-bold tracking-tight text-slate-950">{money(account.availableBalance, account.currency)}</p><p className="mt-1 text-xs text-slate-500">Available balance</p></button>)}</div>}
    </div>
  );
}

function RecipientStep({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <div className="p-5 sm:p-7"><div className="mb-6"><h2 className="text-lg font-bold text-slate-950">Who are you sending to?</h2><p className="mt-1 text-sm text-slate-500">Enter the destination account number for the Crestline Capital recipient.</p></div><label className="label-text" htmlFor="recipient-account">Recipient account number</label><input id="recipient-account" inputMode="numeric" autoComplete="off" className="input-field text-base tracking-wide" value={value} onChange={(event) => onChange(event.target.value.replace(/[^0-9A-Za-z-]/g, ''))} placeholder="Enter account number" maxLength={32} autoFocus /><p className="mt-2 text-xs text-slate-500">For your security, recipient details are verified by the bank when the transfer is submitted.</p></div>;
}

function AmountStep({ currency, amount, available, description, onAmountChange, onDescriptionChange }: { currency: string; amount: string; available: number; description: string; onAmountChange: (value: string) => void; onDescriptionChange: (value: string) => void }) {
  return <div className="p-5 sm:p-7"><div className="mb-6"><h2 className="text-lg font-bold text-slate-950">How much?</h2><p className="mt-1 text-sm text-slate-500">Enter the amount you want to transfer.</p></div><div className="rounded-2xl border border-slate-200 bg-[#f6f5f2] p-5"><label className="label-text" htmlFor="transfer-amount">Transfer amount</label><div className="relative"><span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl font-semibold text-slate-400">$</span><input id="transfer-amount" inputMode="decimal" autoComplete="off" className="w-full rounded-xl border border-slate-200 bg-white py-4 pl-10 pr-20 text-2xl font-bold tracking-tight text-slate-950 outline-none focus:border-red-600 focus:ring-2 focus:ring-red-100" value={amount} onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))} placeholder="0.00" maxLength={18} autoFocus /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">{currency}</span></div><div className="mt-3 flex justify-between text-xs"><span className="text-slate-500">Available</span><span className="font-semibold text-slate-800">{money(available, currency)}</span></div></div><div className="mt-5"><label className="label-text" htmlFor="transfer-description">Description <span className="font-normal text-slate-400">(optional)</span></label><input id="transfer-description" className="input-field" value={description} onChange={(event) => onDescriptionChange(event.target.value.slice(0, 200))} placeholder="What is this transfer for?" maxLength={200} /></div></div>;
}

function ReviewStep({ account, recipient, amount, description }: { account?: Account; recipient: string; amount: number; description: string }) {
  return <div className="p-5 sm:p-7"><div className="mb-6"><h2 className="text-lg font-bold text-slate-950">Review your transfer</h2><p className="mt-1 text-sm text-slate-500">Check the details carefully before you confirm.</p></div><div className="overflow-hidden rounded-2xl border border-slate-200"><div className="divide-y divide-slate-100"><Detail label="From" value={`${account?.accountType.replaceAll('_', ' ') || 'Account'} · ${account ? maskAccount(account.accountNumber) : '—'}`} /><Detail label="To" value={`Crestline Capital · ${maskAccount(recipient)}`} /><Detail label="Amount" value={money(amount, account?.currency || 'USD')} strong /><Detail label="Fee" value={money(0, account?.currency || 'USD')} /><Detail label="Total debit" value={money(amount, account?.currency || 'USD')} strong /></div>{description && <div className="border-t border-slate-100 bg-[#f6f5f2] px-4 py-3 text-sm"><span className="font-semibold text-slate-600">Description</span><p className="mt-1 text-slate-900">{description}</p></div>}</div><div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-900"><span className="font-semibold">Security check:</span> your authenticated banking session will authorize this transfer. The bank will validate the recipient, balance, and request again on the server before posting funds.</div></div>;
}

function Detail({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-5 px-4 py-4 sm:px-5"><span className="text-sm text-slate-500">{label}</span><span className={`text-right text-sm ${strong ? 'font-bold text-slate-950' : 'font-semibold text-slate-800'}`}>{value}</span></div>;
}

function SuccessStep({ result, recipient, currency }: { result: TransferResult | null; recipient: string; currency: string }) {
  const transfer = result?.transfer;
  return <div className="p-6 text-center sm:p-10"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-700" aria-hidden="true">✓</div><h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-950">Transfer submitted</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{result?.replayed ? 'This transfer was already processed. No additional funds were moved.' : 'Your transfer has been posted successfully.'}</p><div className="mx-auto mt-7 max-w-md rounded-2xl border border-slate-200 bg-[#f6f5f2] p-5 text-left"><Detail label="Amount" value={money(transfer?.amount ?? 0, transfer?.currency || currency)} strong /><Detail label="Recipient" value={maskAccount(recipient)} /><Detail label="Reference" value={transfer?.reference || '—'} /><Detail label="Status" value={transfer?.status || 'Completed'} /></div><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link href="/dashboard" className="btn-primary">Done</Link><Link href="/transactions" className="btn-secondary">View transactions</Link></div></div>;
}
