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
- `BOOTSTRAP_ADMIN_USERNAME=admin`
- `BOOTSTRAP_ADMIN_PASSWORD=...`
- `CORS_ALLOWED_ORIGINS=https://app.example.com,http://localhost:5173`
- `AUTO_CREATE_DOMAINS_ON_INGEST=false`
- `STORE_RAW_MIME=true`
- `RAW_MIME_RETENTION_DAYS=30`

`AUTH_JWT_SECRET` và `API_KEY_PEPPER` vẫn có thể set nếu muốn tự quản secret nội bộ. Nếu bỏ trống thì backend sẽ tự generate secret riêng và lưu trong SQLite, không reuse `INBOUND_AUTH_TOKEN` cho auth user/session.

## Scripts

- `npm run build`
- `npm run env:init`
- `npm run start`
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
- `GET|DELETE /v1/permissions/:permissionId`
- `GET|POST /v1/domains`
- `GET|DELETE /v1/domains/:domain`
- `GET|POST /v1/email-registers`
- `GET /v1/email-registers/new-mail` (session/API key; user theo domain có permission, admin theo toàn bộ domain `active`)
- `DELETE /v1/email-registers/:registrationId`
- `GET /v1/emails`
- `GET|DELETE /v1/emails/:id`
- `GET|DELETE /v1/inboxes/:emailAddress`
- `GET|POST /v1/groups`
- `GET|PATCH|DELETE /v1/groups/:groupId`
- `GET|POST /v1/groups/:groupId/emails`
- `DELETE /v1/groups/:groupId/emails/:emailId`
- `POST /v1/maintenance/prune-raw-mime`
- `GET /v1/maintenance/storage`
- `POST /v1/maintenance/prune-emails`
- `GET|PATCH /v1/system/telegram`
- `POST /v1/system/telegram/commands/register`
- `POST /v1/telegram/webhook` when Telegram bot enabled

## Telegram Bot

Bot map Telegram sender id vào `users.telegram_id` và dùng permission/mailbox registration hiện có.
Admin cấu hình bot từ frontend qua `GET|PATCH /v1/system/telegram` và có thể đăng ký lại command qua `POST /v1/system/telegram/commands/register`. Backend sẽ:

- lưu token + webhook secret trong SQLite
- reload runtime ngay sau khi lưu
- tự register webhook khi bot được bật
- giữ retry outbox trong SQLite nếu gửi Telegram fail

Commands:

- `/start`
- `/help`
- `/mailboxes`
- `/register <email>`
- `/unregister <email>`
- `/inbox <email>`
- `/email <id>`
- `/delete <id>`
- `/clear <email>`

## Ghi chú

- `npm run env:init` sẽ tạo/cập nhật `.env` ở root repo với secret khởi đầu; `npm run start` tự source `.env` nếu file tồn tại
- Trong production, `new_server` tự serve frontend build từ `new_frontend/dist` nếu thư mục này tồn tại
- `GET /v1/auth/me` là entrypoint tốt nhất cho frontend sau login
- `GET /v1/domains` phản ánh đúng domain user đang có permission
- `GET /v1/emails?scope=registered` luôn khóa theo mailbox đã register của caller, kể cả admin
- `GET /v1/emails?scope=system` chỉ dành cho admin để đọc toàn bộ mail hệ thống
- `GET /v1/emails`, `GET /v1/inboxes/:emailAddress` và `GET /v1/groups/:groupId/emails` của user thường đều bị chặn bởi `email_registers`
- Một mailbox chỉ được đăng ký bởi đúng một user trên toàn hệ thống
- `BOOTSTRAP_ADMIN_*` chỉ nên dùng để tạo admin ban đầu; nếu username đã tồn tại thì backend chỉ ensure quyền admin, không ghi đè password/profile sẵn có
- `POST /v1/domains` và `POST /v1/permissions` là create-only, không còn upsert
- `DELETE /v1/domains/:domain` sẽ cascade xoá `permissions`, `emails`, `email_registers` và link email trong group thuộc domain đó
- `DELETE /v1/permissions/:permissionId` của user thường sẽ dọn luôn registrations, group links và pending Telegram outbox của domain đó
- Không thể disable hoặc revoke `active admin` cuối cùng
- `GET /v1/email-registers/new-mail` dùng được với session token hoặc API key; user thường chỉ gen trên domain mình có quyền, admin thì trên toàn bộ domain `active`
- `GET /v1/maintenance/storage` trả về dung lượng SQLite hiện tại (`sqlite`, `-wal`, `-shm`) và tổng dung lượng thư mục chứa DB
- `POST /v1/maintenance/prune-emails` hỗ trợ `dryRun`, `domain`, `olderThanDays`, `limit` để dọn mail cũ theo lô và sẽ tự `VACUUM` ngay sau lần xóa thật
- `GET /v1/groups/:groupId/emails` có thể trả `409` và auto-prune các email id đã denied/missing
- Không còn model service/group-address cũ trong backend mới
- Telegram webhook được register/re-register khi admin lưu cấu hình bot; nếu reload fail thì config Telegram sẽ rollback về state trước đó
- Notification Telegram đi qua outbox SQLite và retry nền nếu gửi fail
