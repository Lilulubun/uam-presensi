import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, FileSpreadsheet, FileJson } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useShallow } from 'zustand/react/shallow';
import { Button } from '../../app/components/ui/button';
import { useSessionStore } from '../../store/sessionStore';
import { useAttendanceStore } from '../../store/attendanceStore';
import { useTPAStore, getTpaById } from '../../store/tpaStore';
import { getUserById, useUsersStore } from '../../store/userStore';
import { format } from 'date-fns';
import { formatDate, formatTime } from '../../lib/date-utils';
import { isEarlyExit } from '../../lib/attendance-utils';

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

function sortRows(rows: ReportRow[], column: string | null, direction: 'asc' | 'desc' | null): ReportRow[] {
  if (!column || !direction) {
    return rows.sort((a, b) => b.Tanggal.localeCompare(a.Tanggal));
  }

  return rows.sort((a, b) => {
    let cmp: number;
    switch (column) {
      case 'Tanggal':
        cmp = a.Tanggal.localeCompare(b.Tanggal);
        break;
      case 'TPA':
        cmp = a.TPA.localeCompare(b.TPA);
        break;
      case 'Pengajar':
        cmp = a.Pengajar.localeCompare(b.Pengajar);
        break;
      case 'Jam Masuk':
        cmp = a['Jam Masuk'].localeCompare(b['Jam Masuk']);
        break;
      case 'Jam Keluar':
        cmp = a['Jam Keluar'].localeCompare(b['Jam Keluar']);
        break;
      case 'Status': {
        const order = (s: string) => {
          if (s.startsWith('Pulang Awal')) return 2;
          if (s.startsWith('Terlambat')) return 1;
          return 0;
        };
        cmp = order(a.Status) - order(b.Status);
        if (cmp === 0) cmp = a.Status.localeCompare(b.Status);
        break;
      }
      default:
        cmp = 0;
    }
    return direction === 'asc' ? cmp : -cmp;
  });
}

function buildRows(
  attendances: ReturnType<typeof useAttendanceStore.getState>['attendances'],
  sessions: ReturnType<typeof useSessionStore.getState>['sessions'],
  dateFrom: string,
  dateTo: string,
  tpaFilter: string,
  teacherFilter: string,
  sortColumn: string | null,
  sortDirection: 'asc' | 'desc' | null
): ReportRow[] {
  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo + 'T23:59:59') : null;

  const mapped = attendances
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
      const earlyExit = isEarlyExit(a, session);

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
    });

  return sortRows(mapped, sortColumn, sortDirection);
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

export default function LaporanPage() {
  const navigate = useNavigate();
  const sessions = useSessionStore((s) => s.sessions);
  const attendances = useAttendanceStore((s) => s.attendances);
  const tpas = useTPAStore((s) => s.tpas);

  const now = new Date();
  const today = format(now, 'yyyy-MM-dd');
  const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd');

  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [tpaFilter, setTpaFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);

  const allUsers = useUsersStore((s) => s.users);
  const teachers = useUsersStore(
    useShallow((s) => s.users.filter((u) => u.role === 'pengajar'))
  );

  function handleSort(column: string) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortColumn(null);
      setSortDirection(null);
    }
  }

  const rows = useMemo(
    () => buildRows(attendances, sessions, dateFrom, dateTo, tpaFilter, teacherFilter, sortColumn, sortDirection),
    [attendances, sessions, dateFrom, dateTo, tpaFilter, teacherFilter, sortColumn, sortDirection, allUsers]
  );

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
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg flex-1">Laporan Kehadiran</h1>
      </header>

      <main className="max-w-5xl mx-auto p-4 flex flex-col gap-4">
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
                {tpas.map((t) => (
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

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{rows.length}</span> data
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

        {rows.length === 0 ? (
          <div className="bg-card rounded-xl shadow-sm py-16 text-center text-sm text-muted-foreground">
            Tidak ada data untuk filter yang dipilih. Coba ubah rentang tanggal atau filter lainnya.
          </div>
        ) : (
          <div className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {(['Tanggal', 'TPA', 'Pengajar', 'Jam Masuk', 'Jam Keluar', 'Status'] as const).map((col) => (
                      <th
                        key={col}
                        className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors"
                        onClick={() => handleSort(col)}
                      >
                        {col === 'Jam Masuk' ? 'Masuk' : col === 'Jam Keluar' ? 'Keluar' : col}
                        {sortColumn === col && (
                          <span className="ml-1">{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>
                        )}
                      </th>
                    ))}
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
