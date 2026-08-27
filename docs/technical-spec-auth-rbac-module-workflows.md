# Technical Specification — Authentication, RBAC & Functional Module Workflows

**Project:** Aamako Agro · **Audience:** Engineering (Backend, Dashboard, Storefront) · **Status:** Proposed v1.0 · **Baseline commit:** `50a85f2`

---

## 0. Scope & System Context

This specification covers four requirement areas:

1. **Authentication & User Management** — cross-surface login separation between Admin Dashboard and Storefront; customer-facing Profile & Dashboard in the Storefront.
2. **RBAC & Permissions** — restricted Roles & Permissions visibility, clickable role→permission inspection, and expanded capabilities for Content Manager, Sales, and Inventory Manager roles.
3. **Product & Inventory Management** — comprehensive Add Product workflow and automated Content-Manager notifications.
4. **UI/UX** — responsiveness requirements for all display components ("Quotas"/Quotes displays included).

### 0.1 Architecture summary (as built today)

| Layer | Technology | Entry points |
|---|---|---|
| Backend API | NestJS 10 + TypeScript + Prisma ORM → PostgreSQL | `Backend/src` (Swagger at `/api/docs`) |
| Auth | JWT: 15-min access tokens + rotating refresh tokens hashed in `sessions` table | `Backend/src/auth/auth.service.ts` |
| Admin Dashboard | Next.js 14 App Router monorepo app | `Dashboard/apps/admin/src/app/(dashboard)` |
| Shared contracts | `@aamako/shared-types` (roles, permission manifest, DTO shapes) | `Dashboard/packages/shared-types/src` |
| Storefront | Static vanilla HTML/CSS/JS, zero build step | `Frontend/*.html`, `Frontend/js/api.js` |

Global authorization stack (backend): `JwtAuthGuard` → `JwtRolesGuard` with `@Roles(...)` decorators, role registry in `Backend/src/common/rbac.ts`, permission manifest in `shared-types/src/auth.ts` (`ROLE_PERMISSIONS`), nav-driven RBAC in `Dashboard/apps/admin/src/config/rbac.ts`.

### 0.2 Glossary

| Term | Meaning |
|---|---|
| **Storefront** | Public marketing/shop site (`Frontend/`), served at `/` |
| **Admin Dashboard** | Internal staff console (`Dashboard/apps/admin`), served at `/dashboard` |
| **Staff surface** | The Admin Dashboard (any non-customer role) |
| **Customer surface** | The Storefront authenticated area |
| **Portal scope** | Which surface a login attempt was made from: `storefront` \| `dashboard` |
| **Superadmin** | `SUPER_ADMIN` (Prisma `Role`) — the Dashboard's "Super Admin" label |
| **Manager** | `STAFF_MANAGER` (Prisma `Role`) — the Dashboard's "Manager" label |

> ⚠️ **Alias note:** `@aamako/shared-types` defines legacy aliases (`ADMIN`, `MANAGER`, `SALES`, `INVENTORY_MANAGER`) alongside the authoritative Prisma roles (`STAFF_ADMIN`, `STAFF_MANAGER`, `STAFF_SALES`). This spec always names the **Prisma role as source of truth** and requires aliasing rules to stay in `shared-types` (see §5.5).

### 0.3 Current-state gaps this spec closes

1. `AuthService.login()` accepts any active user regardless of which surface called it — a customer could hit the dashboard token endpoint and vice versa.
2. Staff created through `POST /admin/users` share one `User.email @unique` namespace with customers — intentional (global uniqueness), but no *surface-level* exclusion exists; the requirement mandates surface-level blocking semantics on top of it.
3. Nav item interface `NavItem.roles?: Role[]` exists (`rbac.ts:44-46`) but no nav item sets it — every role passing the permission gate sees every menu entry.
4. Prisma `Role` enum has **no `INVENTORY_MANAGER`**; the dashboard pretends it does. Product creation currently maps to whichever real role was used.
5. Content editing runs through the `ContentRevision` approval workflow (submitter ≠ approver by design); the requirement demands **full self-service editing** for Content Manager — the workflow must be relaxed for this role without deleting the audit path.
6. `CatalogService.create()` already notifies `CONTENT_MANAGER` on product creation — the spec formalizes delivery guarantees, realtime push, dedupe, and UI surfacing rather than introducing the feature from scratch.
7. No refund concept anywhere; `Order.status` conflates payment and fulfilment states. Refunds require dedicated modeling.
8. No customer-facing profile/dashboard pages exist in `Frontend/` (only `signin.html` redirects staff to `localhost:5173` after login).

---

## Part 1 — Authentication & User Management

### 1.1 FR-AUTH-01 · Surface-scoped login (staff ⇄ storefront separation)

**Requirement:** A user registered through the Admin Dashboard **must never** be able to log into the Storefront with that email address — and, symmetrically, a customer registered via the Storefront must never authenticate into the Admin Dashboard.

#### 1.1.1 Data model (no migration required)

Keep the single `User` table with global `email @unique` (preserves current "Email already registered" conflict behavior in `auth.service.ts` and `admin-users.controller.ts`). Surface eligibility is **derived from `role`**, not stored:

```ts
// Backend/src/common/rbac.ts  (new exports)
export const STOREFRONT_ROLES: Role[] = [
  Role.RETAIL_CUSTOMER,
  Role.WHOLESALE_CUSTOMER,
];
export const isStorefrontRole = (r: Role) => STOREFRONT_ROLES.includes(r);
```

Rationale: role reassignment (`PATCH /admin/users/:id/role`) automatically migrates surface rights without a second write; no denormalized flag can drift.

#### 1.1.2 API contract — portal-scoped login

| Endpoint | Change |
|---|---|
| `POST /auth/login` | New required body field `portal: 'storefront' \| 'dashboard'` (transitional default `'storefront'` until both frontends ship). Invalid value → `422 UNKNOWN_PORTAL`. |
| `POST /auth/register` | Stays hardwired to `RETAIL_CUSTOMER`; storefront-only concept. |

**Enforcement in `AuthService.login()`** (replaces current lines 47-56):

```ts
const user = await this.prisma.user.findUnique({
  where: { email: dto.email.toLowerCase() },
});
if (!user || !user.isActive || !(await bcrypt.compare(dto.password, user.passwordHash))) {
  throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' });
}
const portal = dto.portal ?? 'storefront';
const eligible = portal === 'storefront' ? isStorefrontRole(user.role)
                                         : !isStorefrontRole(user.role);
if (!eligible) {
  throw new UnauthorizedException({
    code: 'WRONG_SURFACE',
    message: 'This email is not registered for this service.',
  });
}
return this.issueTokens(user.id, user.email, user.role, ua, ip, { portal });
```

Security rules:

- **Uniform failure shape**: `WRONG_SURFACE` and `INVALID_CREDENTIALS` share HTTP 401 and near-identical latency, preserving enumeration resistance; only the machine-readable `code` differs for legitimate-owner UX.
- The issued JWT gains a **`portal` claim**, enforced by `JwtRolesGuard` against route families (matrix in §1.2.4). A stolen dashboard token cannot be replayed against customer endpoints and vice versa.
- `refresh()` must re-read `role` from DB at rotation and re-assert eligibility; cross-surface role change mid-session → revoke all sessions, respond `403 ROLE_SURFACE_CHANGED`.
- Keep the mandatory session-revocation hook whenever `User.role` changes.

#### 1.1.3 Frontend changes

- **Dashboard** auth-context login handler sends `portal: 'dashboard'`; on `WRONG_SURFACE` shows *"This account isn't a staff account."*
- **Storefront** `js/api.js → AamakoAPI.login()` sends `portal: 'storefront'`; `signin.html` renders *"This email belongs to a team account. Please use the staff dashboard to sign in."* No link/auto-redirect to internal URLs.
- Remove the existing staff branch in `signin.html` that redirects staff roles to `localhost:5173` post-login — dashboard logins happen exclusively inside the Dashboard app after this change.
### 1.2 FR-AUTH-02 · Storefront User Profile & User Dashboard

**Requirement:** Successful storefront login exposes a customer-facing Profile and Dashboard experience.

#### 1.2.1 New static pages

| Page | Route (file) | Contents |
|---|---|---|
| **Account Dashboard** | `Frontend/account.html` | Post-login home: greeting header, quick-stat cards (Total Orders, In-Delivery count, Cart items), recent orders (latest 5 via `GET /orders/mine`), shortcut tiles (Profile, Order History, Wholesale inquiry status) |
| **Profile** | `Frontend/profile.html` | View/edit `firstName`, `lastName`, `phone`; read-only `email` + `role`; change-password form; active sessions list with "sign out everywhere" |
| **Order History** | `Frontend/orders.html` | Paginated order list with status badges (`PLACED → DELIVERED`), expandable line items incl. price snapshots (`OrderItem.unitPriceCents`) |

Shared shell changes:

- `js/api.js` additions: `AamakoAPI.updateMe(payload)` → `PATCH /auth/me`; `changePassword(payload)`; `mySessions()` / `revokeAllSessions()`.
- `signin.html` success redirect: customers → `account.html` (staff branches removed per §1.1.3).
- Header shows an **Account ▾** menu when `aamako_user` exists.
- `account.html` / `profile.html` / `orders.html` run an inline auth check and redirect to `signin.html?next=<path>` when tokens are absent, returning to the target page after login.

#### 1.2.2 Supporting backend endpoints

| Method & path | Auth | Notes |
|---|---|---|
| `GET /auth/me` | JWT (both portals) | Exists — extend payload with `firstName/lastName/phone/createdAt` |
| `PATCH /auth/me` | JWT, both portals | Whitelisted fields only; loose E.164 phone validation; audit entry `PROFILE_UPDATED` |
| `POST /auth/change-password` | JWT | Verifies current password, bcrypt(12) new hash, **revokes every other session**, emits `Notification(type='SECURITY')` |
| `GET /auth/sessions` · `DELETE /auth/sessions` | JWT | List / revoke-all rows in `sessions` for current user |
| `GET /orders/mine` | JWT, `portal=storefront` | Already exists — add `?page&limit&status` |

Owner-scope rule: every endpoint reads `req.user.sub` and filters strictly by it (owner-predicate pattern from `docs/buyer-dual-dashboard-architecture.md`). No IDOR surfaces.

#### 1.2.3 Token-portal × route-family enforcement matrix (`JwtRolesGuard`)

| Route family | `portal=storefront` | `portal=dashboard` | Public |
|---|---|---|---|
| `/products*`, `/categories*`, content reads, public wholesale forms | ✅ | ✅ | ✅ |
| `/cart*`, `/orders` (create), `/auth/me*`, `/auth/sessions*` | ✅ | ❌ 403 | — |
| `/orders/mine` | ✅ | ❌ 403 | — |
| `/admin/**`, admin `/users/**`, pricing mutations | ❌ 403 | ✅ per RBAC | — |

#### 1.2.4 Storefront UX conventions

Match the existing design system: `styles.css` tokens (`--paper/--sage/--gold`, radii, spacing scale), Fraunces display type, breakpoints **900px / 640px / 480px**, forms reuse `js/password-toggle.js`. All three pages must satisfy §4.1 responsiveness requirements.

#### 1.2.5 Acceptance criteria

- [ ] Fresh retail signup lands on `account.html` with zero-state panels ("No orders yet").
- [ ] Profile edit persists and survives reload without re-login.
- [ ] Password change kills a second browser's session but keeps the initiating one.
- [ ] Signed-out visit to `profile.html` redirects to `signin.html?next=/profile.html` and returns after login.
- [ ] Full flow usable at 360 px viewport width.

---


#### 1.1.4 Acceptance criteria

- [ ] `admin@aamako.agro / Admin123!` on `signin.html` → 401 `WRONG_SURFACE`, team-account notice shown.
- [ ] Any `RETAIL_CUSTOMER` credentials on Dashboard login → 401 `WRONG_SURFACE`.
- [ ] Storefront token vs `/admin/**` → 403; per §1.2.4 matrix on all other families.
- [ ] Storefront register with an email already used by any user → 409.

---

## Part 2 — Role-Based Access Control & Permissions

### 2.1 FR-RBAC-01 · "Roles & Permissions" section restricted to Superadmin & Manager, with click-to-inspect permissions

#### 2.1.1 Visibility rule

The **Roles & Permissions** screen (`/roles`, `Dashboard/apps/admin/src/app/(dashboard)/roles/page.tsx`) becomes visible **only** to `SUPER_ADMIN` and `STAFF_MANAGER`.

Backend permissions split:

```ts
// shared-types ROLE_PERMISSIONS deltas
'SUPER_ADMIN':   ['roles:view', 'roles:view-matrix', 'roles:manage', ...]
'STAFF_MANAGER': ['roles:view', 'roles:view-matrix', ...]   // read-only on the matrix
// remove bare 'roles:view' from ADMIN, STAFF_ADMIN, STAFF_SALES,
// CONTENT_MANAGER, CUSTOMER_SUPPORT, STAFF_SUPPORT
```

Three enforcement layers (defense in depth — all three required):

1. **Nav config** (`config/rbac.ts`) — set the optional per-item role filter that already exists in `NavItem`:

```ts
{
  label: 'Roles & Permissions',
  href: '/roles',
  icon: Shield,
  permission: 'roles:view',
  roles: ['SUPER_ADMIN', 'STAFF_MANAGER'],   // ← newly enforced field
},
```

`getVisibleNav()` already drops items failing the role check (`rbac.ts:253`), so no filtering logic changes are needed.

2. **Route guard** — dashboard route/middleware check maps `/roles` to `roles:view`; other roles navigating directly get the standard *Access denied* interstitial (never a blank page).
3. **API** — new endpoint family backing this screen returns `403 FORBIDDEN_PERMISSION` for actors without `roles:view-matrix`, so data can't be fetched via devtools either.

#### 2.1.2 Click-to-view assigned permissions

Interaction spec for `/roles`:

- Each role card (existing `ROLE_INFO` cards) becomes an interactive control: `<button aria-expanded>` with visible affordance ("View permissions →", chevron, hover ring).
- **Click behavior:** expand an inline details panel below the clicked card showing that role's full permission list, grouped by module using the existing `PERMISSION_GROUPS` taxonomy. One expanded at a time on mobile (accordion semantics, WAI-ARIA `role="region"` + `aria-controls`).
- Panel content renders permission chips (`Badge variant="neutral"`) replacing today's truncated `slice(0, 8)` display; the "+N more" truncation moves into the collapsed view only. Expanded panel shows **all** permissions with per-group counts in headers (`Users & Roles (6)`).
- Keyboard accessible: Enter/Space toggles, focus stays on trigger.
- The existing Permissions Matrix table beneath is preserved and kept visible to the same two roles.

#### 2.1.3 Acceptance criteria

- [ ] As `STAFF_SALES`, `STAFF_SUPPORT`, `CONTENT_MANAGER`: nav hides the section, direct `/roles` navigation shows Access-denied interstitial, matrix API call returns 403.
- [ ] `SUPER_ADMIN` and `STAFF_MANAGER` see the section and can expand every role to inspect its full permission list.
- [ ] No runtime errors from removed permissions on legacy alias roles.

### 2.2 FR-RBAC-02 · Content Manager: full edit/create rights over CMS pages

**Requirement:** The Content Manager can edit **all existing pages** and **create new pages** in Content Management without an approval gate.

#### 2.2.1 Conflict resolution vs. current approval workflow

Today content edits go through submit→review (`ContentItem`/`ContentRevision`, `schema.prisma:32-64`). The requirement supersedes this for `CONTENT_MANAGER`:

| Capability | Before | After |
|---|---|---|
| Edit existing page | Submit revision, wait for Manager approval | **Direct write**, revision record kept as audit snapshot |
| Create new page | N/A (fixed key registry) | **Allowed** |
| Publish/unpublish | Manager+ | Content Manager |
| Approval step | Required | **Bypassed for CONTENT_MANAGER-authored edits** |

The `RevisionStatus` pipeline is not deleted — it's auto-approved (`status=APPROVED, reviewedById=actor`) so history remains complete, and any future lower-trust author roles keep the review flow.

#### 2.2.2 Permission manifest deltas

```ts
CONTENT_MANAGER: [
  ...existing,
  'content:create',     // NEW permission string
  'content:publish',    // promoted from manager-only
  // 'content:view'/'content:edit' already granted
]
```

Dashboard UI keys action buttons off `canAct(role, 'content:create'|'content:publish'|'content:edit')`; approval-queue controls are hidden for self-authored items.

#### 2.2.3 Backend changes

- `content.controller/service`: allow `POST /content` (create) and immediate apply of `PATCH /content/:id` for `@Roles(CONTENT_MANAGER, STAFF_MANAGER, STAFF_ADMIN, SUPER_ADMIN)`.
- Writers holding `content:publish` apply live **and** append an approved `ContentRevision` atomically (audit equivalence). Non-publishing writers keep the PENDING flow.
- New-page creation validates unique `key` slug (kebab convention), requires `title` + `body`, returns created item.

#### 2.2.4 Acceptance criteria

- [ ] Content Manager edit → live immediately; no pending state shown for their own writes.
- [ ] Content Manager creates a page → appears in storefront content reads once published.
- [ ] A revision snapshot exists for every direct write (verified by tests).
- [ ] No other role's `content:*` grants change.

---
### 2.3 FR-RBAC-03 · Sales role: payment-status updates & refunds

**Requirement:** `STAFF_SALES` can update an order's **payment status** and process **refunds**.

#### 2.3.1 Modeling gap

Current `OrderStatus` (`schema.prisma:310-319`) conflates fulfilment and payment (`PAID`, `PAYMENT_PENDING` sit beside `FULFILLED`, `DELIVERED`). Refunds don't exist anywhere in the schema. To let Sales touch *payment* without giving away *fulfilment* control, split the concepts:

```prisma
enum PaymentStatus {
  PENDING
  AUTHORIZED
  PAID
  PARTIALLY_REFUNDED
  REFUNDED
  FAILED
}

model Order {
  // ...existing fields...
  paymentStatus PaymentStatus @default(PENDING)
  refundedCents Int           @default(0)   // cumulative, <= totalCents
}

model Refund {
  id            String   @id @default(uuid())
  orderId       String
  order         Order    @relation(fields: [orderId], references: [id])
  amountCents   Int                                    // > 0, <= remaining refundable
  reason        String?
  gatewayRef    String?                                // PSP transaction reference (Phase: manual)
  status        String   @default("COMPLETED")         // COMPLETED | FAILED (manual v1 is atomic)
  performedById String
  createdAt     DateTime @default(now())

  @@map("refunds")
}
```

Migration backfill: `paymentStatus` derived from existing `status` — `PAID → PAID`, `PAYMENT_PENDING → PENDING`, everything else → `PENDING` unless a paid marker exists; `status` remains the fulfilment lifecycle for legacy compatibility.

#### 2.3.2 Permissions

```ts
// shared-types ROLE_PERMISSIONS deltas
'STAFF_SALES': [
  ...existing,
  'orders:payment-status',   // NEW
  'orders:refund',           // NEW
]
```

Both new permissions are excluded from every other non-admin role; `SUPER_ADMIN`/`STAFF_ADMIN`/`STAFF_MANAGER` retain them via their superset grants.

#### 2.3.3 API contract

| Method & path | Roles | Rules |
|---|---|---|
| `PATCH /admin/orders/:id/payment-status` | Sales, Manager+, Admin+ | Body `{ paymentStatus }`. Allowed transitions only (see state machine below); rejected moves → `422 INVALID_PAYMENT_TRANSITION`. Every change appends to audit log + emits live event. |
| `POST /admin/orders/:id/refunds` | Sales, Manager+, Admin+ | Body `{ amountCents, reason? }`. Validates `0 < amountCents <= totalCents - refundedCents - alreadyFailedRefunds`; creates `Refund` row and updates `Order.paymentStatus` (`PARTIALLY_REFUNDED` / `REFUNDED`) and `refundedCents` **in one Prisma transaction** with row lock (`SELECT … FOR UPDATE` equivalent via `updateMany` guard on `refundedCents`). |
| `GET /admin/orders/:id/refunds` | any staff with `orders:view` | History listing. |

Payment-status state machine (enforced server-side):

```
PENDING      → AUTHORIZED | PAID | FAILED | CANCELLED(=order CANCELLED)
AUTHORIZED   → PAID | FAILED
PAID         → PARTIALLY_REFUNDED
PARTIALLY_REFUNDED → REFUNDED
### 2.4 FR-RBAC-04 · Inventory Manager: order-status updates & dedicated product-creation section

**Requirement:** The Inventory Manager can update **product/order statuses** and has a **dedicated section** for adding new products to inventory.

#### 2.4.1 Introduce the missing backend role

The Prisma `Role` enum has no `INVENTORY_MANAGER`, yet the dashboard already displays one. Formalize it:

```prisma
enum Role {
  RETAIL_CUSTOMER
  WHOLESALE_CUSTOMER
  STAFF_SALES
  CONTENT_MANAGER
  STAFF_SUPPORT
  STAFF_MANAGER
  INVENTORY_MANAGER   // ← NEW
  STAFF_ADMIN
  SUPER_ADMIN
}
```

- `Backend/src/common/rbac.ts`: `ROLE_RANK.INVENTORY_MANAGER = 2` (same tier as Sales/Support — manages nobody).
- `CREATABLE_ROLES_BY_ACTOR`: Manager/Admin/Super Admin may create `INVENTORY_MANAGER` (matches existing `USER_CREATION_ALLOWED_TARGETS` in shared-types, which already lists the alias).
- `shared-types/src/auth.ts`: keep `INVENTORY_MANAGER` as a first-class key of `ROLE_PERMISSIONS`; it currently has **no entry**, so `hasPermission()` returns false for everything. Add:

```ts
INVENTORY_MANAGER: [
  'dashboard:view',
  'products:view', 'products:create',        // add-product workflow (Part 3)
  'inventory:view', 'inventory:adjust', 'inventory:create',
  'orders:view', 'orders:update-status',     // NEW permission string
  'warehouses:view', 'batches:view',
  'profile:view', 'profile:edit',
],
```

Map dashboard screens that used to assume a pseudo-inventory role onto the real one (`getVisibleNav` immediately reflects this).

#### 2.4.2 Order-status updates

- New permission `orders:update-status` granted **only** to `INVENTORY_MANAGER`, `STAFF_MANAGER`, `STAFF_ADMIN`, `SUPER_ADMIN`.
- Endpoint: `PATCH /admin/orders/:id/status` — restricts writable transitions to fulfilment states only:

```
PLACED → CONFIRMED → FULFILLED → DELIVERED      (forward-only)
any   → CANCELLED (only while PLACED/CONFIRMED; blocked after PAID without refund)
```

- Guard rails: cannot touch `paymentStatus` (that's Sales per §2.3); attempts return `403 FORBIDDEN_PERMISSION`. Every change is audit-logged with before/after.
- Dashboard orders page: Inventory Manager sees status stepper control on order detail, no payment controls.

#### 2.4.3 Dedicated "Add Product" section

Requirement wording: *"access a dedicated section to add new products to the inventory."*

- Nav addition in `config/rbac.ts` under *Products & Inventory*:

```ts
{
  label: 'Add Products',
  href: '/products/new',
  icon: PackagePlus,
  permission: 'products:create',
},
```
## Part 3 — Product & Inventory Management

### 3.1 FR-PROD-01 · Comprehensive "Add Product" workflow (no minimal entries)

**Requirement:** Adding a product requires **complete data** — high-resolution images and all detailed attributes matching the existing product schema — instead of a minimal name+price flow.

#### 3.1.1 Target schema coverage

The wizard must capture every field of `Product`, `ProductVariant`, and `Inventory` (`schema.prisma:122-282`):

| Level | Field | Validation |
|---|---|---|
| Product | `name` | required, 2–120 chars, unique after slugification |
| Product | `slug` | auto-derived from name, editable, unique, kebab-case |
| Product | `description` | **required**, min 80 chars (marketing-grade copy) |
| Product | `categoryId` | **required** — must pick existing `Category` |
| Product | `imageUrl` + gallery | **required ≥ 3 high-res images** (rule below) |
| Variant (≥1) | `name` | required |
| Variant | `sku` | required, unique, pattern `[A-Z0-9-]{6,24}` |
| Variant | `unit` | required enum: `UNIT_30G…CASE_12X50G` |
| Variant | `basePriceCents` | required integer > 0 (NPR paisa input w/ rupee display conversion) |
| Variant | initial `stockOnHand` | required int ≥ 0 |
| Variant | initial `lowStockThreshold` | default 20, editable |

Multiple variants allowed per product; repeated block with per-variant validation. A draft cannot be submitted until every section is valid — **no partial "quick add" path exists**.

#### 3.1.2 High-resolution image rules

- Accept JPEG/PNG/WebP/AVIF only; each file ≤ 10 MB.
- **Minimum source resolution: 1600 px on the longest edge** (target render is ~800 px @2x); reject smaller with explicit message ("Image too small — 1600px minimum").
- Minimum 3 images per product: 1 hero + ≥ 2 gallery.
- Max 8 images; first = hero (`imageUrl`), rest stored in a new `ProductImage` table:

```prisma
model ProductImage {
  id        String   @id @default(uuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  url       String
  altText   String
  sortOrder Int      @default(0)
  widthPx   Int
  heightPx  Int
  sizeBytes Int
  createdAt DateTime @default(now())

  @@index([productId])
  @@map("product_images")
}
```

(Keep legacy `Product.imageUrl` in sync as the hero for storefront compatibility.)

- Server-side pixel-dimension verification (decode headers via `sharp` or image-size) so client-side checks aren't the only gate; EXIF orientation normalized; output re-encoded to WebP at 2048 px cap + lazy variant generation hooks.

#### 3.1.3 Wizard UX (dashboard)

Four steps with persistent progress state (localStorage keyed by user id) and validation before advancing:

1. **Basics** — name, category select, description (rich-text, min-length meter).
2. **Media** — drag-and-drop upload area, thumbnail grid with drag-to-reorder (first pinned as hero), alt text required per image, per-file resolution badge pass/fail.
3. **Variants & Pricing** — repeatable variant cards (SKU generator helper from name+unit), price input showing `Rs. X.XX ⇄ paisa`.
4. **Inventory & Review** — stock-on-hand, low-stock threshold per variant, full preview card, final submit → `POST /admin/products`.

Failure surfaces inline field errors from backend DTO (`class-validator` messages already return structured details).

#### 3.1.4 Backend contract changes

- `CreateProductDto` extended: `description: string` (min 80), `categoryId: string` (IsUUID), `images: ProductImageInput[]` (arrayMin 3), `variants: CreateVariantDto[]` (arrayMin 1) — replacing today's optional-variants flow.
- Creation transaction: product + variants + inventory rows + image records atomically; slug-conflict auto-suffix `-2` with conflict check.
- Product starts `isPublished=false`; publishing to storefront stays gated by `products:publish` / content side, reinforcing the Inventory→Content hand-off in §3.2.

#### 3.1.5 Acceptance criteria
### 3.2 FR-PROD-02 · Automated Content-Manager notifications on new products

**Requirement:** When an Inventory Manager registers a product, the Content Manager is alerted automatically.

#### 3.2.1 Existing behavior to formalize

`CatalogService.create()` already writes a `Notification` for every `CONTENT_MANAGER` (`catalog.service.ts:76-82`, plus variant-level at 109-114). This spec upgrades it from fire-and-forget to guaranteed, deduplicated, realtime-delivered messaging.

#### 3.2.2 Delivery specification

| Aspect | Requirement |
|---|---|
| **Trigger** | Successful commit of the `POST /admin/products` transaction (post-commit hook / outbox row in same tx). Variant additions trigger a lighter notification as today. |
| **Recipients** | **All active users with role `CONTENT_MANAGER`** (not a single user); implemented via existing `NotificationsService.notifyRole('CONTENT_MANAGER', …)`. |
| **Content** | `type='PRODUCT'`, title `New product awaiting publication`, message includes product name, SKU set, creator name, and links `actionUrl='/products'` filtered to unpublished. |
| **Dedupe/idempotency** | One notification per `(productId, 'NEW_PRODUCT_AWAITING_PUBLISH')` per recipient — re-publish/unpublish cycles never re-spam; enforced by unique index on a `dedupeKey` column added to `Notification`. |
| **Reliability** | Insert inside the same Prisma `$transaction` as product creation (or transactional outbox) — a failed write must roll back or retry via outbox worker; no silent `.catch(() => undefined)` swallowing on the primary path. |
| **Realtime push** | Reuse the dashboard's live gateway (`admin/live.gateway.ts` + `LiveEventsService`) to push `notification:new` events so open dashboards toast immediately. |
| **Read state** | Action URL marks the notification read when clicked (`PATCH /notifications/:id/read`); unread badge count endpoint exists for header polling fallback. |

#### 3.2.3 Content-Manager surface

- Header bell shows unread count; notification entry deep-links to `/products?filter=unpublished`.
- Zero-state helpfulness: after publishing all notified items they auto-archive from the "Needs attention" strip.

#### 3.2.4 Acceptance criteria

- [ ] Product created by Inventory Manager → every Content Manager gets exactly one notification with working link.
- [ ] Transaction rollback on failure leaves no orphan notification.
- [ ] Duplicate creation attempts for same slug produce no second notification.
- [ ] Open dashboards receive websocket toast within ~1 s of creation.

---

## Part 4 — UI/UX Requirements

### 4.1 FR-UIX-01 · Fully responsive displays ("Quotas"/Quotes)

> **Terminology note:** The requirement text says "all *Quotas* displays" — the codebase contains no quota concept anywhere (verified by search), but it does contain **Quotes** (`/quotes` wholesale quote-request screen + `MessageSquareQuote` nav item) whose name collides visually with the requirement wording. This spec treats the requirement as covering **(a) the Quotes module explicitly** and **(b) all display components generally**, which safely satisfies either reading.

#### 5.1.1 Quotes screen (`/quotes`) responsiveness targets

| Breakpoint | Required behavior |
|---|---|
| ≥ 1024 px | Full data table (Quote ID, Business, Tier, Amount, Status, Actions) |
| 640–1023 px | Table collapses to card list: quote summary header + expandable detail rows; primary actions stay one tap away |
| < 640 px | Single-column stacked cards; horizontally scrollable amount/tier chips if dense; action buttons full-width |

Additional hard rules:

---

## Part 6 — Implementation Roadmap

Sequenced for the current codebase; each phase ends in demoable behavior. Rough sizing assumes the existing 2-person engineering pattern.

| Phase | Scope | Deliverables |
|---|---|---|
| **A — Auth separation (backend)** | §1.1 | `portal` login claim, `STOREFRONT_ROLES` helper, guard enforcement, refresh re-validation, session-revocation wiring; unit + e2e tests |
| **B — Customer storefront (frontend)** | §1.2 | `account/profile/orders.html`, `api.js` extensions, auth redirect gate, responsive pass; backend `PATCH /auth/me`, change-password, sessions endpoints |
| **C — RBAC tightening** | §2.1, §2.4 (role enum) | Permission manifest deltas, nav `roles[]` restriction, route guard interstitial, `/roles` click-to-expand panel, Prisma migration adding `INVENTORY_MANAGER` |
| **D — Sales payment & refunds** | §2.3 | Prisma migration (`PaymentStatus`, `Refund`), transitions state machine, refund transaction endpoints, order detail UI panels |
| **E — Add Product wizard** | §3.1 | `ProductImage` table, media upload pipeline w/ resolution checks, 4-step wizard UI, strict `CreateProductDto` |
| **F — Notification hardening** | §3.2 | Outbox/dedupe key migration, websocket push hookup, Content-Manager "needs attention" strip |
| **G — Responsiveness audit** | §4.1 | Screenshot matrix CI job across listed pages/widths; fix-pass |

Cross-phase dependency notes: C precedes D/E/F because permission strings they rely on land there; B's storefront profile can proceed in parallel with C–E.

## Part 7 — Requirement Traceability Matrix

| # | Requirement (source) | Spec section | Key files touched |
|---|---|---|---|
| R1 | Admin users cannot log into Storefront with same email | §1.1 | `Backend/src/auth/auth.service.ts`, `common/rbac.ts`, guards, `Frontend/signin.html`, dashboard auth-context |
| R2 | Storefront User Profile & User Dashboard after login | §1.2 | New `Frontend/account.html`, `profile.html`, `orders.html`; `js/api.js`; auth controller additions |
| R3 | Roles & Permissions visible only to Superadmin/Manager + clickable role permissions | §2.1 | `shared-types/src/auth.ts`, `config/rbac.ts`, `(dashboard)/roles/page.tsx` |
| R4 | Content Manager full edit/create of CMS pages | §2.2 | `content.controller/service.ts`, schema audit-snapshot flow, shared-types |
| R5 | Sales: update payment statuses + process refunds | §2.3 | Prisma schema, new orders endpoints, `(dashboard)/orders/[id]/page.tsx` |
| R6 | Inventory Manager: update product/order statuses + dedicated add-product section | §2.4 | Prisma Role enum, `common/rbac.ts`, shared-types, `/products/new` route |
| R7 | Add Product requires high-res images + full attributes | §3.1 | `catalog.dto.ts`, `catalog.service.ts`, `products/new` wizard, media pipeline |
| R8 | Notify Content Manager on new product registration | §3.2 | `notifications.service.ts`, `catalog.service.ts`, live gateway, notifications page |
| R9 | All Quotas/Quotes displays fully responsive | §4.1 | `(dashboard)/quotes/page.tsx`, all new components above |

## Part 8 — Open Questions / Decisions Needed

1. **Payment gateway reality:** Refund model assumes manual/staff-recorded refunds v1. If a PSP (eSewa/Khalti/Stripe) is already integrated somewhere not visible in this repo, replace `gatewayRef` stubs with real gateway calls and add reconciliation.
2. **Should `ADMIN` (legacy alias) keep `roles:view`?** This spec removes it per the literal requirement (only Superadmin+Manager). Confirm no operational dependence on Staff Admin viewing the matrix.
3. **Content revision UI retention:** keep the approval-queue screen visible to Managers even though bypassed for Content Manager authors?
4. **"Quotas" reading:** if stakeholder intent was an actual *quota* concept (per-customer purchase limits etc.), scope grows — needs product confirmation before sprinting Phase G.

---

*End of specification. Baseline references use commit `50a85f2`; line numbers may drift as implementation lands.*

- No horizontal page scroll at any breakpoint ≥ 360 px; only contained elements may scroll internally.
- Touch targets ≥ 44×44 px on mobile.
- Text truncates with ellipsis + `title` attr; monetary values never wrap mid-figure (use `tabular-nums`, non-breaking format).
- Status badges keep contrast ratio ≥ 4.5:1 against both light surfaces and colored chips.

#### 5.1.2 General display-component standard (applies everywhere)

1. Every new component specified in this document (roles click-to-expand panels §2.1.2, refund panel §2.3.4, Add Product wizard §3.1.3, storefront account pages §1.2) must pass layout audit at **360, 480, 640, 768, 900, 1024, 1280, 1536 px** widths.
2. Dashboard uses its Tailwind container conventions; storefront pages use existing breakpoints 900/640/480 px and design tokens (`styles.css :root`) — do not introduce competing scales.
3. Interactive tables adopt the established pattern: sticky first column where useful, `<overflow-x-auto>` wrapper, checkbox-column freeze.
4. Forms: single column below 640 px; labels above inputs (no side-by-side label layouts on touch devices).
5. Modals/dialogs become bottom sheets under 640 px; focus trap retained.

#### 5.1.3 Verification method

- Component storybook checks or Playwright screenshot matrix across the width set for: roles page, quotes page, orders detail, add-product wizard, account/profile/orders storefront pages.
- CI gate: zero horizontal overflow assertions at each width; keyboard-only traversal passes on accordion/panels.

---


- [ ] Submitting without description/category/images/variants is blocked client-side AND server-side (400/422 with field map).
- [ ] Uploading an 1400×1050 image is rejected with actionable message.
- [ ] Happy-path product appears in admin catalog immediately, on storefront only after publish.
- [ ] Image metadata (dimensions/size) persisted to `product_images`.

---


Visible by default to `INVENTORY_MANAGER`, `MANAGER`, `ADMIN`, `SUPER_ADMIN` via `products:create`; other roles never see it.

- Route `/products/new` renders the full-screen Add Product wizard described in §3.1. Existing `/products` remains the catalog browser (Inventory Manager keeps view access but sees read-only rows plus its own entry point).
- Backend `POST /admin/products` authorization changes from the current mixed grant to `@Roles(INVENTORY_MANAGER, STAFF_MANAGER, STAFF_ADMIN, SUPER_ADMIN)`; Content Manager's recent product-add ability (commit `8745382`) moves behind `content:*` only if product publishing is involved — publishing itself stays with the content side (§3.1.4).

#### 2.4.4 Acceptance criteria

- [ ] `INVENTORY_MANAGER` exists end-to-end: creatable by Manager+, assignable via user forms, appears in Roles matrix once §2.1 ships.
- [ ] Inventory Manager advances an order through `CONFIRMED → FULFILLED` and is blocked from payment endpoints.
- [ ] Only forward transitions accepted; `DELIVERED → CONFIRMED` returns 422.
- [ ] Inventory Manager reaches Add Product from nav, completes §3.1 wizard, lands back on catalog with new item visible.
- [ ] Sales/Support roles see neither Add Product nav item nor can POST products (403).

---

FAILED       → PENDING (retry)
```

Refund itself drives `PAID → PARTIALLY_REFUNDED → REFUNDED`; direct manual set to refund states is forbidden ("Use POST /refunds").

#### 2.3.4 Dashboard UI

- Orders list/detail: payment badge column distinct from fulfilment status; Sales sees an "Update payment" action (`canAct('orders:payment-status')`).
- Order detail adds a **Refund panel**: refundable amount computed from `totalCents − refundedCents`, amount input with currency formatting (NPR paisa), required-reason field when partial, confirmation dialog showing customer-visible consequence.
- Fulfilment "advance order" actions stay hidden from Sales exactly as today.

#### 2.3.5 Acceptance criteria

- [ ] Sales sets order `PENDING → PAID`; audit entry created; live feed reflects it.
- [ ] Full refund flips `paymentStatus=REFUNDED`, `refundedCents == totalCents`.
- [ ] Over-refund attempt (amount > remaining) → 422, no partial writes (transaction rollback verified).
- [ ] Two concurrent refunds racing the last remaining paisa: exactly one succeeds (guarded updateMany).
- [ ] Sales cannot advance fulfilment status or cancel orders (403).

---

