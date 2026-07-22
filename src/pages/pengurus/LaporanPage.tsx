import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, FileText, FileSpreadsheet, FileDown, Loader2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '../../app/components/ui/button';
import { useTPAStore } from '../../store/tpaStore';
import { supabase } from '../../lib/supabase';
import { formatTime, formatDate, formatShortDate, jakartaNow, monthBounds } from '../../lib/date-utils';
import { toCamelCaseArray } from '../../lib/transform';
import type { LaporanRow } from '../../types';

// Months in Indonesian
const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// Current year ± range for year selector
const YEAR_RANGE = 2;
const { year: CURRENT_YEAR, month: CURRENT_MONTH } = jakartaNow();

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
  hadirFisik: number;
  izin: number;
  tidakMasuk: number;
}

interface TeacherRow {
  name: string;
  cells: CellDisplay[];
  counts: TeacherCounts;
  totalHari: number;
  statusAman: 'Memenuhi Target' | 'Belum Memenuhi';
}

interface TpaTable {
  tpaName: string;
  dates: string[];
  teachers: TeacherRow[];
}

function getCellDisplay(row: LaporanRow): CellDisplay {
  if (row.scanInTime) {
    const timeIn = formatTime(new Date(row.scanInTime));

    if (row.isLate) {
      return {
        type: 'split',
        masukText: timeIn,
        masukClass: 'bg-orange-50 text-orange-600',
        keluarText: row.scanOutTime ? formatTime(new Date(row.scanOutTime)) : '-',
        keluarClass: '',
      };
    }

    return {
      type: 'split',
      masukText: timeIn,
      keluarText: row.scanOutTime ? formatTime(new Date(row.scanOutTime)) : '-',
      keluarClass: '',
    };
  }

  if (row.isIzin) {
    return {
      type: 'merged',
      mergedText: 'Izin',
      mergedClass: 'bg-yellow-50 text-yellow-700 font-medium',
    };
  }

  return {
    type: 'merged',
    mergedText: 'Tidak Masuk',
    mergedClass: 'bg-red-50 text-red-600 font-medium',
  };
}

function isAman(hadirFisik: number, totalSesiTPA: number): 'Memenuhi Target' | 'Belum Memenuhi' {
  const wajibHadir = Math.ceil(totalSesiTPA * 0.5 * 0.75);
  return hadirFisik >= wajibHadir ? 'Memenuhi Target' : 'Belum Memenuhi';
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
    const totalSesiTPA = dates.length; // Important: total sessions for THIS TPA

    const teacherMap = new Map<string, { name: string; bestRow: Map<string, LaporanRow>; counts: TeacherCounts; totalHari: number }>();

    for (const row of group.rows) {
      if (!teacherMap.has(row.teacherId)) {
        teacherMap.set(row.teacherId, {
          name: row.teacherName,
          bestRow: new Map(),
          counts: { tepatWaktu: 0, terlambat: 0, hadirFisik: 0, izin: 0, tidakMasuk: 0 },
          totalHari: 0,
        });
      }
      const teacher = teacherMap.get(row.teacherId)!;

      const existing = teacher.bestRow.get(row.tgl);
      if (!existing || (!existing.scanInTime && row.scanInTime)) {
        teacher.bestRow.set(row.tgl, row);
      }
    }

    const teachers = Array.from(teacherMap.values()).map((t) => {
      const cells = new Map<string, CellDisplay>();

      for (const [tgl, row] of t.bestRow) {
        t.totalHari++;
        cells.set(tgl, getCellDisplay(row));

        if (row.scanInTime) {
          if (row.isLate) {
            t.counts.terlambat++;
          } else {
            t.counts.tepatWaktu++;
          }
          t.counts.hadirFisik++;
        } else if (row.isIzin) {
          t.counts.izin++;
        } else {
          t.counts.tidakMasuk++;
        }
      }
      
      const statusAman = isAman(t.counts.hadirFisik, totalSesiTPA);

      return {
        name: t.name,
        cells: dates.map((d) => cells.get(d) ?? {
          type: 'merged' as const,
          mergedText: '-',
          mergedClass: 'text-muted-foreground',
        }),
        counts: t.counts,
        totalHari: t.totalHari,
        statusAman,
      };
    });

    tables.push({ tpaName: group.name, dates, teachers });
  }

  return tables;
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

  const { from: defaultFrom, to: defaultTo } = monthBounds(CURRENT_YEAR, CURRENT_MONTH);

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
    const bounds = monthBounds(year, month);
    setDateFrom(bounds.from);
    setDateTo(bounds.to);
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
    const headers = ['TPA', 'Nama', 'Total', 'Tepat Waktu', 'Terlambat', 'Tidak Masuk', 'Status', ...tables.flatMap((t) => t.dates.flatMap((d) => [`${d} Masuk`, `${d} Keluar`]))];
    const csvRows = tables.flatMap((t) =>
      t.teachers.map((teacher) => [
        t.tpaName,
        teacher.name,
        totalPct(teacher.counts.hadirFisik, teacher.totalHari, teacher.counts.izin),
        teacher.counts.tepatWaktu,
        teacher.counts.terlambat,
        pct(teacher.counts.tidakMasuk, teacher.totalHari - teacher.counts.izin),
        teacher.statusAman,
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
      const headers = ['Nama', 'Total', 'Tepat Waktu', 'Terlambat', 'Tidak Masuk', 'Status', ...t.dates.flatMap((d) => [`${d} Masuk`, `${d} Keluar`])];
      const rows = t.teachers.map((teacher) => [
        teacher.name,
        totalPct(teacher.counts.hadirFisik, teacher.totalHari, teacher.counts.izin),
        teacher.counts.tepatWaktu,
        teacher.counts.terlambat,
        pct(teacher.counts.tidakMasuk, teacher.totalHari - teacher.counts.izin),
        teacher.statusAman,
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
    const fromFormatted = formatDate(dateFrom);
    const toFormatted = formatDate(dateTo);

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
        totalPct(teacher.counts.hadirFisik, teacher.totalHari, teacher.counts.izin),
        teacher.counts.tepatWaktu,
        teacher.counts.terlambat,
        pct(teacher.counts.tidakMasuk, teacher.totalHari - teacher.counts.izin),
        teacher.statusAman.toUpperCase(),
      ]);

      autoTable(doc, {
        startY: margin + 24,
        head: [['Nama', 'Total', 'Tepat Waktu', 'Terlambat', 'Tidak Masuk', 'Status']],
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
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center gap-3">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-[#6B6B66] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight flex-1 text-[#1A1A18]">Laporan Presensi</h1>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        {/* Filters */}
        <div className="bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] p-6 border border-[#EAEAE7] flex flex-col gap-4">
          <p className="text-[14px] font-semibold tracking-tight text-[#1A1A18]">Filter Laporan</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#6B6B66]">Bulan</label>
              <select
                value={monthFilter}
                onChange={(e) => handleMonthYearChange(Number(e.target.value), yearFilter)}
                className="text-sm border border-[#EAEAE7] rounded-[14px] px-3 py-2.5 bg-background focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
              >
                {MONTHS.map((name, i) => (
                  <option key={i} value={i}>{name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#6B6B66]">Tahun</label>
              <select
                value={yearFilter}
                onChange={(e) => handleMonthYearChange(monthFilter, Number(e.target.value))}
                className="text-sm border border-[#EAEAE7] rounded-[14px] px-3 py-2.5 bg-background focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
              >
                {Array.from({ length: YEAR_RANGE * 2 + 1 }, (_, i) => CURRENT_YEAR - YEAR_RANGE + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#6B6B66]">Dari</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border border-[#EAEAE7] rounded-[14px] px-3 py-2.5 bg-background focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#6B6B66]">Sampai</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border border-[#EAEAE7] rounded-[14px] px-3 py-2.5 bg-background focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-[#6B6B66]">TPA</label>
              <select
                value={tpaFilter}
                onChange={(e) => setTpaFilter(e.target.value)}
                className="text-sm border border-[#EAEAE7] rounded-[14px] px-3 py-2.5 bg-background focus:outline-none focus:border-[#D7FF3D] focus:ring-1 focus:ring-[#D7FF3D]/50"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-4 border border-[#EAEAE7]">
          <p className="text-[13px] text-[#6B6B66] font-medium px-2">
            Periode Laporan: <span className="text-[#1A1A18]">{formatDate(dateFrom)}</span> – <span className="text-[#1A1A18]">{formatDate(dateTo)}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={exportCSV}
              disabled={!hasData}
              className="rounded-[12px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-xs font-medium text-[#6B6B66] hover:text-[#1A1A18]"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              disabled={!hasData}
              className="rounded-[12px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-xs font-medium text-[#6B6B66] hover:text-[#1A1A18]"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportPDF}
              disabled={!hasData}
              className="rounded-[12px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-xs font-medium text-[#6B6B66] hover:text-[#1A1A18]"
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} /> PDF
            </Button>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 text-[#6B6B66] gap-2.5">
            <Loader2 className="w-5 h-5 animate-spin text-[#D7FF3D]" strokeWidth={1.5} />
            <span className="text-[14px] font-medium">Memuat Laporan Presensi...</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-white rounded-[32px] border border-red-100 py-10 px-6 text-center shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
            <p className="text-[14px] text-red-500 font-medium">Gagal memuat laporan: {error}. Silakan coba kembali.</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && !hasData && (
          <div className="bg-white rounded-[32px] border border-[#EAEAE7] py-16 text-center shadow-[0_4px_24px_rgba(0,0,0,0.04)] text-[#A3A39D]">
            Tidak ada data presensi pada periode bulan ini.
          </div>
        )}

        {/* Tables */}
        {!loading && !error && hasData && tables.map((t) => (
          <section key={t.tpaName} className="bg-white rounded-[32px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] border border-[#EAEAE7] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#EAEAE7] bg-[#F7F7F5]">
              <h2 className="font-semibold text-[15px] tracking-tight text-[#1A1A18]">{t.tpaName}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr className="bg-[#F7F7F5]">
                    <th rowSpan={3} className="sticky left-0性能 z-10 bg-[#F7F7F5] text-left px-4 py-3 text-[11px] font-semibold text-[#6B6B66] whitespace-nowrap min-w-[160px] border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                      Nama
                    </th>
                    <th colSpan={3} className="text-center px-3 py-3 text-[11px] font-semibold text-[#6B6B66] whitespace-nowrap border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                      Persentase
                    </th>
                    <th rowSpan={3} className="sticky left-[316px] z-10 bg-[#F7F7F5] text-center px-3 py-3 text-[11px] font-semibold text-[#6B6B66] whitespace-nowrap min-w-[56px] border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                      Alpa
                    </th>
                    <th rowSpan={3} className="sticky left-[372px] z-10 bg-[#F7F7F5] text-center px-4 py-3 text-[11px] font-semibold text-[#6B6B66] whitespace-nowrap min-w-[80px] border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                      Status
                    </th>
                    {t.dates.map((d) => (
                      <th key={d} colSpan={2} className="text-center px-3 py-3 text-[11px] font-semibold text-[#6B6B66] whitespace-nowrap border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                        {formatShortDate(d)}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-[#F7F7F5]">
                    <th rowSpan={2} className="sticky left-[160px] z-10 bg-[#F7F7F5] text-center px-3 py-3 text-[11px] font-semibold text-[#6B6B66] whitespace-nowrap min-w-[48px] border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                      Total
                    </th>
                    <th colSpan={2} className="text-center px-3 py-3 text-[11px] font-semibold text-[#6B6B66] whitespace-nowrap border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                      Masuk
                    </th>
                    {t.dates.flatMap((d) => [
                      <th key={`${d}-in`} rowSpan={2} className="text-center px-3 py-2 text-[10px] font-semibold text-[#6B6B66] border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                        Masuk
                      </th>,
                      <th key={`${d}-out`} rowSpan={2} className="text-center px-3 py-2 text-[10px] font-semibold text-[#6B6B66] border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                        Keluar
                      </th>,
                    ])}
                  </tr>
                  <tr className="bg-[#F7F7F5]">
                    <th className="sticky left-[208px] z-10 bg-[#F7F7F5] text-center px-3 py-2 text-[10px] font-semibold text-[#6B6B66] border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                      Tepat<br />Waktu
                    </th>
                    <th className="sticky left-[260px] z-10 bg-[#F7F7F5] text-center px-3 py-2 text-[10px] font-semibold text-[#6B6B66] border-b border-r border-[#EAEAE7] uppercase tracking-wider">
                      Lambat
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAEAE7]">
                  {t.teachers.map((teacher) => (
                    <tr key={teacher.name} className="hover:bg-[#F7F7F5] transition-colors">
                      <td className="sticky left-0 z-10 bg-white text-left px-4 py-3 text-[13px] font-medium min-w-[160px] border-b border-r border-[#EAEAE7] text-[#1A1A18]">
                        {teacher.name}
                      </td>
                      <td className="sticky left-[160px] z-10 bg-white text-center px-3 py-3 text-[13px] font-semibold tabular-nums border-b border-r border-[#EAEAE7] text-[#1A1A18]">
                        {totalPct(teacher.counts.hadirFisik, teacher.totalHari, teacher.counts.izin)}
                      </td>
                      <td className="sticky left-[208px] z-10 bg-white text-center px-3 py-3 text-[13px] border-b border-r border-[#EAEAE7] text-[#6B6B66] tabular-nums">
                        {teacher.counts.tepatWaktu}
                      </td>
                      <td className="sticky left-[260px] z-10 bg-white text-center px-3 py-3 text-[13px] border-b border-r border-[#EAEAE7] text-[#6B6B66] tabular-nums">
                        {teacher.counts.terlambat}
                      </td>
                      <td className="sticky left-[316px] z-10 bg-white text-center px-3 py-3 text-[13px] font-medium text-red-600 border-b border-r border-[#EAEAE7] tabular-nums">
                        {pct(teacher.counts.tidakMasuk, teacher.totalHari - teacher.counts.izin)}
                      </td>
                      <td className="sticky left-[372px] z-10 bg-white text-center px-4 py-3 text-[13px] font-medium border-b border-r border-[#EAEAE7]">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset ${
                          teacher.statusAman === 'Memenuhi Target' 
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' 
                            : 'bg-rose-50 text-rose-700 ring-rose-600/20'
                        }`}>
                          {teacher.statusAman}
                        </span>
                      </td>
                      {teacher.cells.map((cell, i) => {
                        if (cell.type === 'merged') {
                          return (
                            <td key={i} colSpan={2} className={`text-center px-3 py-3 text-[12px] border-b border-r border-[#EAEAE7] font-medium ${cell.mergedClass ?? ''}`}>
                              {cell.mergedText}
                            </td>
                          );
                        }
                        return (
                          <>
                            <td key={`${i}-in`} className={`text-center px-3 py-3 text-[12px] tabular-nums border-b border-r border-[#EAEAE7] ${cell.masukClass ?? ''}`}>
                              {cell.masukText}
                            </td>
                            <td key={`${i}-out`} className={`text-center px-3 py-3 text-[12px] tabular-nums border-b border-r border-[#EAEAE7] ${cell.keluarClass ?? ''}`}>
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
