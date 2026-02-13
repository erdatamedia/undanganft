# Deploy ke VPS (PM2, tanpa Docker)

Panduan singkat untuk deploy ke VPS berbasis Ubuntu dengan PM2.

## 1) Persiapan VPS

- Pastikan Node.js 20+ terpasang.
- Install pnpm:
  `corepack enable && corepack prepare pnpm@latest --activate`

## 2) Clone & Install

```bash
git clone git@github.com:erdatamedia/undanganft.git
cd undanganft
pnpm install
```

## 3) Konfigurasi Environment

```bash
cp .env.example .env.local
```

Isi variabel penting:
- `DATABASE_URL`
- `SESSION_SECRET`
- `APP_BASE_URL`
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

## 4) Migrasi Database (sekali saja)

Jalankan di psql:
```sql
ALTER TABLE attendees
ADD COLUMN IF NOT EXISTS npm text NOT NULL DEFAULT '-';

ALTER TABLE attendees
ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
```

## 5) Build & Start (PM2)

```bash
pnpm build
pnpm add -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

> Default port 3000. Ubah `args` di `ecosystem.config.cjs` jika ingin port lain.

## 6) (Opsional) Nginx Reverse Proxy

Contoh server block:

```
server {
  listen 80;
  server_name undangan.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## 7) Update Rutin

```bash
git pull
pnpm install
pnpm build
pm2 restart undanganft
```
