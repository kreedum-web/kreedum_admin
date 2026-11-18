# Kreedum Admin

The owner's dashboard for the Kreedum Sports store (shop.kreedum.com).
Separate from the store; talks to the same backend (api.kreedum.com).

| Page | What you do there |
|---|---|
| Home | Today's sales and visitors, to-do list, 30-day sales chart, latest orders |
| Orders | Confirm → pack → ship → deliver, cancel (refunds online payments automatically), print, call/WhatsApp the customer |
| Products | Change prices, option prices, stock, photos, name; hide/show; featured / best seller badges |
| Brands | Hide a whole brand (and its products), featured brands, logos |
| Website content | Home banners (with start/end dates), announcement bar, leadership, client logos |
| Customers | Accounts, their orders and total spent; disable an account |
| Enquiries | Bulk enquiries from the website, mark contacted / closed |
| Traffic | Visitors, pages viewed, top pages, where visitors came from, devices, who's on the store now |

**New-order alerts** work on every page: every 15 seconds the dashboard checks for
orders, and a new one pops up in the corner with a sound, a red count on the bell
and in the tab title. Turn on desktop alerts from the bell to get them even when
the dashboard is in another tab.

## Run on your computer

```bash
npm install
cp .env.example .env      # then edit .env if needed
npm run dev               # opens on http://localhost:5174
```

## Settings (.env / Vercel environment variables)

| Name | Example |
|---|---|
| `VITE_API_BASE_URL` | `https://api.kreedum.com/api/v1` |
| `VITE_STORE_URL` | `https://shop.kreedum.com` |

## Who can sign in

Only accounts with the admin role. Sign up on the store first, then on the server:

```bash
npm run admin:make -- owner@example.com
```

(in the **backend** folder). `-- owner@example.com --remove` takes it away again.
