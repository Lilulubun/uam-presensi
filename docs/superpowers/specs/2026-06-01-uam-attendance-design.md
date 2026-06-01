# Design Specification: UAM Attendance Monitoring System

**Project:** Sistem Informasi Monitoring SDM dan Presensi Pengajar  
**Organization:** UII Ayo Mengajar (UAM)  
**Date:** June 1, 2026  
**Version:** 1.0  
**Status:** Approved for Implementation

---

## Executive Summary

This specification describes a web-based attendance monitoring system for 11 TPA (Taman Pendidikan Al-Quran) locations managed by UII Ayo Mengajar. The system replaces manual WhatsApp-based attendance tracking with an automated solution using dynamic QR codes and GPS validation.

**Key Features:**

- Dynamic QR code-based check-in/out (20-second token refresh)
- GPS location validation (100m radius)
- Real-time admin dashboard for monitoring all locations
- Late detection (>15 minutes from session start)
- Early exit detection (computed from attendance records)
- Multi-format data export (CSV, Excel, JSON)

**Implementation Strategy:**

- **Prototype:** Client-side only (Zustand + localStorage)
- **Production:** Migrate to Supabase (PostgreSQL + Auth + Realtime)

---

## 1. System Architecture

### 1.1 Technology Stack

**Core Framework:**

- React 18.3.1 + TypeScript (strict mode)
- Vite 6.3.5 (build tool)
- Tailwind CSS v4.1.12

**State Management:**

- Zustand (with persist middleware)
- localStorage for persistence (prototype)

**Routing:**

- React Router v7.13.0

**UI Components:**

- Radix UI primitives (existing in project)
- shadcn/ui components (existing in project)
- Lucide React icons

**QR Code:**

- `html5-qrcode` - Camera-based scanning
- `qrcode` - QR generation (static and dynamic)

**Utilities:**

- `date-fns` - Date/time formatting
- `sonner` - Toast notifications
- `xlsx` - Excel export

**Design System:**

- Primary color: Turquoise/Teal (#17a2b8) from UAM branding
- Accent: Light blue (#0d6efd)
- Clean, card-based layout inspired by provided design reference
- Responsive: Mobile (390px), Tablet (768px), Desktop (1440px+)

### 1.2 Project Structure

```
src/
├── app/
│   ├── App.tsx                          # Root with router
│   ├── components/
│   │   ├── ui/                          # Existing shadcn components
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── TeacherNav.tsx
│   │   │   └── AdminNav.tsx
│   │   ├── qr/
│   │   │   ├── QRScanner.tsx            # Camera QR scanner
│   │   │   ├── QRDisplay.tsx            # Dynamic QR + countdown
│   │   │   └── StaticQRGenerator.tsx    # Generate printable PDFs
│   │   ├── attendance/
│   │   │   ├── AttendanceCard.tsx
│   │   │   ├── AttendanceList.tsx
│   │   │   └── SessionCard.tsx
│   │   └── dashboard/
│   │       ├── TPACard.tsx
│   │       ├── TPAGrid.tsx
│   │       └── StatsWidget.tsx
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── teacher/
│   │   │   ├── TeacherDashboard.tsx
│   │   │   ├── ScanQRPage.tsx
│   │   │   ├── ActiveSessionPage.tsx
│   │   │   ├── AttendanceConfirmation.tsx
│   │   │   └── AttendanceHistory.tsx
│   │   └── admin/
│   │       ├── AdminDashboard.tsx
│   │       ├── TPADetailPage.tsx
│   │       ├── TeacherDetailPage.tsx
│   │       ├── ReportsPage.tsx
│   │       └── SetupPage.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useSession.ts
│   │   ├── useAttendance.ts
│   │   ├── useQRScanner.ts
│   │   ├── useGeolocation.ts
│   │   └── useDynamicQR.ts
│   ├── store/
│   │   ├── authStore.ts
│   │   ├── tpaStore.ts
│   │   ├── sessionStore.ts
│   │   └── attendanceStore.ts
│   ├── lib/
│   │   ├── qr-utils.ts
│   │   ├── gps-utils.ts
│   │   ├── date-utils.ts
│   │   ├── export-utils.ts
│   │   └── mock-data.ts
│   ├── types/
│   │   └── index.ts
│   └── config.ts
```

### 1.3 Deployment Model

**Prototype:**

- Static web application
- Deploy to Vercel/Netlify
- No backend required
- All data in browser localStorage

**Production Migration:**

- Supabase backend (PostgreSQL + Auth + Realtime)
- Server-side QR token generation (Edge Functions)
- Row-level security (RLS) policies
- Real-time subscriptions for dashboard updates

---

## 2. Data Models

### 2.1 Core Types

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: "pengajar" | "pengurus";
  nim?: string; // Only for pengajar
}

interface TPA {
  id: string;
  name: string;
  location: {
    lat: number; // Decimal degrees (WGS84)
    lng: number;
    radius: number; // Meters (100 for production)
  };
  staticQRCode: string; // e.g., "TPA-001"
}

interface Session {
  id: string;
  tpaId: string;
  dateOpened: string; // ISO 8601 timestamp
  dateClosed?: string; // ISO 8601 timestamp
  firstTeacherId: string; // User ID of "Pengajar Pertama"
  isActive: boolean;

  qrDynamicIn?: {
    token: string; // UUID v4
    expiresAt: string; // ISO 8601 timestamp
    usedBy: string[]; // User IDs who scanned this token
  };

  qrDynamicOut?: {
    token: string;
    expiresAt: string;
    usedBy: string[];
  };
}

interface Attendance {
  id: string;
  sessionId: string;
  userId: string;
  tpaId: string;

  // Check-in
  checkInTime?: string;
  checkInLocation?: { lat: number; lng: number };
  isLate: boolean;
  lateMinutes: number; // 0 if on time

  // Check-out
  checkOutTime?: string;
  checkOutLocation?: { lat: number; lng: number };

  // NOTE: isEarlyExit is NOT stored - computed dynamically
  // via detectEarlyExits() to avoid stale data
}
```

### 2.2 Zustand Stores

**authStore.ts:**

```typescript
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}
```

**tpaStore.ts:**

```typescript
interface TPAState {
  tpas: TPA[];
  getTPAById: (id: string) => TPA | undefined;
  getTPAByStaticQR: (qrCode: string) => TPA | undefined;
}
```

**sessionStore.ts:**

```typescript
interface SessionState {
  sessions: Session[];
  openSession: (
    tpaId: string,
    firstTeacherId: string,
  ) => Session;
  closeSession: (sessionId: string) => void;
  refreshDynamicQRIn: (sessionId: string) => void;
  getActiveSessionByTPA: (tpaId: string) => Session | undefined;
  isTokenValid: (
    token: string,
    userId: string,
    type: "in" | "out",
  ) => boolean;
}
```

**attendanceStore.ts:**

```typescript
interface AttendanceState {
  attendances: Attendance[];
  recordCheckIn: (
    sessionId: string,
    userId: string,
    location: Coords,
  ) => Attendance;
  recordCheckOut: (
    attendanceId: string,
    location: Coords,
  ) => void;
  getAttendanceBySession: (sessionId: string) => Attendance[];
  getAttendanceByUser: (userId: string) => Attendance[];
  detectEarlyExits: (sessionId: string) => Attendance[]; // Computed
}
```

### 2.3 Persistence Strategy

**localStorage Keys:**

- `uam-auth` - User session
- `uam-tpas` - TPA locations (pre-seeded)
- `uam-sessions` - Active and historical sessions
- `uam-attendances` - All attendance records

**Zustand Persist Middleware:**

- Auto-sync store state to localStorage
- Hydrate on app load
- No manual localStorage calls in components

**Migration Notes:**
All stores include comments like:

```typescript
// PRODUCTION: Replace with Supabase query
// const { data } = await supabase.from('sessions').select('*')
```

---

## 3. User Flows

### 3.1 Authentication Flow

**Login Process:**

1. User enters email + password
2. Validate against mock users (prototype)
3. Store user in authStore + localStorage
4. Redirect based on role:
   - `pengajar` → `/teacher/dashboard`
   - `pengurus` → `/admin/dashboard`

**Protected Routes:**

- All routes except `/login` require authentication
- Role-based access control:
  - `/teacher/*` - Only `pengajar`
  - `/admin/*` - Only `pengurus`
- Unauthorized access → redirect to login

**Mock Users (Prototype):**

```typescript
Teachers:
- budi@uii.ac.id / password
- siti@uii.ac.id / password
- ahmad@uii.ac.id / password
- dewi@uii.ac.id / password
- rizki@uii.ac.id / password

Admin:
- pengurus@uii.ac.id / admin
```

### 3.2 Session Management (Pengajar Pertama)

**"Pengajar Pertama" is NOT a permanent role** - it's a dynamic status assigned to whoever scans the static QR first to open a session.

**Opening Session:**

1. Teacher navigates to `/teacher/scan`
2. Scans **static QR code** (physical, posted at TPA)
3. System validates:
   - ✅ QR matches a registered TPA
   - ✅ No active session at that TPA (`¬S_active`)
4. Create session:
   - Set `firstTeacherId = currentUser.id`
   - Record `dateOpened = now()`
   - Generate initial `qrDynamicIn` token (20s expiry)
   - **Auto-create attendance record** for first teacher (check-in time = session open time)
5. Navigate to `/teacher/session-active`
6. Start 20-second auto-refresh timer

**Active Session Page:**

- Display dynamic QR code with countdown (20, 19, 18...)
- Show list of teachers who checked in (updates from localStorage)
- Show session info (TPA name, start time)
- **"Tutup Sesi"** button (only visible to firstTeacher)

**Closing Session:**

1. Only `firstTeacherId` can close
2. Record `dateClosed = now()`
3. Set `isActive = false`
4. Generate `qrDynamicOut` token (20s expiry, auto-refresh)
5. **Auto-create check-out record** for first teacher
6. Display QR dynamic out
7. First teacher scans to complete their check-out

**Route Guard:**

```typescript
// /teacher/session-active only accessible if user is currently
// a "Pengajar Pertama" of an active session
const activeSessionAsFirst = sessions.find(
  (s) => s.isActive && s.firstTeacherId === user.id,
);
if (!activeSessionAsFirst) redirect("/teacher/dashboard");
```

### 3.3 Check-In Flow (Pengajar Lain)

**Process:**

1. Teacher scans **dynamic QR In** from first teacher's screen
2. Extract token from QR
3. Validate:
   - ✅ Token not expired (`expiresAt > now()`)
   - ✅ Token not used by this user (`userId ∉ usedBy`)
   - ✅ Session is active
   - ✅ GPS location within radius (or debug mode bypass)
4. Calculate lateness:
   ```typescript
   lateMinutes = max(0, t_scan_in - (t_open + 15 minutes))
   isLate = lateMinutes > 0
   ```
5. Record attendance
6. Mark token as used by this user
7. Navigate to `/teacher/confirmation` with result

**Confirmation Messages:**

- ✅ "Presensi masuk berhasil!" (on time)
- ⚠️ "Terlambat X menit" (late)
- ❌ "QR sudah kadaluwarsa, minta scan ulang"
- ❌ "Anda sudah presensi masuk"
- ❌ "Izinkan akses lokasi untuk presensi"
- ❌ "Lokasi Anda di luar area TPA"

### 3.4 Check-Out Flow (All Teachers)

**Process:**

1. Scan **dynamic QR Out** (only available after session closed)
2. Extract token
3. Validate:
   - ✅ Token not expired
   - ✅ Token not used by this user
   - ✅ Session is closed (`!isActive`)
   - ✅ GPS within radius (or debug bypass)
   - ✅ User has check-in record for this session
4. Record `checkOutTime` and location
5. Show confirmation: "Presensi keluar berhasil!"

**Early Exit Detection (Computed):**

```typescript
// Run when viewing session detail or generating report
const detectEarlyExits = (sessionId: string) => {
  const attendances = getAttendanceBySession(sessionId);
  return attendances.filter(
    (a) => a.checkInTime && !a.checkOutTime, // Has check-in, no check-out
  );
};
```

**Why computed, not stored:**

- Prevents stale data (what if check-out added later?)
- Single source of truth (presence/absence of `checkOutTime`)
- Admin dashboard always shows current reality

### 3.5 GPS Validation

**Debug Mode (Prototype):**

```typescript
const GPS_DEBUG_MODE = true; // Set false for production

const validateLocation = (userLat, userLng, tpa) => {
  if (GPS_DEBUG_MODE) {
    console.log("🐛 GPS validation bypassed (debug mode)");
    return true; // Always pass
  }

  // Production: Haversine distance calculation
  const distance = calculateDistance(
    userLat,
    userLng,
    tpa.lat,
    tpa.lng,
  );
  return distance <= tpa.radius;
};
```

**Production (100m radius):**

```typescript
// Haversine formula for GPS distance
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) *
      Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};
```

**GPS Permission Handling:**

```typescript
const getLocation = async (): Promise<Coordinates> => {
  if (!navigator.geolocation) {
    throw new Error("Geolocation tidak didukung browser Anda");
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(
            new Error("Izinkan akses lokasi untuk presensi"),
          );
        } else if (error.code === error.TIMEOUT) {
          reject(new Error("Timeout mendapatkan lokasi"));
        } else {
          reject(
            new Error("Tidak dapat mendeteksi lokasi Anda"),
          );
        }
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  });
};
```

### 3.6 Dynamic QR Token Management

**Token Structure:**

```typescript
interface QRToken {
  sessionId: string;
  type: "in" | "out";
  token: string; // UUID v4
  expiresAt: string; // ISO 8601 timestamp
  usedBy: string[]; // User IDs
}
```

**20-Second Auto-Refresh:**

```typescript
// In ActiveSessionPage.tsx
useEffect(() => {
  if (!session.isActive) return;

  const interval = setInterval(() => {
    refreshDynamicQRIn(sessionId);
  }, 20000); // 20 seconds

  return () => clearInterval(interval);
}, [session.isActive, sessionId]);
```

**QR Content Format:**

```typescript
// Static QR (printed, never changes)
const staticQRContent = `TPA-001`;

// Dynamic QR (changes every 20 seconds)
const dynamicQRContent = JSON.stringify({
  sessionId: "session-uuid",
  type: "in",
  token: "token-uuid",
  expiresAt: "2026-06-01T15:30:20.000Z",
});
```

**Token Generation:**

```typescript
// PROTOTYPE: Client-side generation
const generateDynamicToken = (
  sessionId: string,
  type: "in" | "out",
) => {
  return {
    sessionId,
    type,
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 20000).toISOString(),
    usedBy: [],
  };
};

// PRODUCTION: Server-side generation (Supabase Edge Function)
// - Prevents client manipulation
// - Cryptographically signed tokens (JWT)
// - Server validates signature
```

---

## 4. User Interface

### 4.1 Route Structure

```
Public Routes:
/login

Teacher Routes (role: pengajar):
/teacher/dashboard          # Home, today's status
/teacher/scan               # QR scanner
/teacher/session-active     # Active session (only if firstTeacher)
/teacher/confirmation       # Check-in/out result
/teacher/history            # Personal attendance history

Admin Routes (role: pengurus):
/admin/dashboard            # Overview of all 11 TPAs
/admin/tpa/:id              # TPA detail + session history
/admin/teacher/:id          # Teacher profile + attendance
/admin/reports              # Filters + export (CSV/Excel/JSON)
/admin/setup                # View/download static QR codes
```

### 4.2 Design System

**Colors (UAM Branding):**

```css
--primary: 174 75% 41%; /* #17a2b8 Turquoise */
--primary-foreground: 0 0% 100%;
--accent: 199 89% 48%; /* #0d6efd Light Blue */
--warning: 38 92% 50%; /* #f59e0b Orange (late) */
--success: 142 71% 45%; /* #22c55e Green (on-time) */
--destructive: 0 84% 60%; /* #ef4444 Red (early exit) */
--background: 0 0% 98%; /* #fafafa */
--card: 0 0% 100%;
--muted: 210 40% 96%; /* #f1f5f9 */
```

**Component Style:**

- Clean, card-based layouts
- Subtle shadows (`shadow-sm`)
- Rounded corners (`rounded-lg` / 12px)
- Generous padding and white space
- Typography: Clear hierarchy with system fonts

**Responsive Breakpoints:**

- Mobile: 390px - 767px (single column, large tap targets)
- Tablet: 768px - 1023px (2 columns)
- Desktop: 1024px+ (3-4 columns, data tables)

### 4.3 Key Pages

**Login Page:**

```
┌─────────────────────────┐
│   [UAM Logo]            │
│   Sistem Presensi UAM   │
│                         │
│   Email                 │
│   [_______________]     │
│                         │
│   Password              │
│   [_______________]     │
│                         │
│   [    Masuk    ]       │
└─────────────────────────┘
```

**Teacher Dashboard:**

```
┌─────────────────────────────────┐
│ Halo, Budi Santoso              │
├─────────────────────────────────┤
│ Status Hari Ini                 │
│ ┌─────────────────────────────┐ │
│ │ TPA Al-Ikhlas               │ │
│ │ ✓ Masuk: 14:00              │ │
│ │ ⏱️ Sesi berlangsung          │ │
│ └─────────────────────────────┘ │
│                                 │
│ [  📱 Scan QR untuk Presensi  ] │
│                                 │
│ Riwayat Terakhir                │
│ • 31/05 - TPA Al-Ikhlas ✓       │
│ • 30/05 - TPA Nurul Huda ⚠️     │
│ • 29/05 - TPA Al-Amin ✓         │
│ [Lihat Semua]                   │
└─────────────────────────────────┘
```

**Scan QR Page:**

```
┌─────────────────────────────────┐
│ ← Kembali                       │
│                                 │
│ Scan QR Code                    │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │   [Camera Viewfinder]       │ │
│ │                             │ │
│ │   Arahkan kamera ke QR      │ │
│ │                             │ │
│ └─────────────────────────────┘ │
│                                 │
│ Pastikan QR code terlihat jelas │
└─────────────────────────────────┘
```

**Active Session Page (First Teacher):**

```
┌─────────────────────────────────┐
│ TPA Al-Ikhlas Condongcatur      │
│ Dibuka: 14:00                   │
├─────────────────────────────────┤
│ QR Code Presensi Masuk          │
│ ┌─────────────────────────────┐ │
│ │                             │ │
│ │     [Dynamic QR Code]       │ │
│ │                             │ │
│ │   Berlaku: 00:15 ⏱️         │ │
│ └─────────────────────────────┘ │
│                                 │
│ Pengajar yang sudah hadir (3):  │
│ ✓ Budi Santoso - 14:00          │
│ ⚠️ Siti Nurhaliza - 14:18       │
│ ✓ Ahmad Fauzi - 14:05           │
│                                 │
│ [     🔴 Tutup Sesi     ]       │
└─────────────────────────────────┘
```

**Admin Dashboard:**

```
┌─────────────────────────────────────────┐
│ Dashboard Pengurus                      │
│ Last updated: 14:35:20                  │
├─────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐ ┌─────────┐│
│ │TPA 1      │ │TPA 2      │ │TPA 3    ││
│ │🟢 Aktif   │ │⚪ Tutup   │ │⚪ Tutup ││
│ │8 hadir    │ │- hadir    │ │- hadir  ││
│ │Sejak 14:00│ │           │ │         ││
│ └───────────┘ └───────────┘ └─────────┘│
│ (... 8 more TPAs)                       │
└─────────────────────────────────────────┘
```

**Reports Page:**

```
┌─────────────────────────────────┐
│ Laporan Kehadiran              │
├─────────────────────────────────┤
│ Filter:                         │
│ 📅 [01/05/26] - [31/05/26]     │
│ 🏫 TPA: [Semua ▼]              │
│ 👤 Pengajar: [Semua ▼]         │
│ [Terapkan]                      │
│                                 │
│ Export: [CSV] [Excel] [JSON]   │
├─────────────────────────────────┤
│ Tgl  │TPA    │Pengajar │Status │
│──────┼───────┼─────────┼───────│
│31/05 │TPA 1  │Budi     │✓      │
│31/05 │TPA 1  │Siti     │⚠️ 18m │
│30/05 │TPA 2  │Ahmad    │✓      │
│...                              │
└─────────────────────────────────┘
```

---

## 5. Static QR Code Setup

### 5.1 Purpose

Each TPA needs a **physical static QR code** that:

- Never changes
- Posted at TPA entrance (laminated)
- Scanned by first teacher to open session
- Contains simple TPA identifier

### 5.2 QR Content

```typescript
// Simple, stable format
const staticQRContent = tpa.staticQRCode; // e.g., "TPA-001"
```

### 5.3 Setup Page (`/admin/setup`)

**Features:**

- View all 11 static QR codes
- Display QR on screen (for testing)
- Download printable PDF (A4 format)

**PDF Layout:**

```
┌──────────────────────────┐
│ TPA Al-Ikhlas Condongcatur│
│                          │
│    ┌──────────────┐      │
│    │              │      │
│    │  [QR Code]   │      │
│    │   300x300    │      │
│    │              │      │
│    └──────────────┘      │
│                          │
│  Scan untuk membuka sesi │
│      mengajar            │
│                          │
│  UII Ayo Mengajar        │
│  ID: TPA-001             │
└──────────────────────────┘
```

**Implementation:**

```typescript
import QRCode from "qrcode";

const generateStaticQR = async (tpa: TPA) => {
  return await QRCode.toDataURL(tpa.staticQRCode, {
    width: 300,
    margin: 2,
    color: {
      dark: "#17a2b8", // UAM turquoise
      light: "#ffffff",
    },
  });
};

const downloadQRPDF = (tpa: TPA, qrDataUrl: string) => {
  // Create print-friendly HTML page
  // User prints to PDF via browser
  window.print();
};
```

---

## 6. Admin Dashboard & Monitoring

### 6.1 Real-Time Updates (Prototype)

**Polling Strategy:**

```typescript
// Poll localStorage every 10 seconds
useEffect(() => {
  const interval = setInterval(() => {
    loadLatestData(); // Refresh from store
  }, 10000);

  return () => clearInterval(interval);
}, []);

// PRODUCTION: Replace with Supabase realtime
// supabase
//   .channel('sessions')
//   .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' })
//   .subscribe(payload => updateLocalState(payload))
```

### 6.2 TPA Card Component

```typescript
interface TPACardProps {
  tpa: TPA;
  activeSession?: Session;
  todayCount: number;
}

// Shows:
// - TPA name
// - Status: 🟢 Aktif | ⚪ Tidak Aktif
// - If active: "X hadir, Sejak HH:MM"
// - If inactive: "Belum ada sesi hari ini"
// - Click → /admin/tpa/:id
```

### 6.3 TPA Detail Page

**Displays:**

- Active session info (if any)
- Attendance list with status:
  - ✓ Green = on time
  - ⚠️ Yellow = late (show minutes)
  - 🚪 Red = early exit (computed)
- Session history (last 10, load more)
- Expandable session cards

### 6.4 Teacher Detail Page

**Displays:**

- Teacher profile (name, NIM, email)
- Aggregate stats:
  - Total attended
  - On-time count
  - Late count
  - Early exit count (computed)
- Full attendance history
- Filters: date range, TPA

### 6.5 Export Functionality

**CSV Export:**

```typescript
const exportCSV = (data: Attendance[]) => {
  const headers = [
    "Tanggal",
    "TPA",
    "Pengajar",
    "NIM",
    "Masuk",
    "Keluar",
    "Status",
    "Terlambat",
  ];
  const rows = data.map((a) => [
    formatDate(a.checkInTime),
    getTPA(a.tpaId).name,
    getUser(a.userId).name,
    getUser(a.userId).nim,
    formatTime(a.checkInTime),
    a.checkOutTime ? formatTime(a.checkOutTime) : "-",
    a.isLate ? "Terlambat" : "Tepat Waktu",
    a.lateMinutes,
  ]);

  const csv = [headers, ...rows]
    .map((r) => r.join(","))
    .join("\n");
  downloadFile(csv, "kehadiran.csv", "text/csv");
};
```

**Excel Export:**

```typescript
import * as XLSX from "xlsx";

const exportExcel = (data: Attendance[]) => {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map(toExcelRow),
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Kehadiran",
  );
  XLSX.writeFile(workbook, "kehadiran.xlsx");
};
```

**JSON Export:**

```typescript
const exportJSON = (data: Attendance[]) => {
  const json = JSON.stringify(data, null, 2);
  downloadFile(json, "kehadiran.json", "application/json");
};
```

---

## 7. Error Handling & Edge Cases

### 7.1 Error Handling Strategy

**Toast Notifications:**

```typescript
import { toast } from "sonner";

toast.success("Presensi masuk berhasil!");
toast.warning("Anda terlambat 15 menit");
toast.error("QR code sudah kadaluwarsa");
toast.info("Sesi telah ditutup");
```

**Error Boundaries:**

```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</ErrorBoundary>
```

**Loading States:**

- Skeleton loaders for data loading
- Spinner during QR scanning initialization
- Progress indicators for large exports

### 7.2 Edge Cases

**Session Management:**

| Scenario                           | Behavior                   | Feedback                                                    |
| ---------------------------------- | -------------------------- | ----------------------------------------------------------- |
| Scan static QR when session active | Reject                     | "Sesi sudah aktif sejak 14:00 oleh Budi"                    |
| First teacher never closes session | Stays active indefinitely  | Acknowledged limitation; admin manual close (future)        |
| Two teachers scan simultaneously   | Undefined (race condition) | **KNOWN LIMITATION** - resolved in production with DB locks |
| First teacher tries dynamic QR In  | Inform already checked in  | "Anda sudah presensi masuk secara otomatis"                 |

**Race Condition Note:**

```typescript
// KNOWN LIMITATION (Prototype only):
// localStorage has no transaction isolation. If two teachers scan
// static QR at exact same millisecond, behavior is undefined.
//
// PRODUCTION FIX: Supabase database transaction
// - Row-level lock on TPA
// - Atomic check-and-insert
// - One teacher succeeds, other gets "already active" error
```

**QR Scanning:**

| Scenario           | Behavior    | Feedback                                  |
| ------------------ | ----------- | ----------------------------------------- |
| Expired token      | Reject      | "QR sudah kadaluwarsa. Minta scan ulang." |
| Token already used | Reject      | "Anda sudah presensi masuk"               |
| Invalid QR         | Reject      | "QR code tidak valid"                     |
| Camera denied      | Show prompt | "Izinkan akses kamera untuk scan QR"      |
| No camera          | Show error  | "Kamera tidak tersedia"                   |

**GPS Validation:**

| Scenario          | Debug Mode      | Production                                |
| ----------------- | --------------- | ----------------------------------------- |
| Permission denied | Auto-pass + log | Reject: "Izinkan akses lokasi"            |
| GPS unavailable   | Auto-pass + log | Reject: "Tidak dapat mendeteksi lokasi"   |
| Outside radius    | Auto-pass + log | Reject: "Anda di luar area TPA (X meter)" |
| Low accuracy      | Auto-pass + log | Allow with warning                        |

**Check-Out:**

| Scenario                  | Behavior              | Feedback                    |
| ------------------------- | --------------------- | --------------------------- |
| Forgot to check out       | Flagged as early exit | Admin sees 🚪 in dashboard  |
| Check out before check in | Reject                | "Anda belum presensi masuk" |

### 7.3 Validation Rules

**Check-In Validation Chain:**

```typescript
1. Session exists and active
2. Token valid and not expired
3. Token not used by this user
4. GPS within radius (or debug bypass)
```

**Check-Out Validation Chain:**

```typescript
1. Session exists and closed
2. Token valid and not expired
3. Token not used by this user
4. User has check-in record
5. GPS within radius (or debug bypass)
```

---

## 8. Mock Data

### 8.1 Mock TPAs

```typescript
// ============================================================================
// MOCK TPA DATA - PLACEHOLDER ONLY
// ============================================================================
// TODO: Verify actual TPA coordinates with UAM
//
// Current data is placeholder with realistic Yogyakarta coordinates.
// Before production:
// 1. Get actual list of 11 TPA names from UAM
// 2. Get actual GPS coordinates for each location
// 3. Verify radius requirements (100m may need adjustment per TPA)
// 4. Update staticQRCode format if UAM has preference
// ============================================================================

export const MOCK_TPAS: TPA[] = [
  {
    id: "tpa-001",
    name: "TPA Al-Ikhlas Condongcatur", // TODO: Verify
    location: {
      lat: -7.753574, // TODO: Actual coordinates
      lng: 110.375684,
      radius: 100,
    },
    staticQRCode: "TPA-001",
  },
  {
    id: "tpa-002",
    name: "TPA Nurul Huda Karangmalang",
    location: { lat: -7.769389, lng: 110.378144, radius: 100 },
    staticQRCode: "TPA-002",
  },
  // ... 9 more TPAs (total 11)
];
```

### 8.2 Mock Users

```typescript
export const MOCK_USERS: User[] = [
  // Teachers
  {
    id: "user-001",
    email: "budi@uii.ac.id",
    password: "password",
    name: "Budi Santoso",
    role: "pengajar",
    nim: "21511001",
  },
  {
    id: "user-002",
    email: "siti@uii.ac.id",
    password: "password",
    name: "Siti Nurhaliza",
    role: "pengajar",
    nim: "21511002",
  },
  {
    id: "user-003",
    email: "ahmad@uii.ac.id",
    password: "password",
    name: "Ahmad Fauzi",
    role: "pengajar",
    nim: "21511003",
  },
  {
    id: "user-004",
    email: "dewi@uii.ac.id",
    password: "password",
    name: "Dewi Lestari",
    role: "pengajar",
    nim: "21511004",
  },
  {
    id: "user-005",
    email: "rizki@uii.ac.id",
    password: "password",
    name: "Rizki Pratama",
    role: "pengajar",
    nim: "21511005",
  },

  // Admin
  {
    id: "admin-001",
    email: "pengurus@uii.ac.id",
    password: "admin",
    name: "Rahma Dewi",
    role: "pengurus",
  },
];
```

### 8.3 Data Initialization

```typescript
export const initializeMockData = () => {
  const existing = localStorage.getItem("uam-tpas");
  if (!existing) {
    localStorage.setItem("uam-tpas", JSON.stringify(MOCK_TPAS));
  }
};

// Call in App.tsx on mount
useEffect(() => {
  initializeMockData();
}, []);
```

---

## 9. Configuration

### 9.1 App Config

```typescript
// src/config.ts
export const CONFIG = {
  APP_NAME: "UAM Presensi",
  APP_VERSION: "1.0.0-prototype",

  // Feature flags
  GPS_DEBUG_MODE: true, // TODO: false for production
  SHOW_DEBUG_BANNER: true, // Show debug UI indicators

  // QR settings
  QR_REFRESH_INTERVAL: 20000, // 20 seconds
  QR_TOKEN_EXPIRY: 20000, // 20 seconds

  // GPS settings
  GPS_RADIUS_METERS: 100, // Production radius
  GPS_TIMEOUT: 10000, // 10 seconds

  // Business rules
  LATE_THRESHOLD_MINUTES: 15,

  // Admin polling
  ADMIN_POLL_INTERVAL: 10000, // 10 seconds

  // Storage keys
  STORAGE_KEYS: {
    AUTH: "uam-auth",
    TPAS: "uam-tpas",
    SESSIONS: "uam-sessions",
    ATTENDANCES: "uam-attendances",
  },
};
```

---

## 10. Known Limitations (Prototype)

| Limitation                               | Impact                                    | Status                 | Production Fix                       |
| ---------------------------------------- | ----------------------------------------- | ---------------------- | ------------------------------------ |
| **Race condition on session creation**   | Two simultaneous scans could both succeed | Acceptable (rare)      | Supabase RPC with row lock           |
| **No auto-close for abandoned sessions** | Session stays active if never closed      | Acknowledged           | Background job or admin manual close |
| **localStorage quota limit**             | Could hit browser storage limit           | Low risk               | Supabase handles millions of records |
| **No cross-device sync**                 | Data only on one device                   | Expected for prototype | Supabase real-time sync              |
| **No optimistic locking**                | Concurrent edits could conflict           | Low risk               | Supabase row versioning              |
| **Client-side QR tokens**                | Theoretically could be manipulated        | Low risk               | Server-side signed JWT tokens        |

---

## 11. Testing Strategy

### 11.1 Manual Testing Checklist

**Authentication:**

- [ ] Login with teacher credentials
- [ ] Login with admin credentials
- [ ] Invalid credentials rejected
- [ ] Logout works
- [ ] Session persists on refresh
- [ ] Protected routes redirect to login

**Session Management:**

- [ ] Scan static QR opens session
- [ ] First teacher auto checked in
- [ ] Dynamic QR displays with countdown
- [ ] QR refreshes every 20 seconds
- [ ] Cannot open duplicate session
- [ ] Close session works
- [ ] Dynamic QR Out appears

**Check-In:**

- [ ] Scan dynamic QR In (on-time)
- [ ] Scan dynamic QR In (late) shows minutes
- [ ] Double-scan rejected
- [ ] Expired QR rejected
- [ ] GPS debug mode bypasses validation

**Check-Out:**

- [ ] Scan dynamic QR Out works
- [ ] Cannot check out before session closed
- [ ] Cannot check out without check in

**Teacher Dashboard:**

- [ ] View personal history
- [ ] Late flags show correctly
- [ ] Early exit flags show (computed)

**Admin Dashboard:**

- [ ] All 11 TPAs display
- [ ] Active/inactive status correct
- [ ] TPA detail shows session history
- [ ] Teacher detail shows stats
- [ ] Export CSV works
- [ ] Export Excel works
- [ ] Export JSON works

**Responsive:**

- [ ] Mobile (390px) works
- [ ] Tablet (768px) works
- [ ] Desktop (1440px) works

### 11.2 Edge Case Testing

- [ ] Camera permission denied
- [ ] Invalid QR scanned
- [ ] localStorage cleared
- [ ] Large export (50+ records)
- [ ] Session never closed
- [ ] First teacher abandons session

---

## 12. Migration Path to Production

### 12.1 Supabase Setup

**Database Schema:**

```sql
-- Users (use Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('pengajar', 'pengurus')),
  nim TEXT
);

-- TPAs
CREATE TABLE tpas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius INTEGER NOT NULL DEFAULT 100,
  static_qr_code TEXT UNIQUE NOT NULL
);

-- Sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tpa_id UUID REFERENCES tpas NOT NULL,
  first_teacher_id UUID REFERENCES profiles NOT NULL,
  date_opened TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date_closed TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  qr_dynamic_in_token TEXT,
  qr_dynamic_in_expires TIMESTAMPTZ,
  qr_dynamic_in_used_by UUID[],
  qr_dynamic_out_token TEXT,
  qr_dynamic_out_expires TIMESTAMPTZ,
  qr_dynamic_out_used_by UUID[]
);

-- Attendances
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions NOT NULL,
  user_id UUID REFERENCES profiles NOT NULL,
  tpa_id UUID REFERENCES tpas NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  is_late BOOLEAN NOT NULL DEFAULT false,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  check_out_time TIMESTAMPTZ,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION
);

-- Indexes
CREATE INDEX idx_sessions_active ON sessions(tpa_id, is_active);
CREATE INDEX idx_attendances_session ON attendances(session_id);
CREATE INDEX idx_attendances_user ON attendances(user_id);
```

**RLS Policies:**

```sql
-- Teachers can read their own attendance
CREATE POLICY "Teachers view own attendance"
ON attendances FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins view all attendance"
ON attendances FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'pengurus'
  )
);
```

**Edge Functions:**

```typescript
// functions/generate-qr-token/index.ts
export const handler = async (req) => {
  const { sessionId, type } = await req.json();

  // Generate cryptographically signed JWT
  const token = await createJWT(
    {
      sessionId,
      type,
      exp: Math.floor(Date.now() / 1000) + 20,
    },
    SECRET_KEY,
  );

  return new Response(JSON.stringify({ token }));
};
```

### 12.2 Code Migration

**Replace localStorage with Supabase:**

```typescript
// BEFORE (Prototype):
const sessions = useSessionStore((state) => state.sessions);

// AFTER (Production):
const { data: sessions } = await supabase
  .from("sessions")
  .select("*")
  .eq("is_active", true);
```

**Replace polling with realtime:**

```typescript
// BEFORE:
setInterval(() => loadLatestData(), 10000);

// AFTER:
supabase
  .channel("sessions")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "sessions",
  })
  .subscribe((payload) => {
    updateLocalState(payload.new);
  });
```

**Replace mock auth with Supabase Auth:**

```typescript
// BEFORE:
const login = (email, password) => {
  const user = MOCK_USERS.find((u) => u.email === email);
  // ...
};

// AFTER:
const login = async (email, password) => {
  const { data, error } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });
  if (error) throw error;
  return data.user;
};
```

---

## 13. Success Criteria

### 13.1 Functional Requirements

- [x] Teachers can scan static QR to open sessions
- [x] Dynamic QR refreshes every 20 seconds
- [x] Other teachers can check in with GPS validation
- [x] Late detection works (>15 min threshold)
- [x] First teacher can close sessions
- [x] All teachers can check out
- [x] Early exit detection (computed, not stored)
- [x] Admin sees real-time status of 11 TPAs
- [x] Admin can view detailed records
- [x] Admin can export (CSV, Excel, JSON)
- [x] All UI in Bahasa Indonesia

### 13.2 Non-Functional Requirements

- [x] Responsive: 390px, 768px, 1440px+
- [x] QR scanner works in modern browsers
- [x] GPS debug mode for testing
- [x] Clear Supabase migration path
- [x] Proper error handling
- [x] Loading states

### 13.3 Code Quality

- [x] PROTOTYPE/PRODUCTION migration comments
- [x] TypeScript strict mode
- [x] Clean component structure
- [x] Reusable hooks
- [x] Edge case handling
- [x] No `any` types

---

## 14. Deployment

### 14.1 Build

```bash
pnpm install
pnpm run build
```

### 14.2 Deployment Targets

**Prototype:**

- Vercel (recommended)
- Netlify
- GitHub Pages

**Production:**

- Vercel (with Supabase integration)
- Self-hosted (with PostgreSQL)

### 14.3 Environment Variables

```env
# Prototype: None required

# Production:
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 15. Next Steps

1. **Approve this design** ✅
2. **Write implementation plan** (using writing-plans skill)
3. **Execute plan with TDD** (using test-driven-development skill)
4. **Code review** (using requesting-code-review skill)
5. **Deploy prototype**
6. **User testing with UAM**
7. **Migrate to production** (Supabase)

---

**End of Design Specification**