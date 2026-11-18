import { useState } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "../lib/auth";
import { errorMessage } from "../lib/api";
import { Button, Field } from "../components/ui";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(identifier.trim(), password);
    } catch (err) {
      setError(err.response ? errorMessage(err) : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <img src="/images/logo.png" alt="" className="size-11 rounded-lg object-contain" />
          <div>
            <h1 className="text-lg font-semibold text-navy">Kreedum Admin</h1>
            <p className="text-sm text-slate-500">Sign in with your store account</p>
          </div>
        </div>
        <div className="space-y-4">
          <Field label="Email or mobile number">
            <input className="input" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" required autoFocus />
          </Field>
          <Field label="Password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" loading={busy} className="w-full !py-2.5">
            <Lock className="size-4" /> Sign in
          </Button>
        </div>
      </form>
    </div>
  );
}
