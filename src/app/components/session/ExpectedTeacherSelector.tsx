import { useState } from 'react';
import { Users, Loader2 } from 'lucide-react';
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
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const count = selected.size;

  const handleSubmit = () => {
    if (count === 0) return;
    onSubmit(Array.from(selected));
  };

  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-primary" />
        <div>
          <p className="font-semibold text-sm">Pilih Pengajar yang Wajib Hadir</p>
          <p className="text-xs text-muted-foreground">
            Hanya pengajar yang dipilih akan dihitung kehadirannya hari ini
          </p>
        </div>
      </div>

      {/* Counter */}
      <p className="text-sm font-medium text-primary">
        {count} dipilih
      </p>

      {/* Checkbox list */}
      <ul className="divide-y border rounded-lg overflow-hidden">
        {teachers.map((teacher) => (
          <li key={teacher.id}>
            <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                checked={selected.has(teacher.id)}
                onChange={() => toggle(teacher.id)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {teacher.name}
                  {teacher.id === currentUserId && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(Anda)</span>
                  )}
                </p>
                {teacher.nim && (
                  <p className="text-xs text-muted-foreground">{teacher.nim}</p>
                )}
              </div>
            </label>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Batal
        </Button>
        <Button
          className="flex-1"
          onClick={handleSubmit}
          disabled={count === 0 || loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Membuka...
            </>
          ) : (
            `Buka Sesi (${count})`
          )}
        </Button>
      </div>
    </div>
  );
}
