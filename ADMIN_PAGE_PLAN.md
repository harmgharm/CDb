# Admin Page Implementation Plan

## Context

This is the final frontend page to build for the CDB (CinemaDatabase) app. All other pages are
complete:

- Home dashboard (stats, activity feed)
- Database (media browser with grid/list toggle, filters, detail page, search + import)
- Users (list + profile pages with stats, rating distribution, genres, picks)

## What to Build

### Admin Page (`src/app/(main)/admin/page.tsx`)

The admin page needs 3 sections, ideally as tabs using shadcn `Tabs` component:

#### Tab 1: Audit Log

- **API**: `GET /api/admin/audit-log` — paginated, filterable by action/entityType/userId
- Filterable table showing: timestamp, user, action, entity type, entity ID, metadata
- Pagination controls
- Action filter dropdown (user.created, media.created, session.created, rating.created, etc.)

#### Tab 2: User Management

- **APIs**:
  - `GET /api/admin/users` — list all users (admin view)
  - `PATCH /api/admin/users/[id]` — change user role
  - `DELETE /api/admin/users/[id]` — delete user
  - `GET /api/admin/invite-codes` — list invite codes
  - `POST /api/admin/invite-codes` — generate new invite code
- User table with role change dropdown (admin/member) and delete button
- Invite codes section: list existing codes (used/unused/expired), generate new code button
- Confirmation dialogs for destructive actions (role change, delete)

#### Tab 3: Media/Session CRUD (optional, lower priority)

- Quick links to add media (reuse ImportMediaDialog from database page)
- Session management if time permits

## Files to Create

### Types & Hooks

- `src/types/admin-responses.ts` — AuditLogEntry, AuditLogResponse, AdminUser, InviteCodeItem
- `src/hooks/use-admin.ts` — useAuditLog, useAdminUsers, useInviteCodes + mutation helpers

### Components

- `src/components/admin/audit-log-table.tsx` — filterable audit log with pagination
- `src/components/admin/user-management.tsx` — user table with role change + delete
- `src/components/admin/invite-codes.tsx` — invite code list + generate button

### Page

- `src/app/(main)/admin/page.tsx` — replace placeholder with tabbed admin panel

## API Routes to Reference

Read these files to understand response shapes:

- `src/app/api/admin/audit-log/route.ts`
- `src/app/api/admin/users/route.ts`
- `src/app/api/admin/users/[id]/route.ts`
- `src/app/api/admin/invite-codes/route.ts`

## Established Patterns to Follow

- SWR hooks in `src/hooks/` with types from `src/types/`
- `Readonly<{}>` for component props, `readonly` on interface fields
- `"easeOut" as const` for motion transition ease values
- `String()` wrapping numbers in template literals
- `=== null` / `=== undefined` instead of `!` (strict-boolean-expressions)
- Extract helper components for nested ternaries (sonarjs/no-nested-conditional)
- Import sorting handled by `npm run lint:fix` (simple-import-sort)
- Use `next/image` with configured remotePatterns for external images
- Use sonner `toast` for success/error notifications
- Confirmation dialogs for destructive actions
- shadcn components already installed: table, dialog, tabs, badge, button, select, etc.

## Commands

```bash
npm run lint          # ESLint check
npm run lint:fix      # Auto-fix
npm run format        # Prettier
npx tsc --noEmit      # TypeScript check
```
