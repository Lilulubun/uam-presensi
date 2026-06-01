# Implementation Plan: UAM Attendance Monitoring System

**Based on:** `docs/superpowers/specs/2026-06-01-uam-attendance-design.md`  
**Date:** June 1, 2026  
**Approach:** Test-Driven Development (TDD)  
**Task Size:** 2-5 minutes each  

---

## Overview

This plan breaks down the UAM attendance system implementation into small, testable increments following RED-GREEN-REFACTOR cycles. Each task is designed to be completed in 2-5 minutes with a clear test-first approach.

**Phases:**
1. **Foundation** - Setup, types, config
2. **Data Layer** - Stores and mock data
3. **Core Utilities** - GPS, QR, date handling
4. **Authentication** - Login/logout flow
5. **Session Management** - Open/close sessions
6. **Attendance** - Check-in/check-out
7. **Teacher UI** - Dashboard, scanner, history
8. **Admin UI** - Monitoring, reports, export
9. **Polish** - Responsive, error handling, UX

---

## Phase 1: Foundation (Setup & Types)

### Task 1.1: Install Dependencies
**Time:** 2 min  
**Test:** Dependencies installed successfully
```bash
pnpm add zustand html5-qrcode qrcode xlsx
pnpm add -D @types/qrcode
```
**Verify:** `package.json` updated, `node_modules` populated

### Task 1.2: Create TypeScript Types
**Time:** 3 min  
**File:** `src/types/index.ts`  
**Test:** Types compile without errors
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'pengajar' | 'pengurus';
  nim?: string;
}

export interface TPA {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
    radius: number;
  };
  staticQRCode: string;
}

export interface Session {
  id: string;
  tpaId: string;
  dateOpened: string;
  dateClosed?: string;
  firstTeacherId: string;
  isActive: boolean;
  qrDynamicIn?: {
    token: string;
    expiresAt: string;
    usedBy: string[];
  };
  qrDynamicOut?: {
    token: string;
    expiresAt: string;
    usedBy: string[];
  };
}

export interface Attendance {
  id: string;
  sessionId: string;
  userId: string;
  tpaId: string;
  checkInTime?: string;
  checkInLocation?: { lat: number; lng: number };
  isLate: boolean;
  lateMinutes: number;
  checkOutTime?: string;
  checkOutLocation?: { lat: number; lng: number };
}

export interface Coordinates {
  lat: number;
  lng: number;
}
```
**Verify:** No TypeScript errors, types export correctly

### Task 1.3: Create Config File
**Time:** 2 min  
**File:** `src/config.ts`  
**Test:** Config exports correctly
```typescript
export const CONFIG = {
  APP_NAME: 'UAM Presensi',
  APP_VERSION: '1.0.0-prototype',
  GPS_DEBUG_MODE: true,
  SHOW_DEBUG_BANNER: true,
  QR_REFRESH_INTERVAL: 20000,
  QR_TOKEN_EXPIRY: 20000,
  GPS_RADIUS_METERS: 100,
  GPS_TIMEOUT: 10000,
  LATE_THRESHOLD_MINUTES: 15,
  ADMIN_POLL_INTERVAL: 10000,
  STORAGE_KEYS: {
    AUTH: 'uam-auth',
    TPAS: 'uam-tpas',
    SESSIONS: 'uam-sessions',
    ATTENDANCES: 'uam-attendances'
  }
} as const;
```
**Verify:** Import `CONFIG` in another file, no errors

---

## Phase 2: Data Layer (Stores & Mock Data)

### Task 2.1: Create Mock TPA Data
**Time:** 3 min  
**File:** `src/lib/mock-data.ts`  
**Test:** Mock data matches type definitions
```typescript
import { TPA, User } from '../types';

// Verified TPA coordinates from UAM
export const MOCK_TPAS: TPA[] = [
  {
    id: 'tpa-001',
    name: 'TPA Al-Fath',
    location: { lat: -7.6864394412020145, lng: 110.4183135208608, radius: 100 },
    staticQRCode: 'TPA-001'
  },
  {
    id: 'tpa-002',
    name: 'TPA Adz-Dzikro',
    location: { lat: -7.744803275758542, lng: 110.41414103514991, radius: 100 },
    staticQRCode: 'TPA-002'
  },
  {
    id: 'tpa-003',
    name: 'TPA Al-Hidayah Besirejo',
    location: { lat: -7.69690001497496, lng: 110.41985753233598, radius: 100 },
    staticQRCode: 'TPA-003'
  },
  {
    id: 'tpa-004',
    name: 'TPA Al-Hidayah Tanjungsari',
    location: { lat: -7.692058086494675, lng: 110.44915826476229, radius: 100 },
    staticQRCode: 'TPA-004'
  },
  {
    id: 'tpa-005',
    name: 'TPA Al-Iman',
    location: { lat: -7.697983633584647, lng: 110.40599807240116, radius: 100 },
    staticQRCode: 'TPA-005'
  },
  {
    id: 'tpa-006',
    name: 'TPA Ananda',
    location: { lat: -7.699886036726615, lng: 110.40676711984223, radius: 100 },
    staticQRCode: 'TPA-006'
  },
  {
    id: 'tpa-007',
    name: 'TPA Az-Zahra',
    location: { lat: -7.672930214991263, lng: 110.40046648044921, radius: 100 },
    staticQRCode: 'TPA-007'
  },
  {
    id: 'tpa-008',
    name: 'TPA Al-Muhtadin',
    location: { lat: -7.7012103705816655, lng: 110.4062802454369, radius: 100 },
    staticQRCode: 'TPA-008'
  },
  {
    id: 'tpa-009',
    name: "TPA Al-Jami'",
    location: { lat: -7.687739641892811, lng: 110.40873308217957, radius: 100 },
    staticQRCode: 'TPA-009'
  },
  {
    id: 'tpa-010',
    name: 'TPA Ulil Albab',
    location: { lat: -7.701725012893864, lng: 110.41550971507898, radius: 100 },
    staticQRCode: 'TPA-010'
  },
  {
    id: 'tpa-011',
    name: 'TPA Sholihin',
    location: { lat: -7.695346961575441, lng: 110.41336418264429, radius: 100 },
    staticQRCode: 'TPA-011'
  }
];

export const MOCK_USERS: User[] = [
  { id: 'user-001', email: 'budi@uii.ac.id', password: 'password', 
    name: 'Budi Santoso', role: 'pengajar', nim: '21511001' },
  { id: 'user-002', email: 'siti@uii.ac.id', password: 'password',
    name: 'Siti Nurhaliza', role: 'pengajar', nim: '21511002' },
  { id: 'user-003', email: 'ahmad@uii.ac.id', password: 'password',
    name: 'Ahmad Fauzi', role: 'pengajar', nim: '21511003' },
  { id: 'user-004', email: 'dewi@uii.ac.id', password: 'password',
    name: 'Dewi Lestari', role: 'pengajar', nim: '21511004' },
  { id: 'user-005', email: 'rizki@uii.ac.id', password: 'password',
    name: 'Rizki Pratama', role: 'pengajar', nim: '21511005' },
  { id: 'admin-001', email: 'pengurus@uii.ac.id', password: 'admin',
    name: 'Rahma Dewi', role: 'pengurus' }
];

export const initializeMockData = () => {
  const existing = localStorage.getItem('uam-tpas');
  if (!existing) {
    localStorage.setItem('uam-tpas', JSON.stringify(MOCK_TPAS));
  }
};
```
**Verify:** TypeScript compiles, all 11 TPAs with verified coordinates

### Task 2.2: Create Auth Store
**Time:** 4 min  
**File:** `src/store/authStore.ts`  
**Test:** Store initializes with null user
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { MOCK_USERS } from '../lib/mock-data';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      
      login: async (email: string, password: string) => {
        // PROTOTYPE: Mock authentication
        // PRODUCTION: Replace with Supabase Auth
        const user = MOCK_USERS.find(u => 
          u.email === email && u.password === password
        );
        
        if (!user) return false;
        
        set({ user: { ...user, password: undefined }, isAuthenticated: true });
        return true;
      },
      
      logout: () => {
        // PRODUCTION: await supabase.auth.signOut();
        set({ user: null, isAuthenticated: false });
      }
    }),
    { name: 'uam-auth' }
  )
);
```
**Verify:** 
- Import store, call `useAuthStore.getState()`, user is null
- Call `login()` with valid creds, returns true
- User state updates correctly

### Task 2.3: Create TPA Store
**Time:** 3 min  
**File:** `src/store/tpaStore.ts`  
**Test:** Store loads TPAs, getters work
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TPA } from '../types';
import { MOCK_TPAS } from '../lib/mock-data';

interface TPAState {
  tpas: TPA[];
  getTPAById: (id: string) => TPA | undefined;
  getTPAByStaticQR: (qrCode: string) => TPA | undefined;
}

export const useTPAStore = create<TPAState>()(
  persist(
    (set, get) => ({
      tpas: MOCK_TPAS,
      
      getTPAById: (id: string) => {
        return get().tpas.find(t => t.id === id);
      },
      
      getTPAByStaticQR: (qrCode: string) => {
        return get().tpas.find(t => t.staticQRCode === qrCode);
      }
    }),
    { name: 'uam-tpas' }
  )
);
```
**Verify:**
- `getTPAById('tpa-001')` returns TPA Al-Fath
- `getTPAByStaticQR('TPA-001')` returns TPA Al-Fath
- Invalid ID returns undefined

### Task 2.4: Create Session Store (Part 1 - Structure)
**Time:** 5 min  
**File:** `src/store/sessionStore.ts`  
**Test:** Store initializes, basic methods exist
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Session } from '../types';

interface SessionState {
  sessions: Session[];
  openSession: (tpaId: string, firstTeacherId: string) => Session;
  closeSession: (sessionId: string) => void;
  refreshDynamicQRIn: (sessionId: string) => void;
  getActiveSessionByTPA: (tpaId: string) => Session | undefined;
  isTokenValid: (token: string, userId: string, type: 'in' | 'out') => boolean;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      
      openSession: (tpaId: string, firstTeacherId: string) => {
        // Implementation in next task
        throw new Error('Not implemented');
      },
      
      closeSession: (sessionId: string) => {
        throw new Error('Not implemented');
      },
      
      refreshDynamicQRIn: (sessionId: string) => {
        throw new Error('Not implemented');
      },
      
      getActiveSessionByTPA: (tpaId: string) => {
        return get().sessions.find(s => s.tpaId === tpaId && s.isActive);
      },
      
      isTokenValid: (token: string, userId: string, type: 'in' | 'out') => {
        throw new Error('Not implemented');
      }
    }),
    { name: 'uam-sessions' }
  )
);
```
**Verify:** Store compiles, methods exist but throw errors

### Task 2.5: Create Attendance Store (Part 1 - Structure)
**Time:** 4 min  
**File:** `src/store/attendanceStore.ts`  
**Test:** Store initializes, basic methods exist
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Attendance, Coordinates } from '../types';

interface AttendanceState {
  attendances: Attendance[];
  recordCheckIn: (sessionId: string, userId: string, location: Coordinates) => Attendance;
  recordCheckOut: (attendanceId: string, location: Coordinates) => void;
  getAttendanceBySession: (sessionId: string) => Attendance[];
  getAttendanceByUser: (userId: string) => Attendance[];
  detectEarlyExits: (sessionId: string) => Attendance[];
}

export const useAttendanceStore = create<AttendanceState>()(
  persist(
    (set, get) => ({
      attendances: [],
      
      recordCheckIn: (sessionId: string, userId: string, location: Coordinates) => {
        throw new Error('Not implemented');
      },
      
      recordCheckOut: (attendanceId: string, location: Coordinates) => {
        throw new Error('Not implemented');
      },
      
      getAttendanceBySession: (sessionId: string) => {
        return get().attendances.filter(a => a.sessionId === sessionId);
      },
      
      getAttendanceByUser: (userId: string) => {
        return get().attendances.filter(a => a.userId === userId);
      },
      
      detectEarlyExits: (sessionId: string) => {
        // Computed: has checkInTime but no checkOutTime
        return get().attendances.filter(a => 
          a.sessionId === sessionId && 
          a.checkInTime && 
          !a.checkOutTime
        );
      }
    }),
    { name: 'uam-attendances' }
  )
);
```
**Verify:** Store compiles, getter methods work with empty array

---

## Phase 3: Core Utilities

### Task 3.1: GPS Distance Calculation
**Time:** 4 min  
**File:** `src/lib/gps-utils.ts`  
**Test:** Haversine formula works correctly
```typescript
import { Coordinates } from '../types';

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @returns Distance in meters
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};
```
**Test Cases:**
- Same point: distance = 0
- TPA Al-Fath to TPA Adz-Dzikro: ~7km (verify with known distance)
- Edge case: Equator, poles

### Task 3.2: GPS Validation with Debug Mode
**Time:** 3 min  
**File:** `src/lib/gps-utils.ts` (continue)  
**Test:** Debug mode bypasses, production validates
```typescript
import { CONFIG } from '../config';

export const validateLocation = (
  userLat: number,
  userLng: number,
  tpaLat: number,
  tpaLng: number,
  radius: number
): boolean => {
  if (CONFIG.GPS_DEBUG_MODE) {
    console.log('🐛 GPS Debug: Validation bypassed');
    console.log(`  User: ${userLat}, ${userLng}`);
    console.log(`  TPA: ${tpaLat}, ${tpaLng}`);
    console.log(`  Radius: ${radius}m`);
    return true; // Always pass in debug
  }
  
  // PRODUCTION: Actual validation
  const distance = calculateDistance(userLat, userLng, tpaLat, tpaLng);
  console.log(`📍 Distance to TPA: ${distance.toFixed(2)}m (limit: ${radius}m)`);
  
  return distance <= radius;
};
```
**Test Cases:**
- Debug mode ON: always returns true
- Debug mode OFF + within radius: returns true
- Debug mode OFF + outside radius: returns false

### Task 3.3: QR Token Generation
**Time:** 3 min  
**File:** `src/lib/qr-utils.ts`  
**Test:** Generates valid tokens
```typescript
export const generateDynamicToken = (
  sessionId: string,
  type: 'in' | 'out'
) => {
  // PROTOTYPE: Client-side UUID
  // PRODUCTION: Server-side JWT with signature
  return {
    sessionId,
    type,
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + 20000).toISOString(), // 20 seconds
    usedBy: []
  };
};

export const isTokenExpired = (expiresAt: string): boolean => {
  return new Date(expiresAt) < new Date();
};
```
**Test Cases:**
- Generated token has all fields
- expiresAt is 20 seconds in future
- isTokenExpired() works correctly

### Task 3.4: Date/Time Utilities
**Time:** 2 min  
**File:** `src/lib/date-utils.ts`  
**Test:** Formatting works correctly
```typescript
import { format, formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export const formatDateTime = (date: string | Date): string => {
  return format(new Date(date), 'dd/MM/yyyy HH:mm', { locale: localeId });
};

export const formatTime = (date: string | Date): string => {
  return format(new Date(date), 'HH:mm');
};

export const formatDate = (date: string | Date): string => {
  return format(new Date(date), 'dd/MM/yyyy');
};

export const timeAgo = (date: string | Date): string => {
  return formatDistanceToNow(new Date(date), { 
    addSuffix: true, 
    locale: localeId 
  });
};
```
**Test Cases:**
- formatDateTime('2026-06-01T14:30:00') = '01/06/2026 14:30'
- formatTime returns 'HH:mm'
- timeAgo shows Indonesian text

---

## Phase 4: Authentication Flow

### Task 4.1: Create Login Page
**Time:** 5 min  
**File:** `src/pages/LoginPage.tsx`  
**Test:** Page renders, form submits
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { toast } from 'sonner';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore(state => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const success = await login(email, password);
    
    if (success) {
      const user = useAuthStore.getState().user;
      if (user?.role === 'pengajar') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } else {
      toast.error('Email atau password salah');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 bg-card rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold text-center mb-6">
          Sistem Presensi UAM
        </h1>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email</label>
            <Input 
              type="email" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Password</label>
            <Input 
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Memuat...' : 'Masuk'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```
**Test Cases:**
- Page renders without errors
- Form validation works
- Successful login redirects based on role
- Failed login shows error toast

### Task 4.2: Create Protected Route Component
**Time:** 3 min  
**File:** `src/components/layout/ProtectedRoute.tsx`  
**Test:** Redirects unauthenticated users
```typescript
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('pengajar' | 'pengurus')[];
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles 
}: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    toast.error('Anda tidak memiliki akses ke halaman ini');
    return <Navigate to={user.role === 'pengajar' ? '/teacher/dashboard' : '/admin/dashboard'} replace />;
  }

  return <>{children}</>;
}
```
**Test Cases:**
- Unauthenticated → redirects to /login
- Wrong role → redirects to correct dashboard
- Correct auth → renders children

### Task 4.3: Setup Router with Routes
**Time:** 4 min  
**File:** `src/app/App.tsx`  
**Test:** Router navigates correctly
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import LoginPage from './pages/LoginPage';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';
import { initializeMockData } from './lib/mock-data';

export default function App() {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  useEffect(() => {
    initializeMockData();
  }, []);

  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
        <Route 
          path="/" 
          element={
            isAuthenticated ? (
              <Navigate to={
                useAuthStore.getState().user?.role === 'pengajar' 
                  ? '/teacher/dashboard' 
                  : '/admin/dashboard'
              } replace />
            ) : (
              <Navigate to="/login" replace />
            )
          } 
        />
        
        {/* Teacher routes - to be added */}
        {/* Admin routes - to be added */}
      </Routes>
    </BrowserRouter>
  );
}
```
**Test Cases:**
- Navigate to `/` → redirects to /login if not authenticated
- Navigate to `/` → redirects to role-specific dashboard if authenticated
- Mock data initialized on mount

---

## Phase 5: Session Management (Core Business Logic)

### Task 5.1: Implement Session Store - openSession
**Time:** 5 min  
**File:** `src/store/sessionStore.ts`  
**Test:** Opens session, creates QR token, validates state
```typescript
openSession: (tpaId: string, firstTeacherId: string) => {
  const state = get();
  
  // Validate: no active session at this TPA
  const existingSession = state.sessions.find(
    s => s.tpaId === tpaId && s.isActive
  );
  
  if (existingSession) {
    throw new Error('Sesi sudah aktif di TPA ini');
  }
  
  // KNOWN LIMITATION: Race condition possible (localStorage has no locks)
  // PRODUCTION: Supabase RPC with database lock
  
  const sessionId = crypto.randomUUID();
  const now = new Date().toISOString();
  
  const newSession: Session = {
    id: sessionId,
    tpaId,
    firstTeacherId,
    dateOpened: now,
    isActive: true,
    qrDynamicIn: generateDynamicToken(sessionId, 'in')
  };
  
  set({ sessions: [...state.sessions, newSession] });
  
  // Auto-create attendance for first teacher
  useAttendanceStore.getState().recordCheckIn(
    sessionId,
    firstTeacherId,
    { lat: 0, lng: 0 } // First teacher doesn't need GPS validation
  );
  
  return newSession;
}
```
**Test Cases:**
- Opens session successfully
- Creates QR dynamic in token
- Throws error if session already active
- Auto-creates attendance record

### Task 5.2: Implement Session Store - closeSession
**Time:** 4 min  
**File:** `src/store/sessionStore.ts`  
**Test:** Closes session, generates QR out
```typescript
closeSession: (sessionId: string) => {
  const state = get();
  const sessionIndex = state.sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    throw new Error('Sesi tidak ditemukan');
  }
  
  const session = state.sessions[sessionIndex];
  
  if (!session.isActive) {
    throw new Error('Sesi sudah ditutup');
  }
  
  const now = new Date().toISOString();
  const updatedSession: Session = {
    ...session,
    isActive: false,
    dateClosed: now,
    qrDynamicOut: generateDynamicToken(sessionId, 'out')
  };
  
  const newSessions = [...state.sessions];
  newSessions[sessionIndex] = updatedSession;
  
  set({ sessions: newSessions });
  
  // Auto-create checkout for first teacher
  const attendance = useAttendanceStore.getState().attendances.find(
    a => a.sessionId === sessionId && a.userId === session.firstTeacherId
  );
  
  if (attendance) {
    useAttendanceStore.getState().recordCheckOut(
      attendance.id,
      { lat: 0, lng: 0 }
    );
  }
}
```
**Test Cases:**
- Closes session successfully
- Sets isActive = false
- Records dateClosed
- Generates QR dynamic out
- Auto-checks out first teacher

### Task 5.3: Implement Session Store - refreshDynamicQRIn
**Time:** 3 min  
**File:** `src/store/sessionStore.ts`  
**Test:** Refreshes token every 20 seconds
```typescript
refreshDynamicQRIn: (sessionId: string) => {
  const state = get();
  const sessionIndex = state.sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) return;
  
  const session = state.sessions[sessionIndex];
  
  if (!session.isActive) return;
  
  const updatedSession: Session = {
    ...session,
    qrDynamicIn: generateDynamicToken(sessionId, 'in')
  };
  
  const newSessions = [...state.sessions];
  newSessions[sessionIndex] = updatedSession;
  
  set({ sessions: newSessions });
}
```
**Test Cases:**
- Generates new token with fresh expiry
- Resets usedBy array
- Only works if session is active

### Task 5.4: Implement Session Store - isTokenValid
**Time:** 3 min  
**File:** `src/store/sessionStore.ts`  
**Test:** Validates tokens correctly
```typescript
isTokenValid: (token: string, userId: string, type: 'in' | 'out') => {
  const state = get();
  
  for (const session of state.sessions) {
    const qrToken = type === 'in' ? session.qrDynamicIn : session.qrDynamicOut;
    
    if (!qrToken) continue;
    
    if (qrToken.token === token) {
      // Check expiry
      if (isTokenExpired(qrToken.expiresAt)) {
        return false;
      }
      
      // Check if already used by this user
      if (qrToken.usedBy.includes(userId)) {
        return false;
      }
      
      return true;
    }
  }
  
  return false;
}
```
**Test Cases:**
- Valid unused token → true
- Expired token → false
- Already used by user → false
- Invalid token → false

---

## Phase 6: Attendance Recording

### Task 6.1: Implement Attendance Store - recordCheckIn
**Time:** 5 min  
**File:** `src/store/attendanceStore.ts`  
**Test:** Records check-in with late calculation
```typescript
recordCheckIn: (sessionId: string, userId: string, location: Coordinates) => {
  const session = useSessionStore.getState().sessions.find(s => s.id === sessionId);
  
  if (!session) {
    throw new Error('Sesi tidak ditemukan');
  }
  
  const now = new Date();
  const sessionOpenTime = new Date(session.dateOpened);
  const lateThreshold = new Date(sessionOpenTime.getTime() + CONFIG.LATE_THRESHOLD_MINUTES * 60000);
  
  const isLate = now > lateThreshold && userId !== session.firstTeacherId;
  const lateMinutes = isLate 
    ? Math.floor((now.getTime() - lateThreshold.getTime()) / 60000)
    : 0;
  
  const attendance: Attendance = {
    id: crypto.randomUUID(),
    sessionId,
    userId,
    tpaId: session.tpaId,
    checkInTime: now.toISOString(),
    checkInLocation: location,
    isLate,
    lateMinutes
  };
  
  set({ attendances: [...get().attendances, attendance] });
  
  return attendance;
}
```
**Test Cases:**
- First teacher: never late
- Check-in within 15min: not late
- Check-in after 15min: late, minutes calculated
- Location recorded

### Task 6.2: Implement Attendance Store - recordCheckOut
**Time:** 3 min  
**File:** `src/store/attendanceStore.ts`  
**Test:** Records check-out time
```typescript
recordCheckOut: (attendanceId: string, location: Coordinates) => {
  const state = get();
  const attendanceIndex = state.attendances.findIndex(a => a.id === attendanceId);
  
  if (attendanceIndex === -1) {
    throw new Error('Catatan kehadiran tidak ditemukan');
  }
  
  const attendance = state.attendances[attendanceIndex];
  
  if (attendance.checkOutTime) {
    throw new Error('Sudah melakukan presensi keluar');
  }
  
  const updatedAttendance: Attendance = {
    ...attendance,
    checkOutTime: new Date().toISOString(),
    checkOutLocation: location
  };
  
  const newAttendances = [...state.attendances];
  newAttendances[attendanceIndex] = updatedAttendance;
  
  set({ attendances: newAttendances });
}
```
**Test Cases:**
- Sets checkOutTime
- Records location
- Throws error if already checked out
- Throws error if attendance not found

---

## Phase 7: Teacher UI

### Task 7.1: Create Teacher Dashboard Page
**Time:** 5 min  
**File:** `src/pages/teacher/TeacherDashboard.tsx`  
**Test:** Shows today's status, CTA button
```typescript
import { useAuthStore } from '../../store/authStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useSessionStore } from '../../store/sessionStore';
import { Button } from '../../components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function TeacherDashboard() {
  const user = useAuthStore(state => state.user);
  const navigate = useNavigate();
  
  // Get today's attendance
  const todayAttendances = useAttendanceStore(state => 
    state.attendances.filter(a => {
      if (a.userId !== user?.id) return false;
      const today = new Date().toDateString();
      return a.checkInTime && new Date(a.checkInTime).toDateString() === today;
    })
  );
  
  // Check if user has active session as first teacher
  const activeSessionAsFirst = useSessionStore(state =>
    state.sessions.find(s => s.isActive && s.firstTeacherId === user?.id)
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <h1 className="text-2xl font-bold mb-4">Halo, {user?.name}</h1>
      
      {/* Today's status */}
      {todayAttendances.length > 0 && (
        <div className="mb-6 p-4 bg-card rounded-lg">
          <h2 className="font-semibold mb-2">Status Hari Ini</h2>
          {/* Show attendance info */}
        </div>
      )}
      
      {/* CTA Button */}
      <Button 
        onClick={() => navigate(activeSessionAsFirst ? '/teacher/session-active' : '/teacher/scan')}
        className="w-full"
      >
        {activeSessionAsFirst ? 'Lihat Sesi Aktif' : '📱 Scan QR untuk Presensi'}
      </Button>
      
      {/* Recent history */}
      <div className="mt-6">
        <h2 className="font-semibold mb-2">Riwayat Terakhir</h2>
        {/* List recent attendances */}
      </div>
    </div>
  );
}
```
**Test Cases:**
- Page renders with user name
- Shows today's attendance if exists
- Button text changes based on active session status

---

**[Plan continues with remaining phases 8-9, totaling ~80 tasks]**

---

## Execution Strategy

### RED-GREEN-REFACTOR Cycles

For each task:

1. **RED:** Write minimal test/verify criteria
2. **GREEN:** Implement just enough to pass
3. **REFACTOR:** Clean up, add comments (PROTOTYPE/PRODUCTION markers)

### Task Ordering

- **Dependencies first:** Types → Stores → Utilities → UI
- **Foundation to features:** Setup → Core logic → UI components
- **Vertical slices:** Complete one user flow before moving to next

### Testing Approach

Since this is a prototype without formal testing framework:

**Manual Testing:**
- Browser console verification
- LocalStorage inspection
- User flow walkthroughs

**Future (Production):**
- Jest + React Testing Library
- Vitest for unit tests
- Playwright for E2E

---

## Next Steps

1. Review this plan
2. Start with Phase 1 (Foundation)
3. Execute tasks sequentially using TDD
4. Test each phase before moving to next
5. Keep implementation plan updated with progress

**Ready to start implementing?**
