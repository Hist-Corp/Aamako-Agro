# Buyer Dual-Dashboard System — Technical Architecture & Implementation Roadmap

**Audience:** Engineering (Frontend, Backend, Security) · **Status:** Proposed · **Version:** 1.0

A dual-interface dashboard serving two distinct buyer personas:

| Persona | Existing RBAC role | Core workflow |
|---|---|---|
| **Personal Buyer** | `RETAIL_CUSTOMER` | Browse retail catalog, cart → checkout (idempotent, server-priced), track orders, review purchases |
| **Wholesale Buyer** | `WHOLESALE_CUSTOMER` | Contract/volume pricing visibility, bulk ordering, quotes, sample kits, credit terms, account/tier status |

This spec builds **on top of** the existing platform rather than replacing it. It references concrete modules that already exist today:

- Backend: NestJS 10 (`Backend/src`) — global `JwtRolesGuard` (`common/guards/roles.guard.ts`), role registry (`common/rbac.ts`), rotating-refresh JWT auth (`auth/auth.service.ts`)
- Data: Prisma + PostgreSQL (`Backend/prisma/schema.prisma`) — `User.role`, `Session`, `WholesaleAccount`, `Order`, `Cart`
- Admin UI: Next.js 14 App Router (`Dashboard/apps/admin/src/app/(dashboard)`)

---

## Part 1 — Frontend Architecture & UI/UX Strategy

### 1.1 Pattern decision: Modular monolith-first with contract-isolated feature slices

For a two-persona buyer surface backed by one API and one small team, **micro-frontends are premature** — they add module-federation runtime risk, duplicated vendor bundles, and cross-app auth complexity that outweighs isolation benefits at this scale. Instead we adopt a **modular architecture inside the existing Next.js app**, structured so any slice can later be extracted into a standalone MFE without touching shared contracts:

```
Dashboard/apps/admin/src/
├── app/
│   ├── (auth)/                      # login / register / MFA challenge
│   ├── (kernel)/                    # shared shell: nav frame, providers, error boundaries
│   └── (portal)/                    # BOTH buyer portals live under one authenticated group
│       ├── personal/                # ← RETAIL_CUSTOMER only
│       │   ├── overview/
│       │   ├── orders/[orderId]/
│       │   ├── subscriptions/       # phase 2
│       │   ├── addresses/
│       │   └── profile/
│       ├── wholesale/               # ← WHOLESALE_CUSTOMER only
│       │   ├── overview/
│       │   ├── quick-order/         # SKU-bulk add + CSV upload
│       │   ├── quote-requests/
│       │   ├── price-lists/         # tier-aware, read-only
│       │   ├── bulk-orders/
│       │   ├── sample-kits/
│       │   ├── documents/           # invoices, statements, VAT certs
│       │   └── company-profile/
│       └── _shared/                 # both roles: notifications, settings
├── features/                        # feature slices = the real module boundary
│   ├── personal-orders/             # components + hooks + api, no cross-imports
│   ├── wholesale-pricing/
│   ├── shared/                      # design-system primitives only
│   └── ...
├── lib/
│   ├── api-client.ts                # exists — extend, don't fork
│   ├── session.ts                   # cookie/token handling (see Part 2)
│   └── portal-config.ts             # ← central nav/permission manifest
└── middleware.ts                    # edge role-router (see §2.4)
```

Isolation rules enforced with ESLint import-boundary rules:

1. `features/personal-*` **must never** import `features/wholesale-*` (and vice versa).
2. Portal pages compose only their own slice + `features/shared`.
3. Every portal page declares its required role(s) in metadata used by middleware.

### 1.2 Server-driven navigation schema

Navigation is **not hardcoded per persona**. A single manifest maps capability keys → routes; the resolved nav is computed at login/layout time from the server-verified role:

```ts
// lib/portal-config.ts (excerpt)
export type Capability =
  | 'orders.view.retail' | 'orders.create.bulk' | 'pricing.tier.read'
  | 'quotes.request' | 'samples.request' | 'documents.download'
  | 'cart.checkout' | 'profile.self.edit';

export interface NavItem {
  labelKey: string;
  href: string;
  icon: IconName;
  capability: Capability;      // rendered only if granted
}
```

`GET /api/me/bootstrap` returns `{ user, role, capabilities: Capability[], wholesale?: { companyName, tierName, tierRank, paymentTerms } }`. The frontend renders whatever the server says — **the client never decides what data exists, only how it looks**. This guarantees UI scope ≡ API scope ≡ DB scope.

### 1.3 Functional requirements per persona

**Layout structure — Wholesale portal**
- Dense, table-first enterprise shell: left rail nav, persistent context header showing company + pricing tier badge (from `WholesaleAccount.tierId`), payment terms status.
- Quick-order bar always visible (paste SKU list → validated inline against catalog service).
- Price presentation requires four fields simultaneously: list price (struck through), tier unit price, volume break rows (`PricingTier` breaks), savings delta. All values come from the backend pricing engine — never computed client-side.

**Profile module — Wholesale:** company legal name, VAT number, tier, approved-by/at, users linked to the same `WholesaleAccount`, order approval limits if configured, saved shipping addresses per warehouse, document center.

**Layout structure — Personal portal**
- Consumer-grade storefront continuation: card-based, imagery-led, generous whitespace. Bottom-tab nav pattern on mobile mirroring the existing storefront's mobile conventions.
- Order cards with visual lifecycle timeline (plain-language statuses mapped from backend order status).

**Profile module — Personal:** name/phone/email, address book, marketing preferences (via existing `Notification` preferences), loyalty/reorder suggestions, review history.

**Shared requirements (both):** notification inbox, session/device management ("sign out everywhere"), password change with current-password proof, account closure request.

### 1.4 Design-system strategy

One component library (`features/shared`), tokenized by portal theme:

```css
--portal-accent, --portal-radius, --portal-density, --font-display;
[data-portal='wholesale'] { /* dense tokens */ }
[data-portal='personal']  { /* expressive tokens */ }
```

## Part 2 — Authentication & Security Framework

### 2.1 Protocol stance: keep the current OAuth2 Resource-Owner-Password flow; plan OIDC when SSO arrives

Today `auth.service.ts` implements: login/register → short-lived **access JWT** (`15m`, claims `sub/email/role`) + **rotating single-use refresh JWT** persisted as SHA-256 hash in `Session` (with UA/IP/expiry); reuse of a revoked rotation is a theft signal. This is protocol-equivalent to the OAuth2 ROPC grant and is sufficient because the only authorization server is our own API.

Roadmap posture:

- **Phase A (now):** keep ROPC shape. Harden token transport (§2.2).
- **Phase D (trigger-based):** migrate to **OpenID Connect Authorization Code + PKCE** the moment any external IdP is required (Google login for personal buyers, corporate SSO/Entra ID for wholesale org accounts). The JWT *resource-server* side needs zero changes — only `/login` is replaced by a hosted authorize redirect; `sub/role` claims carry over unchanged into `JwtRolesGuard`.

Never implement implicit flow; PKCE is mandatory for any future public SPA grant.

### 2.2 Token transport and session management changes

Current state: dashboard reads `localStorage.getItem('access_token')` (`api-client.ts`). For XSS containment, tokens move to cookies while keeping API contracts:

| Concern | Decision |
|---|---|
| Access token | `httpOnly; Secure; SameSite=Lax; Path=/api` cookie, 15-min TTL retained |
| Refresh token | `httpOnly; Secure; SameSite=Strict; Path=/api/auth` cookie (scoped so it is never sent elsewhere) |
| CSRF | Double-submit token: non-httpOnly `csrf` cookie + `X-CSRF-Token` header checked by a global guard on mutating verbs. (`SameSite=Lax/Strict` is defense-in-depth, not the control.) |
| Rotation | Unchanged: single-use, hashed-at-rest, revocation-on-reuse ⇒ revoke all sessions for the user |
| Device mgmt | Portal "Sessions" view lists `Session` rows (UA/IP/createdAt) with per-row revoke + revoke-all |

Rotation currently derives new tokens purely from the refresh JWT's own payload (`auth.service.ts:59-89`). Change: on refresh, **re-read `User.role` from the database** so a demoted/promoted user can't mint tokens with a stale role.

### 2.3 Login-time routing & MFA tiers

Single credential check; post-auth bootstrap determines destination:

```
POST /api/auth/login 200 {
  accessToken, refreshToken,
  user: { id, email, role },
  mfaRequired: boolean          // true when totpEnabled (staff today, optional buyers later)
}
→ middleware reads verified role and redirects:
    RETAIL_CUSTOMER     → /portal/personal/overview
    WHOLESALE_CUSTOMER  → /portal/wholesale/overview
    staff roles         → /dashboard            (existing admin group)
```

A user can never be roleless; there is exactly one portal per role enum value.

### 2.4 Strict data isolation between roles

Four enforcement layers, each independently sufficient (defense-in-depth):

1. **Edge router (`middleware.ts`)** — verifies the access JWT on every `(portal)` route; mismatches get a hard redirect to their own portal root with in-band `403` state. UX optimization only; it gates *pages*, which are empty shells until data loads.
2. **API guards (authoritative for verbs)** — `JwtRolesGuard` runs globally before controllers. Routes carrying buyer data declare explicitly, e.g. `@Roles(Role.RETAIL_CUSTOMER, Role.WHOLESALE_CUSTOMER)`. Any un-marked route remains staff-only by default (existing behavior at `roles.guard.ts:41-50`) — unmarked ≠ open.
3. **Ownership predicates in the data layer (the critical layer)** — guarding *which endpoints* you can call is insufficient; every query itself is scoped. Rule: **no buyer-facing service method may query a buyer-owned entity without filtering by the caller's identity taken from the verified JWT (`request.user.sub`), never from body params or URL alone.**

```ts
// WRONG — IDOR: anyone authenticated who guesses an id reads another buyer's order
getOrder(id: string) { return this.prisma.order.findUnique({ where: { id } }); }

// RIGHT — the guard authorized the verb; the WHERE clause authorizes the row
async getOrder(id: string, viewer: RequestUser) {
  const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) throw new NotFoundException();
  if (viewer.role === 'RETAIL_CUSTOMER')    return this.assert(order.userId === viewer.id);
  if (viewer.role === 'WHOLESALE_CUSTOMER') return this.assertWithinOrg(order.userId, viewer);
  throw new ForbiddenException(); // staff go through a different, audited path
}
```

   Implementation discipline: a thin `ScopeService` exposing `mine(viewer)` Prisma fragments; a Prisma Client Extension `_whereOwner(viewer)` applied to the **buyer-facing injected client instance only**, making unscoped reads structurally impossible for these services while leaving the admin client untouched.

4. **Response shaping** — serializers drop staff/other-buyer fields (internal costs, other users' PII) at DTO level; role-check errors are uniform (`403 FORBIDDEN`) and foreign resources return `404`, never enumeration hints.

Additional controls: rate limiting + exponential lockout on `/api/auth/*`; audit records (`actor, action, targetId, ip, at`) for all mutations and denied-access attempts; per-user `403` spike thresholds trigger alerts; wholesale cross-account visibility (colleagues sharing a `WholesaleAccount`) resolved via the account link row only — never by email/domain matching.

### 2.5 Threat model highlights

| Threat | Mitigation |
|---|---|
| Stolen refresh token replayed after rotation | Reuse detection ⇒ revoke all sessions, notify user |
| XSS stealing tokens | Tokens out of `localStorage` into httpOnly cookies |
| CSRF on state-changing calls | Double-submit header + SameSite + CORS allowlist locked to dashboard origin |
| JWT role tampering / stale role | Server signature + DB re-read at refresh; deny-by-default unmarked routes |
| IDOR across buyers | Ownership predicate embedded in every buyer-data query (client extension enforces) |
## Part 3 — Role-Based Access Control (RBAC) Backend Implementation

### 3.1 Model choice

Keep the current **static-hierarchy static-enumeration model** (`Role` Prisma enum + `ROLE_RANK` in `common/rbac.ts`). Two buyer types already exist as distinct enum members, which makes them first-class RBAC subjects. Introduce a derived **capability matrix** layered over the raw enum instead of sprinkling role comparisons through business code:

```ts
// common/capabilities.ts
export const CAPABILITIES: Record<Capability, Role[]> = {
  'orders.view.retail':    [Role.RETAIL_CUSTOMER],
  'orders.create.retail':  [Role.RETAIL_CUSTOMER],
  'orders.create.bulk':    [Role.WHOLESALE_CUSTOMER],
  'pricing.tier.read':     [Role.WHOLESALE_CUSTOMER],
  'quotes.request':        [Role.WHOLESALE_CUSTOMER],
  'samples.request':       [Role.WHOLESALE_CUSTOMER],
  'documents.download':    [Role.WHOLESALE_CUSTOMER],
  'cart.checkout':         [Role.RETAIL_CUSTOMER, Role.WHOLESALE_CUSTOMER],
  'profile.self.edit':     [Role.RETAIL_CUSTOMER, Role.WHOLESALE_CUSTOMER],
};
export function hasCapability(role: Role, c: Capability): boolean {
  return CAPABILITIES[c].includes(role) || role === Role.SUPER_ADMIN;
}
```

Why not full attribute-based control now: attributes exist mainly *within* wholesale (`tierId`, `isActive`, order totals), so they are enforced as **explicit per-route conditions** (§3.5) rather than a generalized ABAC engine — fewer moving parts, still testable. Promote to a policy engine only when rule count justifies it.

### 3.2 Request-lifecycle enforcement pipeline

Every request flows through five checkpoints — none skippable:

```
Request
 │
 ├─ 1. JwtAuthGuard (global): verify access-JWT signature/expiry → req.user { sub, email, role }
 ├─ 2. ThrottleGuard (global): auth endpoints strictest bucket
 ├─ 3. JwtRolesGuard (global):
 │      @Public()           → pass
 │      no @Roles() mark    → staff-only default (existing behavior preserved)
 │      @Roles(r1..rn)      → SUPER_ADMIN bypasses; otherwise member-of required
 │                           else 403 `Role ${role} cannot access this resource`
 ├─ 4. Controller: extracts structured viewer via CurrentUser()
 │      export class ViewerContext { userId; role; capabilities; accountId? }
 └─ 5. Service: scope filter (owner/wholesale-account predicate) +
        contextual business rules before any Prisma call
        e.g. requireActiveWholesaleAccount(viewer) → join WholesaleAccount
            isActive else 403 'WHOLESALE_ACCOUNT_INACTIVE' (a *state*, not a role)
      → Response serialized through role-shaped DTOs
```

Supporting decorators (pattern-consistent with existing `@Roles` / `@Public` / `@CurrentUser`):

```ts
@BuyerPortal()                       // shorthand for @Roles(RETAIL_CUSTOMER, WHOLESALE_CUSTOMER)
@RequireWholesaleAccount({ activeOnly: true })
@Viewer()                            // param decorator returning the typed ViewerContext
@Audit('order.bulk_create')          // emits audit record with actor + target ids
```

### 3.3 Dynamic serving of the correct interface

The backend never serves different HTML — dashboards fetch their definition; role drives *content*:

- `GET /api/me/bootstrap` → role + capabilities (computed from §3.1 matrix) + wholesale account block. One round-trip per login.
- Endpoint families stay unified under singular routers with narrow role marks:

```ts
@Controller('api/orders')
export class OrdersController {
  @Get('mine')          @BuyerPortal()   // scoped by ViewerContext
  @Post('bulk')         @Roles(Role.WHOLESALE_CUSTOMER)          // requires active account
  @Post('checkout')     @Roles(RETAIL_CUSTOMER, WHOLESALE_CUSTOMER) // + Idempotency-Key per existing checkout rules
  @Patch(':id/status')  @Roles(STAFF_*)                          // staff-only, audited
}
```

- Guard rejections return machine codes (`RBAC_ROLE_REQUIRED`, `ACCOUNT_STATE_BLOCKED`) which the frontend maps to neutral interstitial screens, never blank pages.

### 3.4 Keeping tokens honest when roles change

JWT roles go stale the moment an admin upgrades a retail user to a wholesale account. Coordinated mechanisms:

1. **Short-lived access** stays at 15 min — maximum staleness window by construction.
2. **DB truth at refresh**: the rotation handler re-reads `User.role` (+ `isActive`) and issues the new pair with the fresh role (fixes `issueTokens(payload...)` trusting payload-provided role, `auth.service.ts:82-88`).
3. **Kill-switch on promotion/demotion**: whenever `users/admin-users.controller.ts` or the wholesale-approval flow mutates `User.role`, revoke all of that user's `Session` rows; next API call fails auth and forces re-login into the correct portal.
4. *(Optional)* Add `tokenVersion Int @default(1)` to `User` (embed `ver` in JWT; bump invalidates outstanding access tokens instantly).

### 3.5 Wholesale-specific state gating

Role grants *capability class*, not blanket entitlement. Boolean/state conditions gated separately:

| Condition | Enforced in | Failure code |
|---|---|---|
| Active `WholesaleAccount` exists and `isActive=true` | `RequireWholesaleAccount` guard/service pre-hook | 403 `WHOLESALE_ACCOUNT_INACTIVE` |
| Pricing tier visible to buyer for given product | pricing engine lookup on viewer's `tierId` | excluded from results |
| Bulk minimums / credit limit at checkout | domain service on cart totals | 422 `BULK_MIN_NOT_MET` / `CREDIT_HOLD` |
| Session validity + user `isActive` | `JwtAuthGuard` / refresh path | 401 |

All conditions emit audit records so support can answer "why couldn't this buyer order?" from history.

---

## Implementation Roadmap

Sequenced to ship value continuously on the current codebase. Each phase ends with demoable behavior.

**Phase A — Foundations (backend, ~1 sprint)** *no UI yet*
1. Add `capabilities.ts` matrix + unit tests; implement bootstrap endpoint `GET /api/me/bootstrap` (JWT-guarded, works for all personas).
2. Fix refresh flow to re-read role from DB; revoke sessions on role change.
3. Introduce `ScopeService` / owner-predicate client extension; retrofit `orders.mine`, cart, addresses.
4. Token transport swap: cookies + CSRF double-submit; update `api-client.ts` once behind `lib/session.ts`.

**Phase B — Shell & middleware (~1 sprint)**
5. Build `(kernel)` shell + `[data-portal]` theming tokens; role-router `middleware.ts` with E2E tests: each role bounced to its portal root, foreign IDs render 404 (not leaked).
6. Bootstrap-driven nav: one `NavItem[]` renderer, filtered by server-side payload.

**Phase C — Personal portal (~2 sprints)**
7. Orders list/detail, reorder shortcut, address book, profile & session screens; minimal client state — reuse the bootstrap payload.

**Phase D — Wholesale portal (~2–3 sprints, parallelizable with late Phase C)**
8. Overview, tier price-list explorer, bulk quick-order + CSV upload (contract tests on endpoint ↔ DTO).
9. Quote-request submission, sample-kit flow, document center (staff publishing stub acceptable in v1).
10. MFA decision point — whether TOTP remains staff-only for v1.

**Phase E — Hardening & telemetry (~1 sprint)**
11. Load-test scope filters on worst-case order pagination; index tuning (`Order(userId, status, createdAt)` compound).
12. Pen-test pass targeting IDOR/CSRF/token-replay scenarios; alerting thresholds on per-user `403` spikes; admin audit-log dashboards.

Sign-off gate: automated E2E matrix asserting **role × endpoint family → expected outcome** (200 / 403 / 404) runs in CI before launch.


---

