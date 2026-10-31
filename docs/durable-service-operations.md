# HTTP-only restaurant operations

PostgreSQL is the authority for customer waiter/payment requests. Requests are
committed before optional WebSocket delivery. The POS, orders and settings screens
read the tenant-scoped queue every five seconds. Staff can acknowledge and resolve
requests; refresh and transport failure do not remove them. Kitchen accounts do not
receive customer messages. Closing or fully paying a table resolves its outstanding
requests in the same database transaction.

Visible POS, order and customer QR screens refresh operational state every ten
seconds. The public catalogue refreshes once a minute. Settings forms retain their
unsaved edits. Offline screens retain their last snapshot; they cannot confirm an
operation until the backend responds. Background/suspended tabs can refresh later.

POS drafts are saved on the current browser, scoped to tenant/user, for eight hours.
QR drafts are scoped to table/device. Reload restores a draft but never opens a
closed table automatically. Browser storage must remain available; clearing browser
data removes local drafts. Drafts are not shared between devices in HTTP-only mode.

Order submission keys and replies are stored atomically with order items, with a
per-table lock. Retries reuse the same key after a lost response. Payment retries
reuse the existing payment ledger key, including after reload. An uncertain payment
locks its amount/method and table/sale selection until reconciled; it must not be
replaced by a different transaction. Customer request retries are also idempotent.

The additive migration `20261031230000` creates `service_request` and
`order_submission`; it does not publish products or open tables. Back up and verify
restore before applying it. Deploy the backend before the frontend. Older clients
remain compatible, but do not gain the new client's persistent retry protection.

Local verification: `python -m pytest -q` with an isolated PostgreSQL database,
Angular unit tests, `npm run build:vercel` without `WS_URL`, and
`node front/scripts/test-durable-operations.mjs`. The browser script refuses public
hostnames and requires synthetic credentials via `SMOKE_CREDENTIALS_PATH`.
Never run mutating operational tests against production.
