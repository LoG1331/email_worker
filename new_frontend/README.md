# new_frontend

Frontend mới cho `new_server`, viết bằng Vite + React 19 + Tailwind 4.

## Mục tiêu

- Dùng session web `username + password + JWT`
- Gọi toàn bộ API backend mới trừ các route rotate/generate API key
- Cung cấp shell quản trị và vận hành chung cho:
  - overview + account
  - emails + inbox + batch fetch
  - groups
  - domains + nested permissions
  - users
  - global permissions
  - admins
  - maintenance

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`

Từ repo root:

- `npm run new_frontend:dev`
- `npm run new_frontend:build`
- `npm run new_frontend:lint`

## Env

- `VITE_API_BASE_URL`

Nếu không set `VITE_API_BASE_URL`, frontend sẽ gọi relative path `/health` và `/v1/*`.
Trong dev mode, `vite.config.js` đã proxy sẵn sang `http://127.0.0.1:3001`.

## Ghi chú

- Frontend này không dùng cookie auth.
- Session token được giữ ở `localStorage`.
- `sessionExpiresAt` được decode trực tiếp từ JWT để không mất khi reload.
- Group fetch tự xử lý case backend trả `409` khi auto-prune email ID bị denied/missing.
