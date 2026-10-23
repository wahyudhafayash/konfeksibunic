import React, { useState, useRef, useMemo } from 'react';
import { PO, POItem, Tailor, SewingJob, SewingSubmission, getPOItemPricing } from '@/lib/db';
import { 
  Printer, 
  X, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Calendar, 
  User, 
  Scissors, 
  Download,
  Building2,
  Package,
  Layers,
  Sparkles,
  TrendingUp,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';

interface POReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  po: PO;
  poItems: POItem[];
  sewingJobs: SewingJob[];
  sewingSubmissions: SewingSubmission[];
  tailors: Tailor[];
  currentUsername?: string;
  companyName?: string;
}

export default function POReportPdfModal({
  isOpen,
  onClose,
  po,
  poItems,
  sewingJobs,
  sewingSubmissions,
  tailors,
  currentUsername = 'Administrator',
  companyName = 'GARMENT & KONFEKSI PRODUCTION'
}: POReportPdfModalProps) {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zoomScale, setZoomScale] = useState<number>(0.95);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.innerWidth < 640) {
        setZoomScale(0.42);
        setOrientation('portrait');
      } else if (window.innerWidth < 1024) {
        setZoomScale(0.7);
      }
    }
  }, []);
  const printContentRef = useRef<HTMLDivElement>(null);

  // Filter data specifically for this PO
  const relevantItems = useMemo(() => {
    return poItems.filter(item => item.poId === po.id);
  }, [poItems, po.id]);

  const relevantJobs = useMemo(() => {
    return sewingJobs.filter(job => relevantItems.some(it => it.id === job.poItemId));
  }, [sewingJobs, relevantItems]);

  const relevantSubmissions = useMemo(() => {
    return sewingSubmissions.filter(sub => relevantJobs.some(job => job.id === sub.jobId));
  }, [sewingSubmissions, relevantJobs]);

  // Pricing info
  const pricingInfo = useMemo(() => {
    return getPOItemPricing(po, relevantItems[0]);
  }, [po, relevantItems]);

  // Overall Quantities
  const totalTargetQty = useMemo(() => {
    return relevantItems.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  }, [relevantItems]);

  const totalTakenQty = useMemo(() => {
    return relevantJobs.reduce((acc, job) => acc + (Number(job.qtyTaken) || 0), 0);
  }, [relevantJobs]);

  const totalSubmittedQty = useMemo(() => {
    return relevantSubmissions.reduce((acc, sub) => acc + (Number(sub.qtySubmitted) || 0), 0);
  }, [relevantSubmissions]);

  const totalProgressQty = Math.max(0, totalTakenQty - totalSubmittedQty);
  const totalRemainingQty = Math.max(0, totalTargetQty - totalSubmittedQty);
  const totalVarianceQty = totalSubmittedQty - totalTargetQty; // >0 is over-deposit, <0 is under-deposit relative to target
  const overallProgressPercent = totalTargetQty > 0 ? (totalSubmittedQty / totalTargetQty) * 100 : 0;

  // Tailor stats calculation
  const tailorContributions = useMemo(() => {
    const map = new Map<number, {
      tailorId: number;
      name: string;
      partnerName?: string;
      phone?: string;
      itemCount: number;
      qtyTaken: number;
      qtyAwal: number;
      qtySubmitted: number;
      qtyProgress: number;
      selisih: number; // Qty Awal - Qty Disetor (or vice versa according to formula)
      progressPercent: number;
      status: 'BELUM MULAI' | 'PROGRESS' | 'SELESAI' | 'SETOR LEBIH' | 'DATA TIDAK SESUAI';
    }>();

    for (const job of relevantJobs) {
      const t = tailors.find(x => x.id === job.tailorId);
      const tailorName = t ? t.name : (job.tailorName || `Penjahit #${job.tailorId}`);
      const partnerName = t?.partnerName;
      const phone = t?.phone;

      const jobSubs = relevantSubmissions.filter(s => s.jobId === job.id);
      const subTotal = jobSubs.reduce((sum, s) => sum + (Number(s.qtySubmitted) || 0), 0);

      const existing = map.get(job.tailorId) || {
        tailorId: job.tailorId,
        name: tailorName,
        partnerName,
        phone,
        itemCount: 0,
        qtyTaken: 0,
        qtyAwal: 0,
        qtySubmitted: 0,
        qtyProgress: 0,
        selisih: 0,
        progressPercent: 0,
        status: 'BELUM MULAI'
      };

      existing.itemCount += 1;
      existing.qtyTaken += Number(job.qtyTaken) || 0;
      existing.qtyAwal += Number(job.qtyTaken) || 0;
      existing.qtySubmitted += subTotal;

      map.set(job.tailorId, existing);
    }

    const list = Array.from(map.values()).map(item => {
      const qtyProgress = Math.max(0, item.qtyAwal - item.qtySubmitted);
      const selisih = item.qtyAwal - item.qtySubmitted; // 0 = sesuai, >0 = kurang setor, <0 = setor lebih
      const progressPercent = item.qtyAwal > 0 ? (item.qtySubmitted / item.qtyAwal) * 100 : 0;

      let status: 'BELUM MULAI' | 'PROGRESS' | 'SELESAI' | 'SETOR LEBIH' | 'DATA TIDAK SESUAI' = 'BELUM MULAI';
      if (item.qtyAwal <= 0) {
        status = 'DATA TIDAK SESUAI';
      } else if (item.qtySubmitted === 0) {
        status = 'BELUM MULAI';
      } else if (item.qtySubmitted < item.qtyAwal) {
        status = 'PROGRESS';
      } else if (item.qtySubmitted === item.qtyAwal) {
        status = 'SELESAI';
      } else if (item.qtySubmitted > item.qtyAwal) {
        status = 'SETOR LEBIH';
      }

      return {
        ...item,
        qtyProgress,
        selisih,
        progressPercent,
        status
      };
    });

    return list.sort((a, b) => b.qtySubmitted - a.qtySubmitted);
  }, [relevantJobs, relevantSubmissions, tailors]);

  // Items with detailed tailor & progress breakdown
  const itemsWithDetails = useMemo(() => {
    return relevantItems.map((item, idx) => {
      const itemJobs = relevantJobs.filter(j => j.poItemId === item.id);
      const itemQtyTaken = itemJobs.reduce((sum, j) => sum + (Number(j.qtyTaken) || 0), 0);
      
      const itemJobIds = itemJobs.map(j => j.id);
      const itemSubs = relevantSubmissions.filter(s => itemJobIds.includes(s.jobId));
      const itemQtySubmitted = itemSubs.reduce((sum, s) => sum + (Number(s.qtySubmitted) || 0), 0);

      const itemQtyProgress = Math.max(0, itemQtyTaken - itemQtySubmitted);
      const itemQtySisa = Math.max(0, item.qty - itemQtySubmitted);
      const itemSelisih = itemQtySubmitted - item.qty;
      const progressPct = item.qty > 0 ? (itemQtySubmitted / item.qty) * 100 : 0;

      let status = 'Belum Mulai';
      if (itemQtySubmitted >= item.qty && item.qty > 0) {
        status = itemQtySubmitted > item.qty ? 'Setor Lebih' : 'Selesai';
      } else if (itemQtySubmitted > 0) {
        status = 'Sedang Produksi';
      }

      // Tailors working on this specific item
      const itemTailors = itemJobs.map(job => {
        const t = tailors.find(x => x.id === job.tailorId);
        const tName = t ? (t.partnerName ? `${t.name} & ${t.partnerName}` : t.name) : (job.tailorName || `Penjahit #${job.tailorId}`);
        const jobSubmissions = relevantSubmissions.filter(s => s.jobId === job.id);
        const subPcs = jobSubmissions.reduce((sum, s) => sum + (Number(s.qtySubmitted) || 0), 0);
        const sisa = Math.max(0, job.qtyTaken - subPcs);
        const selisih = job.qtyTaken - subPcs; // >0 kurang, <0 lebih
        const pct = job.qtyTaken > 0 ? (subPcs / job.qtyTaken) * 100 : 0;
        
        let tailorStatus = 'BELUM MULAI';
        if (subPcs === 0) tailorStatus = 'BELUM MULAI';
        else if (subPcs < job.qtyTaken) tailorStatus = 'PROGRESS / KURANG SETOR';
        else if (subPcs === job.qtyTaken) tailorStatus = 'SELESAI / SESUAI';
        else tailorStatus = 'SETOR LEBIH';

        return {
          tailorId: job.tailorId,
          tailorName: tName,
          qtyTaken: job.qtyTaken,
          qtyAwal: job.qtyTaken,
          qtySubmitted: subPcs,
          sisa,
          progressPercent: pct,
          selisih,
          status: tailorStatus,
          assignedPart: job.assignedPart || 'Set'
        };
      });

      return {
        ...item,
        indexNumber: idx + 1,
        qtyTaken: itemQtyTaken,
        qtySubmitted: itemQtySubmitted,
        qtyProgress: itemQtyProgress,
        qtySisa: itemQtySisa,
        selisih: itemSelisih,
        progressPercent: progressPct,
        status,
        tailors: itemTailors
      };
    });
  }, [relevantItems, relevantJobs, relevantSubmissions, tailors]);

  // Discrepancy analysis items
  const discrepancyItems = useMemo(() => {
    const list: {
      type: 'item' | 'tailor';
      title: string;
      detail: string;
      qtyAwal: number;
      qtySetor: number;
      selisih: number;
      statusText: string;
      isWarning: boolean;
    }[] = [];

    // Check item variances
    for (const item of itemsWithDetails) {
      if (item.selisih !== 0 && item.qtySubmitted > 0) {
        list.push({
          type: 'item',
          title: `Item: ${item.itemName} (${item.color}, Size ${item.size})`,
          detail: `PO Target: ${item.qty} pcs, Total Disetor: ${item.qtySubmitted} pcs`,
          qtyAwal: item.qty,
          qtySetor: item.qtySubmitted,
          selisih: Math.abs(item.selisih),
          statusText: item.selisih < 0 ? `KURANG SETOR ${Math.abs(item.selisih)} PCS` : `SETOR LEBIH ${item.selisih} PCS`,
          isWarning: true
        });
      }
    }

    // Check tailor variances
    for (const t of tailorContributions) {
      if (t.status === 'SETOR LEBIH') {
        list.push({
          type: 'tailor',
          title: `Penjahit: ${t.name}`,
          detail: `Tanggung Jawab Awal: ${t.qtyAwal} pcs, Disetorkan: ${t.qtySubmitted} pcs`,
          qtyAwal: t.qtyAwal,
          qtySetor: t.qtySubmitted,
          selisih: t.qtySubmitted - t.qtyAwal,
          statusText: `SETOR LEBIH ${t.qtySubmitted - t.qtyAwal} PCS`,
          isWarning: true
        });
      } else if (t.status === 'PROGRESS' && (po.status === 'Selesai' || po.status === 'Siap Kirim')) {
        list.push({
          type: 'tailor',
          title: `Penjahit: ${t.name}`,
          detail: `Tanggung Jawab Awal: ${t.qtyAwal} pcs, Disetorkan: ${t.qtySubmitted} pcs`,
          qtyAwal: t.qtyAwal,
          qtySetor: t.qtySubmitted,
          selisih: t.qtyAwal - t.qtySubmitted,
          statusText: `BELUM SELESAI / KURANG ${t.qtyAwal - t.qtySubmitted} PCS`,
          isWarning: true
        });
      }
    }

    return list;
  }, [itemsWithDetails, tailorContributions, po.status]);

  // Overall PO Status description (Sesuai instruksi: jangan buat bermasalah/selisih, buat status jadi proses/sedang produksi)
  const computedPOStatus = useMemo(() => {
    if (po.status === 'Selesai') return 'Selesai';
    if (totalSubmittedQty >= totalTargetQty && totalTargetQty > 0) return 'Selesai';
    if (totalSubmittedQty > 0 && totalSubmittedQty < totalTargetQty) {
      if (totalSubmittedQty >= totalTargetQty * 0.75) return 'Sebagian Selesai';
      return 'Sedang Produksi';
    }
    if (totalTakenQty > 0) return 'Sedang Produksi';
    if (po.status === 'Proses' || po.status === 'Aktif') return 'Sedang Produksi';
    return 'Belum Mulai';
  }, [po.status, totalSubmittedQty, totalTargetQty, totalTakenQty]);

  // Automatic conclusion text based on data
  const conclusionText = useMemo(() => {
    if (totalTargetQty === 0) {
      return 'Belum ada rincian item atau kuantitas target yang terdaftar pada Purchase Order ini.';
    }

    if (totalSubmittedQty >= totalTargetQty && discrepancyItems.length === 0) {
      return `PO telah berjalan dengan baik. Total target pesanan sebanyak ${totalTargetQty.toLocaleString('id-ID')} pcs dan seluruh kuantitas telah disetorkan secara tuntas oleh ${tailorContributions.length} penjahit. Tidak ditemukan selisih kuantitas pada laporan ini.`;
    }

    if (discrepancyItems.length > 0) {
      const firstIssue = discrepancyItems[0];
      return `Perhatian: Teridentifikasi perbedaan kuantitas pada dokumen produksi ini. ${firstIssue.title} mengalami status ${firstIssue.statusText}. Diperlukan koordinasi dan pengecekan fisik antara supervisor produksi dan penjahit terkait.`;
    }

    if (totalSubmittedQty > 0 && totalRemainingQty > 0) {
      return `PO masih dalam proses pengerjaan produksi aktif. Dari target total ${totalTargetQty.toLocaleString('id-ID')} pcs, sebanyak ${totalSubmittedQty.toLocaleString('id-ID')} pcs telah disetorkan (${overallProgressPercent.toFixed(1)}%) dan masih terdapat ${totalRemainingQty.toLocaleString('id-ID')} pcs yang sedang dikerjakan atau belum disetorkan.`;
    }

    return `PO telah dibuat dan didaftarkan ke sistem dengan target ${totalTargetQty.toLocaleString('id-ID')} pcs. Saat ini proses pengerjaan jahit belum menghasilkan setoran fisik ke bagian quality control / gudang.`;
  }, [totalTargetQty, totalSubmittedQty, discrepancyItems, tailorContributions.length, totalRemainingQty, overallProgressPercent]);

  // Highest and lowest progress tailor
  const topTailor = useMemo(() => {
    if (tailorContributions.length === 0) return null;
    return [...tailorContributions].sort((a, b) => b.progressPercent - a.progressPercent)[0];
  }, [tailorContributions]);

  const lowestTailor = useMemo(() => {
    if (tailorContributions.length <= 1) return null;
    return [...tailorContributions].sort((a, b) => a.progressPercent - b.progressPercent)[0];
  }, [tailorContributions]);

  // Direct print handler
  const handlePrint = () => {
    if (!printContentRef.current) return;
    const printHtml = printContentRef.current.innerHTML;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up printer diblokir browser. Harap izinkan pop-up untuk mencetak laporan.');
      return;
    }

    const isLandscape = orientation === 'landscape';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8" />
          <title>Laporan_PO_${po.poNumber}_${new Date().toISOString().slice(0, 10)}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
            
            @page {
              size: A4 ${isLandscape ? 'landscape' : 'portrait'};
              margin: 10mm 10mm 12mm 10mm;
            }
            
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              box-sizing: border-box;
            }
            
            body {
              font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
              color: #0f172a;
              background-color: #ffffff;
              margin: 0;
              padding: 0;
              font-size: 11px;
              line-height: 1.4;
            }

            .sheet {
              width: 100%;
              max-width: 100%;
              background: #ffffff;
              padding: 0;
            }

            table {
              border-collapse: collapse;
              width: 100%;
            }

            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px 8px;
            }

            .no-break {
              page-break-inside: avoid;
              break-inside: avoid;
            }

            .page-break-before {
              page-break-before: always;
              break-before: page;
            }

            @media print {
              .no-print { display: none !important; }
              body { padding: 0 !important; background: white !important; }
              .sheet { box-shadow: none !important; border: none !important; padding: 0 !important; }
            }
          </style>
        </head>
        <body>
          <div class="sheet">
            ${printHtml}
          </div>
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.focus();
                window.print();
                window.close();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/85 backdrop-blur-md overflow-hidden">
      {/* Top Action Bar */}
      <div className="bg-slate-900 border-b border-slate-800 text-white px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-2 sm:gap-4 shrink-0 shadow-lg z-10">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold uppercase tracking-tight text-white">
                Cetak Laporan PO ke PDF
              </h2>
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-400/30 uppercase tracking-widest">
                #{po.poNumber}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Pratinjau dokumen produksi siap cetak / simpan ke format PDF resolusi tinggi
            </p>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-3">
          {/* Orientation switch */}
          <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700 text-xs font-bold">
            <button
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                orientation === 'landscape'
                  ? 'bg-indigo-600 text-white shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Landscape (A4)
            </button>
            <button
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                orientation === 'portrait'
                  ? 'bg-indigo-600 text-white shadow-sm font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Portrait (A4)
            </button>
          </div>

          {/* Zoom controls */}
          <div className="bg-slate-800 p-1 rounded-xl hidden md:flex items-center border border-slate-700 text-xs">
            <button
              onClick={() => setZoomScale(prev => Math.max(0.6, prev - 0.1))}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              title="Perkecil Tampilan"
            >
              <ZoomOut size={16} />
            </button>
            <span className="px-2 text-slate-300 font-bold tabular-nums text-[11px]">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              onClick={() => setZoomScale(prev => Math.min(1.3, prev + 0.1))}
              className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 transition-colors"
              title="Perbesar Tampilan"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          {/* Print button */}
          <button
            onClick={handlePrint}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
          >
            <Printer size={16} />
            <span>Cetak / Simpan PDF</span>
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white p-2.5 rounded-xl transition-all"
            title="Tutup"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div className="flex-1 overflow-auto p-2 sm:p-6 md:p-10 flex justify-center bg-slate-950/50 custom-scrollbar">
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: 'top center',
            transition: 'transform 0.15s ease-out'
          }}
          className={`transition-all ${
            orientation === 'landscape' ? 'w-[1120px]' : 'w-[840px]'
          }`}
        >
          {/* Printable Document Sheet (A4 styling) */}
          <div
            ref={printContentRef}
            className="bg-white text-slate-900 p-4 sm:p-8 md:p-12 rounded-xl sm:rounded-[1.5rem] shadow-2xl border border-slate-200/80 space-y-7 leading-relaxed font-sans"
          >
            {/* 1. HEADER LAPORAN */}
            <div className="border-b-2 border-slate-900 pb-5 no-break">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl tracking-tighter shrink-0 border-2 border-indigo-600 shadow-md">
                    <Scissors size={28} className="text-indigo-400" />
                  </div>
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase leading-tight">
                      {companyName}
                    </h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      Divisi Administrasi & Pengendalian Kualitas Produksi
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Laporan Monitoring Pengerjaan Purchase Order & Kontribusi Penjahit
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right border-l-2 sm:border-l-0 pl-3 sm:pl-0 border-indigo-500">
                  <div className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider mb-1">
                    LAPORAN PURCHASE ORDER (PO)
                  </div>
                  <div className="text-2xl font-black text-slate-950 tracking-tight uppercase">
                    #{po.poNumber}
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center justify-start sm:justify-end gap-1.5 mt-0.5">
                    <Calendar size={11} className="text-slate-400" />
                    <span>Tgl PO: {new Date(po.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>

              {/* Status & Metadata Bar */}
              <div className="mt-5 pt-3.5 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Status Dokumen</span>
                  <span className={`inline-flex items-center gap-1.5 mt-0.5 px-2.5 py-0.5 rounded-md font-black text-[10px] uppercase tracking-wider border ${
                    computedPOStatus === 'Selesai'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                      : computedPOStatus === 'Sebagian Selesai'
                      ? 'bg-sky-50 text-sky-700 border-sky-300'
                      : computedPOStatus === 'Sedang Produksi' || (computedPOStatus as string) === 'Proses'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-slate-50 text-slate-700 border-slate-300'
                  }`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                    {computedPOStatus}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Periode Produksi</span>
                  <span className="font-bold text-slate-800 text-[11px] block mt-0.5">
                    {new Date(po.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} s/d {po.status === 'Selesai' ? 'Selesai' : 'Sekarang'}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Tanggal Cetak Dokumen</span>
                  <span className="font-bold text-slate-800 text-[11px] block mt-0.5">
                    {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}, {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div>
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Dicetak Oleh (Admin)</span>
                  <span className="font-bold text-slate-900 text-[11px] block mt-0.5 uppercase">
                    {currentUsername || po.createdBy || 'Administrator'}
                  </span>
                </div>
              </div>
            </div>

            {/* 2. INFORMASI CLIENT & 4. RINGKASAN QUANTITY PO (GRID SIDE BY SIDE) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 no-break">
              {/* Client Info Card */}
              <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Building2 size={13} className="text-indigo-600" /> Informasi Client & Pesanan
                    </span>
                    <span className="text-[9px] font-black bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded uppercase">
                      ID: #{po.id || 'PO'}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Nama Client:</span>
                      <span className="font-black text-slate-900 uppercase text-sm">
                        {po.customerName || 'Customer Umum'}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Nomor PO:</span>
                      <span className="font-black text-indigo-600 font-mono">
                        {po.poNumber}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Format Pengerjaan:</span>
                      <span className="font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px]">
                        {pricingInfo.setType}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Tarif Upah Jahit:</span>
                      <span className="font-bold text-slate-800 text-[11px]">
                        Rp {pricingInfo.totalFullWage.toLocaleString('id-ID')}/pcs
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline">
                      <span className="text-slate-400 text-[10px] font-bold uppercase">Tabungan Penjahit:</span>
                      <span className="font-bold text-emerald-700 text-[11px]">
                        Rp {pricingInfo.tabunganPerPcs.toLocaleString('id-ID')}/pcs
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-slate-400 text-[9px] font-black uppercase block mb-1">Catatan / Keterangan PO:</span>
                      <p className="text-[11px] font-medium text-slate-700 bg-white border border-slate-200 rounded-lg p-2 italic leading-relaxed">
                        {po.description || 'Tidak ada instruksi khusus pada Purchase Order ini.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. RINGKASAN QUANTITY PO (SUMMARY BOXES) */}
              <div className="lg:col-span-7 bg-slate-900 text-white rounded-xl p-5 border border-slate-800 flex flex-col justify-between shadow-sm">
                <div>
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 flex items-center gap-1.5">
                      <Package size={13} className="text-indigo-400" /> Ringkasan Kuantitas PO (Production Summary)
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded ${
                      overallProgressPercent >= 100
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                        : overallProgressPercent > 0
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      Progress: {overallProgressPercent.toFixed(1)}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
                    {/* Total Target */}
                    <div className="bg-slate-800/90 rounded-lg p-3 border border-slate-700/80">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        TOTAL PO (AWAL)
                      </span>
                      <span className="text-xl font-black text-white tabular-nums">
                        {totalTargetQty.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">PCS Target</span>
                    </div>

                    {/* Sudah Disetor */}
                    <div className="bg-emerald-950/60 rounded-lg p-3 border border-emerald-800/50">
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-300 block mb-1">
                        SUDAH DISETOR
                      </span>
                      <span className="text-xl font-black text-emerald-400 tabular-nums">
                        {totalSubmittedQty.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[9px] text-emerald-300/80 block mt-0.5 font-bold">PCS Selesai</span>
                    </div>

                    {/* Sedang Progress */}
                    <div className="bg-indigo-950/60 rounded-lg p-3 border border-indigo-800/50">
                      <span className="text-[9px] font-black uppercase tracking-wider text-indigo-300 block mb-1">
                        SEDANG PROGRESS
                      </span>
                      <span className="text-xl font-black text-indigo-300 tabular-nums">
                        {totalProgressQty.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[9px] text-indigo-300/80 block mt-0.5 font-bold">Di Tangan Penjahit</span>
                    </div>

                    {/* Sisa Belum Setor */}
                    <div className="bg-slate-800/90 rounded-lg p-3 border border-slate-700/80">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                        SISA BELUM SETOR
                      </span>
                      <span className={`text-xl font-black tabular-nums ${totalRemainingQty > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                        {totalRemainingQty.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5 font-bold">PCS Sisa Target</span>
                    </div>
                  </div>

                  {/* Progress Bar Visual (Item 10) */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[10px] font-bold">
                      <span className="text-slate-400">Tingkat Penyelesaian Setoran Fisik</span>
                      <span className="text-emerald-400 font-black">
                        {totalSubmittedQty} / {totalTargetQty} pcs ({overallProgressPercent.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-700">
                      <div
                        className={`h-full rounded-full transition-all ${
                          overallProgressPercent >= 100
                            ? 'bg-emerald-500'
                            : overallProgressPercent >= 50
                            ? 'bg-indigo-500'
                            : overallProgressPercent > 0
                            ? 'bg-amber-500'
                            : 'bg-slate-700'
                        }`}
                        style={{ width: `${Math.min(100, overallProgressPercent)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Status Kesesuaian Kuantitas */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[10px] font-bold uppercase">Status Selisih PO:</span>
                    {totalVarianceQty === 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-black text-[11px]">
                        <CheckCircle2 size={13} /> SELISIH: 0 PCS (Akurat & Sesuai Target)
                      </span>
                    ) : totalVarianceQty > 0 ? (
                      <span className="inline-flex items-center gap-1 text-rose-400 font-black text-[11px]">
                        <AlertTriangle size={13} /> TERDAPAT SETOR LEBIH (+{totalVarianceQty} PCS)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-black text-[11px]">
                        <AlertCircle size={13} /> SISA TARGET ({Math.abs(totalVarianceQty)} PCS)
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold">
                    Penjahit Terlibat: <span className="text-white font-black">{tailorContributions.length} Orang</span>
                  </div>
                </div>
              </div>
            </div>

            {/* VALIDATION WARNING ALERT (ITEM 20) */}
            {discrepancyItems.length > 0 && (
              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 no-break">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                      ⚠ DITEMUKAN DATA TIDAK SESUAI / PERHATIAN SELISIH KUANTITAS
                    </h4>
                    <p className="text-[11px] text-rose-800 mt-1 font-medium leading-relaxed">
                      Sistem mendeteksi adanya ketidakcocokan kuantitas pada laporan ini. Harap periksa rincian pada tabel analisis selisih di bagian bawah laporan sebelum memvalidasi dokumen secara resmi.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. INFORMASI PRODUK / ITEM PO (DENGAN FOTO PRODUK) */}
            <div className="no-break space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Layers size={14} className="text-indigo-600" /> 3. Daftar Produk & Rincian Item PO
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Total {relevantItems.length} Variasi Item
                </span>
              </div>

              {/* Table of items */}
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                    <tr>
                      <th className="w-8 text-center">No</th>
                      <th className="w-20 text-center">Foto</th>
                      <th>Kode & Nama Produk</th>
                      <th>Warna</th>
                      <th>Size</th>
                      <th className="text-right">Qty Awal (Order)</th>
                      <th className="text-right">Qty Diambil</th>
                      <th className="text-right">Qty Disetor</th>
                      <th className="text-right">Sisa Target</th>
                      <th className="w-24 text-center">Progress</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {itemsWithDetails.map((item, idx) => {
                      const itemPhoto = po.photoData;
                      return (
                        <tr key={item.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="text-center font-bold text-slate-500">{item.indexNumber}</td>
                          <td className="p-2 text-center">
                            {itemPhoto ? (
                              <div className="w-14 h-14 mx-auto rounded-lg overflow-hidden border border-slate-300 bg-slate-100">
                                <img
                                  src={itemPhoto}
                                  alt={item.itemName}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-14 h-14 mx-auto rounded-lg border border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-300">
                                <ImageIcon size={18} />
                                <span className="text-[8px] font-bold mt-1 text-slate-400">Tidak Ada Foto</span>
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="font-black text-slate-900 uppercase">{item.itemName}</div>
                            <div className="text-[9px] text-slate-400 font-mono mt-0.5">#ITM-{item.id || idx + 1}</div>
                          </td>
                          <td className="uppercase font-bold text-slate-700">{item.color}</td>
                          <td className="font-bold text-slate-700">
                            <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-black border border-slate-200">
                              {item.size}
                            </span>
                          </td>
                          <td className="text-right font-black text-slate-900 tabular-nums">
                            {item.qty.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-400">pcs</span>
                          </td>
                          <td className="text-right font-bold text-indigo-700 tabular-nums">
                            {item.qtyTaken.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-400">pcs</span>
                          </td>
                          <td className="text-right font-black text-emerald-700 tabular-nums">
                            {item.qtySubmitted.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-400">pcs</span>
                          </td>
                          <td className="text-right font-bold tabular-nums text-slate-600">
                            {item.qtySisa.toLocaleString('id-ID')} <span className="text-[9px] font-normal text-slate-400">pcs</span>
                          </td>
                          <td className="p-2">
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-800 tabular-nums mb-1">
                                {item.progressPercent.toFixed(0)}%
                              </span>
                              <div className="w-16 bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    item.progressPercent >= 100
                                      ? 'bg-emerald-500'
                                      : item.progressPercent > 50
                                      ? 'bg-indigo-500'
                                      : item.progressPercent > 0
                                      ? 'bg-amber-500'
                                      : 'bg-slate-300'
                                  }`}
                                  style={{ width: `${Math.min(100, item.progressPercent)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                              item.status === 'Selesai'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : item.status === 'Setor Lebih'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : item.status === 'Sedang Produksi'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-[11px]">
                    <tr>
                      <td colSpan={5} className="text-right uppercase px-3 py-2">Total Kuantitas Keseluruhan:</td>
                      <td className="text-right tabular-nums px-3 py-2 text-slate-950 font-black">
                        {totalTargetQty.toLocaleString('id-ID')} pcs
                      </td>
                      <td className="text-right tabular-nums px-3 py-2 text-indigo-700">
                        {totalTakenQty.toLocaleString('id-ID')} pcs
                      </td>
                      <td className="text-right tabular-nums px-3 py-2 text-emerald-700 font-black">
                        {totalSubmittedQty.toLocaleString('id-ID')} pcs
                      </td>
                      <td className="text-right tabular-nums px-3 py-2 text-slate-700">
                        {totalRemainingQty.toLocaleString('id-ID')} pcs
                      </td>
                      <td className="text-center font-black tabular-nums text-emerald-700">
                        {overallProgressPercent.toFixed(1)}%
                      </td>
                      <td className="text-center text-[10px] uppercase font-black">
                        {computedPOStatus}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* 13. TABEL DETAIL RELASI PRODUK + PENJAHIT (ITEM 13) */}
            <div className="no-break space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Scissors size={14} className="text-indigo-600" /> 4. Tabel Relasi Rincian Produk & Pembagian Kerja Penjahit
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Mapping Item vs Penjahit
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                    <tr>
                      <th>Nama Item / Spesifikasi</th>
                      <th>Nama Penjahit</th>
                      <th>Bagian Jahit</th>
                      <th className="text-right">Qty Diambil</th>
                      <th className="text-right">Qty Disetor</th>
                      <th className="text-right">Sisa</th>
                      <th className="text-center">Progress</th>
                      <th className="text-right">Selisih</th>
                      <th className="text-center">Status Pengerjaan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {itemsWithDetails.flatMap(item => {
                      if (item.tailors.length === 0) {
                        return [(
                          <tr key={`empty-${item.id}`} className="bg-slate-50/50">
                            <td className="font-bold text-slate-800">
                              {item.itemName} ({item.color}, {item.size})
                            </td>
                            <td colSpan={8} className="text-slate-400 italic text-[11px] text-center py-2.5">
                              Belum ada penjahit yang mengambil pengerjaan untuk item ini.
                            </td>
                          </tr>
                        )];
                      }

                      return item.tailors.map((t, tIdx) => (
                        <tr key={`${item.id}-${t.tailorId}-${tIdx}`} className="hover:bg-slate-50/80">
                          {tIdx === 0 ? (
                            <td rowSpan={item.tailors.length} className="font-black text-slate-900 border-r border-slate-200 bg-white align-top p-2.5">
                              <div className="uppercase">{item.itemName}</div>
                              <div className="text-[9px] text-slate-500 font-normal mt-0.5">
                                {item.color} | Size: {item.size}
                              </div>
                              <div className="text-[9px] font-black text-indigo-600 mt-1">
                                Target: {item.qty} pcs
                              </div>
                            </td>
                          ) : null}
                          <td className="font-black text-slate-800 uppercase p-2.5">
                            {t.tailorName}
                          </td>
                          <td className="p-2.5">
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {t.assignedPart}
                            </span>
                          </td>
                          <td className="text-right font-bold text-slate-800 tabular-nums p-2.5">
                            {t.qtyTaken} pcs
                          </td>
                          <td className="text-right font-black text-emerald-700 tabular-nums p-2.5">
                            {t.qtySubmitted} pcs
                          </td>
                          <td className="text-right font-bold text-slate-600 tabular-nums p-2.5">
                            {t.sisa} pcs
                          </td>
                          <td className="text-center font-black tabular-nums text-slate-800 p-2.5">
                            {t.progressPercent.toFixed(0)}%
                          </td>
                          <td className="text-right font-black tabular-nums p-2.5">
                            {t.selisih === 0 ? (
                              <span className="text-emerald-600">0</span>
                            ) : t.selisih < 0 ? (
                              <span className="text-rose-600">+{Math.abs(t.selisih)} (Lebih)</span>
                            ) : (
                              <span className="text-amber-600">-{t.selisih} (Kurang)</span>
                            )}
                          </td>
                          <td className="text-center p-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                              t.status === 'SELESAI / SESUAI'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : t.status === 'SETOR LEBIH'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : t.status.includes('PROGRESS')
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 5. DETAIL PENJAHIT YANG BERKONTRIBUSI & 7. REKAP KONTRIBUSI */}
            <div className="no-break space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <User size={14} className="text-indigo-600" /> 5. Rekapitulasi Kontribusi Seluruh Penjahit
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {tailorContributions.length} Orang Terdaftar
                </span>
              </div>

              {tailorContributions.length === 0 ? (
                <div className="text-center py-6 border border-slate-200 border-dashed rounded-xl bg-slate-50 text-slate-400 font-medium text-xs">
                  Belum ada penjahit yang mengambil potongan kain atau menyetorkan hasil jahit untuk PO ini.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider">
                      <tr>
                        <th className="w-8 text-center">No</th>
                        <th>Nama Lengkap Penjahit</th>
                        <th className="text-center">Jml Item</th>
                        <th className="text-right">Qty Diambil</th>
                        <th className="text-right">Qty Awal (Target)</th>
                        <th className="text-right">Qty Disetor</th>
                        <th className="w-28 text-center">Progress (%)</th>
                        <th className="text-right">Selisih</th>
                        <th className="text-center">Status Penjahit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {tailorContributions.map((t, idx) => (
                        <tr key={`tc-${t.tailorId ?? 't'}-${idx}`} className="hover:bg-slate-50/80">
                          <td className="text-center font-bold text-slate-500">{idx + 1}</td>
                          <td>
                            <div className="font-black text-slate-900 uppercase">
                              {t.name} {t.partnerName ? `& ${t.partnerName}` : ''}
                            </div>
                            {t.phone && (
                              <div className="text-[9px] text-slate-400">Kontak: {t.phone}</div>
                            )}
                          </td>
                          <td className="text-center font-bold text-slate-600">
                            {t.itemCount} Item
                          </td>
                          <td className="text-right font-bold text-slate-800 tabular-nums">
                            {t.qtyTaken.toLocaleString('id-ID')} pcs
                          </td>
                          <td className="text-right font-bold text-slate-800 tabular-nums">
                            {t.qtyAwal.toLocaleString('id-ID')} pcs
                          </td>
                          <td className="text-right font-black text-emerald-700 tabular-nums">
                            {t.qtySubmitted.toLocaleString('id-ID')} pcs
                          </td>
                          <td className="p-2">
                            <div className="flex flex-col items-center">
                              <span className="text-[10px] font-black text-slate-800 tabular-nums mb-1">
                                {t.progressPercent.toFixed(0)}%
                              </span>
                              <div className="w-20 bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div
                                  className={`h-full ${
                                    t.status === 'SELESAI'
                                      ? 'bg-emerald-500'
                                      : t.status === 'SETOR LEBIH'
                                      ? 'bg-rose-500'
                                      : t.progressPercent > 0
                                      ? 'bg-amber-500'
                                      : 'bg-slate-300'
                                  }`}
                                  style={{ width: `${Math.min(100, t.progressPercent)}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="text-right font-black tabular-nums">
                            {t.selisih === 0 ? (
                              <span className="text-emerald-600">0 pcs</span>
                            ) : t.selisih < 0 ? (
                              <span className="text-rose-600 font-black">+{Math.abs(t.selisih)} pcs (Lebih)</span>
                            ) : (
                              <span className="text-amber-600 font-black">-{t.selisih} pcs (Kurang)</span>
                            )}
                          </td>
                          <td className="text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${
                              t.status === 'SELESAI'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                : t.status === 'SETOR LEBIH'
                                ? 'bg-rose-50 text-rose-700 border-rose-300'
                                : t.status === 'PROGRESS'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-slate-100 text-slate-600 border-slate-300'
                            }`}>
                              {t.status === 'SELESAI' ? 'SELESAI / SESUAI' : t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-300 text-[11px]">
                      <tr>
                        <td colSpan={3} className="text-right uppercase px-3 py-2">Total Akumulasi Seluruh Penjahit:</td>
                        <td className="text-right tabular-nums px-3 py-2">
                          {tailorContributions.reduce((s, x) => s + x.qtyTaken, 0).toLocaleString('id-ID')} pcs
                        </td>
                        <td className="text-right tabular-nums px-3 py-2">
                          {tailorContributions.reduce((s, x) => s + x.qtyAwal, 0).toLocaleString('id-ID')} pcs
                        </td>
                        <td className="text-right tabular-nums px-3 py-2 text-emerald-700 font-black">
                          {tailorContributions.reduce((s, x) => s + x.qtySubmitted, 0).toLocaleString('id-ID')} pcs
                        </td>
                        <td className="text-center tabular-nums px-3 py-2 text-indigo-700 font-black">
                          {tailorContributions.length > 0
                            ? (
                                tailorContributions.reduce((s, x) => s + x.progressPercent, 0) /
                                tailorContributions.length
                              ).toFixed(1)
                            : 0}
                          % Rata-rata
                        </td>
                        <td className="text-right tabular-nums px-3 py-2 font-black">
                          {(() => {
                            const totalS = tailorContributions.reduce((s, x) => s + x.selisih, 0);
                            if (totalS === 0) return <span className="text-emerald-700">0 pcs</span>;
                            if (totalS < 0) return <span className="text-rose-600">+{Math.abs(totalS)} pcs</span>;
                            return <span className="text-amber-600">-{totalS} pcs</span>;
                          })()}
                        </td>
                        <td className="text-center text-[10px] uppercase font-black text-slate-600">
                          {tailorContributions.filter(t => t.status === 'SELESAI').length}/{tailorContributions.length} Selesai
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* 7. Highlight Statistik Penjahit */}
              {tailorContributions.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                      Jumlah Penjahit Terlibat
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {tailorContributions.length} Orang
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {tailorContributions.filter(t => t.status === 'SELESAI').length} penjahit telah menuntaskan seluruh tanggung jawab.
                    </p>
                  </div>

                  {topTailor && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5 flex items-center gap-1">
                        <TrendingUp size={12} /> Progress Tertinggi
                      </span>
                      <span className="text-base font-black text-emerald-950 uppercase truncate block">
                        {topTailor.name}
                      </span>
                      <p className="text-[10px] text-emerald-700 font-bold mt-0.5">
                        {topTailor.qtySubmitted} / {topTailor.qtyAwal} pcs ({topTailor.progressPercent.toFixed(0)}%)
                      </p>
                    </div>
                  )}

                  {lowestTailor && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 block mb-0.5">
                        Progress Terendah / Masih Berjalan
                      </span>
                      <span className="text-base font-black text-amber-950 uppercase truncate block">
                        {lowestTailor.name}
                      </span>
                      <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                        {lowestTailor.qtySubmitted} / {lowestTailor.qtyAwal} pcs ({lowestTailor.progressPercent.toFixed(0)}%)
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 9. ANALISIS SELISIH QUANTITY (ITEM 9) */}
            <div className="no-break space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <AlertCircle size={14} className="text-indigo-600" /> 6. Analisis Selisih Quantity (Discrepancy Analysis)
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Audit & Kontrol
                </span>
              </div>

              {discrepancyItems.length === 0 ? (
                <div className="bg-emerald-50/80 border-2 border-emerald-200 rounded-xl p-4 text-emerald-900 flex items-center gap-3">
                  <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-800">
                      ✓ Quantity Sesuai & Tepat
                    </h4>
                    <p className="text-[11px] font-medium text-emerald-700 mt-0.5 leading-relaxed">
                      Tidak ditemukan selisih antara kuantitas awal yang diambil dan kuantitas setoran yang diterima. Seluruh alur pekerjaan tercatat presisi.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="overflow-x-auto border border-rose-200 rounded-xl">
                    <table className="w-full text-left text-xs bg-rose-50/30">
                      <thead className="bg-rose-100/70 text-rose-900 text-[10px] font-black uppercase tracking-wider">
                        <tr>
                          <th>Item / Pihak Terkait</th>
                          <th>Keterangan Masalah</th>
                          <th className="text-right">Qty Awal</th>
                          <th className="text-right">Qty Setor</th>
                          <th className="text-right">Selisih</th>
                          <th className="text-center">Status Audit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100 font-medium">
                        {discrepancyItems.map((issue, i) => (
                          <tr key={i} className="hover:bg-rose-50/80">
                            <td className="font-black text-slate-900 p-2.5">
                              {issue.title}
                            </td>
                            <td className="text-slate-600 text-[11px] p-2.5">
                              {issue.detail}
                            </td>
                            <td className="text-right font-bold text-slate-700 tabular-nums p-2.5">
                              {issue.qtyAwal} pcs
                            </td>
                            <td className="text-right font-black text-slate-900 tabular-nums p-2.5">
                              {issue.qtySetor} pcs
                            </td>
                            <td className="text-right font-black text-rose-600 tabular-nums p-2.5">
                              {issue.selisih} pcs
                            </td>
                            <td className="text-center p-2.5">
                              <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white shadow-sm">
                                {issue.statusText}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-slate-500 italic">
                    * Catatan untuk admin/supervisor: Jika terjadi status "SETOR LEBIH", lakukan verifikasi ulang apakah ada kesalahan input nomor nota setoran atau penjahit mengerjakan sisa kain lebih.
                  </p>
                </div>
              )}
            </div>

            {/* 14. KESIMPULAN LAPORAN (ITEM 14) */}
            <div className="no-break bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                7. Kesimpulan & Rekomendasi Laporan
              </span>
              <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                {conclusionText}
              </p>
            </div>

            {/* 15. TANDA TANGAN / PENGESAHAN (ITEM 15) */}
            <div className="no-break pt-4 border-t-2 border-slate-900">
              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                {/* Dibuat Oleh */}
                <div className="space-y-12">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      Dibuat Oleh:
                    </span>
                    <span className="font-bold text-slate-600 text-[11px]">
                      Admin Administrasi Produksi
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="w-36 mx-auto border-b-2 border-slate-900 pb-0.5">
                      <span className="font-black text-slate-900 uppercase text-xs">
                        {currentUsername || 'Administrator'}
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 block">
                      Tgl: {new Date().toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Diperiksa Oleh */}
                <div className="space-y-12">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      Diperiksa Oleh:
                    </span>
                    <span className="font-bold text-slate-600 text-[11px]">
                      Supervisor / Quality Control
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="w-36 mx-auto border-b-2 border-slate-900 pb-0.5">
                      <span className="text-slate-300 font-bold italic text-xs">
                        ( .................................... )
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 block">
                      Tgl: ____ / ____ / ________
                    </span>
                  </div>
                </div>

                {/* Disetujui Oleh */}
                <div className="space-y-12">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                      Disetujui Oleh:
                    </span>
                    <span className="font-bold text-slate-600 text-[11px]">
                      Pimpinan / Pemilik Garment
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="w-36 mx-auto border-b-2 border-slate-900 pb-0.5">
                      <span className="text-slate-300 font-bold italic text-xs">
                        ( .................................... )
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-400 block">
                      Tgl: ____ / ____ / ________
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 16. FOOTER DOKUMEN (ITEM 16) */}
            <div className="no-break pt-4 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest gap-2">
              <span>{companyName} &bull; SISTEM MANAJEMEN GARMENT</span>
              <span>NOMOR PO: #{po.poNumber} &bull; DOKUMEN INTERNAL PRODUKSI</span>
              <span>DICETAK: {new Date().toLocaleDateString('id-ID')} {new Date().toLocaleTimeString('id-ID')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
