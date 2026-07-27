import { toast } from 'sonner';

interface ExportDataRow {
  [key: string]: any;
}

export function validateAndExportXlsx(
  data: ExportDataRow[],
  onExport: () => void
) {
  if (!Array.isArray(data)) {
    toast.error('Data ekspor tidak valid');
    return false;
  }

  // Bound row count
  if (data.length > 5000) {
    toast.error('Jumlah data melebihi batas ekspor (maksimal 5000 baris)');
    return false;
  }

  // Prevent prototype pollution attacks in cell properties
  for (const row of data) {
    if (row === null || typeof row !== 'object') {
      toast.error('Format data ekspor tidak valid');
      return false;
    }
    for (const key of Object.keys(row)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        toast.error('Deteksi data tidak aman pada ekspor');
        return false;
      }
    }
  }

  // Safe to proceed
  try {
    onExport();
    return true;
  } catch (err: any) {
    toast.error(`Gagal melakukan ekspor: ${err?.message || 'Error tidak diketahui'}`);
    return false;
  }
}
