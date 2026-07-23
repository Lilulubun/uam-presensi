import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, FileText, Info } from 'lucide-react';
import { Button } from '../../../../app/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogFooter,
} from '../../../../app/components/ui/alert-dialog';
import { createUser } from '../../../../lib/manage-user';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkTambahPengajarModal({ open, onClose, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        toast.error('Mohon unggah file dengan format .csv');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Mohon pilih file CSV terlebih dahulu');
      return;
    }

    setSubmitting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim() !== '');

      // Skip header
      const dataLines = lines.slice(1);
      const rows = dataLines
        .map((line) => {
          const [name, email, nim, tpaId] = line.split(',').map(s => s.trim());
          return { name, email, nim, tpaId };
        })
        .filter((r) => r.name && r.email);

      const totalRows = rows.length;
      const failedEmails: string[] = [];
      let successCount = 0;
      const BATCH_SIZE = 5;

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const results = await Promise.allSettled(
          batch.map((r) => createUser(r.email, r.name, r.nim || '', r.tpaId ? [r.tpaId] : []))
        );
        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          if (r.status === 'fulfilled') {
            successCount++;
          } else {
            failedEmails.push(batch[j].email);
          }
        }
      }

      const errorCount = totalRows - successCount;
      const msg = `Import selesai: ${successCount} berhasil, ${errorCount} gagal`;
      if (failedEmails.length > 0) {
        toast(msg + '\n' + failedEmails.join(', '));
      } else {
        toast.success(msg);
      }
      setFile(null);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error('Gagal membaca file CSV');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
        <AlertDialogContent className="max-w-md bg-white rounded-[28px] border border-[#EAEAE7]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-semibold text-[18px] text-[#1A1A18]">
              <FileText className="w-5 h-5" strokeWidth={1.5} />
              Import Pengajar (CSV)
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-[#6B6B66]">
              Unggah file CSV untuk menambahkan banyak pengajar sekaligus.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-6 py-4 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-[#6B6B66] font-medium">
                Pastikan format file sudah sesuai.
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-[12px] text-[#D7FF3D] hover:text-[#cbe646]"
                onClick={() => setShowInstructions(true)}
              >
                <Info className="w-3 h-3 mr-1" strokeWidth={1.5} />
                Format CSV
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-[#EAEAE7] rounded-[24px] p-8 transition-colors hover:bg-[#F7F7F5]">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#D7FF3D]/10 flex items-center justify-center text-[#1A1A18]">
                  <FileText className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-semibold text-[#1A1A18]">
                    {file ? file.name : 'Pilih file CSV'}
                  </p>
                  <p className="text-[12px] text-[#7A7A75] mt-1">Maksimal ukuran file 2MB</p>
                </div>
              </label>
            </div>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={submitting} className="h-11 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5]">Batal</AlertDialogCancel>
            <Button
              onClick={handleImport}
              disabled={submitting || !file}
              className="h-11 rounded-[14px] bg-[#D7FF3D] text-[#1A1A18] hover:bg-[#cbe646] font-semibold"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Mengimpor...</>
              ) : (
                'Mulai Import'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {showInstructions && (
        <AlertDialog open={showInstructions} onOpenChange={setShowInstructions}>
          <AlertDialogContent className="max-w-md bg-white rounded-[28px] border border-[#EAEAE7]">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-semibold text-[18px] text-[#1A1A18]">Format File CSV</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-[#6B6B66]">
                Gunakan format berikut untuk mengimpor data pengajar dengan benar.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="px-6 py-4 space-y-4">
              <p className="text-[13px] text-[#6B6B66]">
                File CSV harus menggunakan koma (<code>,</code>) sebagai pemisah dan memiliki header di baris pertama.
              </p>
              <div className="bg-[#F7F7F5] rounded-[14px] p-4 font-mono text-[12px] overflow-x-auto border border-[#EAEAE7]">
                <p>nama,email,nim,tpa_id</p>
                <p>Budi Santoso,budi@uii.ac.id,20521001,tpa-001</p>
                <p>Siti Rahayu,siti@uii.ac.id,20521002,tpa-002</p>
              </div>
              <ul className="text-[12px] text-[#6B6B66] space-y-2 list-disc pl-4">
                <li><strong>nama</strong>: Nama lengkap pengajar (Wajib)</li>
                <li><strong>email</strong>: Email institusi/aktif (Wajib)</li>
                <li><strong>nim</strong>: Nomor Induk Mengajar (Opsional)</li>
                <li><strong>tpa_id</strong>: ID TPA dari sistem (Opsional)</li>
              </ul>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel className="h-11 rounded-[14px] border-[#EAEAE7] hover:bg-[#F7F7F5]">Tutup</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
