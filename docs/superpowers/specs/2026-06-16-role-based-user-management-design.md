# Design Spec: Role-Based User Management

## 1. Goal
Support the creation and management of 'pengurus' (administrator) users in addition to 'pengajar' (teacher) users. This includes backend support for roles and a UI for administrators to add other administrators.

## 2. Architecture

### Backend (Supabase Edge Functions)
- **Endpoint:** `manage-user`
- **Changes:**
  - `CreatePayload` interface updated to include `role` and `password`.
  - `handleCreate` logic refactored:
    - Default password for 'pengajar' remains `{NIM}uam`.
    - Custom password supported for both roles.
    - `users` table insertion now uses the provided `role`.
    - `pengajar_tpa` assignment skipped for 'pengurus' users.

### Frontend Library
- `src/lib/manage-user.ts`: `createUser` updated to support `role` and `password` parameters.

### UI Components
- **`TambahPengurusModal`**: A new modal for adding administrator accounts without requiring NIM or TPA assignment.
- **`KelolaPengajarPage` (renamed to "Kelola Pengguna")**:
  - Added a tab system to toggle between "Pengajar" and "Pengurus" lists.
  - Added "Tambah Pengurus" button for admins.
  - Conditional rendering of NIM and TPA columns based on the active tab.

## 3. Data Flow
1. Admin clicks "Tambah Pengurus" in the management page.
2. Modal collects name, email, and optional password.
3. `createUser` library function calls the `manage-user` Edge Function.
4. Edge Function creates the Auth user and the public profile with `role: 'pengurus'`.
5. User appears in the "Pengurus" tab of the management page.

## 4. Verification Plan
- [x] Create a specific pengurus account via script to verify backend/database integrity.
- [x] Verify that pengurus users can be toggled/deleted just like pengajar users.
- [x] Verify that pengurus users do not require TPA assignment.
