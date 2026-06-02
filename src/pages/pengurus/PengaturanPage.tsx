import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '../../app/components/ui/button';
import { MOCK_TPAS } from '../../lib/mock-data';
import type { TPA } from '../../types';

interface TPAWithQR extends TPA {
  qrDataUrl: string | null;
}

export default function PengaturanPage() {
  const navigate = useNavigate();
  const [tpasWithQR, setTpasWithQR] = useState<TPAWithQR[]>(
    MOCK_TPAS.map((t) => ({ ...t, qrDataUrl: null }))
  );

  useEffect(() => {
    Promise.all(
      MOCK_TPAS.map(async (tpa) => {
        const qrDataUrl = await QRCode.toDataURL(tpa.staticQRCode, {
          width: 300,
          margin: 2,
          color: { dark: '#0e7490', light: '#ffffff' },
        });
        return { ...tpa, qrDataUrl };
      })
    ).then(setTpasWithQR);
  }, []);

  const handlePrintAll = () => window.print();

  const handlePrintOne = (tpa: TPAWithQR) => {
    if (!tpa.qrDataUrl) return;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${tpa.name}</title>
          <style>
            body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
            .card { text-align: center; padding: 40px; border: 2px solid #e5e7eb; border-radius: 12px; max-width: 360px; }
            h1 { font-size: 22px; margin: 0 0 8px; }
            p { color: #6b7280; margin: 0 0 20px; font-size: 14px; }
            img { display: block; margin: 0 auto; }
            .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${tpa.name}</h1>
            <p>Scan untuk membuka sesi mengajar</p>
            <img src="${tpa.qrDataUrl}" width="240" height="240" />
            <div class="footer">UII Ayo Mengajar · ID: ${tpa.staticQRCode}</div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>`;
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b px-4 py-4 flex items-center gap-3 print:hidden">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg flex-1">Setup QR Statis</h1>
        <Button variant="outline" size="sm" onClick={handlePrintAll}>
          <Printer className="w-4 h-4 mr-1.5" />
          Cetak Semua
        </Button>
      </header>

      <main className="max-w-5xl mx-auto p-4">
        <p className="text-sm text-muted-foreground mb-4 print:hidden">
          Cetak dan tempelkan QR code ini di pintu masuk masing-masing TPA. QR ini tidak berubah.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {tpasWithQR.map((tpa) => (
            <div
              key={tpa.id}
              className="bg-card rounded-xl shadow-sm p-4 flex flex-col items-center gap-3 text-center"
            >
              <div className="bg-white p-2 rounded-lg shadow-inner">
                {tpa.qrDataUrl ? (
                  <img src={tpa.qrDataUrl} alt={`QR ${tpa.name}`} className="w-28 h-28 object-contain" />
                ) : (
                  <div className="w-28 h-28 flex items-center justify-center bg-muted rounded animate-pulse" />
                )}
              </div>

              <div>
                <p className="text-sm font-semibold leading-tight">{tpa.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{tpa.staticQRCode}</p>
              </div>

              <button
                onClick={() => handlePrintOne(tpa)}
                disabled={!tpa.qrDataUrl}
                className="print:hidden text-xs text-primary underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
              >
                Cetak
              </button>
            </div>
          ))}
        </div>

        <style>{`
          @media print {
            header, button { display: none !important; }
            .print\\:hidden { display: none !important; }
          }
        `}</style>
      </main>
    </div>
  );
}
