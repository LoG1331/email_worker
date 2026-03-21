# New Server API

API docs này bám theo code backend hiện tại trong `new_server/src`.
Mục tiêu là đủ chính xác để build lại frontend mà không phải đoán contract.

Docs machine-readable nằm ở `new_server/openapi.json`.

## Base

- Base URL: `http(s)://<host>:<port>`
- JSON body mặc định cho mọi route trừ inbound raw MIME
- Mọi response đều có `requestId`
- Header `x-request-id` được echo lại nếu client gửi vào, nếu không server tự tạo

## Auth

### 1. User session cho web

- Header: `Authorization: Bearer <sessionToken>`
- Token nhận từ `POST /v1/auth/login`
- Không dùng cookie, không có CSRF flow
- `POST /v1/auth/refresh` gia hạn session và trả token mới

### 2. API key cho bot/script

- Header khuyến nghị: `X-Api-Key: <apiKey>`
- Header thay thế: `Authorization: ApiKey <apiKey>`
- API key được rotate qua:
  - `POST /v1/auth/me/api-key/rotate`
  - `POST /v1/users/:userId/api-key/rotate`

### 3. Inbound từ worker

- Header: `Authorization: Bearer <INBOUND_AUTH_TOKEN>`
- Chỉ dùng cho `POST /v1/inbound/email`

## Permission Model

### Role

- `viewer`: đọc mail
- `operator`: đọc + xóa mail
- `admin`: quản trị domain/mailbox scope

### Scope

- Domain-level permission: `localPart = null`
- Mailbox-level permission: `localPart = "<mailbox>"`
- Global admin: user có row trong bảng `admins`

### Email registration gate

- Bảng `email_registers` lưu mailbox mà user muốn monitor
- User thường chỉ đọc/xóa/fetch mail nếu:
  - mailbox đó vẫn nằm trong permission scope hiện hành
  - và mailbox đó đã được user register
- Mỗi mailbox chỉ được đăng ký bởi một user trên toàn hệ thống
- Group chỉ được chứa email ID thuộc mailbox đã register cho owner của group

### Lưu ý quan trọng cho frontend

- User mailbox-only sẽ có domain nằm trong `accessibleDomains` của `GET /v1/auth/me`
- Nhưng `GET /v1/domains` chỉ trả domain cho:
  - global admin
  - user có domain-level permission
- Vì vậy frontend nên dùng `GET /v1/auth/me` làm nguồn chân lý cho current account + domain scope

## Common Error Shape

```json
{
  "error": "Validation failed",
  "details": [],
  "requestId": "..."
}
```

Status thường gặp:

- `400`: input/query invalid
- `401`: chưa auth hoặc token/api key sai
- `403`: không đủ quyền
- `404`: không tìm thấy resource hoặc resource không thuộc scope user
- `409`: conflict hoặc state bị prune
- `413`: body quá lớn
- `422`: inbound vào domain chưa đăng ký
- `500`: lỗi server

## Data Shapes

### User

```json
{
  "id": 1,
  "username": "alice",
  "displayName": "Alice",
  "telegramId": "123456789",
  "status": "active",
  "hasPassword": true,
  "hasApiKey": true,
  "apiKeyLastFour": "a1b2",
  "isAdmin": false,
  "lastSeenAt": "2026-03-21T10:00:00.000Z",
  "createdAt": "2026-03-21T09:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

### Session

```json
{
  "id": 1,
  "userId": 1,
  "expiresAt": "2026-03-28T10:00:00.000Z",
  "createdAt": "2026-03-21T10:00:00.000Z",
  "lastSeenAt": "2026-03-21T10:00:00.000Z",
  "revokedAt": null,
  "ipAddress": "::1",
  "userAgent": "Mozilla/5.0"
}
```

### Domain

```json
{
  "id": 1,
  "domain": "example.com",
  "description": "Main domain",
  "status": "active",
  "inboundEnabled": true,
  "isDefault": false,
  "counts": {
    "domainPermissions": 1,
    "mailboxPermissions": 4,
    "emails": 250
  },
  "createdAt": "2026-03-21T09:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

### Permission

```json
{
  "id": 10,
  "domain": "example.com",
  "localPart": "alice",
  "emailAddress": "alice@example.com",
  "role": "operator",
  "status": "active",
  "user": {
    "id": 1,
    "username": "alice",
    "displayName": "Alice",
    "telegramId": "123456789",
    "status": "active"
  },
  "grantedBy": {
    "userId": 99,
    "username": "admin",
    "displayName": "Admin"
  },
  "createdAt": "2026-03-21T09:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

### Email

```json
{
  "id": 100,
  "to": "alice@example.com",
  "localPart": "alice",
  "domain": "example.com",
  "envelopeFrom": "sender@example.net",
  "from": {
    "name": "Sender",
    "address": "sender@example.net"
  },
  "subject": "Hello",
  "text": "Hello Alice",
  "html": "<p>Hello Alice</p>",
  "workerName": "edge-sg-1",
  "sourceDomain": "example.com",
  "messageId": "abc@example.net",
  "receivedAt": "2026-03-21T10:00:00.000Z",
  "createdAt": "2026-03-21T10:00:00.000Z",
  "hasRawMime": true,
  "rawMimeSize": 2048,
  "groupCount": 2,
  "rawMime": "base64..."
}
```

- `rawMime` chỉ có khi request bật `includeRawMime`

### Group

```json
{
  "id": 7,
  "ownerUserId": 1,
  "owner": {
    "id": 1,
    "username": "alice",
    "displayName": "Alice"
  },
  "name": "Important",
  "color": "#2563EB",
  "description": "Pinned emails",
  "emailCount": 3,
  "createdAt": "2026-03-21T09:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

### Email Register

```json
{
  "id": 12,
  "ownerUserId": 1,
  "owner": {
    "id": 1,
    "username": "alice",
    "displayName": "Alice"
  },
  "emailAddress": "alice@example.com",
  "localPart": "alice",
  "domain": "example.com",
  "emailCount": 5,
  "latestReceivedAt": "2026-03-21T10:00:00.000Z",
  "createdAt": "2026-03-21T09:00:00.000Z",
  "updatedAt": "2026-03-21T10:00:00.000Z"
}
```

## Auth Routes

### `POST /v1/auth/login`

Body:

```json
{
  "username": "alice",
  "password": "alice-pass-123"
}
```

Response `200`:

```json
{
  "success": true,
  "tokenType": "Bearer",
  "sessionToken": "<jwt>",
  "expiresAt": "2026-03-28T10:00:00.000Z",
  "session": {},
  "account": {
    "...user": true,
    "permissions": []
  },
  "requestId": "..."
}
```

### `POST /v1/auth/logout`

- Auth: session token hoặc api key
- Nếu auth bằng api key thì vẫn trả `success: true`

Response `200`:

```json
{
  "success": true,
  "requestId": "..."
}
```

### `POST /v1/auth/refresh`

- Auth: phải là session token

Response `200`:

```json
{
  "success": true,
  "tokenType": "Bearer",
  "sessionToken": "<jwt>",
  "expiresAt": "2026-03-28T10:00:00.000Z",
  "requestId": "..."
}
```

### `GET /v1/auth/me`

- Auth: session token hoặc api key

Response `200`:

```json
{
  "account": {
    "...user": true,
    "permissions": []
  },
  "accessibleDomains": [
    "example.com"
  ],
  "requestId": "..."
}
```

### `PATCH /v1/auth/me`

Body:

```json
{
  "displayName": "Alice Updated",
  "telegramId": "123456789"
}
```

- `telegramId: null` để xóa

### `POST /v1/auth/me/password`

Body:

```json
{
  "currentPassword": "old-pass",
  "newPassword": "new-pass-123"
}
```

### `POST /v1/auth/me/api-key/rotate`

Body optional:

```json
{
  "apiKey": "custom-api-key-min-16"
}
```

Response `200`:

```json
{
  "success": true,
  "user": {},
  "apiKey": "<plain-text-api-key>",
  "requestId": "..."
}
```

## User Admin Routes

Tất cả route dưới đây cần global admin.

### `GET /v1/users`

Response:

```json
{
  "count": 2,
  "users": [
    {
      "...user": true,
      "permissionCount": 3
    }
  ],
  "requestId": "..."
}
```

### `GET /v1/users/by-telegram/:telegramId`

### `POST /v1/users`

Body:

```json
{
  "username": "alice",
  "password": "alice-pass-123",
  "displayName": "Alice",
  "telegramId": "123456789",
  "status": "active",
  "generateApiKey": true,
  "apiKey": "optional-custom-api-key"
}
```

Notes:

- `username` sẽ được normalize lowercase
- password tối thiểu 8 ký tự
- `generateApiKey` mặc định là `true`

### `GET /v1/users/:userId`

Response trả thêm `permissions`.

### `PATCH /v1/users/:userId`

Body:

```json
{
  "username": "alice2",
  "password": "new-pass-123",
  "displayName": "Alice 2",
  "telegramId": null,
  "status": "disabled"
}
```

### `POST /v1/users/:userId/api-key/rotate`

Body optional:

```json
{
  "apiKey": "optional-custom-api-key"
}
```

## Admin Routes

Tất cả route dưới đây cần global admin.

### `GET /v1/admins`

### `POST /v1/admins`

Body:

```json
{
  "userId": 1
}
```

hoặc

```json
{
  "username": "alice"
}
```

Response `201`:

```json
{
  "success": true,
  "admin": {},
  "requestId": "..."
}
```

### `DELETE /v1/admins/:userId`

- Không cho xóa admin cuối cùng, sẽ trả `409`

## Permission Routes

### `GET /v1/permissions`

- Global admin only
- Query optional:
  - `userId`
  - `username`
  - `domain`
  - `localPart`
  - `role`
  - `status`

### `POST /v1/permissions`

- Global admin only
- Upsert theo scope `(userId/domain/localPart)`

Body:

```json
{
  "userId": 1,
  "domain": "example.com",
  "localPart": "alice",
  "role": "operator",
  "status": "active"
}
```

hoặc tạo user ngầm nếu chưa có:

```json
{
  "username": "alice",
  "displayName": "Alice",
  "telegramId": "123456789",
  "domain": "example.com",
  "localPart": null,
  "role": "viewer"
}
```

Notes:

- `localPart: null` nghĩa là domain-level permission
- Route này luôn trả `201` cả khi create lẫn update scope cũ

### `GET /v1/permissions/:permissionId`

### `PATCH /v1/permissions/:permissionId`

Body:

```json
{
  "role": "admin",
  "status": "active"
}
```

### `DELETE /v1/permissions/:permissionId`

## Domain Routes

### `GET /v1/domains`

- Global admin: thấy tất cả domain
- User thường: chỉ thấy domain mà mình có domain-level permission

### `POST /v1/domains`

- Global admin only
- Upsert domain theo `domain`

Body:

```json
{
  "domain": "example.com",
  "description": "Main domain",
  "status": "active",
  "inboundEnabled": true,
  "isDefault": false
}
```

### `GET /v1/domains/:domain`

- Cần domain-level `viewer` trở lên

### `PATCH /v1/domains/:domain`

- Cần domain-level `admin` hoặc global admin

### `GET /v1/domains/:domain/permissions`

- Cần domain-level `admin` hoặc global admin

### `POST /v1/domains/:domain/permissions`

- Cần domain-level `admin` hoặc global admin
- Upsert permission trong phạm vi domain đó

Body:

```json
{
  "userId": 1,
  "localPart": "alice",
  "role": "operator",
  "status": "active"
}
```

### `GET /v1/domains/:domain/permissions/:permissionId`

### `PATCH /v1/domains/:domain/permissions/:permissionId`

### `DELETE /v1/domains/:domain/permissions/:permissionId`

- Cả 3 route trên đều check `permissionId` có thuộc đúng domain không, sai domain trả `404`

## Email Register Routes

### `GET /v1/email-registers`

- User thường: chỉ thấy mailbox của chính mình
- Global admin: có thể truyền `ownerUserId` để xem mailbox của user khác

### `POST /v1/email-registers`

Body:

```json
{
  "emailAddress": "alice@example.com"
}
```

Rules:

- Mailbox phải còn nằm trong scope permission hiện hành
- Nếu cùng user đăng ký lại mailbox cũ, route hoạt động như idempotent update
- Nếu mailbox đã bị user khác claim, route trả `409`

### `DELETE /v1/email-registers/:registrationId`

- Owner hoặc global admin có thể xóa
- Khi xóa registration, backend sẽ tự gỡ mọi `group_emails` của owner đang trỏ vào mailbox đó

## Email Routes

### `GET /v1/emails`

Query:

- `domain`
- `address`
- `limit` default `50`, max `200`
- `offset` default `0`

Rules:

- Global admin có thể xem toàn cục nếu không truyền filter
- User thường chỉ thấy email thuộc mailbox đã register cho chính mình
- User thường có thể truyền thêm `domain` hoặc `address` để thu hẹp tập mailbox đã register
- Nếu truyền cả hai thì domain trong `address` phải khớp query `domain`

Response:

```json
{
  "total": 100,
  "count": 50,
  "emails": [],
  "requestId": "..."
}
```

### `POST /v1/emails/batch`

Body:

```json
{
  "emailIds": [1, 2, 3],
  "includeRawMime": false
}
```

Response:

```json
{
  "count": 2,
  "emails": [],
  "missingIds": [3],
  "deniedIds": [2],
  "requestId": "..."
}
```

Notes:

- batch là partial success, không fail toàn bộ nếu có id denied/missing
- Với user thường, denied thường đến từ mailbox chưa register hoặc permission đã mất
- max `200` email IDs

### `GET /v1/emails/:id`

Query:

- `includeRawMime=1`

### `DELETE /v1/emails/:id`

- Cần mailbox permission `operator` trở lên và mailbox phải đang được register cho user hiện tại

## Inbox Routes

Path param `emailAddress` phải URL-encode.

Ví dụ:

- `/v1/inboxes/alice%40example.com`

### `GET /v1/inboxes/:emailAddress`

Query:

- `limit` default `50`, max `200`

Rules:

- User thường chỉ fetch được inbox đã register
- Global admin có thể fetch mọi inbox

### `DELETE /v1/inboxes/:emailAddress`

- Xóa toàn bộ mail của inbox
- Cần mailbox permission `operator` trở lên
- User thường còn phải là owner của registration tương ứng

## Group Routes

Group luôn thuộc chặt với owner user.

Rules:

- User thường chỉ thấy group của chính mình
- Global admin có thể list group của user khác bằng `ownerUserId`
- Không có transfer ownership

### `GET /v1/groups`

Query:

- `ownerUserId` chỉ có ý nghĩa với global admin

### `POST /v1/groups`

Body:

```json
{
  "name": "Important",
  "color": "#2563EB",
  "description": "Pinned emails"
}
```

### `GET /v1/groups/:groupId`

### `PATCH /v1/groups/:groupId`

### `DELETE /v1/groups/:groupId`

### `GET /v1/groups/:groupId/emails`

Query:

- `limit` default `100`, max `200`
- `offset` default `0`
- `includeRawMime=1`

Response `200`:

```json
{
  "group": {},
  "total": 3,
  "count": 3,
  "emails": [
    {
      "...email": true,
      "groupPosition": 1,
      "groupAddedAt": "2026-03-21T10:00:00.000Z",
      "groupAddedByUserId": 1
    }
  ],
  "requestId": "..."
}
```

Special case:

- Nếu group chứa email ID bị denied, bị xóa, hoặc owner không còn register mailbox tương ứng, route này sẽ:
  - tự gỡ các email ID lỗi khỏi group
  - trả `409`

Error shape ví dụ:

```json
{
  "error": "Group contained inaccessible emails; denied or stale ids were removed",
  "details": {
    "missingIds": [],
    "deniedIds": [10],
    "prunedIds": [10]
  },
  "requestId": "..."
}
```

Frontend nên:

1. Hiển thị thông báo
2. Reload group một lần nữa

### `POST /v1/groups/:groupId/emails`

Body:

```json
{
  "emailIds": [10, 11, 12]
}
```

- Add theo kiểu append
- Bỏ qua email ID đã có sẵn
- Nếu có mail không truy cập được hoặc owner chưa register mailbox tương ứng, route fail `403`

### `PUT /v1/groups/:groupId/emails`

Body:

```json
{
  "emailIds": [10, 11, 12]
}
```

- Replace toàn bộ danh sách email trong group
- Cho phép mảng rỗng

### `DELETE /v1/groups/:groupId/emails/:emailId`

- Xóa một email khỏi group và reindex `position`

## Inbound Route

### `POST /v1/inbound/email`

- Auth: inbound bearer token
- Content-Type: `message/rfc822`
- Body: raw MIME

Headers hỗ trợ:

- `X-Email-Envelope-To` bắt buộc thực tế để ingest ổn định
- `X-Email-Envelope-From`
- `X-Email-Worker-Name`
- `X-Email-Received-At`
- `X-Email-Domain`
- `X-Email-Message-Id`

Response `202`:

```json
{
  "success": true,
  "id": 100,
  "envelopeTo": "alice@example.com",
  "domain": "example.com",
  "receivedAt": "2026-03-21T10:00:00.000Z",
  "requestId": "..."
}
```

## Maintenance Route

### `POST /v1/maintenance/prune-raw-mime`

- Global admin only

Response:

```json
{
  "success": true,
  "skipped": false,
  "updated": 12,
  "requestId": "..."
}
```

## Health Route

### `GET /health`

Response:

```json
{
  "ok": true,
  "service": "new_server",
  "nodeEnv": "production",
  "storage": {
    "engine": "sqlite",
    "ready": true
  },
  "requestId": "..."
}
```

## Frontend Build Notes

- Sau login, lưu `sessionToken`, không có cookie session
- Gọi `GET /v1/auth/me` ngay sau login để lấy:
  - current account
  - permissions
  - `accessibleDomains`
- Nếu UI có domain picker cho user thường:
  - ưu tiên `accessibleDomains`
  - không phụ thuộc hoàn toàn vào `GET /v1/domains`
- Inbox route phải encode email address trong path
- Khi fetch mail theo list ID cho UI selection:
  - dùng `POST /v1/emails/batch`
  - xử lý `missingIds` và `deniedIds` riêng
- Trước khi user thường monitor mailbox:
  - tạo registration ở `POST /v1/email-registers`
  - sau đó mới dùng list/inbox/group flow
- Khi mở group:
  - nếu `409`, reload lại group/email list ngay
- API key chỉ hiện plain-text đúng lúc rotate/create, frontend không thể lấy lại bản rõ sau đó
