import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Users, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import type { User } from '../../../types';

interface ExpectedTeacherSelectorProps {
  teachers: User[];
  currentUserId: string;
  onSubmit: (selectedIds: string[]) => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ExpectedTeacherSelector({
  teachers,
  currentUserId,
  onSubmit,
  onCancel,
  loading = false,
}: ExpectedTeacherSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(teachers.map((teacher) => teacher.id)));
  const clearAll = () => setSelected(new Set());
  const count = selected.size;
  const allSelected = teachers.length > 0 && count === teachers.length;
  const hostIsSelected = selected.has(currentUserId);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1A18]/35 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expected-teacher-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.16)] sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EDF3F8] text-[#8DB5D8]">
              <Users className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <h2 id="expected-teacher-title" className="text-[16px] font-semibold text-[#1A1A18]">
                Pilih pengajar wajib hadir
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-[#7A7A75]">
                Tentukan pengajar yang dijadwalkan mengikuti sesi ini.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            aria-label="Tutup pilihan pengajar"
            className="rounded-full p-2 text-[#7A7A75] hover:bg-[#F4F4F2] hover:text-[#1A1A18] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[13px] font-semibold text-[#1A1A18]">{count} pengajar dipilih</span>
          <button
            type="button"
            onClick={allSelected ? clearAll : selectAll}
            disabled={loading || teachers.length === 0}
            className="text-[13px] font-semibold text-[#5B9C64] hover:text-[#4A8553] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {allSelected ? 'Batal pilih semua' : 'Pilih semua'}
          </button>
        </div>

        <ul className="max-h-[45vh] overflow-y-auto rounded-[16px] border border-[#EAEAE7]" aria-label="Daftar pengajar">
          {teachers.map((teacher) => (
            <li key={teacher.id} className="border-b border-[#EAEAE7] last:border-b-0">
              <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-3 hover:bg-[#F4F4F2]">
                <input
                  type="checkbox"
                  checked={selected.has(teacher.id)}
                  onChange={() => toggle(teacher.id)}
                  disabled={loading}
                  className="h-5 w-5 rounded border-[#D0D0CB] accent-[#5B9C64] focus:ring-[#5B9C64]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-[#1A1A18]">
                    {teacher.name}
                    {teacher.id === currentUserId && <span className="ml-1.5 text-[12px] text-[#7A7A75]">(Anda)</span>}
                  </span>
                  {teacher.nim && <span className="mt-0.5 block text-[12px] text-[#7A7A75]">{teacher.nim}</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {count > 0 && !hostIsSelected && (
          <div className="mt-4 rounded-[14px] border border-[#D9A06B]/25 bg-[#FDF4ED] p-3 text-[12px] leading-relaxed text-[#7A5A38]">
            <strong>Catatan:</strong> Anda tetap dicatat hadir sebagai pembuka sesi, tetapi tidak dihitung sebagai pengajar wajib karena tidak dipilih.
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="h-11 flex-1 rounded-[14px]" onClick={onCancel} disabled={loading}>
            Batal
          </Button>
          <Button
            className="h-11 flex-1 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#CBE646]"
            onClick={() => onSubmit(Array.from(selected))}
            disabled={count === 0 || loading}
          >
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Membuka...</> : `Buka sesi (${count})`}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
