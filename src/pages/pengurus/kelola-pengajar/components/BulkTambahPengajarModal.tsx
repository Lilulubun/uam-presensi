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

      console.log('CSV raw lines:', lines);

      // Skip header
      const dataLines = lines.slice(1);
      let successCount = 0;
      let errorCount = 0;

      for (const [idx, line] of dataLines.entries()) {
        console.log(`Row ${idx + 1}:`, line);
        const [name, email, nim, tpaId] = line.split(',').map(s => s.trim());
        console.log(`Parsed row ${idx + 1}:`, { name, email, nim, tpaId });
        
        if (!name || !email) {
          console.warn('Skipping invalid row — missing name or email:', { name, email, nim, tpaId });
          errorCount++;
          continue;
        }

        try {
          await createUser(email, name, nim || '', tpaId ? [tpaId] : []);
          successCount++;
        } catch (err) {
          console.error(`Error creating user ${email}:`, err);
          errorCount++;
        }
      }

      toast.success(`Import selesai: ${successCount} berhasil, ${errorCount} gagal`);
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
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Import Pengajar (CSV)
            </AlertDialogTitle>
            <AlertDialogDescription>
              Unggah file CSV untuk menambahkan banyak pengajar sekaligus.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-6 py-4 space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Unggah file CSV untuk menambahkan banyak pengajar sekaligus.
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-primary"
                onClick={() => setShowInstructions(true)}
              >
                <Info className="w-3 h-3 mr-1" />
                Format CSV
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center border-2 border-dashed border-input rounded-xl p-8 transition-colors hover:bg-muted/30">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {file ? file.name : 'Klik untuk pilih file CSV'}
                  </p>
                  <p className="text-xs text-muted-foreground">Maksimal ukuran file 2MB</p>
                </div>
              </label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Batal</AlertDialogCancel>
            <Button onClick={handleImport} disabled={submitting || !file}>
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
          <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Format File CSV</AlertDialogTitle>
            <AlertDialogDescription>
              Gunakan format berikut untuk mengimpor data pengajar dengan benar.
            </AlertDialogDescription>
          </AlertDialogHeader>

            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                File CSV harus menggunakan koma (<code>,</code>) sebagai pemisah dan memiliki header di baris pertama.
              </p>
              <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
                <p>nama,email,nim,tpa_id</p>
                <p>Budi Santoso,budi@uii.ac.id,20521001,tpa-001</p>
                <p>Siti Rahayu,siti@uii.ac.id,20521002,tpa-002</p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2 list-disc pl-4">
                <li><strong>nama</strong>: Nama lengkap pengajar (Wajib)</li>
                <li><strong>email</strong>: Email institusi/aktif (Wajib)</li>
                <li><strong>nim</strong>: Nomor Induk Mengajar (Opsional)</li>
                <li><strong>tpa_id</strong>: ID TPA dari sistem (Opsional)</li>
              </ul>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Tutup</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
