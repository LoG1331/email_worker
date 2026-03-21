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
- `groups`: group thuộc sở hữu cố định của một user
- `group_emails`: danh sách `email_id` nằm trong group

## Quy tắc quyền

- Admin có full quyền trên mọi domain, user, group, email
- User thường chỉ thấy domain đã được cấp trong `permissions`
- User thường chỉ đọc được mail thuộc mailbox mà chính user đã đăng ký trong `email_registers`
- Hai user không thể cùng đăng ký một `emailAddress`
- Group chỉ thuộc về owner, không chuyển owner
- Muốn add mail vào group thì mailbox đó phải đã được owner đăng ký trước

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

Gỡ quyền admin. Không thể gỡ admin cuối cùng.

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

### `GET /v1/permissions/:permissionId`

Lấy chi tiết một permission.

### `PATCH /v1/permissions/:permissionId`

Chỉ update:

```json
{
  "status": "disabled"
}
```

### `DELETE /v1/permissions/:permissionId`

Xóa permission.

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

### `GET /v1/domains/:domain`

User phải có quyền trên domain đó hoặc là admin.

### `PATCH /v1/domains/:domain`

Admin only.

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

### `POST /v1/email-registers`

Body:

```json
{
  "emailAddress": "alice@example.com"
}
```

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

Xóa đăng ký mailbox. Nếu group của owner đang chứa mail từ mailbox đó thì backend tự gỡ các mail liên quan khỏi group.

## Emails

### `GET /v1/emails`

Query:

- `limit` mặc định `50`, max `200`
- `cursor`: opaque cursor để lấy trang tiếp theo
- `domain`
- `address`
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

### `GET /v1/emails/:id`

Query:

- `includeRawMime=1`

### `DELETE /v1/emails/:id`

User thường chỉ xóa được mail thuộc mailbox đã đăng ký và có permission trên domain.

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

Frontend không dùng route này.

## Maintenance

### `POST /v1/maintenance/prune-raw-mime`

Admin only.

Dùng ở tab overview để cleanup raw MIME đã quá hạn retention.
