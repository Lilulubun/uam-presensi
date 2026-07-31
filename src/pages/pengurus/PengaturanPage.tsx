import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import { Button } from '../../app/components/ui/button';
import { useTPAStore } from '../../store/tpaStore';
import type { TPA } from '../../types';

interface TPAWithQR extends TPA {
  qrDataUrl: string | null;
}

export default function PengaturanPage() {
  const navigate = useNavigate();
  const tpas = useTPAStore((s) => s.tpas);
  const [tpasWithQR, setTpasWithQR] = useState<TPAWithQR[]>(
    tpas.map((t) => ({ ...t, qrDataUrl: null }))
  );

  useEffect(() => {
    if (tpas.length === 0) return;
    setTpasWithQR(tpas.map((t) => ({ ...t, qrDataUrl: null })));
    Promise.all(
      tpas.map(async (tpa) => {
        const qrDataUrl = await QRCode.toDataURL(tpa.staticQRCode, {
          width: 300,
          margin: 2,
          color: { dark: '#0e7490', light: '#ffffff' },
        });
        return { ...tpa, qrDataUrl };
      })
    ).then(setTpasWithQR);
  }, [tpas]);

  const handlePrintAll = () => window.print();

  const handlePrintOne = (tpa: TPAWithQR) => {
    if (!tpa.qrDataUrl) return;
    const win = window.open('', '_blank');
    if (!win) return;
    const doc = win.document;
    doc.write('<!DOCTYPE html><html><head>');
    doc.write(`<title>${tpa.staticQRCode}</title>`);
    doc.write('<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}.card{text-align:center;padding:48px;border:2px solid #e5e7eb;border-radius:16px;max-width:400px}h1{font-size:28px;font-weight:700;margin:0 0 12px;line-height:1.2}p{color:#4b5563;margin:0 0 24px;font-size:16px;line-height:1.5}img{display:block;margin:0 auto}.footer{margin-top:32px;font-size:12px;color:#9ca3af;letter-spacing:0.025em}</style></head><body>');
    const card = doc.createElement('div');
    card.className = 'card';
    const h1 = doc.createElement('h1');
    h1.textContent = tpa.name;
    card.appendChild(h1);
    const p = doc.createElement('p');
    p.textContent = 'Scan untuk membuka sesi mengajar';
    card.appendChild(p);
    const img = doc.createElement('img');
    img.src = tpa.qrDataUrl;
    img.width = 240;
    img.height = 240;
    card.appendChild(img);
    const footer = doc.createElement('div');
    footer.className = 'footer';
    footer.textContent = `UII Ayo Mengajar \u00b7 ID: ${tpa.staticQRCode}`;
    card.appendChild(footer);
    doc.body.appendChild(card);
    const script = doc.createElement('script');
    script.textContent = 'window.onload=function(){window.print();window.close()}';
    doc.body.appendChild(script);
    doc.close();
    win.print();
    win.close();
  };

  return (
    <div className="min-h-screen bg-[#F4F4F2] font-sans text-[#1A1A18] pb-12">
      <header className="bg-white/70 backdrop-blur-[20px] border-b border-[#EAEAE7] px-4 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.02)] print:hidden">
        <button onClick={() => navigate('/pengurus/dashboard')} className="text-[#6B6B66] hover:text-[#1A1A18]">
          <ArrowLeft className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <h1 className="font-semibold text-[20px] tracking-tight flex-1 text-[#1A1A18]">Setup QR Statis</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrintAll}
          className="rounded-[12px] border-[#EAEAE7] hover:border-[#D7FF3D] hover:bg-[#F7F7F5] text-xs font-medium text-[#6B6B66] hover:text-[#1A1A18]"
        >
          <Printer className="w-4 h-4 mr-1.5" strokeWidth={1.5} />
          Cetak Semua
        </Button>
      </header>

      <main className="max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
        <p className="text-[13px] text-[#7A7A75] font-medium px-2 print:hidden">
          Cetak dan tempelkan QR ini di pintu masuk masing-masing TPA. QR ini bersifat permanen — tidak perlu diperbarui.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {tpasWithQR.map((tpa) => (
            <div
              key={tpa.id}
              className="bg-white rounded-[24px] shadow-[0_4px_24px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.02)] p-5 border border-[#EAEAE7] flex flex-col items-center gap-4 text-center hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] motion-safe:transition-[box-shadow,border-color,opacity,transform]"
            >
              <div className="bg-[#F7F7F5] p-3 rounded-[16px] border border-[#EAEAE7]">
                {tpa.qrDataUrl ? (
                  <img src={tpa.qrDataUrl} alt={`QR ${tpa.name}`} className="w-28 h-28 object-contain" />
                ) : (
                  <div className="w-28 h-28 flex items-center justify-center bg-[#F0F0EC] rounded animate-pulse" />
                )}
              </div>

              <div>
                <p className="text-[15px] font-semibold leading-tight text-[#1A1A18]">{tpa.name}</p>
                <p className="text-[11px] text-[#7A7A75] mt-1.5 font-mono">{tpa.staticQRCode}</p>
              </div>

              <button
                onClick={() => handlePrintOne(tpa)}
                disabled={!tpa.qrDataUrl}
                className="print:hidden text-[12px] font-medium text-[#6B6B66] hover:text-[#1A1A18] underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
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
