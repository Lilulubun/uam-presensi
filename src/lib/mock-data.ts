import type { User } from '../types';

// TODO(phase-3.5): replace MOCK_USERS with a real useUsers() store backed
// by `select public.users` (RLS already allows pengurus to read all users).
// The teacher filter in LaporanPage and the per-teacher name in
// DashboardPengurus both rely on this list. Removing MOCK_USERS is part of
// Task 3.5 (Detail Pengajar) which adds a useUsers store.

// Mock users for development
export const MOCK_USERS: User[] = [
  {
    id: 'user-001',
    email: 'budi@uii.ac.id',
    password: 'password',
    name: 'Budi Santoso',
    role: 'pengajar',
    nim: '21511001',
  },
  {
    id: 'user-002',
    email: 'siti@uii.ac.id',
    password: 'password',
    name: 'Siti Nurhaliza',
    role: 'pengajar',
    nim: '21511002',
  },
  {
    id: 'user-003',
    email: 'ahmad@uii.ac.id',
    password: 'password',
    name: 'Ahmad Fauzi',
    role: 'pengajar',
    nim: '21511003',
  },
  {
    id: 'user-admin',
    email: 'pengurus@uii.ac.id',
    password: 'admin',
    name: 'Rahma Dewi',
    role: 'pengurus',
  },
];

// Helper function to get user by email
export function getUserByEmail(email: string): User | undefined {
  return MOCK_USERS.find((user) => user.email === email);
}

// Helper function to get user by ID
export function getUserById(id: string): User | undefined {
  return MOCK_USERS.find((user) => user.id === id);
}
