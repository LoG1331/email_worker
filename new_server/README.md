# new_server

Express backend mới cho mail worker forward-only + xử lý domain-first trên SQLite async.

## Mục tiêu

- Nhận raw MIME từ `new_workers`
- Auth bằng `username + password + JWT session`
- Hỗ trợ `telegramId` và `apiKey` trên user
- Phân quyền theo `domain`, không theo account kiểu cũ
- Group gắn chặt với owner user và lưu danh sách `email_id`
- User thường chỉ monitor mail thuộc mailbox đã claim trong `email_registers`

## Tài liệu

- Human docs: `new_server/API.md`
- Machine-readable spec: `new_server/openapi.json`

## Env chính

- `HOST=0.0.0.0`
- `PORT=3001`
- `NEW_SERVER_SQLITE_PATH=/abs/path/to/new-server.sqlite`
- `INBOUND_AUTH_TOKEN=...`
- `AUTH_JWT_SECRET=...`
- `API_KEY_PEPPER=...`
- `BOOTSTRAP_ADMIN_USERNAME=admin`
- `BOOTSTRAP_ADMIN_PASSWORD=...`
- `BOOTSTRAP_ADMIN_DISPLAY_NAME=Bootstrap Admin`
- `BOOTSTRAP_ADMIN_TELEGRAM_ID=123456789` optional
- `BOOTSTRAP_ADMIN_API_KEY=...` optional
- `CORS_ALLOWED_ORIGINS=https://app.example.com,http://localhost:5173`
- `AUTO_CREATE_DOMAINS_ON_INGEST=false`
- `STORE_RAW_MIME=true`
- `RAW_MIME_RETENTION_DAYS=30`

`FORWARD_AUTH_TOKEN` có thể dùng thay `INBOUND_AUTH_TOKEN` nếu muốn dùng chung secret giữa worker và server.

## Scripts

- `npm run new_server:dev`
- `npm run new_server:start`
- `npm run test:new_server`
- `npm run test:new_server:openapi`
- `npm test`

## Route Summary

- `GET /health`
- `POST /v1/inbound/email`
- `POST /v1/auth/login`
- `POST /v1/auth/logout`
- `POST /v1/auth/refresh`
- `GET /v1/auth/me`
- `PATCH /v1/auth/me`
- `POST /v1/auth/me/password`
- `POST /v1/auth/me/api-key/rotate`
- `GET|POST /v1/users`
- `GET|PATCH /v1/users/:userId`
- `POST /v1/users/:userId/api-key/rotate`
- `GET|POST /v1/admins`
- `DELETE /v1/admins/:userId`
- `GET|POST /v1/permissions`
- `GET|PATCH|DELETE /v1/permissions/:permissionId`
- `GET|POST /v1/domains`
- `GET|PATCH /v1/domains/:domain`
- `GET|POST /v1/email-registers`
- `DELETE /v1/email-registers/:registrationId`
- `GET /v1/emails`
- `GET|DELETE /v1/emails/:id`
- `GET|DELETE /v1/inboxes/:emailAddress`
- `GET|POST /v1/groups`
- `GET|PATCH|DELETE /v1/groups/:groupId`
- `GET|POST /v1/groups/:groupId/emails`
- `DELETE /v1/groups/:groupId/emails/:emailId`
- `POST /v1/maintenance/prune-raw-mime`

## Ghi chú

- `GET /v1/auth/me` là entrypoint tốt nhất cho frontend sau login
- `GET /v1/domains` phản ánh đúng domain user đang có permission
- `GET /v1/emails?scope=registered` luôn khóa theo mailbox đã register của caller, kể cả admin
- `GET /v1/emails?scope=system` chỉ dành cho admin để đọc toàn bộ mail hệ thống
- `GET /v1/emails`, `GET /v1/inboxes/:emailAddress` và `GET /v1/groups/:groupId/emails` của user thường đều bị chặn bởi `email_registers`
- Một mailbox chỉ được đăng ký bởi đúng một user trên toàn hệ thống
- `GET /v1/groups/:groupId/emails` có thể trả `409` và auto-prune các email id đã denied/missing
- Không còn model service/group-address cũ trong backend mới
