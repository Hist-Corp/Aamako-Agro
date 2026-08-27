# Aama ko Agro — Frontend

A static HTML/CSS/JS marketing site for a Nepali freeze-dried food brand. No build step, no npm dependencies. External CDNs: Google Fonts (Fraunces, Work Sans, JetBrains Mono), GSAP + ScrollTrigger, Lenis smooth scroll.

## Project Structure

```
├── index.html          # Homepage
├── shop.html           # Product listing / shop
├── product.html        # Single product page
├── cart.html           # Shopping cart
├── process.html        # Why freeze-dried
├── story.html          # Our Story
├── wholesale.html      # Wholesale / B2B
├── journal.html        # Blog / learn
├── signin.html         # Sign in
├── signup.html         # Sign up
├── styles.css          # Global stylesheet
├── logo.png            # Site logo
├── logo-footer.png     # Footer logo
├── .freebuff/          # Preview run docs
└── aama-ko-agro-site.html  # Standalone demo (all-in-one)
```

## Pages

| Page | Description |
|------|-------------|
| `index.html` | Hero, category grid, best sellers, wholesale CTA, traceability, reviews, newsletter |
| `shop.html` | Full product grid with category filter chips |
| `product.html` | Single product detail with add-to-cart, accordion FAQ |
| `cart.html` | Cart with quantity controls, subtotal, checkout link |
| `process.html` | Why freeze-dried science, nutrient retention stats |
| `story.html` | Brand story, timeline, partner farms |
| `wholesale.html` | Pricing tiers (Starter / Growth / Enterprise), catalogue table, certifications, inquiry form |
| `journal.html` | Blog articles, FAQ accordion |
| `signin.html` | Sign in form |
| `signup.html` | Sign up form |
| `account.html` | Post-login user dashboard: greeting, stats (orders / active / cart), recent orders, quick actions |
| `profile.html` | Profile & security: edit name/phone, read-only email/role, change password |
| `orders.html` | Full order history with status badges and expandable line items |

## Key Features

### User Account Area
- **`account.html`** dashboard shown after sign-in/signup (customers only)
- **`profile.html`** self-service editing via `PATCH /api/auth/me`; password change via `POST /api/auth/change-password` (revokes all other sessions)
- **`orders.html`** order history from `GET /api/orders/mine`
- Shared **`js/account-menu.js`** turns the header "Sign in" button into an Account ▾ dropdown on any page that includes it after `js/api.js`
- Gated pages redirect signed-out visitors to `signin.html?next=<page>` and return after login
- Team/staff accounts are refused at the storefront sign-in with a clear notice

### Mobile Hamburger Menu
- Menu drawer opens **pinned below the sticky header** (no full-screen overlay)
- Opens at the current scroll position — no page jump
- Logo and X (close) button stay visible in the header at all times
- Smooth hover effects on menu items (subtle background highlight)
- Separator lines between all menu items including above "Home"
- Body scroll locked when menu is open
- Header border hidden when menu is open for seamless visual flow

### Cart System
- Client-side cart using `localStorage`
- Add-to-cart with quantity controls (+/-)
- Cart badge counter in header
- Slide-in cart drawer with subtotal/total
- Cart persists across pages

### Responsive Design
- Mobile-first responsive breakpoints at **900px** and **480px**
- Navigation collapses to hamburger menu on mobile
- Category grids stack to 2-column on tablet, single column on mobile
- Wholesale pricing tiers stack vertically on mobile
- Catalogue table scrolls horizontally on mobile
- Hero sections adapt layout per breakpoint

### Scroll Behavior
- Sticky header with blur backdrop
- Header hides on scroll down, shows on scroll up (past 80px)
- Smooth scroll animations via GSAP ScrollTrigger
- Lenis smooth scroll integration

## Tech Stack

| Technology | Purpose |
|------------|---------|
| HTML5 | Semantic markup |
| CSS3 | Custom properties, grid, flexbox, media queries |
| Vanilla JS | Cart, hamburger menu, scroll behavior, accordions |
| GSAP + ScrollTrigger | Scroll animations |
| Lenis | Smooth scrolling |
| Google Fonts | Fraunces (display), Inter (body), JetBrains Mono (mono) |

## CSS Custom Properties

Key design tokens defined in `:root`:
- `--ink`, `--ink-soft` — text colors
- `--paper`, `--bg`, `--surface` — background colors
- `--sage`, `--sage-deep` — brand green
- `--gold` — accent gold
- `--line` — border color
- `--radius`, `--radius-md`, `--radius-sm` — border radii
- `--space-1` through `--space-8` — spacing scale (4px–48px)
- `--shadow-md`, `--shadow-lg` — box shadows

## Running Locally

No build step required. Serve static files:

```bash
# Using Node.js
cat > serve.js << 'EOF'
const http = require('http');
const fs = require('fs');
const path = require('path');
const MIME = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const fp = path.join(__dirname, url);
  fs.readFile(fp, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(4000, '127.0.0.1', () => console.log('http://127.0.0.1:4000'));
EOF
node serve.js
```

Or use Python:
```bash
python3 -m http.server 4000
```

## Conventions

- **No frameworks** — vanilla HTML/CSS/JS only
- **No build tools** — edit files directly
- **CDN dependencies** — Google Fonts, GSAP, Lenis loaded via `<script>` and `<link>` tags
- **Class naming** — BEM-inspired with utility prefixes (`btn-primary`, `section-title`, `tier-card`)
- **Responsive breakpoints** — 900px (tablet/mobile), 640px (small mobile), 480px (compact)
- **Color palette** — earthy tones: sage green, gold accent, warm paper backgrounds
