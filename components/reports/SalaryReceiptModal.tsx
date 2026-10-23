import React, { useRef, useMemo, useState } from 'react';
import { 
  Printer, 
  X, 
  CheckCircle2, 
  Calendar, 
  User, 
  Scissors, 
  Wallet, 
  PiggyBank, 
  Receipt, 
  Sparkles, 
  Building2, 
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Download,
  Image as ImageIcon,
  Camera,
  Layers,
  Copy,
  Check,
  Loader2,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { toJpeg, toPng } from 'html-to-image';
import { 
  Tailor, 
  SewingSubmission, 
  SewingJob, 
  PO, 
  POItem, 
  getSubmissionNominalQty,
  getSubmissionReceiptQty
} from '@/lib/db';

interface SalaryReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  tailorId: number;
  tailorName: string;
  stats: any;
  subs: SewingSubmission[];
  jobs: SewingJob[];
  pos: PO[];
  poItems: POItem[];
  tailors: Tailor[];
  companyName?: string;
  currentUsername?: string;
  onProceedPay?: () => void;
}

// Helper Terbilang Bahasa Indonesia
function terbilangAngka(n: number): string {
  if (n === 0) return 'Nol';
  if (n < 0) return 'Minus ' + terbilangAngka(Math.abs(n));
  const bilangan = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'];
  n = Math.floor(n);
  if (n < 12) return bilangan[n];
  if (n < 20) return terbilangAngka(n - 10) + ' Belas';
  if (n < 100) return terbilangAngka(Math.floor(n / 10)) + ' Puluh ' + (n % 10 !== 0 ? ' ' + bilangan[n % 10] : '');
  if (n < 200) return 'Seratus ' + (n % 100 !== 0 ? ' ' + terbilangAngka(n % 100) : '');
  if (n < 1000) return terbilangAngka(Math.floor(n / 100)) + ' Ratus ' + (n % 100 !== 0 ? ' ' + terbilangAngka(n % 100) : '');
  if (n < 2000) return 'Seribu ' + (n % 1000 !== 0 ? ' ' + terbilangAngka(n % 1000) : '');
  if (n < 1000000) return terbilangAngka(Math.floor(n / 1000)) + ' Ribu ' + (n % 1000 !== 0 ? ' ' + terbilangAngka(n % 1000) : '');
  if (n < 1000000000) return terbilangAngka(Math.floor(n / 1000000)) + ' Juta ' + (n % 1000000 !== 0 ? ' ' + terbilangAngka(n % 1000000) : '');
  if (n < 1000000000000) return terbilangAngka(Math.floor(n / 1000000000)) + ' Milyar ' + (n % 1000000000 !== 0 ? ' ' + terbilangAngka(n % 1000000000) : '');
  return '';
}

export function formatTerbilangRupiah(amount: number): string {
  const words = terbilangAngka(amount).trim();
  return words ? `${words} Rupiah` : 'Nol Rupiah';
}

export default function SalaryReceiptModal({
  isOpen,
  onClose,
  tailorId,
  tailorName,
  stats,
  subs,
  jobs,
  pos,
  poItems,
  tailors,
  companyName = 'GARMENT & KONFEKSI PRODUCTION',
  currentUsername = 'Administrator',
  onProceedPay
}: SalaryReceiptModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const multiPagePrintRef = useRef<HTMLDivElement>(null);

  const [isGeneratingPhoto, setIsGeneratingPhoto] = useState(false);
  const [photoProgressText, setPhotoProgressText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedClipboard, setCopiedClipboard] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'multipage'>('single');
  const [activePage, setActivePage] = useState(1);

  const tailor = useMemo(() => {
    return tailors.find(t => t.id === tailorId);
  }, [tailors, tailorId]);

  // Compute detailed work submissions during this week
  const detailedWorkItems = useMemo(() => {
    return subs.map((s, index) => {
      const job = jobs.find(j => j.id === s.jobId);
      const item = poItems.find(i => i.id === job?.poItemId);
      const po = pos.find(p => p.id === item?.poId);

      const poNumber = po?.poNumber || (job?.productionNumber ? `#${job.productionNumber}` : 'PO-Manual');
      const poCustomer = po?.customerName || po?.description || '';
      const poLabel = poCustomer ? `${poNumber} (${poCustomer})` : poNumber;
      const itemName = item?.itemName || 'Item Jahit';
      const color = item?.color || '';
      const size = item?.size || '';
      const partType = s.partType || job?.assignedPart || 'Set';
      const partLabel = partType !== 'Set' ? `[${partType}]` : '';
      const itemDesc = `${itemName}${color ? ` • ${color}` : ''}${size ? ` (${size})` : ''} ${partLabel}`.trim();

      const qty = getSubmissionNominalQty(s);
      const nominalQty = getSubmissionNominalQty(s);
      const wageTotal = Number(s.wageTotal) || 0;
      const rate = qty > 0 ? Math.round(wageTotal / qty) : (Number(job?.wagePerPcs) || 0);

      const dateStr = s.dateSubmitted 
        ? new Date(s.dateSubmitted).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })
        : '-';

      return {
        no: index + 1,
        id: s.id,
        dateSubmitted: s.dateSubmitted,
        dateStr,
        poNumber,
        poCustomer,
        poLabel,
        itemName,
        itemDesc,
        partType,
        qty,
        nominalQty,
        rate,
        wageTotal
      };
    });
  }, [subs, jobs, pos, poItems]);

  // Aggregate work per PO for summary
  const poSummaries = useMemo(() => {
    const map = new Map<string, {
      poLabel: string;
      itemDesc: string;
      totalQty: number;
      rate: number;
      totalWage: number;
      count: number;
    }>();

    detailedWorkItems.forEach(w => {
      const key = `${w.poLabel}___${w.itemDesc}___${w.rate}`;
      if (!map.has(key)) {
        map.set(key, {
          poLabel: w.poLabel,
          itemDesc: w.itemDesc,
          totalQty: 0,
          rate: w.rate,
          totalWage: 0,
          count: 0
        });
      }
      const cur = map.get(key)!;
      cur.totalQty += w.qty;
      cur.totalWage += w.wageTotal;
      cur.count += 1;
    });

    return Array.from(map.values());
  }, [detailedWorkItems]);

  // Week period text from submission dates
  const weekPeriodText = useMemo(() => {
    const dates = subs
      .map(s => s.dateSubmitted)
      .filter(Boolean)
      .map(d => new Date(d).getTime())
      .sort((a, b) => a - b);

    if (dates.length === 0) return 'Minggu Berjalan';
    const minDate = new Date(dates[0]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const maxDate = new Date(dates[dates.length - 1]).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    return minDate === maxDate ? minDate : `${minDate} s/d ${maxDate}`;
  }, [subs]);

  // Receipt reference number
  const receiptNo = useMemo(() => {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return `KW-${ymd}-${String(tailorId).padStart(3, '0')}`;
  }, [tailorId]);

  const totalSubmittedQty = useMemo(() => {
    return detailedWorkItems.reduce((s, w) => s + w.qty, 0);
  }, [detailedWorkItems]);

  // Pagination calculation for very large submissions (jika setoran sangat banyak)
  const ITEMS_PER_PAGE = 14;
  const isLargeSetoran = detailedWorkItems.length > ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(detailedWorkItems.length / ITEMS_PER_PAGE));

  const pagesData = useMemo(() => {
    const pages = [];
    for (let p = 1; p <= totalPages; p++) {
      const start = (p - 1) * ITEMS_PER_PAGE;
      const end = Math.min(start + ITEMS_PER_PAGE, detailedWorkItems.length);
      const items = detailedWorkItems.slice(start, end);
      const subtotalQty = items.reduce((s, w) => s + w.qty, 0);
      const subtotalWage = items.reduce((s, w) => s + w.wageTotal, 0);
      pages.push({
        pageNumber: p,
        items,
        startIdx: start + 1,
        endIdx: end,
        subtotalQty,
        subtotalWage,
        isFirstPage: p === 1,
        isLastPage: p === totalPages,
      });
    }
    return pages;
  }, [detailedWorkItems, totalPages]);

  const currentPageData = useMemo(() => {
    return pagesData[activePage - 1] || pagesData[0];
  }, [pagesData, activePage]);

  // Capture element to high-res image (JPEG/PNG) without any cutoffs
  const captureNode = async (node: HTMLElement, format: 'jpeg' | 'png' = 'jpeg') => {
    // Target receipt canvas width for crisp, high-resolution photo with ample room for all columns
    const targetWidth = 920;

    // Create an invisible off-screen sandbox host attached to document.body
    // Critical: do NOT use position: fixed with left: -99999px because SVG foreignObject in html-to-image
    // renders elements at negative x-coordinates off-canvas or clipped!
    // Instead, place it at top: 0, left: 0 inside an invisible layer (z-index: -9999) behind the page.
    const sandboxHost = document.createElement('div');
    sandboxHost.id = 'salary-receipt-sandbox-host';
    sandboxHost.style.position = 'fixed';
    sandboxHost.style.top = '0';
    sandboxHost.style.left = '0';
    sandboxHost.style.width = `${targetWidth}px`;
    sandboxHost.style.maxWidth = `${targetWidth}px`;
    sandboxHost.style.zIndex = '-9999';
    sandboxHost.style.pointerEvents = 'none';
    sandboxHost.style.opacity = '1';
    sandboxHost.style.visibility = 'visible';
    sandboxHost.style.overflow = 'hidden';
    sandboxHost.style.backgroundColor = '#ffffff';

    // Clone the receipt node into the host
    const clone = node.cloneNode(true) as HTMLElement;
    clone.id = 'salary-receipt-capture-target';
    clone.style.width = `${targetWidth}px`;
    clone.style.minWidth = `${targetWidth}px`;
    clone.style.maxWidth = `${targetWidth}px`;
    clone.style.height = 'auto';
    clone.style.minHeight = 'auto';
    clone.style.maxHeight = 'none';
    clone.style.position = 'relative';
    clone.style.left = '0';
    clone.style.top = '0';
    clone.style.margin = '0';
    clone.style.padding = '32px 32px 48px 32px'; // Extra bottom padding so signatures & footnotes have comfortable room
    clone.style.boxSizing = 'border-box';
    clone.style.borderRadius = '0px';
    clone.style.boxShadow = 'none';
    clone.style.border = 'none';
    clone.style.backgroundColor = '#ffffff';

    sandboxHost.appendChild(clone);
    document.body.appendChild(sandboxHost);

    // Wait briefly for reflow, layout calculations, and fonts
    await new Promise(r => setTimeout(r, 120));

    // Calculate exact rendered content height of the clone with extra safety margin
    const measuredHeight = Math.ceil(
      Math.max(
        clone.scrollHeight,
        clone.offsetHeight,
        clone.getBoundingClientRect().height
      )
    ) + 24;

    try {
      const options = {
        quality: format === 'jpeg' ? 0.98 : undefined,
        pixelRatio: 2, // 2x gives 1840px wide retina resolution
        backgroundColor: '#ffffff',
        cacheBust: true,
        width: targetWidth,
        height: measuredHeight,
        canvasWidth: targetWidth * 2,
        canvasHeight: measuredHeight * 2,
        style: {
          position: 'relative',
          left: '0',
          top: '0',
          margin: '0',
          padding: '32px 32px 48px 32px',
          width: `${targetWidth}px`,
          height: `${measuredHeight}px`,
          boxSizing: 'border-box',
          overflow: 'visible',
          transform: 'none',
          borderRadius: '0px',
          boxShadow: 'none',
          backgroundColor: '#ffffff',
        }
      };

      const dataUrl = format === 'jpeg' 
        ? await toJpeg(clone, options) 
        : await toPng(clone, options);

      return dataUrl;
    } finally {
      if (sandboxHost.parentNode) {
        document.body.removeChild(sandboxHost);
      }
    }
  };

  // Unduh 1 Foto Penuh (Semua rincian utuh terlihat tanpa terpotong)
  const downloadReceiptPhoto = async (format: 'jpeg' | 'png' = 'jpeg', pageIndex?: number) => {
    const targetRef = (pageIndex !== undefined && multiPagePrintRef.current) 
      ? multiPagePrintRef.current 
      : printRef.current;

    if (!targetRef) return;
    setIsGeneratingPhoto(true);
    setPhotoProgressText('Merender foto kwitansi resolusi tinggi (bebas terpotong)...');

    try {
      const dataUrl = await captureNode(targetRef, format);
      const ext = format === 'jpeg' ? 'jpg' : 'png';
      const cleanName = tailorName.replace(/\s+/g, '_');
      const suffix = pageIndex ? `_Lembar${pageIndex}` : '';
      const filename = `Kwitansi_Gaji_${cleanName}_${receiptNo}${suffix}.${ext}`;

      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToastMessage(
        pageIndex 
          ? `Foto Lembar ${pageIndex} (${ext.toUpperCase()}) berhasil disimpan!`
          : `Foto Kwitansi (${ext.toUpperCase()}) berhasil disimpan! Seluruh rincian terlihat jelas tanpa terpotong.`
      );
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err) {
      console.error('Failed to generate image:', err);
      alert('Gagal membuat foto kwitansi. Silakan coba kembali atau gunakan Cetak PDF.');
    } finally {
      setIsGeneratingPhoto(false);
      setPhotoProgressText('');
    }
  };

  // Unduh Semua Lembar Sekaligus (Jika setoran sangat banyak)
  const downloadAllPagesAsPhotos = async (format: 'jpeg' | 'png' = 'jpeg') => {
    if (!isLargeSetoran) {
      return downloadReceiptPhoto(format);
    }
    setIsGeneratingPhoto(true);
    setPhotoProgressText(`Menyiapkan ${totalPages} lembar foto bersambung...`);

    try {
      for (let p = 1; p <= totalPages; p++) {
        setActivePage(p);
        setPhotoProgressText(`Merender Lembar ${p} dari ${totalPages}...`);
        // Wait for DOM update
        await new Promise(r => setTimeout(r, 250));

        if (multiPagePrintRef.current) {
          const dataUrl = await captureNode(multiPagePrintRef.current, format);
          const ext = format === 'jpeg' ? 'jpg' : 'png';
          const cleanName = tailorName.replace(/\s+/g, '_');
          const filename = `Kwitansi_Gaji_${cleanName}_${receiptNo}_Lembar${p}.${ext}`;

          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
        await new Promise(r => setTimeout(r, 350));
      }

      setToastMessage(`Semua ${totalPages} lembar foto kwitansi berhasil diunduh lengkap!`);
      setTimeout(() => setToastMessage(null), 4500);
    } catch (err) {
      console.error('Failed batch download:', err);
      alert('Gagal mengunduh semua lembar foto.');
    } finally {
      setIsGeneratingPhoto(false);
      setPhotoProgressText('');
    }
  };

  // Salin Foto ke Clipboard (bisa langsung Ctrl+V ke WhatsApp)
  const copyPhotoToClipboard = async () => {
    const targetRef = (viewMode === 'multipage' && multiPagePrintRef.current) 
      ? multiPagePrintRef.current 
      : printRef.current;

    if (!targetRef) return;
    setIsGeneratingPhoto(true);
    setPhotoProgressText('Menyalin foto ke clipboard...');

    try {
      const dataUrl = await captureNode(targetRef, 'png');
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        setCopiedClipboard(true);
        setToastMessage('Foto kwitansi berhasil disalin! Anda bisa langsung Paste (Ctrl+V) ke WhatsApp atau Telegram.');
        setTimeout(() => setCopiedClipboard(false), 3000);
        setTimeout(() => setToastMessage(null), 4500);
      } else {
        downloadReceiptPhoto('jpeg');
      }
    } catch (err) {
      console.error('Failed copying to clipboard:', err);
      // Fallback
      downloadReceiptPhoto('jpeg');
    } finally {
      setIsGeneratingPhoto(false);
      setPhotoProgressText('');
    }
  };

  // Buka Pratinjau Foto
  const openPhotoPreview = async () => {
    const targetRef = (viewMode === 'multipage' && multiPagePrintRef.current) 
      ? multiPagePrintRef.current 
      : printRef.current;

    if (!targetRef) return;
    setIsGeneratingPhoto(true);
    setPhotoProgressText('Menyiapkan pratinjau foto...');

    try {
      const dataUrl = await captureNode(targetRef, 'jpeg');
      setPreviewImageUrl(dataUrl);
    } catch (err) {
      console.error('Failed preview photo:', err);
      alert('Gagal membuka pratinjau foto.');
    } finally {
      setIsGeneratingPhoto(false);
      setPhotoProgressText('');
    }
  };

  // Cetak Dokumen via Iframe Tersembunyi (Anti-Popup Blocker & Anti-Cutoff)
  const handlePrint = () => {
    const target = (viewMode === 'multipage' && multiPagePrintRef.current)
      ? multiPagePrintRef.current
      : printRef.current;

    if (!target) return;

    // Gunakan hidden iframe agar proses print tidak diblokir popup blocker dan CSS terisolasi sempurna
    let iframe = document.getElementById('salary-receipt-print-frame') as HTMLIFrameElement | null;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'salary-receipt-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Kwitansi_Gaji_${tailorName.replace(/\s+/g, '_')}_${receiptNo}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @page {
              size: portrait;
              margin: 6mm;
            }
            * {
              box-sizing: border-box !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: #ffffff !important;
              color: #0f172a !important;
              font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
              font-size: 11px !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              width: 100% !important;
            }
            table {
              width: 100% !important;
              table-layout: fixed !important;
              border-collapse: collapse !important;
            }
            th, td {
              overflow-wrap: anywhere !important;
              word-break: break-word !important;
              hyphens: auto !important;
            }
            tr {
              page-break-inside: avoid !important;
            }
            thead {
              display: table-header-group !important;
            }
            tfoot {
              display: table-footer-group !important;
            }
            .salary-receipt-sheet {
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
              width: 100% !important;
              max-width: 100% !important;
            }
          </style>
        </head>
        <body class="p-4 bg-white text-slate-900">
          <div class="w-full">
            ${target.innerHTML}
          </div>
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        iframe?.contentWindow?.focus();
        iframe?.contentWindow?.print();
      } catch {
        window.print();
      }
    }, 400);
  };

  const downloadCSV = () => {
    let csv = `KWITANSI GAJI & BUKTI HASIL KERJA - ${tailorName}\n`;
    csv += `No Kwitansi,${receiptNo}\n`;
    csv += `Periode Kerja,${weekPeriodText}\n\n`;
    csv += `No,Tanggal Setor,No PO,Pelanggan,Model / Item,Bagian,Qty (Pcs),Tarif (Rp),Subtotal (Rp)\n`;
    detailedWorkItems.forEach(item => {
      csv += `${item.no},"${item.dateStr}","${item.poNumber}","${item.poCustomer}","${item.itemName}","${item.partType}",${item.qty},${item.rate},${item.wageTotal}\n`;
    });
    csv += `\nTotal Disetor (Pcs),${totalSubmittedQty}\n`;
    csv += `Total Upah Murni,${stats.totalWage}\n`;
    csv += `Bonus Grade,${stats.bonus}\n`;
    csv += `Potongan Kasbon,${stats.totalKasbon}\n`;
    csv += `Penyesuaian Manual,${stats.totalAdjustment}\n`;
    csv += `Masuk Tabungan,${stats.totalTabungan}\n`;
    csv += `Gaji Bersih Diterima,${stats.netPayment}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Kwitansi_Gaji_${tailorName.replace(/\s+/g, '_')}_${receiptNo}.csv`;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-1 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <style>{`
        @media print {
          @page {
            size: portrait;
            margin: 6mm;
          }
          * {
            box-sizing: border-box !important;
          }
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .salary-receipt-hide-print {
            display: none !important;
          }
          .salary-receipt-modal-container {
            position: absolute !important;
            inset: 0 !important;
            background: white !important;
            z-index: 99999 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            border: none !important;
            box-shadow: none !important;
          }
          .salary-receipt-sheet {
            box-shadow: none !important;
            border: none !important;
            padding: 2mm 4mm !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            overflow: visible !important;
          }
          table {
            width: 100% !important;
            table-layout: fixed !important;
            border-collapse: collapse !important;
          }
          th, td {
            overflow-wrap: anywhere !important;
            word-break: break-word !important;
            hyphens: auto !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
        }
      `}</style>

      <div className="salary-receipt-modal-container bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-5xl h-[98dvh] sm:h-[94vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Top Control Bar */}
        <div className="salary-receipt-hide-print p-3 sm:p-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Receipt size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  Kwitansi Gaji & Bukti Hasil Kerja
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Pra-Bayar / Resmi
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Penerima: <span className="text-white font-bold">{tailorName}</span> • Periode: <span className="text-slate-300 font-semibold">{weekPeriodText}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            
            {/* Action 1: Unduh Foto (JPEG) - Pilihan Utama Pengguna */}
            <div className="flex items-center bg-emerald-600 rounded-xl shadow-lg shadow-emerald-600/20 p-0.5">
              <button
                type="button"
                disabled={isGeneratingPhoto}
                onClick={() => {
                  if (viewMode === 'multipage') {
                    downloadReceiptPhoto('jpeg', activePage);
                  } else {
                    downloadReceiptPhoto('jpeg');
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition-all active:scale-95 disabled:opacity-50"
                title="Unduh kwitansi gaji dalam format Foto JPEG utuh (resolusi tinggi, semua rincian terlihat jelas)"
              >
                {isGeneratingPhoto ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Camera size={15} />
                )}
                <span>{viewMode === 'multipage' ? `Foto Lembar ${activePage} (JPEG)` : 'Foto (JPEG)'}</span>
              </button>

              <button
                type="button"
                disabled={isGeneratingPhoto}
                onClick={() => downloadReceiptPhoto('png', viewMode === 'multipage' ? activePage : undefined)}
                className="px-2 py-1.5 hover:bg-emerald-500/80 text-emerald-100 rounded-lg text-[11px] font-bold border-l border-emerald-700/50"
                title="Unduh versi Foto PNG (lossless)"
              >
                PNG
              </button>
            </div>

            {/* Action 2: Salin Foto ke Clipboard (Bisa langsung Paste ke WhatsApp) */}
            <button
              type="button"
              disabled={isGeneratingPhoto}
              onClick={copyPhotoToClipboard}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Salin foto ke Clipboard untuk langsung di-paste (Ctrl+V) ke WhatsApp"
            >
              {copiedClipboard ? (
                <>
                  <Check size={14} className="text-emerald-400" />
                  <span className="text-emerald-400 hidden sm:inline">Tersalin</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span className="hidden sm:inline">Salin Foto</span>
                </>
              )}
            </button>

            {/* Action 3: Pratinjau Foto */}
            <button
              type="button"
              disabled={isGeneratingPhoto}
              onClick={openPhotoPreview}
              className="hidden md:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              title="Lihat pratinjau hasil foto sebelum diunduh"
            >
              <ImageIcon size={14} />
              <span>Lihat Foto</span>
            </button>

            {/* Action 4: Cetak / Simpan PDF */}
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              title="Cetak kwitansi ke printer fisik atau simpan sebagai PDF resmi"
            >
              <Printer size={15} />
              <span>Cetak / PDF</span>
            </button>

            {/* Action 5: Unduh CSV */}
            <button
              type="button"
              onClick={downloadCSV}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all active:scale-95"
              title="Unduh rincian dalam format spreadsheet CSV/Excel"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>

            {/* Action 6: Lanjut Bayar Sekarang */}
            {onProceedPay && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onProceedPay();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              >
                <ArrowRight size={14} />
                <span className="hidden sm:inline">Lanjut Bayar</span>
              </button>
            )}

            {/* Action 7: Tutup Modal */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1"
              title="Tutup kwitansi"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Status Toast Banner */}
        {toastMessage && (
          <div className="salary-receipt-hide-print bg-emerald-600/20 border-b border-emerald-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-300 font-semibold animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-400 hover:text-white text-xs">
              ✕
            </button>
          </div>
        )}

        {/* Loading Bar when generating photo */}
        {isGeneratingPhoto && (
          <div className="salary-receipt-hide-print bg-indigo-600/20 border-b border-indigo-500/30 px-6 py-2 flex items-center gap-2 text-xs text-indigo-300 font-semibold animate-pulse">
            <Loader2 size={15} className="animate-spin text-indigo-400 shrink-0" />
            <span>{photoProgressText || 'Sedang memproses foto kwitansi resolusi tinggi...'}</span>
          </div>
        )}

        {/* Secondary Bar: Mode Selector & Multi-Page Options (Jika Setoran Sangat Banyak) */}
        {isLargeSetoran && (
          <div className="salary-receipt-hide-print px-4 sm:px-6 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <AlertCircle size={12} /> {detailedWorkItems.length} Catatan Setoran
              </span>
              <span className="text-slate-400 hidden sm:inline text-[11px]">
                Pilih format tampilan & foto yang Anda butuhkan:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Switch View Mode */}
              <div className="inline-flex rounded-xl bg-slate-800 p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={() => setViewMode('single')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'single'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tampilkan seluruh rincian dalam 1 lembar panjang utuh tanpa terpotong"
                >
                  1 Foto Lengkap (Utuh)
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('multipage')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    viewMode === 'multipage'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Bagi setoran ke dalam beberapa lembar foto berurutan"
                >
                  Foto Terbagi ({totalPages} Lembar)
                </button>
              </div>

              {/* Multi-page controls */}
              {viewMode === 'multipage' && (
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center bg-slate-800 rounded-xl px-1 py-0.5 border border-slate-700">
                    {pagesData.map(p => (
                      <button
                        key={p.pageNumber}
                        type="button"
                        onClick={() => setActivePage(p.pageNumber)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                          activePage === p.pageNumber
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Hal {p.pageNumber}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    disabled={isGeneratingPhoto}
                    onClick={() => downloadAllPagesAsPhotos('jpeg')}
                    className="flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                    title="Unduh seluruh lembar foto berurutan (Lembar 1, Lembar 2, dst)"
                  >
                    <Layers size={13} />
                    <span>Unduh Semua ({totalPages} Foto)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Receipt Preview Container */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-950 flex justify-center custom-scrollbar">
          <div className="w-full max-w-4xl flex justify-center">
            
            {/* MODE 1: SINGLE CONTINUOUS PHOTO SHEET (DEFAULT & RECOMMENDED) */}
            {viewMode === 'single' && (
              <div 
                ref={printRef}
                className="salary-receipt-sheet bg-white text-slate-900 shadow-2xl rounded-2xl p-4 sm:p-8 md:p-10 border border-slate-200 w-full max-w-4xl [overflow-wrap:anywhere]"
                style={{ colorScheme: 'light' }}
              >
                {/* 1. Header Kwitansi Resmi */}
                <div className="border-b-4 border-slate-900 pb-5 mb-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md border-2 border-slate-900 shrink-0">
                        KG
                      </div>
                      <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                          {companyName}
                        </h1>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                          Sistem Informasi Manajemen Konfeksi & Penggajian Terpadu
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-600 font-semibold">
                          <span>SLIP KWITANSI PEMBAYARAN UPAH BORONGAN</span>
                          <span>•</span>
                          <span>RESMI LENGKAP</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-black uppercase tracking-widest mb-1">
                        KWITANSI GAJI
                      </div>
                      <p className="text-xs font-mono font-black text-slate-900">
                        NO: {receiptNo}
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Tanggal Cetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Informasi Penerima & Periode Kerja */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Nama Penjahit</span>
                    <span className="font-extrabold text-slate-900 text-sm">{stats.tailorName}</span>
                    {tailor?.productionNumber && (
                      <span className="text-[10px] font-mono text-slate-500 block">No #{tailor.productionNumber}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Status / Tim</span>
                    <span className="font-bold text-slate-800">
                      {tailor?.partnerName ? `Collab: ${tailor.partnerName}` : 'Penjahit Mandiri'}
                    </span>
                    {stats.gradeName !== '-' && (
                      <span className="text-[10px] font-black text-emerald-700 block">Grade {stats.gradeName}</span>
                    )}
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Periode Kerja</span>
                    <span className="font-extrabold text-indigo-700">{weekPeriodText}</span>
                    <span className="text-[10px] text-slate-500 block">Minggu Berjalan</span>
                  </div>

                  <div>
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Total Disetor</span>
                    <span className="font-extrabold text-slate-900 text-sm tabular-nums">
                      {totalSubmittedQty.toLocaleString('id-ID')} pcs
                    </span>
                    <span className="text-[10px] text-slate-500 block">({detailedWorkItems.length} rekaman setoran)</span>
                  </div>
                </div>

                {/* 3. TABEL SELURUH HASIL PENGERJAAN MINGGU ITU */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-4 bg-indigo-600 rounded-full"></div>
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Rincian Seluruh Hasil Pengerjaan Selama Minggu Itu
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      Total {detailedWorkItems.length} Catatan Setoran Lengkap
                    </span>
                  </div>

                  <div className="border border-slate-300 rounded-xl overflow-x-auto sm:overflow-visible shadow-sm custom-scrollbar">
                    <table className="w-full min-w-[550px] sm:min-w-full text-left border-collapse text-xs table-fixed">
                      <thead>
                        <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[10px]">
                          <th className="p-2 text-center w-[4%] shrink-0">No</th>
                          <th className="p-2 w-[12%] whitespace-nowrap">Tgl Setor</th>
                          <th className="p-2 w-[23%] [overflow-wrap:anywhere] break-words">No PO & Pelanggan</th>
                          <th className="p-2 w-[23%] [overflow-wrap:anywhere] break-words">Model / Item</th>
                          <th className="p-2 text-right w-[8%] whitespace-nowrap">Qty</th>
                          <th className="p-2 text-right w-[13%] whitespace-nowrap">Tarif</th>
                          <th className="p-2 text-right w-[17%] whitespace-nowrap">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {detailedWorkItems.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                              Tidak ada rincian setoran pekerjaan yang tercatat.
                            </td>
                          </tr>
                        ) : (
                          detailedWorkItems.map((item, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                              <td className="p-2 text-center font-bold text-slate-400 text-[11px] align-top">
                                {idx + 1}
                              </td>
                              <td className="p-2 align-top whitespace-nowrap">
                                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 leading-tight block whitespace-nowrap">{item.dateStr}</span>
                              </td>
                              <td className="p-2 align-top [overflow-wrap:anywhere] break-words">
                                <span className="font-extrabold text-indigo-700 block text-[11px] leading-tight break-words [overflow-wrap:anywhere]">{item.poNumber}</span>
                                {item.poCustomer && (
                                  <span className="text-[10px] text-slate-500 block break-words [overflow-wrap:anywhere] font-medium leading-tight mt-0.5">{item.poCustomer}</span>
                                )}
                              </td>
                              <td className="p-2 align-top [overflow-wrap:anywhere] break-words">
                                <span className="font-bold text-slate-800 text-[11px] block break-words [overflow-wrap:anywhere] leading-tight">{item.itemName}</span>
                                {item.partType !== 'Set' && (
                                  <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 inline-block mt-0.5 break-words [overflow-wrap:anywhere]">
                                    Bagian: {item.partType}
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-right font-black text-slate-900 tabular-nums align-top whitespace-nowrap">
                                <span className="text-[11px] block leading-tight font-mono whitespace-nowrap">{item.qty.toLocaleString('id-ID')}</span>
                              </td>
                              <td className="p-2 text-right font-semibold text-slate-700 tabular-nums align-top whitespace-nowrap">
                                <span className="text-[10px] sm:text-[11px] block font-mono leading-tight whitespace-nowrap">Rp {item.rate.toLocaleString('id-ID')}</span>
                              </td>
                              <td className="p-2 text-right font-black text-slate-900 tabular-nums align-top whitespace-nowrap">
                                <span className="text-[10px] sm:text-[11px] block font-mono font-black text-indigo-950 leading-tight whitespace-nowrap">Rp {item.wageTotal.toLocaleString('id-ID')}</span>
                              </td>
                            </tr>
                          ))
                        )}

                        {/* Baris Total Hasil Kerja */}
                        <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-xs">
                          <td colSpan={4} className="p-2.5 text-right uppercase tracking-wider text-[10px] text-slate-700 [overflow-wrap:anywhere] break-words">
                            Total Hasil Pengerjaan Minggu Ini:
                          </td>
                          <td className="p-2.5 text-right text-slate-900 tabular-nums font-black whitespace-nowrap">
                            <span className="text-[11px] block leading-tight font-mono whitespace-nowrap">{totalSubmittedQty.toLocaleString('id-ID')} pcs</span>
                          </td>
                          <td className="p-2.5 text-right text-slate-400 whitespace-nowrap">-</td>
                          <td className="p-2.5 text-right text-indigo-800 tabular-nums font-black text-sm whitespace-nowrap">
                            <span className="text-[11px] sm:text-xs font-mono font-black block leading-tight whitespace-nowrap">Rp {stats.totalWage.toLocaleString('id-ID')}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. RINGKASAN PO & REKAPITULASI KEUANGAN GAJI */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  
                  {/* Rangkuman Ringkas per PO */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                      <Scissors size={13} className="text-indigo-600" /> Rangkuman Upah per PO
                    </h3>
                    <div className="space-y-1.5 text-xs">
                      {poSummaries.map((p, pIdx) => (
                        <div key={pIdx} className="bg-white border border-slate-200 rounded-lg p-2 flex justify-between items-center text-[11px]">
                          <div>
                            <span className="font-extrabold text-indigo-700 break-words">{p.poLabel}</span>
                            <span className="text-slate-500 block text-[10px] break-words">{p.itemDesc}</span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-black text-slate-900 block font-mono">Rp {p.totalWage.toLocaleString('id-ID')}</span>
                            <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                              {p.totalQty} pcs × Rp {p.rate.toLocaleString('id-ID')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rincian Komponen Pembayaran & Gaji Bersih */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 flex flex-col justify-between">
                    <div>
                      <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                        <Wallet size={13} className="text-indigo-600" /> Rincian Pembayaran Gaji
                      </h3>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                          <span className="font-medium text-slate-600">Upah Borongan Murni ({stats.totalQty} Set)</span>
                          <span className="font-black text-slate-900 tabular-nums">Rp {stats.totalWage.toLocaleString('id-ID')}</span>
                        </div>

                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200 text-emerald-700">
                          <span className="font-medium">Bonus Grade ({stats.gradeName || '-'})</span>
                          <span className="font-black tabular-nums">+{stats.bonus > 0 ? `Rp ${stats.bonus.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                        </div>

                        {stats.totalAdjustment !== 0 && (
                          <div className={`flex justify-between items-center py-0.5 border-b border-slate-200 ${stats.totalAdjustment > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                            <span className="font-medium">Penyesuaian Manual</span>
                            <span className="font-black tabular-nums">
                              {stats.totalAdjustment > 0 ? '+' : ''}Rp {stats.totalAdjustment.toLocaleString('id-ID')}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200 text-rose-600">
                          <span className="font-medium">Potongan Kasbon Berjalan</span>
                          <span className="font-black tabular-nums">-{stats.totalKasbon > 0 ? `Rp ${stats.totalKasbon.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                        </div>

                        <div className="flex justify-between items-center py-0.5 border-b border-slate-200 text-sky-600">
                          <span className="font-medium">Masuk Tabungan Periode Ini</span>
                          <span className="font-black tabular-nums">+{stats.totalTabungan > 0 ? `Rp ${stats.totalTabungan.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Bersih Box */}
                    <div className="mt-3 pt-2 border-t-2 border-slate-300 flex justify-between items-baseline">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                        Gaji Bersih Diterima:
                      </span>
                      <span className="text-xl font-black text-indigo-700 tabular-nums font-mono">
                        Rp {stats.netPayment.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 5. Terbilang Box */}
                <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 mb-6">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block mb-0.5">
                    Terbilang Jumlah Bersih:
                  </span>
                  <p className="font-bold text-slate-900 text-xs italic capitalize">
                    # {formatTerbilangRupiah(stats.netPayment)} #
                  </p>
                </div>

                {/* 6. Tanda Tangan & Pengesahan */}
                <div className="border-t border-slate-300 pt-5 mt-4" style={{ pageBreakInside: 'avoid' }}>
                  <div className="grid grid-cols-3 gap-6 text-center text-xs">
                    <div>
                      <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Penerima Upah</p>
                      <div className="h-16 flex items-end justify-center">
                        <p className="font-black text-slate-900 underline uppercase">{tailorName}</p>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5">Penjahit</p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Dibayarkan Oleh</p>
                      <div className="h-16 flex items-end justify-center">
                        <p className="font-black text-slate-900 underline uppercase">{currentUsername}</p>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5">Kasir / Bagian Payroll</p>
                    </div>

                    <div>
                      <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Mengetahui</p>
                      <div className="h-16 flex items-end justify-center">
                        <p className="font-black text-slate-900 underline uppercase">Supervisor / Owner</p>
                      </div>
                      <p className="text-[9px] text-slate-400 mt-0.5">Pimpinan Konfeksi</p>
                    </div>
                  </div>
                </div>

                {/* Footnote */}
                <div className="mt-6 pt-3 border-t border-slate-200 text-center">
                  <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">
                    Kwitansi ini diterbitkan secara otomatis sebelum proses bayar sebagai bukti sah penerimaan upah hasil pengerjaan minggu berjalan.
                  </p>
                </div>

              </div>
            )}

            {/* MODE 2: MULTI-PAGE SPLIT PHOTO SHEET (UNTUK SETORAN SANGAT BANYAK) */}
            {viewMode === 'multipage' && (
              <div 
                ref={multiPagePrintRef}
                className="salary-receipt-sheet bg-white text-slate-900 shadow-2xl rounded-2xl p-4 sm:p-8 md:p-10 border border-slate-200 w-full max-w-4xl [overflow-wrap:anywhere]"
                style={{ colorScheme: 'light' }}
              >
                {/* 1. Header Kwitansi Sambungan */}
                <div className="border-b-4 border-slate-900 pb-5 mb-5">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4">
                    <div className="flex items-start gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-xl shadow-md border-2 border-slate-900 shrink-0">
                        KG
                      </div>
                      <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900 leading-none">
                          {companyName}
                        </h1>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                          Sistem Informasi Manajemen Konfeksi & Penggajian Terpadu
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-600 font-semibold">
                          <span>KWITANSI UPAH BORONGAN</span>
                          <span>•</span>
                          <span className="font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            LEMBAR {activePage} DARI {totalPages}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-black uppercase tracking-widest mb-1">
                        KWITANSI GAJI
                      </div>
                      <p className="text-xs font-mono font-black text-slate-900">
                        NO: {receiptNo} (Part {activePage})
                      </p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Tanggal: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Informasi Penjahit Ringkas */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 mb-5 text-xs">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Penjahit</span>
                    <span className="font-extrabold text-slate-900">{stats.tailorName}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Periode</span>
                    <span className="font-bold text-indigo-700">{weekPeriodText}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Setoran Lembar Ini</span>
                    <span className="font-bold text-slate-900">
                      Item #{currentPageData.startIdx} - #{currentPageData.endIdx} ({currentPageData.items.length} item)
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Status Lembar</span>
                    <span className="font-black text-emerald-700">
                      {currentPageData.isLastPage ? 'Lembar Terakhir (Penutup)' : `Bersambung ke Lembar ${activePage + 1}`}
                    </span>
                  </div>
                </div>

                {/* 3. Tabel Setoran Lembar Ini */}
                <div className="mb-6">
                  <div className="border border-slate-300 rounded-xl overflow-x-auto sm:overflow-visible shadow-sm custom-scrollbar">
                    <table className="w-full min-w-[550px] sm:min-w-full text-left border-collapse text-xs table-fixed">
                      <thead>
                        <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[10px]">
                          <th className="p-2 text-center w-[4%] shrink-0">No</th>
                          <th className="p-2 w-[12%] whitespace-nowrap">Tgl Setor</th>
                          <th className="p-2 w-[23%] [overflow-wrap:anywhere] break-words">No PO & Pelanggan</th>
                          <th className="p-2 w-[23%] [overflow-wrap:anywhere] break-words">Model / Item</th>
                          <th className="p-2 text-right w-[8%] whitespace-nowrap">Qty</th>
                          <th className="p-2 text-right w-[13%] whitespace-nowrap">Tarif</th>
                          <th className="p-2 text-right w-[17%] whitespace-nowrap">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {currentPageData.items.map((item, idx) => (
                          <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                            <td className="p-2 text-center font-bold text-slate-400 text-[11px] align-top">
                              {currentPageData.startIdx + idx}
                            </td>
                            <td className="p-2 align-top whitespace-nowrap">
                              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 leading-tight block whitespace-nowrap">{item.dateStr}</span>
                            </td>
                            <td className="p-2 align-top [overflow-wrap:anywhere] break-words">
                              <span className="font-extrabold text-indigo-700 block text-[11px] leading-tight break-words [overflow-wrap:anywhere]">{item.poNumber}</span>
                              {item.poCustomer && (
                                <span className="text-[10px] text-slate-500 block break-words [overflow-wrap:anywhere] font-medium leading-tight mt-0.5">{item.poCustomer}</span>
                              )}
                            </td>
                            <td className="p-2 align-top [overflow-wrap:anywhere] break-words">
                              <span className="font-bold text-slate-800 text-[11px] block break-words [overflow-wrap:anywhere] leading-tight">{item.itemName}</span>
                              {item.partType !== 'Set' && (
                                <span className="text-[9px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 inline-block mt-0.5 break-words [overflow-wrap:anywhere]">
                                  Bagian: {item.partType}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-right font-black text-slate-900 tabular-nums align-top whitespace-nowrap">
                              <span className="text-[11px] block leading-tight font-mono whitespace-nowrap">{item.qty.toLocaleString('id-ID')}</span>
                            </td>
                            <td className="p-2 text-right font-semibold text-slate-700 tabular-nums align-top whitespace-nowrap">
                              <span className="text-[10px] sm:text-[11px] block font-mono leading-tight whitespace-nowrap">Rp {item.rate.toLocaleString('id-ID')}</span>
                            </td>
                            <td className="p-2 text-right font-black text-slate-900 tabular-nums align-top whitespace-nowrap">
                              <span className="text-[10px] sm:text-[11px] block font-mono font-black text-indigo-950 leading-tight whitespace-nowrap">Rp {item.wageTotal.toLocaleString('id-ID')}</span>
                            </td>
                          </tr>
                        ))}

                        {/* Subtotal Lembar Ini */}
                        <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-xs">
                          <td colSpan={4} className="p-2.5 text-right uppercase tracking-wider text-[10px] text-slate-700 [overflow-wrap:anywhere] break-words">
                            Subtotal Hasil Pengerjaan Lembar {activePage}:
                          </td>
                          <td className="p-2.5 text-right text-slate-900 tabular-nums font-black whitespace-nowrap">
                            <span className="text-[11px] block leading-tight font-mono whitespace-nowrap">{currentPageData.subtotalQty.toLocaleString('id-ID')} pcs</span>
                          </td>
                          <td className="p-2.5 text-right text-slate-400 whitespace-nowrap">-</td>
                          <td className="p-2.5 text-right text-indigo-800 tabular-nums font-black text-sm whitespace-nowrap">
                            <span className="text-[11px] sm:text-xs font-mono font-black block leading-tight whitespace-nowrap">Rp {currentPageData.subtotalWage.toLocaleString('id-ID')}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Jika BUKAN Lembar Terakhir: Tampilkan notice bersambung */}
                {!currentPageData.isLastPage && (
                  <div className="p-4 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl text-center mb-6">
                    <p className="text-xs font-bold text-indigo-900">
                      Rincian setoran hasil pengerjaan minggu ini berlanjut pada <span className="font-black underline">Lembar {activePage + 1}</span>.
                    </p>
                    <p className="text-[10px] text-indigo-600 mt-0.5">
                      Ringkasan rekonsiliasi kasbon, tabungan, bonus grade, gaji bersih, dan pengesahan tanda tangan tercantum pada lembar terakhir.
                    </p>
                  </div>
                )}

                {/* Jika LEMBAR TERAKHIR: Tampilkan Grand Total, Rekapitulasi Keuangan, Terbilang, dan Tanda Tangan */}
                {currentPageData.isLastPage && (
                  <>
                    <div className="mb-4 p-3 bg-slate-100 border border-slate-300 rounded-xl flex justify-between items-center text-xs font-black">
                      <span className="uppercase text-slate-700">Total Keseluruhan Hasil Kerja Minggu Ini ({totalSubmittedQty} pcs):</span>
                      <span className="text-base text-indigo-900 font-mono">Rp {stats.totalWage.toLocaleString('id-ID')}</span>
                    </div>

                    {/* Ringkasan Keuangan Gaji */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50">
                        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                          <Scissors size={13} className="text-indigo-600" /> Rangkuman Upah per PO
                        </h3>
                        <div className="space-y-1.5 text-xs">
                          {poSummaries.map((p, pIdx) => (
                            <div key={pIdx} className="bg-white border border-slate-200 rounded-lg p-2 flex justify-between items-center text-[11px]">
                              <div>
                                <span className="font-extrabold text-indigo-700 break-words">{p.poLabel}</span>
                                <span className="text-slate-500 block text-[10px] break-words">{p.itemDesc}</span>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <span className="font-black text-slate-900 block font-mono">Rp {p.totalWage.toLocaleString('id-ID')}</span>
                                <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                                  {p.totalQty} pcs × Rp {p.rate.toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 flex flex-col justify-between">
                        <div>
                          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-2 flex items-center gap-1.5">
                            <Wallet size={13} className="text-indigo-600" /> Rincian Pembayaran Gaji
                          </h3>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between items-center py-0.5 border-b border-slate-200">
                              <span className="font-medium text-slate-600">Upah Borongan Murni ({stats.totalQty} Set)</span>
                              <span className="font-black text-slate-900 tabular-nums">Rp {stats.totalWage.toLocaleString('id-ID')}</span>
                            </div>

                            <div className="flex justify-between items-center py-0.5 border-b border-slate-200 text-emerald-700">
                              <span className="font-medium">Bonus Grade ({stats.gradeName || '-'})</span>
                              <span className="font-black tabular-nums">+{stats.bonus > 0 ? `Rp ${stats.bonus.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                            </div>

                            {stats.totalAdjustment !== 0 && (
                              <div className={`flex justify-between items-center py-0.5 border-b border-slate-200 ${stats.totalAdjustment > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                                <span className="font-medium">Penyesuaian Manual</span>
                                <span className="font-black tabular-nums">
                                  {stats.totalAdjustment > 0 ? '+' : ''}Rp {stats.totalAdjustment.toLocaleString('id-ID')}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-center py-0.5 border-b border-slate-200 text-rose-600">
                              <span className="font-medium">Potongan Kasbon Berjalan</span>
                              <span className="font-black tabular-nums">-{stats.totalKasbon > 0 ? `Rp ${stats.totalKasbon.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                            </div>

                            <div className="flex justify-between items-center py-0.5 border-b border-slate-200 text-sky-600">
                              <span className="font-medium">Masuk Tabungan Periode Ini</span>
                              <span className="font-black tabular-nums">+{stats.totalTabungan > 0 ? `Rp ${stats.totalTabungan.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t-2 border-slate-300 flex justify-between items-baseline">
                          <span className="text-xs font-black uppercase tracking-wider text-slate-800">
                            Gaji Bersih Diterima:
                          </span>
                          <span className="text-xl font-black text-indigo-700 tabular-nums font-mono">
                            Rp {stats.netPayment.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 mb-6">
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 block mb-0.5">
                        Terbilang Jumlah Bersih:
                      </span>
                      <p className="font-bold text-slate-900 text-xs italic capitalize">
                        # {formatTerbilangRupiah(stats.netPayment)} #
                      </p>
                    </div>

                    <div className="border-t border-slate-300 pt-5 mt-4" style={{ pageBreakInside: 'avoid' }}>
                      <div className="grid grid-cols-3 gap-6 text-center text-xs">
                        <div>
                          <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Penerima Upah</p>
                          <div className="h-16 flex items-end justify-center">
                            <p className="font-black text-slate-900 underline uppercase">{tailorName}</p>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5">Penjahit</p>
                        </div>

                        <div>
                          <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Dibayarkan Oleh</p>
                          <div className="h-16 flex items-end justify-center">
                            <p className="font-black text-slate-900 underline uppercase">{currentUsername}</p>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5">Kasir / Bagian Payroll</p>
                        </div>

                        <div>
                          <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Mengetahui</p>
                          <div className="h-16 flex items-end justify-center">
                            <p className="font-black text-slate-900 underline uppercase">Supervisor / Owner</p>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-0.5">Pimpinan Konfeksi</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Footnote */}
                <div className="mt-6 pt-3 border-t border-slate-200 text-center">
                  <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">
                    Kwitansi Lembar {activePage} dari {totalPages} • Diterbitkan secara otomatis sebelum proses bayar gaji.
                  </p>
                </div>

              </div>
            )}

          </div>
        </div>

      </div>

      {/* POPUP PRATINJAU FOTO RESOLUSI TINGGI */}
      {previewImageUrl && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 px-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ImageIcon size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-white">Pratinjau Foto Kwitansi Gaji</h4>
                  <p className="text-[11px] text-slate-400">Semua rincian hasil kerja terlihat utuh tanpa terpotong</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewImageUrl}
                  download={`Kwitansi_Gaji_${tailorName.replace(/\s+/g, '_')}_${receiptNo}.jpg`}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
                >
                  <Download size={14} />
                  <span>Simpan JPEG</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-950 flex justify-center custom-scrollbar">
              <img
                src={previewImageUrl}
                alt="Pratinjau Foto Kwitansi"
                className="max-w-full h-auto rounded-xl border border-slate-800 shadow-xl object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
