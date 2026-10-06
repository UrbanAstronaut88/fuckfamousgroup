export function catalogCount(count: number, language: "uk" | "en") {
  const form = new Intl.PluralRules(language).select(count);
  const label = language === "en"
    ? (form === "one" ? "item" : "items")
    : (form === "one" ? "позиція" : form === "few" ? "позиції" : "позицій");
  return `${count} ${label}`;
}

export const english: Record<string, string> = {
  "Весь мерч": "All merch",
  Футболки: "T-shirts",
  Худі: "Hoodies",
  Стікери: "Stickers",
  Аксесуари: "Accessories",
  "До вмісту": "Skip to content",
  "FCK FAMOUS GROUP — головна": "FCK FAMOUS GROUP — home",
  "Головна навігація": "Main navigation",
  Мерч: "Merch",
  "Як замовити": "How to order",
  "Про гурт": "About the band",
  "Замовити мерч": "Order merch",
  "Воля або смерть": "Freedom or death",
  "Музика — у навушниках.": "Music in your headphones.",
  "Мерч — на тобі.": "FFG on you.",
  "Категорії товарів": "Product categories",
  Оновити: "Refresh",
  "Не вдалося оновити каталог. Наявність уточнюйте у менеджера.":
    "The catalog could not be loaded. Please contact our manager or try again.",
  "Для тих, хто з нами на одній хвилі.": "For those on the same wavelength.",
  "Воля або смерть.": "Freedom or death.",
  "Мерч українського реп-гурту Fck Famous Group.":
    "Merch by Ukrainian rap group Fck Famous Group.",
  "Для тих, хто слухає, відчуває й залишається поруч. Тут можна обрати речі з символікою FFG та написати менеджеру в Instagram або Telegram.":
    "For those who listen, feel it and stay close. Explore FFG merch and contact our manager on Instagram or Telegram.",
  "Дивитися мерч": "Explore merch",
  "ПЕРЕД ЗАМОВЛЕННЯМ": "BEFORE YOU ORDER",
  ДОСТАВКА: "DELIVERY",
  "Й ОПЛАТА.": "& PAYMENT.",
  "Обери своє": "Find your merch",
  "Переглянь каталог та обери модель і розмір. Наявність товару підтвердить менеджер.":
    "Browse the catalog and choose a model and size. Our manager will confirm availability.",
  "Напиши менеджеру": "Contact our manager",
  "Зв’яжися з нами в Instagram або Telegram. Надішли назву речі та потрібний розмір — менеджер допоможе оформити замовлення.":
    "Message us on Instagram or Telegram. Send the product name and your size — our manager will help you place your order.",
  "Погодь деталі": "Confirm the details",
  "Оплату, адресу, вартість і термін доставки погодь із менеджером у листуванні. Оплата на сайті не здійснюється.":
    "Agree on payment, your address, shipping cost and delivery time with our manager. Payments are not made on this website.",
  "НАПРЯМУ З НАМИ": "DIRECTLY WITH US",
  "ТВОЄ —": "YOURS —",
  "В ОДНОМУ ПОВІДОМЛЕННІ.": "ONE MESSAGE AWAY.",
  "Для замовлення напиши менеджеру.": "To order, contact our manager.",
  "Вкажи назву мерчу та розмір. Менеджер уточнить наявність, відповість на запитання й погодить оплату та доставку.":
    "Send the product name and size. Our manager will check availability, answer your questions and arrange payment and delivery.",
  "Обери зручний для себе месенджер.":
    "Choose the messenger that works for you.",
  "ТВОЇ ДАНІ": "YOUR DATA",
  "КОНФІДЕНЦІЙНІСТЬ.": "PRIVACY.",
  "На сайті немає форми замовлення та онлайн-оплати. Для замовлення ти переходиш до Instagram або Telegram і спілкуєшся з менеджером напряму.":
    "There is no checkout or online payment form on this site. To order, open Instagram or Telegram and contact our manager directly.",
  "Сайт не збирає ім’я, телефон чи платіжні дані через форму покупки. Дані, які ти надсилаєш менеджеру, обробляються під час особистого листування. Зовнішні сервіси застосовують власні правила конфіденційності.":
    "The site does not collect your name, phone number or payment details through a checkout form. Information you send our manager is handled in your private conversation. External services apply their own privacy policies.",
  "У цьому браузері можуть зберігатися налаштування мови та музичного плеєра. Захищені cookies використовуються лише для входу адміністратора.":
    "This browser may store your language and music player preferences. Secure cookies are used only for administrator sign-in.",
  "Конфіденційність ↗": "Privacy ↗",
  Товар: "Product",
  Закрити: "Close",
  Розмір: "Size",
  "Для замовлення:": "To order:",
  "Наявність і деталі уточнить менеджер.":
    "Our manager will confirm availability and details.",
  "Соцмережі та музика гурту": "Band social media and music",
  Соцмережі: "Social media",
  "Музичні платформи": "Listen to FFG",
  "Наші партнери": "Our partners",
  "Музичний плеєр FFG": "FFG music player",
  "Попередній трек": "Previous track",
  "Наступний трек": "Next track",
  "Призупинити музику": "Pause music",
  "Увімкнути музику": "Play music",
  "Не вдалося завантажити трек": "Track could not be loaded",
  "Натисни ▶, щоб слухати": "Press ▶ to listen",
  "ЗАРАЗ ГРАЄ": "NOW PLAYING",
  "FFG / Київ": "FFG / Qyiv",
  "Позиція відтворення": "Playback position",
  "Увімкнути звук": "Unmute",
  "Вимкнути звук": "Mute",
  Гучність: "Volume",
};
export function translate(text: string, language: "uk" | "en") {
  const key = text.replace(/\s+/g, " ").trim();
  return language === "en" ? english[key] || text : text;
}
