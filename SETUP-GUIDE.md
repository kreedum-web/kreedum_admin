# Admin dashboard: setup guide

Three parts, in this order: **backend** → **store** → **admin app**.
Do everything on the `develop` branch first, test on the dev setup (Render +
kreedum-frontend.vercel.app), then merge to `main` for Oracle + shop.kreedum.com.

---

## 1. Backend (kreedum_backend)

Put `backend-admin-dashboard.patch` in the backend folder, then:

```bash
git checkout develop
git am backend-admin-dashboard.patch   # adds the change as a ready-made commit
npm install                            # no new packages, but safe to run
npm test                               # 95 tests; 1 old search test already failed before this
git push origin develop                # Render redeploys the dev backend by itself
```

What these do: `git am` applies the patch file as a commit (with its message),
`npm test` runs the automatic checks, `git push` sends it to GitHub.

### Make yourself an admin

Sign up on the store with a password first (if you haven't), then in the
backend folder **on a machine whose `.env` points at the right database**:

```bash
npm run admin:make -- your@email.com
```

Do it once for the dev database and once for production (on the Oracle server,
inside the backend folder). Remove access later with `--remove` at the end.

### Going live on Oracle (after testing)

```bash
git checkout main && git merge develop && git push origin main
# then on the Oracle server, in the backend folder:
git pull && npm install && pm2 restart all   # or however you restart it today
```

Nothing to change in nginx: the dashboard checks for new orders with normal
requests every 15 seconds, so no special server setting is needed.

---

## 2. Store (kreedum_frontend): visit counting

Put `frontend-visit-tracking.patch` in the store folder, then:

```bash
git checkout develop
git am frontend-visit-tracking.patch
git push origin develop
```

This adds one small file that tells the backend each time a page is opened
(only a random browser id, the page address and where the visitor came from:
no names, phones or emails). Traffic numbers start counting from the moment
this is live; there's no history before that.

---

## 3. Admin app (new): admin.kreedum.com

1. On GitHub, create a new **private** repository in kreedum-web, e.g. `kreedum_admin`.
2. Unzip `kreedum_admin.zip`, then inside that folder:
   ```bash
   git init -b main
   git add . && git commit -m "Admin dashboard"
   git remote add origin https://github.com/kreedum-web/kreedum_admin.git
   git push -u origin main
   ```
3. On Vercel: **Add New → Project**, pick `kreedum_admin`. Framework: Vite
   (detected). Under **Environment Variables** add:
   - `VITE_API_BASE_URL` = `https://api.kreedum.com/api/v1`
     (for testing against dev, use your Render backend address + `/api/v1`)
   - `VITE_STORE_URL` = `https://shop.kreedum.com`
4. Deploy. Then in the project: **Settings → Domains → Add** `admin.kreedum.com`.
5. In GoDaddy DNS for kreedum.com, add the record Vercel shows you
   (normally: type **CNAME**, name **admin**, value **cname.vercel-dns.com**).
6. Open https://admin.kreedum.com and sign in with the account you made admin.

To try it on your computer first: `npm install`, copy `.env.example` to `.env`,
`npm run dev`, open http://localhost:5174.

---

## How orders flow now

- **COD order placed** → shows as "New – to confirm" + pop-up in the dashboard.
- **Online order** → hidden while the customer is paying; appears (with pop-up)
  the moment Cashfree confirms the payment. Unpaid checkouts are under
  Orders → "Unpaid checkouts".
- You move it on: **Confirm → Packed → Shipped → Out for delivery → Delivered**
  (you can skip steps). The customer sees each step in their order tracking.
- **Cancel** (until delivered): customer gets the cancellation email; paid
  online orders are refunded automatically through Cashfree.
- **Delivered** COD orders are marked paid. **Returned** (after delivery)
  refunds online payments automatically.

## Product edits and the Metro sync

Anything you change by hand (price, name, photos, on/off) is remembered, and
`npm run rebuild:catalog` keeps your value instead of Metro's. The product shows
an "edited" lock; "Use Metro's values again" undoes that at the next sync.
Hiding a brand in the dashboard keeps it hidden through syncs too.
Search results pick up product changes within 5 minutes.
