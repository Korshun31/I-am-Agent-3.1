> Главный документ проекта: CURSOR_RULES.md. Читать первым перед любой задачей.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**I am Agent** is a cross-platform real estate CRM for real estate rental entrepreneurs and their teams. It runs as:
- **Mobile**: Expo SDK 54 (React Native) — iOS, Android
- **Web**: React (via React Native Web) — deployed to Vercel
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)

## Commands

```bash
npm install          # Install dependencies (also runs postinstall: patches + calendar fix)
npm start            # Expo dev server
npm run ios          # Run on iOS simulator
npm run android      # Run on Android emulator
npm run web          # Run web version

npm run verify-build         # Pre-build checks
npm run prepare-testflight   # Prepare iOS TestFlight submission
npm run build:ios            # Full iOS build: verify-build + eas build --platform ios
```

No test runner is configured. Verification is done via `scripts/verify-build.js`.

## Architecture

### Platform Routing

`App.js` is the root. After auth, it routes based on `Platform.OS`:
- `=== 'web'` → `WebMainScreen` wrapped in `AppDataProvider` (web migrated to the shared data context in commit `84e6508`).
- otherwise → `MainNavigator` wrapped in `AppDataProvider`.

### State Management (Context API)

- **`UserContext`** — current user profile, role, plan, company membership, permissions. Used everywhere.
- **`AppDataContext`** — shared data for both mobile and web (web joined the same context in commit `84e6508`): properties, bookings, contacts, calendar events. Exposes `refreshProperties()`, `refreshBookings()`, `refreshContacts()`, `refreshCalendarEvents()`, `refreshAll()`.
- **`LanguageContext`** — active language (en/th/ru), currency (THB/USD/EUR/RUB), dayjs locale.

### Data Layer (Services)

All Supabase logic lives in `src/services/`. Key services:
- `supabase.js` — Supabase client init
- `authService.js` — sign in/up, session load, full user profile resolution
- `propertiesService.js` — CRUD; auto-sets `property_status: 'pending'` for users, `'approved'` for owners
- `bookingsService.js` — booking CRUD with overlap detection and commission calculation
- `companyService.js` — company lifecycle, invitations, team member management
- `contactsService.js`, `calendarEventsService.js`, `locationsService.js`
- `companyChannel.js` — Supabase Realtime subscriptions; calls `broadcastChange()` after mutations to trigger `refreshX()` calls
- `dataUploadService.js` — offline sync via SQLite + AsyncStorage

### Web UI Structure

```
WebMainScreen
  └─ WebLayout (sidebar nav)
     ├─ WebDashboardScreen
     ├─ WebPropertiesScreen   ← list (left) + detail/edit panel (right)
     ├─ WebBookingsScreen     ← Gantt-style calendar
     ├─ WebContactsScreen
     └─ WebAccountScreen      ← profile + team management
```

Web panels (`src/web/components/`): `WebPropertyDetailPanel`, `WebPropertyEditPanel`, `WebBookingEditPanel`, `WebTeamSection`, etc.

### Mobile UI Structure

```
MainNavigator (React Navigation bottom tabs + stack)
  ├─ RealEstateScreen / PropertyDetailScreen
  ├─ BookingCalendarScreen / BookingDetailScreen
  ├─ AgentCalendarScreen
  ├─ ContactsScreen / ContactDetailScreen
  ├─ StatisticsScreen
  └─ AccountScreen
```

## Role-Based Access Control

Two roles defined by `company_members.role`:

| Role | Access |
|------|--------|
| **Admin** (owner) | Full access; approves/rejects properties; manages team |
| **Agent** (member) | Own properties only; booking/contact visibility limited to assigned objects |

Check `user.teamRole`, `user.isAdminRole`, `user.isAgentRole` from `UserContext` before showing sensitive UI. Always check `user.teamPermissions` before allowing actions (permissions: `can_add_property`, `can_edit_prices`, `can_see_financials`, `can_delete_booking`, `can_manage_clients`).

Database RLS enforces these at the query level. The service layer adds a second guard (e.g., `resolveCreatePropertyStatus()`).

## Conventions

- **File locations**: screens → `src/screens/` or `src/web/screens/`; reusable components → `src/components/` or `src/web/components/`; data logic → `src/services/`
- **Naming**: components PascalCase, services camelCase, translation keys camelCase
- **New UI strings**: add to all three languages in `src/i18n/translations.js` (en, th, ru)
- **Block spacing**: use `BLOCK_VERTICAL_PADDING` and `BLOCK_ROW_GAP` constants defined in `AccountScreen.js` — top/bottom padding of a block and internal row gaps must be equal
- **Accent color**: `#3D7D82` (teal)

## Key Reference Files

- `docs/APP_MAP_WEB.md` — source of truth for web UI structure and role/permission matrix
- `docs/SYSTEM_ARCHITECTURE.md` — full data flow and property lifecycle diagrams
- `CONTEXT_FOR_AI.md` — detailed DB schema, API contracts, pending technical debt
- `src/constants/roleFeatures.js` — plan-based feature flags (STANDARD, PREMIUM, ADMIN)

## Known Technical Debt

- Translation keys are partially duplicated across web/mobile (e.g., `bkTotalPrice` vs `bookingTotalPrice`, `ownerCommissionOneTime` vs `bookingOwnerCommOnce`)
- Permission enforcement (`can_add_property`, etc.) is defined but not fully enforced in the UI layer yet
