import type { TPA, User } from '../types';

// 11 TPA with verified coordinates from UAM
export const MOCK_TPAS: TPA[] = [
  {
    id: 'tpa-001',
    name: 'TPA Al-Fath',
    location: { lat: -7.6864394412020145, lng: 110.4183135208608, radius: 100 },
    staticQRCode: 'TPA-001',
  },
  {
    id: 'tpa-002',
    name: 'TPA Adz-Dzikro',
    location: { lat: -7.744803275758542, lng: 110.41414103514991, radius: 100 },
    staticQRCode: 'TPA-002',
  },
  {
    id: 'tpa-003',
    name: 'TPA Al-Hidayah Besirejo',
    location: { lat: -7.69690001497496, lng: 110.41985753233598, radius: 100 },
    staticQRCode: 'TPA-003',
  },
  {
    id: 'tpa-004',
    name: 'TPA Al-Hidayah Tanjungsari',
    location: { lat: -7.692058086494675, lng: 110.44915826476229, radius: 100 },
    staticQRCode: 'TPA-004',
  },
  {
    id: 'tpa-005',
    name: 'TPA Al-Iman',
    location: { lat: -7.697983633584647, lng: 110.40599807240116, radius: 100 },
    staticQRCode: 'TPA-005',
  },
  {
    id: 'tpa-006',
    name: 'TPA Ananda',
    location: { lat: -7.699886036726615, lng: 110.40676711984223, radius: 100 },
    staticQRCode: 'TPA-006',
  },
  {
    id: 'tpa-007',
    name: 'TPA Az-Zahra',
    location: { lat: -7.672930214991263, lng: 110.40046648044921, radius: 100 },
    staticQRCode: 'TPA-007',
  },
  {
    id: 'tpa-008',
    name: 'TPA Al-Muhtadin',
    location: { lat: -7.7012103705816655, lng: 110.4062802454369, radius: 100 },
    staticQRCode: 'TPA-008',
  },
  {
    id: 'tpa-009',
    name: "TPA Al-Jami'",
    location: { lat: -7.687739641892811, lng: 110.40873308217957, radius: 100 },
    staticQRCode: 'TPA-009',
  },
  {
    id: 'tpa-010',
    name: 'TPA Ulil Albab',
    location: { lat: -7.701725012893864, lng: 110.41550971507898, radius: 100 },
    staticQRCode: 'TPA-010',
  },
  {
    id: 'tpa-011',
    name: 'TPA Sholihin',
    location: { lat: -7.695346961575441, lng: 110.41336418264429, radius: 100 },
    staticQRCode: 'TPA-011',
  },
];

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

// Helper function to get TPA by static QR code
export function getTpaByQRCode(qrCode: string): TPA | undefined {
  return MOCK_TPAS.find((tpa) => tpa.staticQRCode === qrCode);
}

// Helper function to get TPA by ID
export function getTpaById(id: string): TPA | undefined {
  return MOCK_TPAS.find((tpa) => tpa.id === id);
}

// Helper function to get user by email
export function getUserByEmail(email: string): User | undefined {
  return MOCK_USERS.find((user) => user.email === email);
}

// Helper function to get user by ID
export function getUserById(id: string): User | undefined {
  return MOCK_USERS.find((user) => user.id === id);
}
