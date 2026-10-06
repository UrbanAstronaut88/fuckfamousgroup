"use client";
import { useEffect, useState } from "react";
import type { Product } from "../../lib/catalog";
import { AdminSecurity } from "../../components/admin-security";
import Link from "next/link";
type Draft = {
  slug: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  description: string;
  descriptionEn: string;
  price: number;
  category: string;
  image: string;
  active: boolean;
  variants: { size: string; quantity: number }[];
};
const blank = (): Draft => ({
  slug: `merch-${crypto.randomUUID()}`,
  title: "",
  titleEn: "",
  subtitle: "",
  subtitleEn: "",
  description: "",
  descriptionEn: "",
  price: 1200,
  category: "tshirt",
  image: "",
  active: false,
  variants: [
    { size: "S", quantity: 0 },
    { size: "M", quantity: 0 },
    { size: "L", quantity: 0 },
    { size: "XL", quantity: 0 },
  ],
});
export default function AdminPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrollmentRequired, setEnrollmentRequired] = useState(false);
  const [loading, setLoading] = useState(true),
    [authenticated, setAuthenticated] = useState(false),
    [configured, setConfigured] = useState(true);
  const [products, setProducts] = useState<Product[]>([]),
    [revision, setRevision] = useState(0),
    [draftRevision, setDraftRevision] = useState(0),
    [draft, setDraft] = useState<Draft | null>(null),
    [baseline, setBaseline] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const dirty = !!draft && JSON.stringify(draft) !== baseline;
  async function api(body?: unknown) {
    const response = await fetch("/api/admin", {
      method: body ? "POST" : "GET",
      cache: "no-store",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json()) as {
      error?: string;
      authenticated: boolean;
      configured: boolean;
      mfaEnabled: boolean;
      enrollmentRequired: boolean;
      products: Product[];
      revision: number;
    };
    if (!response.ok) {
      if (response.status === 401 && authenticated) setAuthenticated(false);
      throw Error(data.error || "Не вдалося виконати дію.");
    }
    return data;
  }
  function accept(data: { products: Product[]; revision: number }) {
    setProducts(data.products);
    setRevision(data.revision);
  }
  async function load() {
    const data = await api();
    setAuthenticated(data.authenticated);
    setConfigured(data.configured);
    setMfaEnabled(data.mfaEnabled);
    setEnrollmentRequired(data.enrollmentRequired);
    if (data.authenticated && !data.enrollmentRequired) accept(data);
  }
  useEffect(() => {
    // State is updated after the initial network request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const unique = products.filter(
    (p, i, all) => all.findIndex((x) => x.slug === p.slug) === i,
  );
  function mayLeave() {
    return !dirty || window.confirm("Є незбережені зміни. Відкинути їх?");
  }
  function edit(product?: Product) {
    if (!mayLeave()) return;
    const next: Draft = product
      ? {
          slug: product.slug,
          title: product.title,
          titleEn: product.titleEn || "",
          subtitle: product.subtitle,
          subtitleEn: product.subtitleEn || "",
          description: product.description,
          descriptionEn: product.descriptionEn || "",
          price: product.pricePending ? 0 : product.price,
          category: product.category,
          image: product.image,
          active: !!product.active,
          variants: products
            .filter((p) => p.slug === product.slug)
            .map((p) => ({ size: p.size, quantity: p.quantity })),
        }
      : blank();
    setDraft(next);
    setDraftRevision(revision);
    setBaseline(JSON.stringify(next));
    setError("");
    setMessage("");
  }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    setBusy(true);
    setError("");
    try {
      await api({
        action: "login",
        login: data.get("login"),
        password,
        code: data.get("code"),
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function removeProduct() {
    if (!draft || busy) return;
    const saved = products.find((product) => product.slug === draft.slug);
    if (!saved || !window.confirm(`Видалити «${saved.title}» з усіма розмірами? Товар зникне з каталогу та панелі.${dirty ? " Незбережені зміни буде втрачено." : ""}`)) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api({ action: "delete", slug: draft.slug, revision: draftRevision });
      accept(data);
      setDraft(null);
      setBaseline("");
      setMessage("Товар видалено з каталогу та панелі.");
    } catch (error) {
      setError((error as Error).message);
    } finally { setBusy(false); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    if (!draft.image) {
      setError("Додайте фото товару.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api({ action: "save", ...draft, revision: draftRevision });
      accept(data);
      setDraftRevision(data.revision);
      setBaseline(JSON.stringify(draft));
      setMessage(
        draft.active
          ? "Збережено. Товар доступний у каталозі."
          : "Збережено. Товар прихований від відвідувачів.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file || !draft) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 8 * 1024 * 1024
      )
        throw Error("Оберіть JPEG, PNG або WebP до 8 МБ.");
      const bitmap = await createImageBitmap(file);
      const pixels = bitmap.width * bitmap.height;
      bitmap.close();
      if (pixels > 40000000)
        throw Error("Зменште фото до 40 мегапікселів або менше.");
      const response = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const data = (await response.json()) as { error?: string; image: string };
      if (!response.ok)
        throw Error(data.error || "Не вдалося завантажити фото.");
      update("image", data.image);
      setMessage("Фото завантажено. Збережіть товар, щоб застосувати зміни.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    if (!mayLeave()) return;
    setBusy(true);
    try {
      await api({ action: "logout" });
      setAuthenticated(false);
      setDraft(null);
      setProducts([]);
      setMessage("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      data = new FormData(form);
    if (data.get("password") !== data.get("repeat")) {
      setError("Нові паролі не збігаються.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api({
        action: "password",
        currentPassword: data.get("currentPassword"),
        password: data.get("password"),
      });
      form.reset();
      setMessage("Пароль змінено. Інші сеанси завершено.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-shell" lang="uk">
      <header className="admin-header">
        <Link
          href="/"
          onClick={(e) => {
            if (!mayLeave()) e.preventDefault();
          }}
        >
          FFG / ADMIN
        </Link>
        <span>Керування каталогом</span>
        {authenticated && (
          <button disabled={busy} onClick={logout}>
            Вийти
          </button>
        )}
      </header>
      <main className="admin-main">
        <div className="admin-heading">
          <div>
            <p className="eyebrow">FCK FAMOUS GROUP</p>
            <h1>
              {authenticated
                ? "Твої товари."
                : "Вхід до панелі."}
            </h1>
          </div>
          {authenticated && !enrollmentRequired && (
            <button className="primary" disabled={busy} onClick={() => edit()}>
              + Додати товар
            </button>
          )}
        </div>
        {error && (
          <div className="admin-alert" role="alert">
            {error}
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (!mayLeave()) return;
                setBusy(true);
                try {
                  await load();
                  setDraft(null);
                  setError("");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Оновити список
            </button>
          </div>
        )}
        {message && (
          <p className="admin-message" role="status">
            {message}
          </p>
        )}
        {authenticated && <AdminSecurity required={enrollmentRequired} enabled={mfaEnabled} onComplete={load} />}
        {loading ? (
          <p role="status">Завантаження…</p>
        ) : !authenticated ? (
          <form className="admin-login" onSubmit={login}>
            <p>Введіть логін і пароль адміністратора.</p>
            {!configured && <p role="alert">Доступ ще не налаштовано власником сайту.</p>}
            <label>Логін
              <input name="login" required maxLength={128} autoComplete="username" autoCapitalize="none" spellCheck={false} />
            </label>
            <label>Пароль
              <input name="password" type="password" required minLength={12} maxLength={128} autoComplete="current-password" />
            </label>
            {configured && mfaEnabled && <label>
              Код автентифікатора або резервний код
              <input name="code" required maxLength={64} autoComplete="one-time-code" spellCheck={false} />
            </label>}
            <button
              className="primary"
              disabled={busy || !configured}
            >
              {busy ? "Зачекайте…" : "Увійти"}
            </button>
          </form>
        ) : enrollmentRequired ? null : (
          <div className="admin-workspace">
            <aside className="admin-list" aria-label="Товари">
              <p className="admin-help">
                {unique.length} моделей · залишки оновлюйте після підтвердження
                продажу менеджером.
              </p>
              {unique.length === 0 && <p>Додайте перший товар.</p>}
              {unique.map((product) => (
                <button
                  className={`admin-product ${draft?.slug === product.slug ? "is-selected" : ""}`}
                  key={product.slug}
                  disabled={busy}
                  onClick={() => edit(product)}
                >
                  <img src={product.image} alt="" />
                  <span>
                    <strong>{product.title}</strong>
                    <small>
                      {product.pricePending ? "Ціну уточнюйте" : `${product.price} ₴`} ·{" "}
                      {products
                        .filter((p) => p.slug === product.slug)
                        .reduce((n, p) => n + p.quantity, 0)}{" "}
                      шт.
                    </small>
                    <small>
                      {product.active ? "У каталозі" : "Приховано"}
                      {product.isDemo ? " · демо" : ""}
                    </small>
                  </span>
                </button>
              ))}
            </aside>
            <section className="admin-editor">
              {!draft ? (
                <div className="admin-empty">
                  <h2>Обери товар або додай новий.</h2>
                  <p>
                    Заповни тексти двома мовами, додай фото й розміри. Натисни
                    «Зберегти товар» — зміни одразу з’являться на сайті.
                  </p>
                </div>
              ) : (
                <form onSubmit={save}>
                  <fieldset disabled={busy}>
                    <legend>
                      {products.some((p) => p.slug === draft.slug)
                        ? "Редагування товару"
                        : "Новий товар"}
                    </legend>
                    <div className="admin-image-field">
                      {draft.image && (
                        <img src={draft.image} alt="Фото товару" />
                      )}
                      <label>
                        Фото товару
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) => {
                            void upload(e.currentTarget.files?.[0]);
                            e.currentTarget.value = "";
                          }}
                        />
                        <small>
                          JPEG, PNG або WebP · до 8 МБ. Найкраще — квадратне
                          фото.
                        </small>
                      </label>
                    </div>
                    <div className="admin-translations">
                      {(["uk", "en"] as const).map((lang) => {
                        const en = lang === "en";
                        return (
                          <div key={lang}>
                            <h2>{en ? "English" : "Українська"}</h2>
                            <label>
                              Назва
                              <input
                                required
                                maxLength={160}
                                value={en ? draft.titleEn : draft.title}
                                onChange={(e) =>
                                  update(
                                    en ? "titleEn" : "title",
                                    e.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              Колір / крій
                              <input
                                maxLength={200}
                                value={en ? draft.subtitleEn : draft.subtitle}
                                onChange={(e) =>
                                  update(
                                    en ? "subtitleEn" : "subtitle",
                                    e.target.value,
                                  )
                                }
                              />
                            </label>
                            <label>
                              Опис
                              <textarea
                                required
                                maxLength={4000}
                                rows={5}
                                value={
                                  en ? draft.descriptionEn : draft.description
                                }
                                onChange={(e) =>
                                  update(
                                    en ? "descriptionEn" : "description",
                                    e.target.value,
                                  )
                                }
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <div className="admin-row">
                      <label>
                        Ціна, грн (0 — уточнюйте у менеджера)
                        <input
                          type="number"
                          min={0}
                          max={1000000}
                          step={1}
                          required
                          value={draft.price}
                          onChange={(e) =>
                            update("price", Number(e.target.value))
                          }
                        />
                      </label>
                      <label>
                        Категорія
                        <select
                          value={draft.category}
                          onChange={(e) => update("category", e.target.value)}
                        >
                          <option value="tshirt">Футболки</option>
                          <option value="hoodie">Худі</option>
                          <option value="accessory">Аксесуари</option>
                          <option value="sticker">Стікери</option>
                        </select>
                      </label>
                    </div>
                    <h2>Розміри та залишки</h2>
                    <p className="admin-help">
                      Для кепок та аксесуарів можна вказати ONE SIZE.
                    </p>
                    <div className="admin-variants">
                      {draft.variants.map((variant, i) => (
                        <div className="admin-variant" key={i}>
                          <label>
                            Розмір
                            <input
                              required
                              maxLength={24}
                              value={variant.size}
                              onChange={(e) =>
                                update(
                                  "variants",
                                  draft.variants.map((v, j) =>
                                    j === i
                                      ? { ...v, size: e.target.value }
                                      : v,
                                  ),
                                )
                              }
                            />
                          </label>
                          <label>
                            Залишок
                            <input
                              type="number"
                              required
                              min={0}
                              max={100000}
                              step={1}
                              value={variant.quantity}
                              onChange={(e) =>
                                update(
                                  "variants",
                                  draft.variants.map((v, j) =>
                                    j === i
                                      ? {
                                          ...v,
                                          quantity: Number(e.target.value),
                                        }
                                      : v,
                                  ),
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            aria-label={`Прибрати розмір ${variant.size}`}
                            disabled={draft.variants.length === 1}
                            onClick={() =>
                              update(
                                "variants",
                                draft.variants.filter((_, j) => j !== i),
                              )
                            }
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="admin-secondary"
                      disabled={draft.variants.length >= 20}
                      onClick={() =>
                        update("variants", [
                          ...draft.variants,
                          { size: "", quantity: 0 },
                        ])
                      }
                    >
                      + Додати розмір
                    </button>
                    <label className="admin-checkbox">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(e) => update("active", e.target.checked)}
                      />
                      Показувати товар у каталозі
                    </label>
                    <div className="admin-save">
                      <button className="primary" type="submit">
                        {busy ? "Збереження…" : "Зберегти товар"}
                      </button>
                      <span>
                        {dirty ? "Є незбережені зміни" : "Зміни збережено"}
                      </span>
                      {products.some((product) => product.slug === draft.slug) && (
                        <button type="button" className="admin-delete" onClick={removeProduct} disabled={busy}>
                          Видалити товар
                        </button>
                      )}
                    </div>
                  </fieldset>
                </form>
              )}
              <details className="admin-security">
                <summary>Змінити пароль</summary>
                <form onSubmit={changePassword}>
                  <label>
                    Поточний пароль
                    <input
                      type="password"
                      name="currentPassword"
                      required
                      maxLength={128}
                      autoComplete="current-password"
                    />
                  </label>
                  <label>
                    Новий пароль
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </label>
                  <label>
                    Повторіть новий пароль
                    <input
                      type="password"
                      name="repeat"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                    />
                  </label>
                  <button className="admin-secondary" disabled={busy}>
                    Змінити пароль
                  </button>
                </form>
              </details>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
