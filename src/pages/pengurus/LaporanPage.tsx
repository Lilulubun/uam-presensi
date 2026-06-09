import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, FileSpreadsheet, FileDown, Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '../../app/components/ui/button';
import { useTPAStore } from '../../store/tpaStore';
import { supabase } from '../../lib/supabase';
import { formatTime } from '../../lib/date-utils';
import { toCamelCaseArray } from '../../lib/transform';
import type { LaporanRow } from '../../types';

// Months in Indonesian
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Current year ± range for year selector
const YEAR_RANGE = 2;
const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth(); // 0-based

// Cell display types
interface CellDisplay {
  type: 'split' | 'merged';
  masukText?: string;
  masukClass?: string;
  keluarText?: string;
  keluarClass?: string;
  mergedText?: string;
  mergedClass?: string;
}

interface TeacherCounts {
  tepatWaktu: number;
  terlambat: number;
  pulangAwal: number;
  hadirFisik: number;
  izin: number;
  tidakMasuk: number;
}

interface TeacherRow {
  name: string;
  cells: CellDisplay[];
  counts: TeacherCounts;
  totalSesi: number;
}

interface TpaTable {
  tpaName: string;
  dates: string[];
  teachers: TeacherRow[];
}

function getCellDisplay(row: LaporanRow): CellDisplay {
  if (row.isIzin) {
    return {
      type: 'merged',
      mergedText: 'Izin',
      mergedClass: 'bg-yellow-50 text-yellow-700 font-medium',
    };
  }
  if (!row.scanInTime) {
    return {
      type: 'merged',
      mergedText: 'Tidak Masuk',
      mergedClass: 'bg-red-50 text-red-600 font-medium',
    };
  }

  const timeIn = formatTime(new Date(row.scanInTime));
  const hasScanOut = !!row.scanOutTime;
  const isLate = (row.lateMinutes ?? 0) > 15;
  const isEarly = !row.sessionIsActive && !hasScanOut && row.teacherId !== row.firstTeacherId;

  if (isLate) {
    return {
      type: 'split',
      masukText: timeIn,
      masukClass: 'bg-orange-50 text-orange-600',
      keluarText: isEarly ? 'Pulang Awal' : (hasScanOut ? formatTime(new Date(row.scanOutTime)) : '-'),
      keluarClass: isEarly ? 'bg-red-50 text-red-600 font-medium' : '',
    };
  }

  if (isEarly) {
    return {
      type: 'split',
      masukText: timeIn,
      keluarText: 'Pulang Awal',
      keluarClass: 'bg-red-50 text-red-600 font-medium',
    };
  }

  return {
    type: 'split',
    masukText: timeIn,
    keluarText: hasScanOut ? formatTime(new Date(row.scanOutTime)) : '-',
    keluarClass: '',
  };
}

function processData(rows: LaporanRow[]): TpaTable[] {
  const grouped = new Map<string, { name: string; rows: LaporanRow[] }>();
  const dateSet = new Map<string, Set<string>>();

  for (const row of rows) {
    const id = row.tpaId;
    if (!grouped.has(id)) {
      grouped.set(id, { name: row.tpaName, rows: [] });
      dateSet.set(id, new Set());
    }
    grouped.get(id)!.rows.push(row);
    dateSet.get(id)!.add(row.tgl);
  }

  const tables: TpaTable[] = [];

  for (const [tpaId, group] of grouped) {
    const dates = Array.from(dateSet.get(tpaId)!).sort();
    const totalSesi = dates.length;

    const teacherMap = new Map<string, { name: string; cells: Map<string, CellDisplay>; counts: TeacherCounts }>();

    for (const row of group.rows) {
      if (!teacherMap.has(row.teacherId)) {
        teacherMap.set(row.teacherId, {
          name: row.teacherName,
          cells: new Map(),
          counts: { tepatWaktu: 0, terlambat: 0, pulangAwal: 0, hadirFisik: 0, izin: 0, tidakMasuk: 0 },
        });
      }
      const teacher = teacherMap.get(row.teacherId)!;
      const cell = getCellDisplay(row);
      teacher.cells.set(row.tgl, cell);

      if (row.isIzin) {
        teacher.counts.izin++;
      } else if (row.scanInTime) {
        const isLate = (row.lateMinutes ?? 0) > 15;
        const isEarly = !row.sessionIsActive && !row.scanOutTime && row.teacherId !== row.firstTeacherId;

        if (isLate) {
          teacher.counts.terlambat++;
        } else if (isEarly) {
          teacher.counts.pulangAwal++;
        } else {
          teacher.counts.tepatWaktu++;
        }
        teacher.counts.hadirFisik++;
      } else {
        teacher.counts.tidakMasuk++;
      }
    }

    const teachers = Array.from(teacherMap.values()).map((t) => ({
      name: t.name,
      cells: dates.map((d) => t.cells.get(d) ?? {
        type: 'merged' as const,
        mergedText: '-',
        mergedClass: 'text-muted-foreground',
      }),
      counts: t.counts,
      totalSesi,
    }));

    tables.push({ tpaName: group.name, dates, teachers });
  }

  return tables;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return format(d, 'dd/MM');
}

function pct(value: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function totalPct(hadirFisik: number, totalSesi: number, izin: number): string {
  const denom = totalSesi - izin;
  if (denom <= 0) return '-';
  return `${Math.round((hadirFisik / denom) * 100)}%`;
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
  const tpas = useTPAStore((s) => s.tpas);

  const today = format(now, 'yyyy-MM-dd');
  const defaultFrom = format(startOfMonth(now), 'yyyy-MM-dd');
  const defaultTo = format(endOfMonth(now), 'yyyy-MM-dd');

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [monthFilter, setMonthFilter] = useState(CURRENT_MONTH);
  const [yearFilter, setYearFilter] = useState(CURRENT_YEAR);
  const [tpaFilter, setTpaFilter] = useState('');
  const [data, setData] = useState<LaporanRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMonthYearChange = (month: number, year: number) => {
    setMonthFilter(month);
    setYearFilter(year);
    const d = new Date(year, month, 1);
    setDateFrom(format(startOfMonth(d), 'yyyy-MM-dd'));
    setDateTo(format(endOfMonth(d), 'yyyy-MM-dd'));
  };

  // Fetch data when filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const tpaIds = tpaFilter ? [tpaFilter] : null;

    supabase
      .rpc('get_laporan_presensi', {
        p_dari: dateFrom,
        p_sampai: dateTo,
        p_tpa_ids: tpaIds,
      })
      .then(({ data: result, error: err }) => {
        if (cancelled) return;
        setLoading(false);
        if (err) {
          setError(err.message);
          setData(null);
        } else {
          setData(toCamelCaseArray<LaporanRow>(result ?? []));
        }
      });

    return () => { cancelled = true; };
  }, [dateFrom, dateTo, tpaFilter]);

  const tables = useMemo(() => (data ? processData(data) : []), [data]);

  const hasData = tables.length > 0 && tables.some((t) => t.teachers.length > 0);

  // Export functions
  function exportCSV() {
    if (!hasData) return;
    const headers = ['TPA', 'Nama', 'Total', 'Tepat Waktu', 'Terlambat', 'Pulang Awal', 'Tidak Masuk', ...tables.flatMap((t) => t.dates.flatMap((d) => [`${d} Masuk`, `${d} Keluar`]))];
    const csvRows = tables.flatMap((t) =>
      t.teachers.map((teacher) => [
        t.tpaName,
        teacher.name,
        totalPct(teacher.counts.hadirFisik, teacher.totalSesi, teacher.counts.izin),
        pct(teacher.counts.tepatWaktu, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.terlambat, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.pulangAwal, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.tidakMasuk, teacher.totalSesi - teacher.counts.izin),
        ...t.dates.flatMap((d) => {
          const cell = teacher.cells[t.dates.indexOf(d)];
          if (cell.type === 'merged') return [cell.mergedText ?? '', ''];
          return [cell.masukText ?? '', cell.keluarText ?? ''];
        }),
      ])
    );
    const csv = [
      headers.join(','),
      ...csvRows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');
    downloadBlob(csv, 'laporan-presensi.csv', 'text/csv;charset=utf-8;');
  }

  function exportExcel() {
    if (!hasData) return;
    const wb = XLSX.utils.book_new();
    for (const t of tables) {
      const headers = ['Nama', 'Total', 'Tepat Waktu', 'Terlambat', 'Pulang Awal', 'Tidak Masuk', ...t.dates.flatMap((d) => [`${d} Masuk`, `${d} Keluar`])];
      const rows = t.teachers.map((teacher) => [
        teacher.name,
        totalPct(teacher.counts.hadirFisik, teacher.totalSesi, teacher.counts.izin),
        pct(teacher.counts.tepatWaktu, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.terlambat, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.pulangAwal, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.tidakMasuk, teacher.totalSesi - teacher.counts.izin),
        ...t.dates.flatMap((d) => {
          const cell = teacher.cells[t.dates.indexOf(d)];
          if (cell.type === 'merged') return [cell.mergedText ?? '', ''];
          return [cell.masukText ?? '', cell.keluarText ?? ''];
        }),
      ]);
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, t.tpaName.slice(0, 31));
    }
    XLSX.writeFile(wb, 'laporan-presensi.xlsx');
  }

  function exportPDF() {
    if (!hasData) return;
    const doc = new jsPDF('p', 'mm', 'a4');
    const margin = 14;
    const pageWidth = doc.internal.pageSize.getWidth();
    const fromFormatted = format(new Date(dateFrom + 'T00:00:00'), 'dd/MM/yyyy');
    const toFormatted = format(new Date(dateTo + 'T00:00:00'), 'dd/MM/yyyy');

    tables.forEach((t, idx) => {
      if (idx > 0) doc.addPage();

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`Laporan Presensi Pengajar UAM ${t.tpaName}`, margin, margin + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80);
      doc.text(`Periode: ${fromFormatted} – ${toFormatted}`, margin, margin + 18);
      doc.setTextColor(0);

      const body = t.teachers.map((teacher) => [
        teacher.name,
        totalPct(teacher.counts.hadirFisik, teacher.totalSesi, teacher.counts.izin),
        pct(teacher.counts.tepatWaktu, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.terlambat, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.pulangAwal, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk),
        pct(teacher.counts.tidakMasuk, teacher.totalSesi - teacher.counts.izin),
      ]);

      autoTable(doc, {
        startY: margin + 24,
        head: [['Nama', 'Total', 'Tepat Waktu', 'Terlambat', 'Pulang Awal', 'Tidak Masuk']],
        body,
        margin: { left: margin, right: margin },
        styles: {
          font: 'helvetica',
          fontSize: 9,
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.5,
        },
        headStyles: {
          fillColor: [30, 41, 59],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 11,
        },
        bodyStyles: {
          textColor: [30, 41, 59],
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'center' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'center' },
        },
      });
    });

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148);
      doc.text(
        `Halaman ${i} dari ${totalPages}`,
        pageWidth - margin,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'right' },
      );
    }

    doc.save('laporan-presensi.pdf');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg flex-1">Laporan Presensi</h1>
      </header>

      <main className="max-w-6xl mx-auto p-4 flex flex-col gap-4">
        {/* Filters */}
        <div className="bg-card rounded-xl shadow-sm p-4 flex flex-col gap-3">
          <p className="text-sm font-semibold">Filter</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Bulan</label>
              <select
                value={monthFilter}
                onChange={(e) => handleMonthYearChange(Number(e.target.value), yearFilter)}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {MONTHS.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Tahun</label>
              <select
                value={yearFilter}
                onChange={(e) => handleMonthYearChange(monthFilter, Number(e.target.value))}
                className="text-sm border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => CURRENT_YEAR - YEAR_RANGE + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
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
          </div>
        </div>

        {/* Info bar + export */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Periode: {format(new Date(dateFrom + 'T00:00:00'), 'dd/MM/yyyy')} – {format(new Date(dateTo + 'T00:00:00'), 'dd/MM/yyyy')}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!hasData}>
              <FileText className="w-4 h-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!hasData}>
              <FileSpreadsheet className="w-4 h-4 mr-1.5" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportPDF} disabled={!hasData}>
              <FileDown className="w-4 h-4 mr-1.5" /> PDF
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Memuat data...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-card rounded-xl shadow-sm py-8 px-4 text-center">
            <p className="text-sm text-red-500">Gagal memuat data: {error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && !hasData && (
          <div className="bg-card rounded-xl shadow-sm py-16 text-center text-sm text-muted-foreground">
            Tidak ada sesi di periode ini. Coba ubah rentang tanggal atau filter TPA.
          </div>
        )}

        {/* Tables */}
        {!loading && !error && hasData && tables.map((t) => (
          <section key={t.tpaName} className="bg-card rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30">
              <h2 className="font-semibold text-sm">{t.tpaName}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-muted/50">
                    <th rowSpan={3} className="sticky left-0 z-10 bg-muted/50 text-left px-3 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[160px] border-b border-r">
                      Nama
                    </th>
                    <th colSpan={4} className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-r">
                      persentase
                    </th>
                    <th rowSpan={3} className="sticky left-[368px] z-10 bg-muted/50 text-center px-2 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[56px] border-b border-r">
                      Tidak<br />Masuk
                    </th>
                    {t.dates.map((d) => (
                      <th key={d} colSpan={2} className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-r">
                        {formatShortDate(d)}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-muted/30">
                    <th rowSpan={2} className="sticky left-[160px] z-10 bg-muted/30 text-center px-2 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap min-w-[48px] border-b border-r">
                      total
                    </th>
                    <th colSpan={3} className="text-center px-2 py-2 text-xs font-semibold text-muted-foreground whitespace-nowrap border-b border-r">
                      Masuk
                    </th>
                    {t.dates.flatMap((d) => [
                      <th key={`${d}-in`} rowSpan={2} className="text-center px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-r">
                        masuk
                      </th>,
                      <th key={`${d}-out`} rowSpan={2} className="text-center px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-r">
                        keluar
                      </th>,
                    ])}
                  </tr>
                  <tr className="bg-muted/20">
                    <th className="sticky left-[208px] z-10 bg-muted/20 text-center px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-r">
                      tepat<br />waktu
                    </th>
                    <th className="sticky left-[260px] z-10 bg-muted/20 text-center px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-r">
                      terlambat
                    </th>
                    <th className="sticky left-[316px] z-10 bg-muted/20 text-center px-2 py-1.5 text-[10px] font-medium text-muted-foreground border-b border-r">
                      pulang<br />awal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {t.teachers.map((teacher) => (
                    <tr key={teacher.name} className="hover:bg-muted/20 transition-colors">
                      <td className="sticky left-0 z-10 bg-card text-left px-3 py-2 text-xs font-medium min-w-[160px] border-b border-r">
                        {teacher.name}
                      </td>
                      <td className="sticky left-[160px] z-10 bg-card text-center px-2 py-2 text-xs font-medium tabular-nums border-b border-r">
                        {totalPct(teacher.counts.hadirFisik, teacher.totalSesi, teacher.counts.izin)}
                      </td>
                      <td className="sticky left-[208px] z-10 bg-card text-center px-2 py-2 text-xs border-b border-r">
                        {pct(teacher.counts.tepatWaktu, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk)}
                      </td>
                      <td className="sticky left-[260px] z-10 bg-card text-center px-2 py-2 text-xs border-b border-r">
                        {pct(teacher.counts.terlambat, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk)}
                      </td>
                      <td className="sticky left-[316px] z-10 bg-card text-center px-2 py-2 text-xs border-b border-r">
                        {pct(teacher.counts.pulangAwal, teacher.totalSesi - teacher.counts.izin - teacher.counts.tidakMasuk)}
                      </td>
                      <td className="sticky left-[368px] z-10 bg-card text-center px-2 py-2 text-xs font-medium text-red-600 border-b border-r">
                        {pct(teacher.counts.tidakMasuk, teacher.totalSesi - teacher.counts.izin)}
                      </td>
                      {teacher.cells.map((cell, i) => {
                        if (cell.type === 'merged') {
                          return (
                            <td key={i} colSpan={2} className={`text-center px-2 py-2 text-[11px] border-b border-r ${cell.mergedClass ?? ''}`}>
                              {cell.mergedText}
                            </td>
                          );
                        }
                        return (
                          <>
                            <td key={`${i}-in`} className={`text-center px-2 py-2 text-[11px] tabular-nums border-b border-r ${cell.masukClass ?? ''}`}>
                              {cell.masukText}
                            </td>
                            <td key={`${i}-out`} className={`text-center px-2 py-2 text-[11px] tabular-nums border-b border-r ${cell.keluarClass ?? ''}`}>
                              {cell.keluarText}
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}
