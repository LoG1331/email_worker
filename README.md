# email_worker

Stack hiện tại chỉ còn 3 phần:

- `new_workers`: worker forward-only
- `new_server`: Express + SQLite backend
- `new_frontend`: Vite React frontend

## Chạy nhanh

Từ root repo:

```bash
npm run dev
```

Lệnh này chạy đồng thời:

- backend tại `http://127.0.0.1:3001`
- frontend tại `http://127.0.0.1:3002`

## Chạy riêng từng phần

```bash
npm run server:dev
npm run frontend:dev
```

## Login mặc định local dev

- `username`: `admin`
- `password`: `admin-pass-123`

## Scripts chính

```bash
npm run server:start
npm run frontend:build
npm run frontend:lint
npm run server:test
npm run server:openapi
npm run worker:bundle
```

## Env dev mặc định

Các script root tự set default local:

- `PORT=3001`
- `NEW_SERVER_SQLITE_PATH=./data/new-server-dev.sqlite`
- `INBOUND_AUTH_TOKEN=dev-inbound-token`
- `AUTH_JWT_SECRET=dev-jwt-secret`
- `API_KEY_PEPPER=dev-api-pepper`
- `BOOTSTRAP_ADMIN_USERNAME=admin`
- `BOOTSTRAP_ADMIN_PASSWORD=admin-pass-123`
- `CORS_ALLOWED_ORIGINS=http://127.0.0.1:3002`

M có thể override bằng env trước khi chạy script.
