# Implementation Plan: Sistem Monitoring SDM dan Presensi UAM

## Overview
Building a web-based attendance monitoring system for 11 TPA locations with dynamic QR codes, GPS validation, and role-based access.

---

## 1. Project Setup & Dependencies

### Additional NPM Packages Needed
- `html5-qrcode` - For camera-based QR code scanning
- `qrcode` - For generating QR codes
- `zustand` - For client-side state management (lightweight, perfect for prototype)
- `@supabase/supabase-js` - (Future: when moving to production backend)

### Mock Data Strategy
For prototype phase:
- Mock 11 TPA locations with realistic Yogyakarta GPS coordinates
- Mock user accounts (3 teachers, 1 admin)
- LocalStorage + Zustand for state persistence
- Simulate 20-second QR token refresh
- Client-side GPS validation simulation

---

## 2. Architecture & Data Models

### Core Entities

#### TPA (Taman Pendidikan Al-Quran)
```typescript
interface TPA {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
    radius: number; // meters, e.g., 100
  };
  qrStatic: string; // Static QR code identifier
}
```

#### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'pengajar' | 'pengurus';
  nim?: string; // For pengajar
}
```

#### Session (Sesi Mengajar)
```typescript
interface Session {
  id: string;
  tpaId: string;
  dateOpened: Date; // t_open
  dateClosed?: Date; // t_close
  firstTeacherId: string; // Actor_first
  isActive: boolean;
  qrDynamicInToken?: string; // Current token for check-in
  qrDynamicOutToken?: string; // Current token for check-out
  qrDynamicInExpiry?: Date;
  qrDynamicOutExpiry?: Date;
}
```

#### Attendance (Presensi)
```typescript
interface Attendance {
  id: string;
  sessionId: string;
  userId: string;
  scanInTime?: Date; // t_scan_in
  scanOutTime?: Date; // t_scan_out
  isLate: boolean;
  lateMinutes?: number; // Late(u)
  isEarlyExit: boolean;
  scanInLocation?: { lat: number; lng: number };
  scanOutLocation?: { lat: number; lng: number };
}
```

---

## 3. Application Structure

### Routing Structure
```
/                           → Redirect based on auth
/login                      → Login page (all users)
/pengajar                   → Teacher dashboard
  /pengajar/scan            → QR Scanner
  /pengajar/session-active  → Active session (First Teacher only)
  /pengajar/riwayat         → Attendance history
/pengurus                   → Admin dashboard
  /pengurus/tpa/:id         → TPA detail
  /pengurus/pengajar/:id    → Teacher detail
  /pengurus/laporan         → Reports & export
```

### Component Structure
```
src/app/
├── App.tsx
├── components/
│   ├── ui/ (existing shadcn components)
│   ├── layout/
│   │   ├── NavBar.tsx
│   │   ├── TeacherLayout.tsx
│   │   └── AdminLayout.tsx
│   ├── qr/
│   │   ├── QRScanner.tsx
│   │   ├── QRDisplay.tsx (shows dynamic QR with countdown)
│   │   └── QRValidator.tsx
│   ├── attendance/
│   │   ├── AttendanceCard.tsx
│   │   ├── AttendanceList.tsx
│   │   └── SessionSummary.tsx
│   ├── dashboard/
│   │   ├── TPAStatusCard.tsx
│   │   ├── TPAGrid.tsx
│   │   └── StatsWidget.tsx
│   └── auth/
│       └── LoginForm.tsx
├── pages/
│   ├── LoginPage.tsx
│   ├── pengajar/
│   │   ├── DashboardPengajar.tsx
│   │   ├── ScanPage.tsx
│   │   ├── SessionActivePage.tsx
│   │   ├── KonfirmasiPresensi.tsx
│   │   └── RiwayatPage.tsx
│   └── pengurus/
│       ├── DashboardPengurus.tsx
│       ├── TPADetailPage.tsx
│       ├── PengajarDetailPage.tsx
│       └── LaporanPage.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useGeolocation.ts
│   ├── useQRScanner.ts
│   └── useSession.ts
├── store/
│   ├── authStore.ts (Zustand)
│   ├── sessionStore.ts
│   └── attendanceStore.ts
├── lib/
│   ├── qr-utils.ts
│   ├── gps-utils.ts
│   ├── date-utils.ts
│   └── mock-data.ts
└── types/
    └── index.ts
```

---

## 4. Implementation Phases

### Phase 1: Foundation (Core Setup)
**Tasks:**
1. ✅ Install dependencies (`html5-qrcode`, `qrcode`, `zustand`)
2. ✅ Create type definitions (`src/types/index.ts`)
3. ✅ Create mock data (11 TPAs, mock users)
4. ✅ Setup Zustand stores (auth, session, attendance)
5. ✅ Setup React Router with routes
6. ✅ Create base layouts (Teacher, Admin)

**Deliverables:**
- Project structure ready
- Mock data seeded
- Routing working
- Basic layouts

---

### Phase 2: Authentication Module
**Tasks:**
1. ✅ Create login page with Indonesian UI
2. ✅ Implement mock authentication (email/password)
3. ✅ Create auth store with session persistence
4. ✅ Add protected routes
5. ✅ Role-based redirects (pengajar → /pengajar, pengurus → /pengurus)

**Business Rules:**
- [AUTH-01] Email/password authentication
- [AUTH-02] Role differentiation (pengajar vs pengurus)
- [AUTH-03] Session persistence in localStorage
- [AUTH-04] Protected routes

**Deliverables:**
- Working login/logout
- Protected routes
- Role-based navigation

---

### Phase 3: Session Management (Pengajar Pertama)
**Tasks:**
1. ✅ Create QR Scanner component (camera access)
2. ✅ Implement static QR scan → session opening
3. ✅ Create "Halaman Sesi Aktif" with dynamic QR display
4. ✅ Implement 20-second QR token refresh
5. ✅ Add session close functionality
6. ✅ Auto-record first teacher attendance on session open

**Business Rules:**
- [SESI-01] Validate static QR matches TPA
- [SESI-02] Prevent duplicate active sessions (¬S_active)
- [SESI-03] Record t_open and Actor_first
- [SESI-04] Generate QR_dynamic_in every 20 seconds
- [SESI-05] Server-side state (simulated in store)
- [SESI-06] Only first teacher can close session
- [SESI-07] Activate QR_dynamic_out on close
- [P-IN-01] Auto-record first teacher check-in

**Components:**
- QRScanner.tsx (with html5-qrcode)
- QRDisplay.tsx (with countdown timer)
- SessionActivePage.tsx
- Session close confirmation dialog

**Deliverables:**
- Functional session lifecycle
- Dynamic QR generation
- First teacher auto-attendance

---

### Phase 4: Check-In Module (Pengajar Lain)
**Tasks:**
1. ✅ Create check-in flow (scan QR_dynamic_in)
2. ✅ Implement GPS location capture
3. ✅ Validate GPS within TPA radius
4. ✅ Validate QR token (not expired, not reused)
5. ✅ Calculate lateness (t_scan_in vs t_open + 15min)
6. ✅ Create confirmation page with status

**Business Rules:**
- [P-IN-02] Token validation (fresh, not reused by user)
- [P-IN-03] GPS validation (within radius)
- [P-IN-04] Record t_scan_in
- [P-IN-05] Calculate Late(u) for non-first teachers
- [P-IN-06] Show confirmation (on-time / late X minutes)
- [GPS-01] to [GPS-04] GPS handling

**Components:**
- GPS permission handler
- Token validator
- KonfirmasiPresensi.tsx (success/late/rejected)

**Edge Cases:**
- Expired token → show "QR sudah kadaluarsa, scan ulang"
- GPS denied → show "Izinkan akses lokasi"
- Outside radius → show "Lokasi tidak sesuai"
- Double scan → reject with message

**Deliverables:**
- Working check-in flow
- GPS validation
- Late detection
- User-friendly error messages

---

### Phase 5: Check-Out Module
**Tasks:**
1. ✅ Create check-out flow (scan QR_dynamic_out)
2. ✅ Validate QR_dynamic_out active (session closed)
3. ✅ GPS validation on check-out
4. ✅ Record t_scan_out
5. ✅ Early exit detection (no P_out record)

**Business Rules:**
- [P-OUT-01] QR_out only active after S_close
- [P-OUT-02] Token validation
- [P-OUT-03] GPS validation
- [P-OUT-04] Record t_scan_out
- [P-OUT-05] Show confirmation
- [DASH-04] Detect early exit (has P_in, no P_out)

**Edge Cases:**
- Scan before session closed → "Sesi belum ditutup"
- Forgot to scan out → marked as early exit in admin view

**Deliverables:**
- Working check-out
- Early exit detection

---

### Phase 6: Teacher Dashboard
**Tasks:**
1. ✅ Create teacher home/dashboard
2. ✅ Show today's attendance status
3. ✅ Quick access to scan QR
4. ✅ Personal attendance history (RiwayatPage)
5. ✅ Show late/early-exit flags in history

**Screens:**
- DashboardPengajar.tsx (today's status, CTA to scan)
- RiwayatPage.tsx (table/list of past attendance)

**Deliverables:**
- Teacher can view personal history
- Clear status indicators

---

### Phase 7: Admin Dashboard
**Tasks:**
1. ✅ Create admin overview (11 TPA grid)
2. ✅ Show active/inactive session status per TPA
3. ✅ Show attendance count per TPA today
4. ✅ Create TPA detail page
5. ✅ Create teacher detail page
6. ✅ Implement data export (CSV)

**Business Rules:**
- [DASH-01] Real-time TPA status display
- [DASH-02] Session detail (t_open, t_close, attendance list)
- [DASH-03] Teacher history with flags
- [DASH-05] Data export

**Screens:**
- DashboardPengurus.tsx (TPA grid with status)
- TPADetailPage.tsx (session history, attendance)
- PengajarDetailPage.tsx (teacher profile + history)
- LaporanPage.tsx (filters + export)

**Deliverables:**
- Complete admin monitoring
- Export functionality

---

### Phase 8: Polish & Testing
**Tasks:**
1. ✅ Add loading states
2. ✅ Add error boundaries
3. ✅ Toast notifications (using Sonner)
4. ✅ Responsive design (mobile-first)
5. ✅ Indonesian translations for all UI
6. ✅ Performance: QR refresh performance
7. ✅ Test all edge cases
8. ✅ Add confetti on successful attendance 🎉

**Non-Functional Requirements:**
- [NFR-PERF-01] QR refresh < 1 second
- [NFR-PERF-02] Validation response < 3 seconds
- [NFR-PERF-03] Dashboard load < 5 seconds
- [NFR-SEC-01 to 05] Security validations
- [NFR-COMPAT-01 to 03] Browser compatibility, responsive
- [NFR-AVAIL-01 to 02] Error handling

**Deliverables:**
- Production-ready prototype
- Smooth UX
- All edge cases handled

---

## 5. Mock Data Specifications

### 11 TPA Mock Data (Yogyakarta Area)
```typescript
const MOCK_TPAS = [
  { id: '1', name: 'TPA Al-Ikhlas Condongcatur', location: { lat: -7.753574, lng: 110.375684, radius: 100 } },
  { id: '2', name: 'TPA Nurul Huda Karangmalang', location: { lat: -7.769389, lng: 110.378144, radius: 100 } },
  { id: '3', name: 'TPA Al-Amin Sinduadi', location: { lat: -7.754210, lng: 110.397230, radius: 100 } },
  // ... 8 more TPAs
];
```

### Mock Users
```typescript
const MOCK_USERS = [
  { id: '1', email: 'budi@uii.ac.id', password: 'password', name: 'Budi Santoso', role: 'pengajar', nim: '21511001' },
  { id: '2', email: 'siti@uii.ac.id', password: 'password', name: 'Siti Nurhaliza', role: 'pengajar', nim: '21511002' },
  { id: '3', email: 'ahmad@uii.ac.id', password: 'password', name: 'Ahmad Fauzi', role: 'pengajar', nim: '21511003' },
  { id: 'admin1', email: 'pengurus@uii.ac.id', password: 'admin', name: 'Rahma Dewi', role: 'pengurus' },
];
```

---

## 6. Technical Implementation Details

### QR Code Generation
- **Static QR**: Contains TPA ID (e.g., `TPA-001`)
- **Dynamic QR**: Contains `{token: uuid, sessionId: string, type: 'in'|'out', expiry: timestamp}`
- Token format: JWT-like structure (for future backend compatibility)

### GPS Validation
```typescript
function isWithinRadius(
  userLat: number,
  userLng: number,
  tpaLat: number,
  tpaLng: number,
  radius: number
): boolean {
  // Haversine formula
  // Return true if distance <= radius
}
```

### Token Refresh Logic
```typescript
useEffect(() => {
  if (session.isActive && !session.dateClosed) {
    const interval = setInterval(() => {
      // Generate new QR_dynamic_in token
      updateSessionToken(sessionId, generateToken());
    }, 20000); // 20 seconds
    return () => clearInterval(interval);
  }
}, [session]);
```

---

## 7. Out of Scope (Acknowledged Limitations)

As per PRD Section 7:
- ❌ Auto-close sessions (manual only)
- ❌ Real-time push notifications
- ❌ Native mobile apps
- ❌ Self-registration for teachers
- ❌ Email/SMS notifications

---

## 8. Success Criteria

### Functional
- ✅ Teachers can scan static QR to open session
- ✅ First teacher sees dynamic QR updating every 20 seconds
- ✅ Other teachers can check in by scanning dynamic QR
- ✅ GPS validation prevents remote check-ins
- ✅ System detects late arrivals (>15 min from t_open)
- ✅ System detects early exits (no check-out record)
- ✅ First teacher can close session
- ✅ Admin can view all 11 TPAs status real-time
- ✅ Admin can export attendance data
- ✅ All UI in Indonesian

### Non-Functional
- ✅ Responsive on mobile (390px), tablet (768px), desktop (1440px)
- ✅ Camera QR scanning works in modern browsers
- ✅ GPS permission flow is clear
- ✅ Informative error messages for all failure cases

---

## 9. Future Migration to Production

When ready to code for production:

### Backend Migration
1. Setup Supabase project
2. Create tables: `tpas`, `users`, `sessions`, `attendances`
3. Setup Row Level Security (RLS)
4. Implement Supabase Auth
5. Move QR token generation to Edge Functions
6. Move GPS validation to server-side
7. Add real-time subscriptions for dashboard

### Additional Features
1. Admin panel for TPA management
2. Bulk user import
3. Advanced reporting (charts, analytics)
4. Push notifications (using FCM)
5. Manual session close by admin
6. Attendance correction workflow
7. Export to PDF/Excel with charts

---

## 10. Questions for Clarification

Before starting implementation, confirm:

1. **GPS Radius**: Is 100 meters acceptable for all TPAs? (Some might need tighter/looser radius)
2. **Session Duration**: Is there a typical session duration? (e.g., 2 hours) This could inform auto-close in future
3. **Late Threshold**: Confirmed 15 minutes from t_open?
4. **Early Exit**: Defined as "has P_in but no P_out after QR_dynamic_out active" - correct?
5. **QR Static**: Should I generate printable PDFs of static QR codes for physical placement?

---

## Estimated Timeline (Prototype)

- **Phase 1**: Foundation → 0.5 day
- **Phase 2**: Authentication → 0.5 day  
- **Phase 3**: Session Management → 1 day
- **Phase 4**: Check-In → 1 day
- **Phase 5**: Check-Out → 0.5 day
- **Phase 6**: Teacher Dashboard → 0.5 day
- **Phase 7**: Admin Dashboard → 1 day
- **Phase 8**: Polish & Testing → 1 day

**Total: ~6 days** for fully functional prototype

---

## Next Steps

Once you approve this plan:
1. I'll start with Phase 1 (Foundation)
2. Implement each phase sequentially
3. You can test each phase as it completes
4. We iterate based on your feedback
5. When prototype is solid, we migrate to production backend

**Ready to start? Approve this plan or let me know if you want any changes!** 🚀
