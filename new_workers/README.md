# new_workers

Worker ingress mới, chỉ nhận email và forward raw MIME vào `new_server`.

## Env

- `FORWARD_TARGET_URL=https://server.example.com/v1/inbound/email`
- `FORWARD_AUTH_TOKEN=...`
- `WORKER_NAME=edge-sg-1`
- `EMAIL_DOMAIN=example.com`

## Hành vi

- Không xử lý business logic tại edge.
- Không giữ state admin.
- Forward toàn bộ raw MIME + metadata qua header tương thích với backend mới.

