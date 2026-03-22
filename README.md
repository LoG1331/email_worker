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

## Production

Build frontend một lần rồi chạy backend:

```bash
npm run build
npm run start
```

Sau khi build, `new_server` sẽ serve luôn file trong `new_frontend/dist` ở cùng origin.

Muốn sinh `.env` production với secret khởi tạo:

```bash
npm run env:init
```

Lệnh này tạo hoặc cập nhật `.env` ở root repo. `npm run start` sẽ tự source file này nếu tồn tại.

## Login mặc định local dev

- `username`: `admin`
- `password`: `admin-pass-123`

## Scripts chính

```bash
npm run build
npm run env:init
npm run start
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
- `BOOTSTRAP_ADMIN_USERNAME=admin`
- `BOOTSTRAP_ADMIN_PASSWORD=admin-pass-123`
- `CORS_ALLOWED_ORIGINS=http://127.0.0.1:3002`

M có thể override bằng env trước khi chạy script.

Lưu ý: `BOOTSTRAP_ADMIN_*` ở script dev chỉ dành cho local bootstrap. Backend hiện không còn ghi đè password/profile của user đã tồn tại khi restart.

## Telegram Bot

Backend hiện support Telegram bot ở webhook mode. Cấu hình chính của bot giờ được lưu qua frontend admin, không cần env Telegram riêng cho token/webhook nữa.

Bot map user qua `users.telegram_id` và dùng permission/mailbox registration hiện có.
