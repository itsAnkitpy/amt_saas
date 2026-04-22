# AMT SaaS

AMT SaaS is a multi-tenant asset management application built with Next.js, Prisma, PostgreSQL, and Clerk. It supports tenant-scoped asset tracking, category-driven custom fields, assignment history, QR and barcode workflows, bulk import and export, image uploads, and audit activity.

## Current Scope

Implemented today:

- multi-tenant tenant routing with `/t/[slug]`
- Clerk authentication and database-backed user sync
- superadmin tenant management
- asset CRUD with category-based custom fields
- assignment and return flows with history records
- QR code generation and camera scanning
- CSV import, export, and bulk asset actions
- asset image uploads with local storage or Vercel Blob
- tenant dashboard analytics and recent activity
- audit logging and soft delete via `archivedAt`

Still planned:

- billing and subscriptions
- fuller onboarding flow
- maintenance tracking, notifications, reports, and depreciation
- broader automated test coverage

## Stack

- Next.js 16 App Router
- React 19
- TypeScript 5
- PostgreSQL
- Prisma ORM
- Clerk authentication
- Tailwind CSS 4
- shadcn/ui
- Vercel Blob or local filesystem storage

## Local Setup

### Requirements

- Node.js 20+
- npm
- PostgreSQL
- Clerk application credentials

### Steps

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

3. Fill in the required values in `.env`.

4. Apply database migrations:

   ```bash
   npx prisma migrate dev
   ```

5. Optionally seed a superadmin user:

   ```bash
   npx prisma db seed
   ```

6. Start the app:

   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See `.env.example` for the full template. The main variables are:

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_APP_URL` | Yes | Base app URL for local/dev environments |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk frontend key |
| `CLERK_SECRET_KEY` | Yes | Clerk backend key |
| `CLERK_WEBHOOK_SECRET` | Yes for webhook sync | Clerk webhook verification |
| `BLOB_READ_WRITE_TOKEN` | No | Enables Vercel Blob storage |
| `SUPERADMIN_CLERK_ID` | No | Optional seed value |
| `SUPERADMIN_EMAIL` | No | Optional seed value |

If `BLOB_READ_WRITE_TOKEN` is not set, image uploads use the local `storage/` directory.

## Common Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npx prisma migrate dev
npx prisma studio
npx prisma db seed
```

## Architecture Notes

### Tenant Routing

- Tenant workspaces live under `/t/[slug]`.
- Superadmins can access any tenant.
- Non-superadmins are restricted to their own tenant.

### Role Hierarchy

- `USER`
- `MANAGER`
- `ADMIN`
- `SUPER_ADMIN`

Asset write operations are currently hardened around `MANAGER+` access.

### Asset Lifecycle

- Active assets use statuses like `AVAILABLE`, `ASSIGNED`, and `MAINTENANCE`.
- Deleting an asset performs a soft delete by setting `archivedAt` and moving status to `RETIRED`.
- Archived assets stay in the database along with their activity, assignments, and image records.

### Assignments

- Current assignee is stored on the asset for quick reads.
- Assignment history is tracked in `AssetAssignment`.
- Single-asset actions, scan flows, and bulk actions now use the same assignment rules and audit behavior.

### Storage

- Local development defaults to filesystem storage.
- Staging and production can switch to Vercel Blob by setting `BLOB_READ_WRITE_TOKEN`.

## Quality And Verification

- `npm run lint` is expected to pass.
- `npm run typecheck` is expected to pass.
- Automated tests are not in place yet, so verification is currently lint, typecheck, and targeted manual checks.

## Project Documentation

- Implementation notes live under `PRD/project_implementation/`.
- Start with `PRD/project_implementation/project.md` for the current summary.
- Module-specific docs cover foundation, auth, superadmin, assets, barcode flows, bulk operations, validation, audit, and dashboard work.
