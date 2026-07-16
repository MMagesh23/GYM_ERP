# Gym Management ERP — Phase 1 + 2 + 3 + 4 + 5

This is the foundation layer of the Gym ERP: full folder structure, all 14 MongoDB
collections modeled, JWT auth (access + rotating refresh tokens) with account lockout,
role-based access control (simple `admin`/`receptionist` roles + an optional granular
`Role`/`Permission` matrix for future customization), and the Settings module.

Both the backend and frontend have been installed and build-tested successfully in
this environment.

## Folder structure

```
gym-erp/
├── backend/
│   ├── config/db.js              # Mongoose connection
│   ├── models/                   # All 14 collections (see below)
│   ├── middleware/
│   │   ├── auth.js                # protect() - verifies JWT access token
│   │   ├── rbac.js                # authorize() + can() - role/permission checks
│   │   ├── validate.js            # express-validator error formatter
│   │   └── errorHandler.js        # centralized error + 404 handler
│   ├── controllers/
│   │   ├── authController.js      # register/login/refresh/logout/me
│   │   └── settingsController.js  # get/update gym settings
│   ├── routes/                    # authRoutes, settingsRoutes, index.js aggregator
│   ├── utils/
│   │   ├── tokens.js              # JWT generation/verification, token hashing
│   │   ├── asyncHandler.js
│   │   ├── ApiError.js
│   │   ├── logAudit.js            # writes to the auditLogs collection
│   │   └── seed.js                # creates default admin + roles + settings
│   ├── app.js / server.js
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── redux/
    │   │   ├── store.js
    │   │   └── slices/ (authSlice.js, uiSlice.js)
    │   ├── services/ (api.js — axios w/ silent refresh, authApi.js)
    │   ├── routes/ProtectedRoute.jsx
    │   ├── components/layout/AppLayout.jsx  # sidebar, dark mode, logout
    │   ├── pages/
    │   │   ├── Auth/ (LoginPage, UnauthorizedPage)
    │   │   └── Dashboard/DashboardPage.jsx  # placeholder, built out in Phase 5
    │   ├── App.jsx, main.jsx, index.css
    ├── tailwind.config.js (dark mode via class), postcss.config.js
    ├── vite.config.js (dev proxy → backend on :5000)
    └── package.json
```

## Database collections modeled

`users`, `roles`, `settings`, `members`, `membershipPlans`, `memberships`, `payments`,
`invoices`, `expenses`, `equipment`, `maintenance`, `staff`, `notifications`, `auditLogs`.

Each schema includes every field from the spec (e.g. Member has BMI auto-calculated
from height/weight on save; MembershipPlan supports freeze rules, grace periods, max
renewals; Payment/Invoice separate the transaction record from the printable document).

## Auth & security implemented

- JWT access token (short-lived, 15 min default) + rotating refresh token stored as an
  **httpOnly cookie** (not accessible to JS, mitigates XSS token theft).
- Refresh tokens are hashed (SHA-256) before being stored on the user document, and
  rotated on every refresh; reuse of an old token forces a full logout.
- Account lockout after 5 failed attempts (15 min lock), both configurable via `.env`.
- Passwords hashed with bcrypt.
- `authorize('admin')` for simple role gating, and `can('module', 'action')` for a
  granular permission matrix if you outgrow the two default roles.
- All auth events (login/logout) and settings changes are written to `auditLogs`.

## Running it locally

**Backend**
```bash
cd backend
npm install
cp .env.example .env        # then fill in MONGO_URI and JWT secrets
npm run seed                 # creates default admin: admin@gymerp.com / Admin@12345
npm run dev                  # http://localhost:5000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api to :5000)
```

Log in with the seeded admin account, and you'll land on a dashboard shell with a
role-aware sidebar (Admin sees Expenses/Staff/Reports/Settings; Receptionist does not).

## Phase 2: Members & Membership Lifecycle

**Backend**
- `models/Counter.js` — generic atomic-increment counter, reused for Member/Staff/Equipment/Invoice IDs.
- `utils/idGenerator.js` — generates `GYM001`-style member IDs off the Settings prefix.
- `middleware/upload.js` — multer config for photo uploads and CSV/Excel import files.
- `controllers/memberController.js` + `routes/memberRoutes.js` — full CRUD, pagination,
  search (name/phone/email/memberId), status filter, status transitions (suspend/freeze/
  reactivate/cancel), Excel export, and bulk CSV/Excel import with a per-row error report.
- `controllers/membershipPlanController.js` + `routes/membershipPlanRoutes.js` — plan CRUD;
  standard duration types auto-compute `durationDays`, custom plans accept their own.
- `controllers/membershipController.js` + `routes/membershipRoutes.js` — the full lifecycle:
  new / renew / upgrade / downgrade (pro-rated) / transfer / freeze / unfreeze / cancel,
  plus `/api/memberships/expiring?days=7` for reminders. Pricing (`calcFinalAmount`)
  applies discount (flat or %) then tax.

**Frontend**
- `pages/Members/` — list page (search, status filter, pagination, export, admin-only import),
  add/edit modal, member profile page with membership history and lifecycle actions.
- `pages/Memberships/PlansPage.jsx` — admin-only plan cards with create/edit/deactivate.
- `components/common/` — Modal, ConfirmDialog, Badge, Pagination (shared across all phases).

## Phase 3: Payments & Expenses

**Backend**
- `utils/generateInvoicePdf.js` — PDFKit-based invoice generator, streamed directly to the
  response (verified in this environment: rendered and rasterized to confirm layout).
- `utils/fileStorage.js` — saves uploaded bill/receipt files to `/uploads/bills` and serves
  them statically at `/uploads/...` (swap for a Cloudinary call if you set those env vars).
- `controllers/paymentController.js` + `routes/paymentRoutes.js` — record a payment (optionally
  linked to a membership, auto-generating an `INV00001`-style invoice), list with filters
  (status/method/member/date range), PDF invoice download, partial/full refunds, Excel export.
- `controllers/expenseController.js` + `routes/expenseRoutes.js` — CRUD with an optional
  bill/receipt upload, category + date filters, an `/analytics` endpoint (category breakdown
  and monthly totals via MongoDB aggregation) for the dashboard charts, and Excel export.

**Frontend**
- `pages/Payments/` — list with status/method filters, "Record Payment" modal with a
  searchable member combobox that auto-fills the amount from their active membership,
  refund modal, one-click invoice PDF download.
- `pages/Expenses/` — list with category filter, add/edit modal with file upload, monthly
  bar chart + category pie chart (Recharts) fed by the analytics endpoint.
- `services/downloadFile.js` — **fixes a bug from the initial Phase 2 pass**: export and
  invoice endpoints require the JWT in an `Authorization` header, which a plain `<a href>`
  link can't send (only our axios interceptor attaches it). All file downloads now go
  through an authenticated blob fetch instead. Members export was patched to match.

Backend and frontend were both installed and build-tested clean in this environment,
including a real generated + rasterized sample PDF invoice to check the layout. No live
MongoDB was available here, so exercise the flows once against your own `MONGO_URI`
before relying on them in production.

## Phase 4: Equipment & Staff

**Backend**
- `controllers/equipmentController.js` + `routes/equipmentRoutes.js` — CRUD with auto-generated
  `EQP001`-style IDs, photo upload, search (name/serial/brand/ID), status filter, status
  transitions, a `/warranty-alerts?days=30` endpoint, Excel export.
- `controllers/maintenanceController.js` + `routes/maintenanceRoutes.js` (nested under
  `/equipment/:id/maintenance` for history, standalone `/maintenance/:id` for updates) —
  logging service/repair/inspection records, repair cost tracking, and a `/due?days=7`
  endpoint for upcoming service alerts. Logging an active repair automatically flips the
  equipment to `under_maintenance`; marking it `completed` restores `active` (or `repaired`
  for a finished repair).
- `controllers/staffController.js` + `routes/staffRoutes.js` (admin-only throughout) — add
  staff with an auto-generated `EMP001`-style ID, **optionally create a linked login
  account** (role `receptionist`) with a generated temporary password, edit profile, disable/
  re-enable (which also flips the linked `User.isActive`), and reset password (rotates the
  refresh token too, forcing re-login everywhere).

**Frontend**
- `pages/Equipment/` — list with search/status filter, warranty-expiry banner, add/edit
  modal with photo upload, a detail page showing full maintenance history with a
  "mark completed" action and a "log record" modal.
- `pages/Staff/` — list with search, add/edit modal (with a "create login account" toggle),
  disable/re-enable, and a one-time credentials modal shown after account creation or a
  password reset (with copy-to-clipboard) — since generated passwords are only ever
  returned once, never stored or re-displayed.
- `Badge` component extended to cover equipment/staff statuses (under maintenance, damaged,
  retired, disabled, etc).

Backend and frontend both installed and build-tested clean in this environment. As with
earlier phases, there's no live MongoDB here, so the full equipment/maintenance/staff
flows haven't been exercised end-to-end — worth a pass against your own `MONGO_URI`.

## Phase 5: Dashboard, Notifications, Reports & Audit Logs

**Backend**
- `controllers/dashboardController.js` + `routes/dashboardRoutes.js` — `/summary` (all the
  cards: total/active/expired/new members, monthly revenue/expenses/net profit, equipment
  count, memberships expiring in 7 days, pending payments) and `/charts` (revenue,
  membership growth, profit, and plan-distribution series, all via MongoDB aggregation).
- `utils/notificationGenerator.js` — six checks (membership expiry, payment due, birthday
  wishes, equipment service due, low revenue alert vs. 30-day average, daily collection
  summary), each idempotent per day so re-running won't duplicate. Wired into `server.js`
  on a daily `node-cron` schedule (8 AM) and also triggerable on demand.
- `controllers/notificationController.js` + `routes/notificationRoutes.js` — list with
  unread count, mark-read / mark-all-read, and an admin "generate now" endpoint.
- `controllers/reportController.js` + `routes/reportRoutes.js` — all 7 reports (Member,
  Membership, Payment, Expense, Profit, Equipment, Staff) exportable as Excel or CSV from
  the same workbook builder, plus a dedicated PDFKit **Profit Report** PDF — rendered and
  rasterized in this environment to confirm the layout, alongside the earlier invoice PDF.
- `controllers/auditLogController.js` + `routes/auditLogRoutes.js` — filterable
  (user/action/module/date range), paginated log viewer over everything the audit trail
  has been recording since Phase 1.

**Frontend**
- `pages/Dashboard/DashboardPage.jsx` — replaced the placeholder with real stat cards and
  four Recharts panels (revenue line, membership growth bar, profit line, plan distribution
  pie), all fed by the new dashboard endpoints.
- `components/layout/NotificationBell.jsx` — a header dropdown with unread badge,
  mark-read/mark-all-read, and an admin-only manual "generate now" refresh button, polling
  every 60s. Added a slim top header bar to `AppLayout` to hold it.
- `pages/Reports/ReportsPage.jsx` — one card per report with Excel/CSV buttons (PDF too,
  for Profit).
- `pages/AuditLogs/AuditLogsPage.jsx` — filterable, paginated log table with color-coded
  action badges.

This closes out the module list from the original spec. Backend and frontend both
installed and build-tested clean here, and I rendered a sample Profit Report PDF with the
real drawing code to check the layout before calling it done. No live MongoDB in this
sandbox, so — as with every phase — run the flows once against your own `MONGO_URI` before
relying on them; the cron job in particular is worth a manual `POST /api/notifications/generate`
test first.

## What's next (per the phased plan)

- **Phase 6 (final):** UI polish pass, QR code check-in, deployment guide (e.g. Render/Railway
  + MongoDB Atlas + Vercel).

Say the word when you want to start Phase 2.
