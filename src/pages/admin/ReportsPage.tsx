import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '../../app/components/ui/button';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { MOCK_TPAS, MOCK_USERS, getTpaById, getUserById } from '../../lib/mock-data';
import { formatDate, formatTime, isSameDay } from '../../lib/date-utils';

interface ReportRow {
  Tanggal: string;
  TPA: string;
  Pengajar: string;
  NIM: string;
  'Jam Masuk': string;
  'Jam Keluar': string;
  Status: string;
  'Terlambat (menit)': number;
  'Pulang Awal': string;
}

function buildRows(
  attendances: ReturnType<typeof useAttendanceStore.getState>['attendances'],
  sessions: ReturnType<typeof useSessionStore.getState>['sessions'],
  dateFrom: string,
  dateTo: string,
  tpaFilter: string,
  teacherFilter: string
): ReportRow[] {
  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;

  return attendances
    .filter((a) => {
      if (!a.scanInTime) return false;
      const session = sessions.find((s) => s.id === a.sessionId);
      if (!session) return false;

      const date = new Date(a.scanInTime);
      if (from && date < from) return false;
      if (to && date > to) return false;
      if (tpaFilter && session.tpaId !== tpaFilter) return false;
      if (teacherFilter && a.userId !== teacherFilter) return false;

      return true;
    })
    .map((a) => {
      const session = sessions.find((s) => s.id === a.sessionId)!;
      const tpa = getTpaById(session.tpaId);
      const teacher = getUserById(a.userId);
      const earlyExit = !!(a.scanInTime && !a.scanOutTime && !session.isActive);

      return {
        Tanggal: a.scanInTime ? formatDate(new Date(a.scanInTime)) : '-',
        TPA: tpa?.name ?? 'Unknown',
        Pengajar: teacher?.name ?? a.userId,
        NIM: teacher?.nim ?? '-',
        'Jam Masuk': a.scanInTime ? formatTime(new Date(a.scanInTime)) : '-',
        'Jam Keluar': a.scanOutTime ? formatTime(new Date(a.scanOutTime)) : '-',
        Status: a.isLate ? `Terlambat ${a.lateMinutes}m` : 'Tepat Waktu',
        'Terlambat (menit)': a.lateMinutes ?? 0,
        'Pulang Awal': earlyExit ? 'Ya' : 'Tidak',
      };
    })
    .sort((a, b) => b.Tanggal.localeCompare(a.Tanggal));
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const navigate = useNavigate();
  const sessions = useSessionStore((s) => s.sessions);
  const attendances = useAttendanceStore((s) => s.attendances);

  const today = new Date().toISOString().slice(0, 10);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [tpaFilter, setTpaFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');

  const rows = useMemo(
    () => buildRows(attendances, sessions, dateFrom, dateTo, tpaFilter, teacherFilter),
    [attendances, sessions, dateFrom, dateTo, tpaFilter, teacherFilter]
  );

  const teachers = MOCK_USERS.filter((u) => u.role === 'pengajar');

  const exportCSV = () => {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        headers.map((h) => `"${String(r[h as keyof ReportRow]).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    downloadBlob(csv, 'laporan-presensi.csv', 'text/csv;charset=utf-8;');
  };

  const exportExcel = () => {
    if (rows.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Presensi');
    XLSX.writeFile(wb, 'laporan-presensi.xlsx');
  };

  const exportJSON = () => {
    if (rows.length === 0) return;
    downloadBlob(JSON.stringify(rows, null, 2), 'laporan-presensi.json', 'application/json');
  };

  const lateCount = rows.filter((r) => r['Terlambat (menit)'] > 0).length;
  const earlyExitCount = rows.filter((r) => r['Pulang Awal'] === 'Ya').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/admin/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg flex-1">Laporan Kehadiran</h1>
      </header>

      <main className="max-w-5xl mx-auto p-4 flex flex-col gap-4">
        {/* Filters */}
        <div className="bg-card rounded-xl shadow-sm p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold">Filter</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Dari</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Sampai</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">TPA</label>
              <select
                value={tpaFilter}
                onChange={(e) => setTpaFilter(e.target.value)}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Semua TPA</option>
                {MOCK_TPAS.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Pengajar</label>
              <select
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Semua Pengajar</option>
                {teachers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Summary + Export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{rows.length}</span> record
            </span>
            {lateCount > 0 && (
              <span className="text-orange-500">{lateCount} terlambat</span>
            )}
            {earlyExitCount > 0 && (
              <span className="text-red-500">{earlyExitCount} pulang awal</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={rows.length === 0}
            >
              <FileText className="w-4 h-4 mr-1.5" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              disabled={rows.length === 0}
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportJSON}
              disabled={rows.length === 0}
            >
              <FileJson className="w-4 h-4 mr-1.5" />
              JSON
            </Button>
          </div>
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="bg-card rounded-xl shadow-sm py-16 text-center text-sm text-muted-foreground">
            Tidak ada data untuk filter yang dipilih
          </div>
        ) : (
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Tanggal</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">TPA</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Pengajar</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Masuk</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Keluar</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{row.Tanggal}</td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium">{row.TPA}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{row.Pengajar}</td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{row['Jam Masuk']}</td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground">
                        {row['Jam Keluar']}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {row['Pulang Awal'] === 'Ya' ? (
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Pulang Awal</span>
                        ) : row['Terlambat (menit)'] > 0 ? (
                          <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            {row.Status}
                          </span>
                        ) : (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Tepat Waktu</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
