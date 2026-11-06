import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { clearAccessCode, getAccessCode, setAccessCode } from "../lib/api";

export function AccessGate({ children }: { children: ReactNode }) {
  const [hasCode, setHasCode] = useState(() => getAccessCode() !== null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onUnauthorized = () => setHasCode(false);
    window.addEventListener("vistet:unauthorized", onUnauthorized);
    return () => window.removeEventListener("vistet:unauthorized", onUnauthorized);
  }, []);

  if (hasCode) return <>{children}</>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/check", { headers: { "x-access-code": code.trim() } });
      if (res.ok) {
        setAccessCode(code.trim());
        setHasCode(true);
      } else if (res.status === 401) {
        clearAccessCode();
        setError("Código incorrecto");
      } else {
        setError("No se ha podido comprobar el código. Inténtalo de nuevo.");
      }
    } catch {
      setError("Sin conexión. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="screen gate">
      <h1>Viste-t</h1>
      <p>Introduce tu código de acceso</p>
      <form onSubmit={submit}>
        <label className="field">
          Código
          <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="current-password" type="password" />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy || code.trim() === ""}>
          Entrar
        </button>
      </form>
    </main>
  );
}
