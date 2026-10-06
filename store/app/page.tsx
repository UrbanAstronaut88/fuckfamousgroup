"use client";
import { useLanguage, LanguageSwitch } from "../components/language";
import { catalogCount } from "../lib/translations";

import { useEffect, useRef, useState } from "react";
import { type Product } from "../lib/catalog";
import { ContactLinks } from "../components/contact-links";
import { CommunityFooter } from "../components/community-footer";
import { MusicPlayer } from "../components/music-player";
const money = (n: number) => new Intl.NumberFormat("uk-UA").format(n) + " ₴";
export default function Home() {
  const { tr, t, language } = useLanguage();
  const categories = [
    ["all", tr("Весь мерч")],
    ["tshirt", tr("Футболки")],
    ["hoodie", tr("Худі")],
    ["accessory", tr("Аксесуари")],
    ["sticker", tr("Стікери")],
  ];
  const [catalogProducts, setProducts] = useState<Product[]>([]);
  const [view, setView] = useState("catalog");
  const [category, setCategory] = useState("all");
  const [selectedSource, setSelected] = useState<Product | null>(null);
  const [size, setSize] = useState("");
  const [loadError, setLoadError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const main = useRef<HTMLElement>(null);
  async function refresh() {
    setCatalogLoading(true);
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (!response.ok) throw Error();
      const data = (await response.json()) as {
        products: Product[];
      };
      setProducts(data.products);
      setLoadError("");
    } catch {
      setLoadError(
        tr("Не вдалося оновити каталог. Наявність уточнюйте у менеджера."),
      );
    } finally {
      setCatalogLoading(false);
    }
  }
  useEffect(() => {
    // Bootstrap catalog data and browser navigation after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    try {
      localStorage.removeItem("ffg-cart");
    } catch {
      /* Retire the old cart draft. */
    }
    const sync = () => {
      const hash = location.hash.slice(1);
      setView(
        ["catalog", "delivery", "about", "contacts", "privacy"].includes(hash)
          ? hash
          : "catalog",
      );
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    main.current?.scrollTo(0, 0);
  }, [view]);
  useEffect(() => {
    if (selectedSource) dialog.current?.showModal();
  }, [selectedSource]);
  const products = catalogProducts.map((p) =>
    language === "en"
      ? {
          ...p,
          title: p.titleEn || p.title,
          subtitle: p.subtitleEn || p.subtitle,
          description: p.descriptionEn || p.description,
        }
      : p,
  );
  const selected = products.find((p) => p.id === selectedSource?.id) || null;
  const unique = products.filter(
    (p, i, all) => all.findIndex((x) => x.slug === p.slug) === i,
  );
  const visible = unique.filter(
    (p) => category === "all" || p.category === category,
  );
  const variants = selected
    ? products.filter((p) => p.slug === selected.slug)
    : [];
  function openProduct(product: Product) {
    setSelected(product);
    setSize(
      products.find((p) => p.slug === product.slug && p.quantity > 0)?.size ||
        product.size,
    );
  }
  return (
    <div className="store-shell">
      <a className="skip-link" href="#content">
        {tr("До вмісту")}
      </a>
      <div className="announcement">
        <span>FCK FAMOUS GROUP</span>
        <span>UKRAINE · INDEPENDENT RAP</span>
      </div>
      <header className="header">
        <a
          href="#catalog"
          className="brand"
          aria-label={tr("FCK FAMOUS GROUP — головна")}
        >
          <img
            className="brand-logo"
            src="/images/ffg-logo-ak.jpg"
            alt="FCK Famous Group"
            width="1536"
            height="1024"
          />
        </a>
        <nav aria-label={tr("Головна навігація")}>
          <a className={view === "catalog" ? "active" : ""} href="#catalog">
            {tr("Мерч")}
          </a>
          <a className={view === "delivery" ? "active" : ""} href="#delivery">
            {tr("Як замовити")}
          </a>
          <a className={view === "about" ? "active" : ""} href="#about">
            {tr("Про гурт")}
          </a>
        </nav>
        <div className="header-actions">
          <LanguageSwitch />
          <a className="manager-nav" href="#contacts">
            {tr("Замовити мерч")}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>
      <main id="content" ref={main} tabIndex={-1}>
        {view === "catalog" && (
          <section className="catalog page-enter">
            <div className="collection-heading">
              <div>
                <p className="eyebrow">FFG / MERCH COLLECTION</p>
                <h1>{tr("Воля або смерть")}</h1>
              </div>
              <p className="collection-note">
                {tr("Музика — у навушниках.")}
                <br /> {tr("Мерч — на тобі.")}
              </p>
            </div>
            <div className="catalog-toolbar">
              <div
                className="categories"
                role="group"
                aria-label={tr("Категорії товарів")}
              >
                {categories.map(([id, label]) => (
                  <button
                    key={id}
                    className={category === id ? "selected" : ""}
                    aria-pressed={category === id}
                    onClick={() => setCategory(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="catalog-count">
                {catalogCount(visible.length, language)}
              </span>
            </div>
            {loadError && (
              <div className="inline-message" role="alert">
                {tr(
                  "Не вдалося оновити каталог. Наявність уточнюйте у менеджера.",
                )}{" "}
                <button onClick={refresh}>{tr("Оновити")}</button>
              </div>
            )}
            {catalogLoading && (
              <p role="status">
                {t("Завантаження каталогу…", "Loading catalog…")}
              </p>
            )}
            {!catalogLoading && !loadError && visible.length === 0 && (
              <p>
                {t(
                  "У цій категорії поки немає товарів.",
                  "No products in this category yet.",
                )}
              </p>
            )}
            <div className="product-grid">
              {visible.map((product) => (
                <article className="product" key={product.slug}>
                  <button
                    className={`product-image${product.image.startsWith("/images/merch/") ? " product-image-pair" : ""}`}
                    onClick={() => openProduct(product)}
                    aria-label={`${t("Переглянути", "View")} ${product.title}`}
                  >
                    <span className="product-tag">
                      {categories.find(([id]) => id === product.category)?.[1] || "FFG MERCH"}
                    </span>
                    <img src={product.image} alt={product.title} />
                    <span className="product-open" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                  <div className="product-meta">
                    <div>
                      <button
                        className="product-title"
                        onClick={() => openProduct(product)}
                      >
                        {product.title}
                      </button>
                      <p>{product.subtitle}</p>
                    </div>
                    <span className="price">{product.pricePending ? t("Ціну уточнюйте", "Price on request") : money(product.price)}</span>
                  </div>
                </article>
              ))}
            </div>
            <div className="collection-bottom">
              <p>
                <span className="tiny-cross" aria-hidden="true">
                  ✳
                </span>
                {tr("Для тих, хто з нами на одній хвилі.")}
              </p>
            </div>
          </section>
        )}
        {view === "about" && (
          <section className="text-page page-enter">
            <p className="eyebrow">FCK FAMOUS GROUP</p>
            <h1>
              {tr("Воля або смерть.")}
            </h1>
            <p className="large-copy">
              {tr("Мерч українського реп-гурту Fck Famous Group.")}
            </p>
            <p>
              {tr(
                "Для тих, хто слухає, відчуває й залишається поруч. Тут можна обрати речі з символікою FFG та написати менеджеру в Instagram або Telegram.",
              )}
            </p>
            <a className="primary" href="#catalog">
              {tr("Дивитися мерч")}
              <span>↗</span>
            </a>
          </section>
        )}
        {view === "delivery" && (
          <section className="text-page page-enter">
            <p className="eyebrow">{tr("ПЕРЕД ЗАМОВЛЕННЯМ")}</p>
            <h1>
              {tr("Як замовити")}
            </h1>
            {[
              [
                tr("Обери своє"),
                tr(
                  "Переглянь каталог та обери модель і розмір. Наявність товару підтвердить менеджер.",
                ),
              ],
              [
                tr("Напиши менеджеру"),
                tr(
                  "Зв’яжися з нами в Instagram або Telegram. Надішли назву речі та потрібний розмір — менеджер допоможе оформити замовлення.",
                ),
              ],
              [
                tr("Погодь деталі"),
                tr(
                  "Оплату, адресу, вартість і термін доставки погодь із менеджером у листуванні. Оплата на сайті не здійснюється.",
                ),
              ],
            ].map(([heading, copy]) => (
              <div className="info-row" key={heading}>
                <span className="info-dot" aria-hidden="true" />
                <div>
                  <h2>{heading}</h2>
                  <p>{copy}</p>
                </div>
              </div>
            ))}
            <ContactLinks />
          </section>
        )}
        {view === "contacts" && (
          <section className="text-page contacts-page page-enter">
            <p className="eyebrow">{tr("НАПРЯМУ З НАМИ")}</p>
            <h1>
              {tr("ТВОЄ —")}
              <br />
              {tr("В ОДНОМУ ПОВІДОМЛЕННІ.")}
            </h1>
            <p className="large-copy">
              {tr("Для замовлення напиши менеджеру.")}
            </p>
            <p>
              {tr(
                "Вкажи назву мерчу та розмір. Менеджер уточнить наявність, відповість на запитання й погодить оплату та доставку.",
              )}
            </p>
            <ContactLinks />
            <p className="contact-note">
              {tr("Обери зручний для себе месенджер.")}
            </p>
          </section>
        )}
        {view === "privacy" && (
          <section className="text-page page-enter">
            <p className="eyebrow">{tr("ТВОЇ ДАНІ")}</p>
            <h1>{tr("КОНФІДЕНЦІЙНІСТЬ.")}</h1>
            <p>
              {tr(
                "На сайті немає форми замовлення та онлайн-оплати. Для замовлення ти переходиш до Instagram або Telegram і спілкуєшся з менеджером напряму.",
              )}
            </p>
            <p>
              {tr(
                "Сайт не збирає ім’я, телефон чи платіжні дані через форму покупки. Дані, які ти надсилаєш менеджеру, обробляються під час особистого листування. Зовнішні сервіси застосовують власні правила конфіденційності.",
              )}
            </p>
            <p>
              {tr(
                "У цьому браузері можуть зберігатися налаштування мови та музичного плеєра. Захищені cookies використовуються лише для входу адміністратора.",
              )}
            </p>
          </section>
        )}
        <CommunityFooter />
      </main>
      <div className="footer">
        <span className="footer-brand">
          FFG® <span>© {new Date().getFullYear()}</span>
        </span>
        <MusicPlayer />
        <a className="privacy-link" href="#privacy">
          {tr("Конфіденційність ↗")}
        </a>
      </div>
      <dialog
        ref={dialog}
        className="product-dialog"
        aria-label={selected?.title || tr("Товар")}
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            dialog.current?.close();
            setSelected(null);
          }
        }}
      >
        {selected && (
          <div className="product-detail">
            <button
              className="dialog-close"
              aria-label={tr("Закрити")}
              onClick={() => {
                dialog.current?.close();
                setSelected(null);
              }}
            >
              ×
            </button>
            <div className="detail-image">
              <img src={selected.image} alt={selected.title} />
            </div>
            <div className="detail-copy">
              <h2>{selected.title}</h2>
              <p className="detail-price">{selected.pricePending ? t("Ціну уточнюйте", "Price on request") : money(selected.price)}</p>
              <p>{selected.description
                .replace(" Розміри, склад, ціну та наявність уточнюйте у менеджера.", "")
                .replace(" Ask our manager about sizes, fabric, price and availability.", "")
                .replace(" Ціну та наявність уточнюйте у менеджера.", "")
                .replace(" Ask our manager about price and availability.", "")}</p>
              {variants.some(p => p.size !== "УТОЧНЮЄТЬСЯ") && <fieldset>
                <legend>
                  {tr("Розмір")}
                </legend>
                <div className="sizes">
                  {variants.map((product) => (
                    <label
                      key={product.id}
                      className={size === product.size ? "checked" : ""}
                    >
                      <input
                        type="radio"
                        name="size"
                        value={product.size}
                        checked={size === product.size}
                        onChange={() => setSize(product.size)}
                      />
                      {product.size === "УТОЧНЮЄТЬСЯ" ? t("Уточнюється", "On request") : product.size}
                    </label>
                  ))}
                </div>
              </fieldset>}
              <p className="stock">{t("Замовити у менеджера", "Order through our manager")}</p>
              <ContactLinks />
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
