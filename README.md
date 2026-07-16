# Gym Management ERP — Phase 1 + Phase 2

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

## Phase 2 additions: Members & Membership Lifecycle

**Backend**
- `models/Counter.js` — generic atomic-increment counter, reused for Member/Staff/Equipment IDs.
- `utils/idGenerator.js` — generates `GYM001`-style member IDs off the Settings prefix.
- `middleware/upload.js` — multer config for photo uploads and CSV/Excel import files.
- `controllers/memberController.js` + `routes/memberRoutes.js` — full CRUD, pagination,
  search (name/phone/email/memberId), status filter, status transitions (suspend/freeze/
  reactivate/cancel), Excel export, and bulk CSV/Excel import with a per-row error report.
- `controllers/membershipPlanController.js` + `routes/membershipPlanRoutes.js` — plan CRUD;
  standard duration types auto-compute `durationDays`, custom plans accept their own.
- `controllers/membershipController.js` + `routes/membershipRoutes.js` — the full lifecycle:
  - **New**: creates a membership, sets the member's `currentMembership` and status.
  - **Renew**: respects `maxRenewals` and the plan's grace period when picking the new start date.
  - **Upgrade/Downgrade**: pro-rates remaining days onto the new plan.
  - **Transfer**: moves an active membership to a different member record.
  - **Freeze/Unfreeze**: extends the end date by the frozen days, enforces the plan's `freezeDays` cap.
  - **Cancel**: ends the membership and clears the member's active link.
  - **Expiring soon**: `/api/memberships/expiring?days=7` for reminders/dashboard use.
  - Pricing (`calcFinalAmount`) applies discount (flat or %) then tax, unit-tested inline.

**Frontend**
- `pages/Members/` — list page (search, status filter, pagination, export button, admin-only
  import), add/edit modal, and a member profile page showing membership history with
  renew/freeze/cancel actions and an "Assign Membership" flow.
- `pages/Memberships/PlansPage.jsx` — admin-only plan cards with create/edit/deactivate.
- `components/common/` — Modal, ConfirmDialog, Badge, Pagination (shared across future phases).
- Sidebar now links to **Plans** (admin only) alongside Members.

Both the backend (`npm install`, syntax check, boots cleanly) and frontend
(`npm install && npm run build`) were verified in this environment. No live MongoDB
was available here to run a full end-to-end request, so exercise the flows locally
against your own `MONGO_URI` before going live — the pricing math and ID generation
were verified directly.

## What's next (per the phased plan)

- **Phase 3:** Payments (PDF invoice generation, refunds) + Expenses.
- **Phase 4:** Equipment + maintenance history + Staff management.
- **Phase 5:** Dashboard cards/charts, Notifications, Reports (PDF/Excel/CSV export),
  Audit log viewer.
- **Phase 6:** UI polish pass, QR code check-in, deployment guide (e.g. Render/Railway
  + MongoDB Atlas + Vercel).

Say the word when you want to start Phase 2.
