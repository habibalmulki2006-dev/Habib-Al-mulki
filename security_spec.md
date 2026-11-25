# Security Specification — TernakAceh Firestore Rules

## 1. Data Invariants
1. **Role & Privilege Integrity**: Users cannot self-assign `role: "operator"` or `role: "admin"` when creating or updating `/users/{userId}`. Only an Admin (`habibalmulki2006@gmail.com` verified or listed in `/admins/{uid}`) may promote roles or grant `/admins/{uid}` markers.
2. **PII Isolation**: User email addresses reside exclusively in `/users/{userId}/private/info`, accessible only to the owning user (`request.auth.uid == userId`) or an Admin.
3. **Livestock Ownership & Role Gate**: Only verified `operator` or `admin` users may create livestock listings under `/livestock/{livestockId}` (`ownerId == request.auth.uid`), and `ownerId`/`createdAt` remain immutable.
4. **Order & Escrow Integrity**: Every order under `/orders/{orderId}` must reference an existing `/livestock/{ternakId}` document, bind `buyerId == request.auth.uid` on creation, enforce server timestamp (`request.time`), and lock terminal escrow state (`isEscrowReleased == true`) against non-admin mutations.
5. **Kandang Virtual Logs (Master Gate)**: Every log under `/orders/{orderId}/logs/{logId}` must verify that its parent `/orders/{orderId}` exists and that the author is either the parent `buyerId`, an `operator`, or an `admin`.
6. **Verification Queue**: Verification requests require `requesterId == request.auth.uid` on creation with initial status `"Menunggu Verifikasi"`, and status transition to `"Terverifikasi KYC & SKKH"` is restricted strictly to `admin`.

## 2. Adversarial Payloads ("Dirty Dozen")
1. **Self-Assigned Admin Role**: `POST /users/{uid}` with `{ role: "admin" }` by a regular verified user -> `PERMISSION_DENIED`.
2. **Shadow Role Escalation**: `PATCH /users/{uid}` by owner attempting to change `role` from `"user"` to `"operator"` -> `PERMISSION_DENIED`.
3. **Spoofed Unverified Admin Email**: Authenticated token with `email: "habibalmulki2006@gmail.com"` and `email_verified: false` reading `/admins/{uid}` or approving verifications -> `PERMISSION_DENIED`.
4. **PII Cross-User Read**: Regular user A calling `get` on `/users/{userB}/private/info` -> `PERMISSION_DENIED`.
5. **Blanket User List Scraping**: Non-admin user calling `list` on `/users` -> `PERMISSION_DENIED`.
6. **Shadow Ghost Field on Livestock**: Operator creating `/livestock/TRN-99` with an undeclared field `isFeatured: true` -> `PERMISSION_DENIED`.
7. **ID Poisoning**: Creating `/livestock/` with a malformed 200-char or symbol-injected ID -> `PERMISSION_DENIED`.
8. **Order Buyer Spoofing**: Creating `/orders/ORD-99` with `buyerId: "other-user-uid"` -> `PERMISSION_DENIED`.
9. **Orphaned Order Creation**: Creating `/orders/ORD-99` referencing nonexistent `ternakId: "TRN-DOES-NOT-EXIST"` -> `PERMISSION_DENIED`.
10. **Terminal Escrow Tampering**: Buyer attempting to update an already released order (`isEscrowReleased == true`) to change `totalPaid` or reopen status -> `PERMISSION_DENIED`.
11. **Client Timestamp Forgery**: Creating `/orders/ORD-99` with arbitrary past `createdAt` instead of `request.time` -> `PERMISSION_DENIED`.
12. **Unauthorized Verification Approval**: Operator or regular user attempting to update `/verifications/VER-101` status to `"Terverifikasi KYC & SKKH"` -> `PERMISSION_DENIED`.
