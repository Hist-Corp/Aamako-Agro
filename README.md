# Aamako-Agro

A comprehensive B2B/B2C e-commerce platform for freeze-dried food products, built with a modern full-stack architecture.

## Overview

Aamako-Agro is an enterprise-grade web application serving both retail customers and wholesale partners. The platform features a static HTML/CSS/JavaScript storefront, a React-based admin dashboard, and a robust NestJS REST API backend.

## Project Structure

```
.
├── Frontend/          # Static HTML/CSS/JS storefront
├── Backend/           # NestJS REST API
├── Dashboard/         # React/Vite admin dashboard
└── README.md          # This file
```

## Technology Stack

| Technology | Usage |
|------------|-------|
| **TypeScript** | 62.1% — Type-safe development across frontend and backend |
| **HTML** | 28% — Semantic markup for the storefront |
| **CSS** | 8.8% — Custom styling and responsive design |
| **Other** | 1.1% — Configuration and utilities |

### Core Technologies

- **Backend**: NestJS 10, TypeScript, Prisma ORM, PostgreSQL (Supabase)
- **Frontend**: HTML5, CSS3, Vanilla JavaScript, GSAP, Lenis
- **Dashboard**: React, Vite, TypeScript
- **Authentication**: JWT with rotating refresh tokens
- **Database**: PostgreSQL with Prisma migration management
- **API Documentation**: Swagger/OpenAPI at `/api/docs`

## Key Features

### Frontend Storefront
- **Responsive Design**: Mobile-first approach with breakpoints at 900px and 480px
- **Product Showcase**: Category-based product browsing with detailed product pages
- **Shopping Cart**: Persistent client-side cart with local storage
- **Sticky Navigation**: Intelligent header behavior with smooth scroll animations
- **Mobile Menu**: Pinned drawer hamburger menu for mobile devices
- **Brand Pages**: Story, process, wholesale information, and journal/blog sections

### Backend API
- **Role-Based Access Control (RBAC)**: Global enforcement of user roles with decorators
- **Pricing Engine**: Dynamic pricing with enterprise contracts, volume discounts, and promotions
- **Wholesale Management**: B2B pricing tiers, inquiry tracking, and sample kit requests
- **Order Management**: Server-side price computation with idempotency guarantees
- **WebSocket Live Feed**: Real-time order and status updates for admin users
- **Comprehensive Audit Trail**: All pricing rule changes recorded in `pricing_history`

### Dashboard
- **Admin Panel**: Centralized management of products, inventory, orders, and pricing
- **Analytics**: Live order feed and wholesale inquiry tracking
- **Product Management**: CRUD operations for catalog items and variants
- **Pricing Control**: Rule-based pricing configuration with tier management

## Getting Started

### Prerequisites

- **Node.js ≥ 18** — required on macOS, Linux and Windows ([nodejs.org](https://nodejs.org))
- **A Supabase (PostgreSQL) connection string** for the backend
- Docker *(optional)* — only if you want a local PostgreSQL via `docker compose up -d`

> Everything runs identically on **macOS**, **Linux** and **Windows** (PowerShell or CMD).
> Where shell syntax differs, both variants are shown.

### Quick Start (all three apps at once)

From the repository **root**:

```bash
# 1. Install dependencies for every app
npm run setup

# 2. Configure the backend environment
cp Backend/.env.example Backend/.env          # macOS / Linux
copy Backend\.env.example Backend\.env        # Windows (CMD)
#    → open Backend/.env and paste your DATABASE_URL

# 3. Create database tables + seed the default admin account
npm run db:setup

# 4. Start Backend + Dashboard + Storefront together
npm run dev
```

Press `Ctrl+C` once to stop all three services.

| App | URL |
|-----|-----|
| 🛍️ Storefront | http://localhost:8080 |
| 🔐 Dashboard | http://localhost:3001 |
| ⚙️ API + Swagger | http://localhost:3000/api/docs |

The dashboard reads its API address from `Dashboard/apps/admin/.env.local`
(`NEXT_PUBLIC_API_URL=http://localhost:3000/api`). Create that file if it does
not exist, then restart the dashboard.

### Running Apps Individually

```bash
npm run dev:backend     # NestJS API      → http://localhost:3000
npm run dev:dashboard   # Admin dashboard → http://localhost:3001
npm run dev:frontend    # Static site     → http://localhost:8080
```

### Backend-only Setup (manual)

1. **Install dependencies**:
   ```bash
   cd Backend
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env       # macOS / Linux
   copy .env.example .env     # Windows (CMD)
   ```
   Add your Supabase connection string:
   `DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"`

3. **Initialize database**:
   ```bash
   npm run db:push
   npm run seed   # Creates default admin account and sample data
   ```

4. **Start the development server**:
   ```bash
   npm run start:dev   # Swagger UI at http://localhost:3000/api/docs
   ```

### Dashboard-only Setup (manual)

The dashboard uses a **pnpm workspace**, so install with pnpm (no global install needed):

```bash
cd Dashboard
npx --yes pnpm@9 install     # any OS — downloads pnpm temporarily
npm run dev                  # Development server on port 3001
```


## API Endpoints

All endpoints are prefixed with `/api`:

| Endpoint | Purpose |
|----------|---------|
| `/auth/*` | User registration, login, token refresh, logout |
| `/products` | Product catalog and search |
| `/pricing/quote` | Dynamic pricing calculations |
| `/cart` | Shopping cart operations |
| `/orders` | Order creation and retrieval |
| `/wholesale/*` | B2B inquiries, sample kits, private label leads |
| `/admin/*` | Administrative operations (staff-only) |

For full API documentation, refer to the Swagger UI at `/api/docs` when the backend is running.

## Default Credentials

After seeding, the following accounts are available:

**Admin Dashboard** (http://localhost:3001/login):
- **Email**: `admin@aamako.agro` · **Password**: `Admin123!` (SUPER_ADMIN)

**Storefront** (http://localhost:8080/signin.html):
- **Retail customer**: `customer@aamako.agro` / `Customer123!` (RETAIL_CUSTOMER)
- **Wholesale customer**: `wholesale@aamako.agro` / `Wholesale123!` (WHOLESALE_CUSTOMER, active GROWTH account)

> Staff/team accounts can only sign in through the Admin Dashboard, and
> customer accounts can only sign in through the Storefront (surface-separated auth).

## Architecture Highlights

- **Database**: PostgreSQL with Prisma ORM for type-safe schema management
- **Authentication**: JWT-based with 15-minute access tokens and rotating refresh tokens
- **Validation**: Class-validator DTOs with unknown field rejection
- **Error Handling**: Standardized error response format: `{ error: { code, message, details } }`
- **Authorization**: Global RBAC guards; unmarked routes require staff role
- **Audit**: Pricing changes logged to `pricing_history` within transactions

## Known Placeholders

- **MFA/TOTP**: Fields exist in the schema but enforcement is not yet implemented
- **Redis/BullMQ**: Optional for scaling; currently not required to run the application

## Development

### Testing

```bash
cd Backend
npm test  # Runs pricing engine priority logic and RBAC guard suite
```

### Local Database (Optional)

For local development with Docker:
```bash
docker compose up -d  # Starts PostgreSQL and Redis
```

## Contributing

1. Ensure all changes maintain the existing code structure and naming conventions
2. Run tests before submitting changes
3. Update relevant README files when modifying functionality
4. Follow TypeScript/HTML/CSS best practices as defined in each module

## License

Please refer to the repository LICENSE file for terms and conditions.

## Support

For issues, feature requests, or questions, please open an issue in the repository.
