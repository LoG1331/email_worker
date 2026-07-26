# new_server API

Tài liệu này dành cho frontend mới. Nguồn chuẩn máy đọc vẫn là [`new_server/openapi.json`](./openapi.json).

## Tổng quan

- Base URL dev: `http://127.0.0.1:3001`
- Auth web: `Authorization: Bearer <sessionToken>`
- Content-Type: `application/json` cho hầu hết route
- Mọi response đều có `requestId`
- Frontend nên dùng JWT session cho toàn bộ flow web

## Mô hình hiện tại

- `users`: tài khoản đăng nhập web bằng `username + password`
- `admins`: user có full quyền hệ thống
- `domains`: domain mail đang được hệ thống quản lý
- `permissions`: quyền theo `user + domain + status`
- `email_registers`: mailbox cụ thể mà user đã đăng ký monitor
- `emails`: mail đã ingest
- `blocked_senders`: danh sách người gửi bị chặn theo email hoặc theo domain
- `groups`: group thuộc sở hữu cố định của một user
- `group_emails`: danh sách `email_id` nằm trong group

## Quy tắc quyền

- Admin có full quyền trên mọi domain, user và email; group vẫn owner-scoped
- User thường chỉ thấy domain đã được cấp trong `permissions`
- User thường chỉ đọc được mail thuộc mailbox mà chính user đã đăng ký trong `email_registers`
- Hai user không thể cùng đăng ký một `emailAddress`
- Group chỉ thuộc về owner, không chuyển owner
- Muốn add mail vào group thì mailbox đó phải đã được owner đăng ký trước
- Chỉ admin mới quản lý được danh sách chặn người gửi

## Error format

Response lỗi chuẩn:

```json
{
  "error": "Human readable message",
  "details": {},
  "requestId": "uuid"
}
```

Các mã thường gặp:

- `400`: payload/query/path không hợp lệ
- `401`: chưa login hoặc token lỗi/hết hạn
- `403`: không đủ quyền
- `404`: không tìm thấy bản ghi
- `409`: conflict logic nghiệp vụ

## Auth

### `POST /v1/auth/login`

Body:

```json
{
  "username": "admin",
  "password": "admin-pass-123"
}
```

Response chính:

- `sessionToken`
- `expiresAt`
- `session`
- `account`

### `POST /v1/auth/logout`

Logout session hiện tại.

### `POST /v1/auth/refresh`

Gia hạn session JWT, trả về `sessionToken` mới.

### `GET /v1/auth/me`

Entry point chính sau login.

Response:

- `account`: profile hiện tại, kèm `permissions`
- `accessibleDomains`: danh sách domain user đang có thể truy cập

### `PATCH /v1/auth/me`

Body:

```json
{
  "displayName": "New Name",
  "telegramId": "123456789"
}
```

### `POST /v1/auth/me/password`

Body:

```json
{
  "currentPassword": "old-pass",
  "newPassword": "new-pass-123"
}
```

### `POST /v1/auth/me/api-key/rotate`

Không bắt buộc cho frontend web, nhưng đang dùng ở tab profile để tạo API key mới.

## Users

Admin only.

### `GET /v1/users`

Query hỗ trợ:

- `q`: tìm theo `username`, `displayName`, `telegramId`
- `telegramId`: lọc exact theo Telegram ID
- `limit` mặc định `50`, max `200`
- `offset` mặc định `0`

Trả về:

- `total`
- `count`
- `users[]`
- mỗi user có `permissionCount`

### `POST /v1/users`

Body:

```json
{
  "username": "alice",
  "password": "alice-pass-123",
  "displayName": "Alice",
  "telegramId": "123456789",
  "status": "active"
}
```

Có thể thêm:

- `generateApiKey`
- `apiKey`

### `GET /v1/users/:userId`

Trả về `user` đầy đủ, kèm `permissions[]`.

### `PATCH /v1/users/:userId`

Cho phép đổi:

- `username`
- `password`
- `displayName`
- `telegramId`
- `status`

Guard:

- không thể disable `active admin` cuối cùng

### `POST /v1/users/:userId/api-key/rotate`

Admin rotate API key cho user bất kỳ.

## Admins

Admin only.

### `GET /v1/admins`

Query hỗ trợ:

- `q`: tìm theo `username`, `displayName`, `telegramId`
- `limit` mặc định `50`, max `200`
- `offset` mặc định `0`

Trả về:

- `total`
- `count`
- `admins[]`

### `POST /v1/admins`

Body:

```json
{
  "userId": 12
}
```

hoặc

```json
{
  "username": "alice"
}
```

### `DELETE /v1/admins/:userId`

Gỡ quyền admin. Không thể gỡ `active admin` cuối cùng.

## Permissions

Admin only. Permission hiện chỉ còn theo domain.

Schema:

```json
{
  "id": 1,
  "domain": "example.com",
  "status": "active",
  "user": {
    "id": 12,
    "username": "alice",
    "displayName": "Alice",
    "telegramId": "123456789",
    "status": "active"
  },
  "grantedBy": {
    "userId": 1,
    "username": "admin",
    "displayName": "Admin"
  },
  "createdAt": "2026-03-21T10:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

### `GET /v1/permissions`

Query hỗ trợ:

- `userId`
- `username`
- `domain`
- `status`
- `limit` mặc định `50`, max `200`
- `offset` mặc định `0`

Response:

- `total`
- `count`
- `permissions[]`

### `POST /v1/permissions`

Body:

```json
{
  "userId": 12,
  "domain": "example.com",
  "status": "active"
}
```

Hoặc target theo `username`. Nếu dùng `username` chưa tồn tại thì backend có thể auto-create user shell.
Route này chỉ tạo mới. Nếu permission đã tồn tại thì trả `409`.

### `GET /v1/permissions/:permissionId`

Lấy chi tiết một permission.

### `DELETE /v1/permissions/:permissionId`

Xóa permission.
Nếu user mục tiêu không phải admin toàn cục thì backend sẽ cleanup luôn:

- `email_registers` của user trên domain đó
- link email trong `groups` của user trên domain đó
- pending/failed `telegram_outbox` của user cho domain đó

## Domains

### `GET /v1/domains`

- Admin: thấy tất cả domain
- User thường: chỉ thấy domain đã có permission
- Query hỗ trợ `limit` mặc định `50`, max `200`
- Query hỗ trợ `offset` mặc định `0`

Mỗi domain có:

```json
{
  "counts": {
    "permissionCount": 3,
    "emails": 120
  }
}
```

Response:

- `total`
- `count`
- `domains[]`

### `POST /v1/domains`

Admin only.

Body:

```json
{
  "domain": "example.com",
  "description": "Primary domain",
  "status": "active",
  "inboundEnabled": true,
  "isDefault": false
}
```

Route này chỉ tạo mới. Nếu domain đã tồn tại thì trả `409`.

### `GET /v1/domains/:domain`

User phải có quyền trên domain đó hoặc là admin.

### `DELETE /v1/domains/:domain`

Admin only.
Xóa domain và cascade cleanup toàn bộ `permissions`, `emails`, `email_registers` và liên kết email trong group thuộc domain đó.

## Email Registers

Mailbox registrations để monitor realtime.

### `GET /v1/email-registers`

- User thường: lấy mailbox của chính mình
- Admin: có thể truyền query `ownerUserId`
- Query hỗ trợ `limit` mặc định `50`, max `200`
- Query hỗ trợ `offset` mặc định `0`

Response:

- `total`
- `count`
- `registrations[]`

### `GET /v1/email-registers/new-mail`

Tạo một mailbox ngẫu nhiên rồi register luôn cho owner hiện tại.

Auth:

- dùng được với session token
- dùng được với API key (`X-Api-Key` hoặc `Authorization: ApiKey ...`)

Query tùy chọn:

- `domain`: ép tạo mailbox trên một domain cụ thể
- `ownerUserId`: admin có thể tạo cho user khác

Rules:

- backend chỉ chọn domain `active`
- user thường chỉ được gen trên domain mà caller đang có `permission` `active`
- admin được gen trên toàn bộ domain `active`
- nếu không truyền `domain`, backend ưu tiên domain mặc định hoặc domain đầu tiên trong tập domain mà caller được dùng
- mailbox sinh ra theo pattern giống địa chỉ thật và được retry tới khi tìm được địa chỉ chưa từng xuất hiện trong `email_registers` lẫn `emails`

### `POST /v1/email-registers`

Body:

```json
{
  "emailAddress": "alice@example.com"
}
```

Mailbox chỉ được đăng ký nếu domain đã tồn tại trong bảng `domains`.

Admin có thể thêm:

```json
{
  "emailAddress": "alice@example.com",
  "ownerUserId": 12
}
```

Rules:

- phải có permission trên domain của mailbox
- nếu mailbox đã được user khác đăng ký thì trả `409`
- cùng owner đăng ký lại thì idempotent

### `DELETE /v1/email-registers/:registrationId`

Xóa đăng ký mailbox. Nếu group của owner đang chứa mail từ mailbox đó thì backend tự gỡ các mail liên quan khỏi group. Pending/failed `telegram_outbox` của mailbox đó cũng bị dọn.

## Emails

### `GET /v1/emails`

Query:

- `limit` mặc định `50`, max `200`
- `cursor`: opaque cursor để lấy trang tiếp theo
- `domain`
- `address`
- `search`: có thể nhập nhiều term cách nhau bằng khoảng trắng; mỗi term phải match trên ít nhất một field trong `subject`, `text/html body`, metadata/header đang lưu (`from`, `to`, `messageId`, `envelopeFrom`, `workerName`, `sourceDomain`) hoặc `raw MIME` nếu mail đó còn lưu MIME gốc
- `scope=registered|system`

Rules:

- User thường chỉ dùng `scope=registered` và chỉ thấy mail của mailbox đã đăng ký bởi chính họ
- Admin có thể dùng `scope=system` để đọc toàn bộ mail hệ thống
- Nếu không truyền `scope` thì backend giữ behavior mặc định theo auth hiện tại

Response:

- `count`
- `emails[]`
- `hasMore`
- `nextCursor`

Mọi route trả danh sách mail (`GET /v1/emails`, `GET /v1/inboxes/:emailAddress`, `GET /v1/groups/:groupId/emails`) đều trả bản rút gọn `EmailSummary`, **không kèm `text` và `html` đầy đủ**:

- `preview`: 400 ký tự đầu của text body, đủ để render dòng danh sách
- `hasText` / `hasHtml`: cho biết mail có nội dung dạng nào mà không cần tải nội dung

Lý do: nhét cả body vào từng dòng làm payload phình theo số mail (50 mail ≈ 440KB), gây giật UI khi hộp thư lớn. Cần nội dung đầy đủ thì gọi route chi tiết.

### `GET /v1/emails/:id`

Trả `Email` đầy đủ, có `text` và `html`.

Query:

- `includeRawMime=1`

### `DELETE /v1/emails/:id`

User thường chỉ xóa được mail thuộc mailbox đã đăng ký và có permission trên domain.

### `POST /v1/emails/bulk-delete`

Body:

```json
{
  "emailIds": [1, 2, 3]
}
```

Behavior:

- tối đa `200` email IDs mỗi request
- backend kiểm quyền `write` trên từng email trước khi xóa
- response trả thêm `deletedIds`, `missingIds`, `deniedIds` để frontend xử lý batch stale selection

## Blocked Senders

Admin only. Mail từ người gửi bị chặn sẽ bị bỏ ngay ở bước ingest: không lưu DB, không vào group, không bắn Telegram.

### `GET /v1/blocked-senders`

Query:

- `q`: tìm theo `pattern` hoặc `reason`
- `patternType=email|domain`
- `status=active|disabled`
- `scope=global|domain`
- `domain`: lọc theo domain nhận mà rule bị giới hạn
- `limit` mặc định `50`, max `200`
- `offset` mặc định `0`

Response:

- `total`
- `count`
- `blockedSenders[]`

### `POST /v1/blocked-senders`

Body:

```json
{
  "pattern": "spam@example.com",
  "patternType": "email",
  "domain": null,
  "reason": "Spam quảng cáo",
  "status": "active"
}
```

Behavior:

- `patternType` bỏ trống thì backend tự suy ra: có `@` là `email`, không có là `domain`
- `pattern` dạng `@example.com` cũng được hiểu là chặn cả domain
- `patternType=domain` chặn luôn mọi subdomain, ví dụ `example.com` chặn cả `mail.example.com`
- `domain` bỏ trống hoặc `null` thì rule áp dụng toàn hệ thống, ngược lại chỉ áp dụng cho mail gửi tới domain nhận đó
- trùng `patternType + pattern + domain` thì trả `409`

### `GET /v1/blocked-senders/:blockedSenderId`
### `PATCH /v1/blocked-senders/:blockedSenderId`

Body nhận các field như khi tạo, tất cả đều optional. Dùng `status=disabled` để tạm tắt rule mà không xóa.

### `DELETE /v1/blocked-senders/:blockedSenderId`

Xóa hẳn rule. Mail đã bị chặn trước đó không được khôi phục.

## Inboxes

### `GET /v1/inboxes/:emailAddress`

Path phải URL-encode, ví dụ `alice%40example.com`.

Query:

- `limit`, mặc định `50`, max `200`
- `cursor`: opaque cursor để lấy trang tiếp theo
- `stime`: Unix timestamp dạng số, chỉ trả mail có `receivedAt` lớn hơn mốc này

Rules:

- mailbox phải thuộc `email_registers` của caller, trừ admin
- caller phải có permission trên domain của mailbox

Response:

- `count`
- `emails[]`
- `hasMore`
- `nextCursor`

### `DELETE /v1/inboxes/:emailAddress`

Xóa toàn bộ mail của mailbox.

## Groups

Group luôn thuộc về một owner user.

### `GET /v1/groups`

- Luôn chỉ list group của chính user hiện tại
- Admin cũng không đọc group của user khác qua route này
- Query hỗ trợ `limit` mặc định `50`, max `200`
- Query hỗ trợ `offset` mặc định `0`

Response:

- `total`
- `count`
- `groups[]`

### `POST /v1/groups`

Body:

```json
{
  "name": "Important",
  "color": "#3B82F6",
  "description": "Pinned mail"
}
```

### `GET /v1/groups/:groupId`
### `PATCH /v1/groups/:groupId`
### `DELETE /v1/groups/:groupId`

Chỉ owner group mới thao tác được.

### `POST /v1/groups/:groupId/emails`

Append thêm mail vào group.

Body hỗ trợ 1 trong 2 kiểu:

```json
{
  "emailIds": [1, 2, 3]
}
```

hoặc

```json
{
  "emailAddresses": ["alice@example.com", "ops@example.com"]
}
```

Behavior với `emailAddresses`:

- backend sẽ auto-register mailbox cho owner nếu mailbox đó chưa được owner đăng ký
- nếu mailbox đã do user khác đăng ký thì trả `409`
- sau đó backend lấy toàn bộ email hiện có của các mailbox đó để append vào group

### `GET /v1/groups/:groupId/emails`

Query:

- `limit` mặc định `100`, max `200`
- `cursor`: opaque cursor theo thứ tự email trong group
- `includeRawMime=1`

Behavior:

- chỉ owner group mới đọc được
- backend kiểm lại quyền của owner trên từng email trong group
- nếu group chứa email đã missing hoặc denied thì backend tự gỡ chúng và trả `409`

Response:

- `group`
- `count`
- `emails`
- `hasMore`
- `nextCursor`

### `DELETE /v1/groups/:groupId/emails/:emailId`

Gỡ một email khỏi group.

## Inbound

### `POST /v1/inbound/email`

Worker-only route.

- Auth bằng inbound token
- Body là raw MIME
- Header chính:
  - `X-Email-Envelope-To`
  - `X-Email-Envelope-From`
  - `X-Email-Worker-Name`

Nếu người gửi khớp một rule trong `blocked_senders` thì mail bị bỏ: response vẫn là `202` với `blocked: true`, `id: null` và `blockedBy` mô tả rule đã khớp. Trả `202` để worker coi như đã xử lý xong, không retry và không bounce ngược về người gửi.

Frontend không dùng route này.

## Maintenance

### `GET /v1/maintenance/storage`

Admin only.

Trả về dung lượng hiện tại của:

- file SQLite chính
- file `-wal`
- file `-shm`
- tổng dung lượng thư mục chứa SQLite

### `POST /v1/maintenance/prune-raw-mime`

Admin only.

Dùng ở tab overview để cleanup raw MIME đã quá hạn retention.

### `POST /v1/maintenance/prune-emails`

Admin only.

Xóa mail cũ toàn hệ thống theo lô để dọn SQLite lớn.

Body:

```json
{
  "olderThanDays": 30,
  "domain": "example.com",
  "dryRun": true,
  "limit": 5000
}
```

Rules:

- `olderThanDays` là bắt buộc
- `domain` là tùy chọn để chỉ dọn một domain
- `dryRun=true` chỉ thống kê, chưa xóa
- `limit` giới hạn số mail bị xóa trong một lần chạy
- backend sẽ reindex lại `group_emails` và cập nhật `groups.updated_at` cho group bị ảnh hưởng
- nếu `dryRun=false`, backend sẽ tự `VACUUM` SQLite ngay sau khi xóa xong

## System

### `GET /v1/system/telegram`

Super admin only.

Trả về:

- `settings`: public Telegram settings, không lộ bot token thô
- `runtime`: trạng thái runtime hiện tại, gồm webhook, outbox và lỗi gần nhất

### `PATCH /v1/system/telegram`

Super admin only.

Body hỗ trợ:

```json
{
  "enabled": true,
  "publicBaseUrl": "https://example.com",
  "botToken": "123456:bot-token",
  "clearBotToken": false
}
```

Behavior:

- lưu cấu hình bot vào `system_settings`
- tự generate webhook secret nếu chưa có
- reload Telegram runtime ngay sau khi lưu
- nếu reload fail thì backend rollback lại config Telegram trước đó và cố gắng khởi động lại runtime cũ
- nếu reload runtime fail thì trả `502` kèm `settings` và `runtime` hiện tại

### `POST /v1/system/telegram/commands/register`

Super admin only.

Đăng ký lại danh sách command của bot với Telegram API.

Trả về:

- `count`
- `commands[]`
- `runtime`

## Telegram

### `POST /v1/telegram/webhook`

Webhook route cho Telegram Bot.

- Không dùng JWT session
- Phải gửi header `X-Telegram-Bot-Api-Secret-Token`
- Secret phải khớp `webhookSecret` đang lưu trong system settings
- Body là update JSON từ Telegram

Response chính:

- `success`
- `handled`
