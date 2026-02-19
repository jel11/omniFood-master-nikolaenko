# SSL-сертификаты для локальной разработки (mkcert)

Эта папка предназначена для хранения локальных TLS-сертификатов,
сгенерированных с помощью **mkcert**.

## Как создать сертификаты

```shell
# 1. Установите mkcert (Windows — через Chocolatey):
choco install mkcert

# 2. Установите корневой CA (один раз):
mkcert -install

# 3. Перейдите в папку проекта и создайте сертификат:
cd OmniFood
mkcert -key-file ssl/localhost-key.pem -cert-file ssl/localhost.pem localhost 127.0.0.1

# 4. Запустите HTTPS-сервер:
npx http-server . --ssl --cert ssl/localhost.pem --key ssl/localhost-key.pem -p 8443
```

После запуска откройте: https://localhost:8443
В адресной строке должен появиться замок 🔒.

## ВАЖНО
Файлы `*.pem` добавлены в .gitignore — приватный ключ нельзя публиковать!
