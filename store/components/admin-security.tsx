"use client";
import { useState } from "react";

export function AdminSecurity({ required, enabled, onComplete }: {
  required: boolean; enabled: boolean; onComplete: () => Promise<void>;
}) {
  const [secret, setSecret] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(secret ? { action: "mfa_confirm", code: data.get("code") } :
          { action: "mfa_begin", currentPassword: data.get("currentPassword") }),
      });
      const result = await response.json() as { error?: string; secret?: string; recoveryCodes?: string[] };
      if (!response.ok) throw Error(result.error || "Не вдалося налаштувати захист.");
      form.reset();
      if (result.secret) setSecret(result.secret);
      else { setSecret(""); setCodes(result.recoveryCodes || []); await onComplete(); }
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }
  return <details className="admin-security" open={required || !!secret || !!codes.length || undefined}>
    <summary>Двофакторний захист · {enabled ? "увімкнено" : "не підключено"}</summary>
    {required && <p>Перед роботою з каталогом підключіть застосунок-автентифікатор.</p>}
    {error && <p role="alert">{error}</p>}
    {codes.length ? <div>
      <h2>Збережіть резервні коди</h2>
      <p>Кожен код дозволяє один вхід замість коду застосунку. Збережіть їх у менеджері паролів або роздрукуйте. Повторно вони не відображатимуться.</p>
      <pre>{codes.join("\n")}</pre>
      <button type="button" onClick={() => setCodes([])}>Я зберіг / зберегла коди</button>
    </div> : <form onSubmit={submit}>
      {!secret ? <>
        <p>{enabled ? "Для заміни автентифікатора підтвердьте пароль. Старі резервні коди стануть недійсними." : "Використайте Google Authenticator, Microsoft Authenticator або інший застосунок із TOTP."}</p>
        <label>Поточний пароль<input type="password" name="currentPassword" required minLength={12} maxLength={128} autoComplete="current-password" /></label>
      </> : <>
        <p>Додайте обліковий запис вручну: FCK Famous Group, ключ нижче, тип — за часом (TOTP). Ключ дійсний 10 хвилин. Нікому його не передавайте.</p>
        <code className="admin-mfa-key">{secret}</code>
        <label>Шестизначний код<input name="code" required pattern="[0-9]{6}" maxLength={6} inputMode="numeric" autoComplete="one-time-code" /></label>
      </>}
      <button disabled={busy} className="primary">{busy ? "Зачекайте…" : secret ? "Підтвердити захист" : enabled ? "Замінити автентифікатор" : "Підключити автентифікатор"}</button>
    </form>}
  </details>;
}
