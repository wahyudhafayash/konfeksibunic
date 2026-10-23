import React, { useState, useRef, useMemo } from 'react';
import { 
  Printer, 
  X, 
  FileText, 
  CheckCircle2, 
  Calendar, 
  User, 
  Scissors, 
  Download,
  Building2,
  Wallet,
  PiggyBank,
  TrendingUp,
  Receipt,
  Layers,
  Sparkles,
  ZoomIn,
  ZoomOut,
  Maximize2,
  AlertCircle,
  HelpCircle,
  ChevronRight
} from 'lucide-react';
import { 
  Tailor, 
  SalaryPayment, 
  SewingSubmission, 
  Kasbon, 
  ManualAdjustment, 
  ActiveTabungan,
  GradeRule,
  PO,
  POItem,
  SewingJob,
  getSubmissionNominalQty,
  getSubmissionGradeQty
} from '@/lib/db';

interface SalaryReportPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  tailors: Tailor[];
  submissions: SewingSubmission[];
  salaryPayments: SalaryPayment[];
  kasbons: Kasbon[];
  manualAdjustments: ManualAdjustment[];
  activeTabungan: ActiveTabungan[];
  gradeRules: GradeRule[];
  jobs: SewingJob[];
  pos: PO[];
  poItems: POItem[];
  currentUsername?: string;
  companyName?: string;
}

export interface WorkBreakdownItem {
  poNumber: string;
  poName: string;
  poLabel: string;
  itemName: string;
  itemDescription: string;
  partType: string;
  qty: number;
  rate: number;
  rateFormatted: string;
  subtotal: number;
  subtotalFormatted: string;
  lineText: string;
}

export default function SalaryReportPdfModal({
  isOpen,
  onClose,
  tailors,
  submissions,
  salaryPayments,
  kasbons,
  manualAdjustments,
  activeTabungan,
  gradeRules,
  jobs,
  pos,
  poItems,
  currentUsername = 'Administrator',
  companyName = 'GARMENT & KONFEKSI PRODUCTION'
}: SalaryReportPdfModalProps) {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait'>('landscape');
  const [zoomScale, setZoomScale] = useState<number>(0.92);
  const [reportFilter, setReportFilter] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [selectedTailorFilter, setSelectedTailorFilter] = useState<number | 'all'>('all');
  const [showPoBreakdown, setShowPoBreakdown] = useState<boolean>(true);
  const printContentRef = useRef<HTMLDivElement>(null);

  // Compute Unpaid salary data per tailor
  const tailorSalaryRows = useMemo(() => {
    return tailors
      .filter(t => t.status !== 'Dihapus')
      .map(t => {
        const tJobs = jobs.filter(j => j.tailorId === t.id);
        const tUnpaidSubs = submissions.filter(s => !s.isPaid && tJobs.some(j => j.id === s.jobId));
        const tPaidSubs = submissions.filter(s => s.isPaid && tJobs.some(j => j.id === s.jobId));
        const unpaidGradeQty = tUnpaidSubs.reduce((sum, s) => sum + getSubmissionGradeQty(s, jobs, poItems, pos), 0);
        const unpaidQty = tUnpaidSubs.reduce((sum, s) => sum + getSubmissionNominalQty(s), 0);
        const unpaidGrossWage = tUnpaidSubs.reduce((sum, s) => sum + (Number(s.wageTotal) || 0), 0);
        const unpaidTabungan = tUnpaidSubs.reduce((sum, s) => sum + (Number(s.tabunganTotal) || 0), 0);

        // Helper to aggregate work breakdown per PO, Item, Part & Rate
        const buildWorkItems = (subsList: SewingSubmission[]): WorkBreakdownItem[] => {
          const map = new Map<string, {
            poNumber: string;
            poName: string;
            itemName: string;
            partType: string;
            qty: number;
            wageTotal: number;
            rate: number;
          }>();

          subsList.forEach(s => {
            const job = jobs.find(j => j.id === s.jobId);
            const item = poItems.find(i => i.id === job?.poItemId);
            const po = pos.find(p => p.id === item?.poId);

            const poNumber = po?.poNumber || (job?.productionNumber ? `#${job.productionNumber}` : 'PO-Manual');
            const poName = po?.customerName || po?.description || '';
            const itemName = item?.itemName || 'Item Jahit';
            const partType = s.partType || job?.assignedPart || 'Set';
            const qty = getSubmissionNominalQty(s);
            const wageTotal = Number(s.wageTotal) || 0;
            const rate = qty > 0 ? Math.round(wageTotal / qty) : (Number(job?.wagePerPcs) || 0);

            const key = `${poNumber}___${itemName}___${partType}___${rate}`;
            if (!map.has(key)) {
              map.set(key, {
                poNumber,
                poName,
                itemName,
                partType,
                qty: 0,
                wageTotal: 0,
                rate
              });
            }
            const cur = map.get(key)!;
            cur.qty += qty;
            cur.wageTotal += wageTotal;
          });

          return Array.from(map.values()).map(it => {
            const poLabel = it.poName ? `${it.poNumber} (${it.poName})` : it.poNumber;
            const partNote = it.partType && it.partType !== 'Set' ? ` [${it.partType}]` : '';
            const itemDescription = `${it.itemName}${partNote}`;
            const rateFormatted = `Rp ${it.rate.toLocaleString('id-ID')}`;
            const subtotalFormatted = `Rp ${it.wageTotal.toLocaleString('id-ID')}`;
            const lineText = `${poLabel} - ${itemDescription}: ${it.qty.toLocaleString('id-ID')} pcs × ${rateFormatted} = ${subtotalFormatted}`;

            return {
              poNumber: it.poNumber,
              poName: it.poName,
              poLabel,
              itemName: it.itemName,
              itemDescription,
              partType: it.partType,
              qty: it.qty,
              rate: it.rate,
              rateFormatted,
              subtotal: it.wageTotal,
              subtotalFormatted,
              lineText
            };
          });
        };

        const unpaidWorkItems = buildWorkItems(tUnpaidSubs);
        const paidWorkItems = buildWorkItems(tPaidSubs);
        const activeWorkItems = tUnpaidSubs.length > 0 ? unpaidWorkItems : paidWorkItems;

        // Grade bonus computation
        const isCollab = !!(t.partnerName && t.partnerName.trim() !== '');
        const pCount = t.partnerCount !== undefined ? t.partnerCount : (isCollab ? 1 : 0);
        let gradeName = '-';
        let bonus = 0;

        for (const rule of [...gradeRules].sort((a, b) => b.minQtySingle - a.minQtySingle)) {
          let ruleMinQty = 0;
          let ruleBonus = 0;
          if (pCount === 0) {
            ruleMinQty = rule.minQtySingle;
            ruleBonus = rule.bonusSingle;
          } else if (pCount === 1) {
            ruleMinQty = rule.minQtyCollab;
            ruleBonus = rule.bonusCollab;
          } else {
            const pRule = rule.partnerRules?.find(pr => pr.partnerCount === pCount);
            if (pRule) {
              ruleMinQty = pRule.minQty;
              ruleBonus = pRule.bonus;
            } else {
              ruleMinQty = rule.minQtyCollab;
              ruleBonus = rule.bonusCollab;
            }
          }
          if (ruleMinQty > 0 && unpaidGradeQty >= ruleMinQty) {
            gradeName = rule.name;
            bonus = ruleBonus;
            break;
          }
        }

        const tUnpaidKasbon = kasbons
          .filter(k => k.tailorId === t.id && !k.isPaid)
          .reduce((sum, k) => sum + (Number(k.amount) || 0), 0);

        const tUnpaidManuals = manualAdjustments.filter(m => m.tailorId === t.id && !m.isPaid);
        const tManualBonus = tUnpaidManuals.filter(m => (m as any).type === 'bonus' || (m.amount || 0) > 0).reduce((sum, m) => sum + Math.abs(Number(m.amount) || 0), 0);
        const tManualPotongan = tUnpaidManuals.filter(m => (m as any).type === 'potongan' || (m.amount || 0) < 0).reduce((sum, m) => sum + Math.abs(Number(m.amount) || 0), 0);
        const tManualNet = tUnpaidManuals.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);

        const unpaidNet = Math.max(0, unpaidGrossWage + bonus - tUnpaidKasbon + tManualNet);

        // Active tabungan balance
        const at = activeTabungan.find(a => a.tailorId === t.id);
        const totalTabunganBalance = (at ? Number(at.balance) : 0) + unpaidTabungan;

        // Paid history summary
        const tailorPayments = salaryPayments.filter(p => p.tailorId === t.id);
        const totalPaidNet = tailorPayments.reduce((sum, p) => sum + (Number(p.netPayment) || 0), 0);
        const totalPaidWage = tailorPayments.reduce((sum, p) => sum + (Number(p.totalWage) || 0), 0);
        const totalPaidCount = tailorPayments.length;

        // Latest payment
        const latestPayment = tailorPayments.length > 0 ? tailorPayments[0] : null;

        return {
          tailor: t,
          id: t.id,
          name: t.name,
          partnerName: t.partnerName,
          productionNumber: t.productionNumber,
          phone: t.phone,
          unpaidSubsCount: tUnpaidSubs.length,
          unpaidQty,
          unpaidGrossWage,
          workItems: activeWorkItems,
          unpaidWorkItems,
          paidWorkItems,
          gradeName,
          bonus,
          tUnpaidKasbon,
          tManualBonus,
          tManualPotongan,
          tManualNet,
          unpaidTabungan,
          totalTabunganBalance,
          unpaidNet,
          totalPaidNet,
          totalPaidWage,
          totalPaidCount,
          latestPayment,
          hasPending: unpaidNet > 0 || unpaidQty > 0 || tUnpaidKasbon > 0,
          statusGaji: unpaidNet > 0 ? 'Tertunda / Siap Bayar' : (totalPaidCount > 0 ? 'Lunas' : 'Belum Ada Transaksi')
        };
      });
  }, [tailors, jobs, submissions, kasbons, manualAdjustments, activeTabungan, gradeRules, salaryPayments, pos, poItems]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    return tailorSalaryRows.filter(row => {
      if (selectedTailorFilter !== 'all' && row.id !== selectedTailorFilter) return false;
      if (reportFilter === 'unpaid') return row.hasPending;
      if (reportFilter === 'paid') return row.totalPaidCount > 0;
      return true;
    }).map(row => {
      // Pick appropriate work items based on filter
      const effectiveWorkItems = reportFilter === 'paid' 
        ? row.paidWorkItems 
        : (reportFilter === 'unpaid' ? row.unpaidWorkItems : row.workItems);
      return {
        ...row,
        workItems: effectiveWorkItems
      };
    });
  }, [tailorSalaryRows, selectedTailorFilter, reportFilter]);

  // Overall totals
  const totalUnpaidGross = useMemo(() => filteredRows.reduce((sum, r) => sum + r.unpaidGrossWage, 0), [filteredRows]);
  const totalBonus = useMemo(() => filteredRows.reduce((sum, r) => sum + r.bonus, 0), [filteredRows]);
  const totalKasbon = useMemo(() => filteredRows.reduce((sum, r) => sum + r.tUnpaidKasbon, 0), [filteredRows]);
  const totalManualNet = useMemo(() => filteredRows.reduce((sum, r) => sum + r.tManualNet, 0), [filteredRows]);
  const totalUnpaidNet = useMemo(() => filteredRows.reduce((sum, r) => sum + r.unpaidNet, 0), [filteredRows]);
  const totalTabungan = useMemo(() => filteredRows.reduce((sum, r) => sum + r.totalTabunganBalance, 0), [filteredRows]);
  const totalUnpaidQty = useMemo(() => filteredRows.reduce((sum, r) => sum + r.unpaidQty, 0), [filteredRows]);
  const totalPaidNetAll = useMemo(() => filteredRows.reduce((sum, r) => sum + r.totalPaidNet, 0), [filteredRows]);

  // Aggregate breakdown per PO across all filtered tailors
  const allAggregatedPOWork = useMemo(() => {
    const map = new Map<string, {
      poNumber: string;
      poName: string;
      poLabel: string;
      itemName: string;
      partType: string;
      totalQty: number;
      rate: number;
      totalWage: number;
      tailorsInvolved: Set<string>;
    }>();

    filteredRows.forEach(row => {
      row.workItems.forEach(w => {
        const key = `${w.poNumber}___${w.itemName}___${w.partType}___${w.rate}`;
        if (!map.has(key)) {
          map.set(key, {
            poNumber: w.poNumber,
            poName: w.poName,
            poLabel: w.poLabel,
            itemName: w.itemName,
            partType: w.partType,
            totalQty: 0,
            rate: w.rate,
            totalWage: 0,
            tailorsInvolved: new Set()
          });
        }
        const entry = map.get(key)!;
        entry.totalQty += w.qty;
        entry.totalWage += w.subtotal;
        entry.tailorsInvolved.add(row.name);
      });
    });

    return Array.from(map.values());
  }, [filteredRows]);

  const printDocument = () => {
    if (!printContentRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    const orientationStyle = orientation === 'landscape'
      ? '@page { size: landscape; margin: 8mm; }'
      : '@page { size: portrait; margin: 8mm; }';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Laporan_Gaji_${new Date().toISOString().split('T')[0]}</title>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            ${orientationStyle}
            @media print {
              body { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important;
                background-color: white !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              .no-print { display: none !important; }
              .page-break { page-break-after: always; }
              tr { page-break-inside: avoid; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background-color: #ffffff;
            }
          </style>
        </head>
        <body class="p-4 bg-white text-slate-900">
          <div>
            ${printContentRef.current.innerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
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

  const downloadCSV = () => {
    const headers = [
      'No',
      'Nama Penjahit',
      'No Produksi',
      'Partner',
      'Rincian Hasil Kerja (PO & Tarif)',
      'Total Qty Setor (Pcs)',
      'Gaji Bruto (Rp)',
      'Bonus Grade (Rp)',
      'Grade',
      'Potongan Kasbon (Rp)',
      'Penyesuaian (Rp)',
      'Gaji Bersih / Tertunda (Rp)',
      'Tabungan Berjalan (Rp)',
      'Status Gaji'
    ];

    const rows = filteredRows.map((r, i) => [
      i + 1,
      r.name,
      r.productionNumber || '-',
      r.partnerName || '-',
      r.workItems && r.workItems.length > 0 
        ? r.workItems.map(w => w.lineText).join('; ')
        : '-',
      r.unpaidQty,
      r.unpaidGrossWage,
      r.bonus,
      r.gradeName,
      r.tUnpaidKasbon,
      r.tManualNet,
      r.unpaidNet,
      r.totalTabunganBalance,
      r.statusGaji
    ]);

    const csvContent = [headers, ...rows]
      .map(line => line.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Laporan_Gaji_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-7xl h-[98dvh] sm:h-[95vh] flex flex-col overflow-hidden text-slate-100">
        
        {/* Top Action & Controls Bar */}
        <div className="p-3 sm:p-4 sm:px-6 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Receipt size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-white tracking-tight">
                  Laporan Rekapitulasi Gaji & Keuangan Penjahit
                </h3>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Resmi / PDF
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Laporan komprehensif upah, bonus grade, kasbon, tabungan, dan gaji bersih penjahit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Status */}
            <div className="flex items-center bg-slate-800 rounded-xl p-1 text-xs border border-slate-700">
              <button
                onClick={() => setReportFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  reportFilter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua ({tailorSalaryRows.length})
              </button>
              <button
                onClick={() => setReportFilter('unpaid')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  reportFilter === 'unpaid' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tertunda ({tailorSalaryRows.filter(r => r.hasPending).length})
              </button>
              <button
                onClick={() => setReportFilter('paid')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  reportFilter === 'paid' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Ada Riwayat Bayar ({tailorSalaryRows.filter(r => r.totalPaidCount > 0).length})
              </button>
            </div>

            {/* Toggle PO Breakdown */}
            <button
              onClick={() => setShowPoBreakdown(b => !b)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                showPoBreakdown 
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow' 
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
              title="Tampilkan / Sembunyikan Rincian Hasil Kerja (PO & Tarif) di tabel"
            >
              <Scissors size={14} />
              <span>Rincian PO: {showPoBreakdown ? 'Detail' : 'Ringkas'}</span>
            </button>

            {/* Orientation */}
            <div className="hidden sm:flex items-center bg-slate-800 rounded-xl p-1 text-xs border border-slate-700">
              <button
                onClick={() => setOrientation('landscape')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  orientation === 'landscape' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Landscape
              </button>
              <button
                onClick={() => setOrientation('portrait')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                  orientation === 'portrait' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Portrait
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="hidden md:flex items-center gap-1 bg-slate-800 rounded-xl px-2 py-1 text-xs border border-slate-700">
              <button
                onClick={() => setZoomScale(z => Math.max(0.6, z - 0.08))}
                className="p-1 hover:text-white text-slate-400 rounded transition-colors"
                title="Perkecil"
              >
                <ZoomOut size={15} />
              </button>
              <span className="font-mono text-[11px] px-1 text-slate-300">{Math.round(zoomScale * 100)}%</span>
              <button
                onClick={() => setZoomScale(z => Math.min(1.3, z + 0.08))}
                className="p-1 hover:text-white text-slate-400 rounded transition-colors"
                title="Perbesar"
              >
                <ZoomIn size={15} />
              </button>
              <button
                onClick={() => setZoomScale(0.92)}
                className="p-1 hover:text-white text-slate-400 rounded transition-colors"
                title="Reset Zoom"
              >
                <Maximize2 size={13} />
              </button>
            </div>

            {/* CSV */}
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-all"
              title="Download Data CSV"
            >
              <Download size={14} />
              <span className="hidden sm:inline">CSV</span>
            </button>

            {/* Print / Save to PDF */}
            <button
              onClick={printDocument}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Printer size={15} />
              <span>Cetak / Simpan PDF</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Document Preview Container */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-950 flex justify-center custom-scrollbar">
          <div
            style={{
              transform: `scale(${zoomScale})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="w-full flex justify-center"
          >
            {/* The Printable Page Content */}
            <div
              ref={printContentRef}
              className={`bg-white text-slate-900 shadow-2xl rounded-2xl p-8 sm:p-12 transition-all ${
                orientation === 'landscape' ? 'w-[1150px] min-h-[780px]' : 'w-[850px] min-h-[1100px]'
              }`}
              style={{ colorScheme: 'light' }}
            >
              {/* ========================================================
                  1. HEADER LAPORAN GAJI
                  ======================================================== */}
              <div className="border-b-4 border-slate-900 pb-6 mb-6">
                <div className="flex justify-between items-start">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-2xl shadow-md border-2 border-slate-900">
                      KP
                    </div>
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-slate-900 leading-none">
                        {companyName}
                      </h1>
                      <p className="text-xs font-bold text-slate-500 tracking-wider uppercase mt-1">
                        Sistem Informasi Manajemen Konfeksi & Penggajian Terpadu
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-600 font-semibold">
                        <span>DIVISI PRODUKSI & KEUANGAN</span>
                        <span>•</span>
                        <span>DOKUMEN RESMI PENGGAJIAN</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="inline-block px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black uppercase tracking-widest mb-1.5">
                      LAPORAN GAJI & KEUANGAN
                    </div>
                    <p className="text-xs font-black text-slate-900">
                      TANGGAL CETAK: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Waktu: {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Dicetak oleh: <span className="font-bold text-slate-800">{currentUsername}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* ========================================================
                  2. EXECUTIVE SUMMARY CARDS
                  ======================================================== */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-600">
                      Total Gaji Tertunda
                    </p>
                    <Wallet size={16} className="text-rose-500" />
                  </div>
                  <p className="text-2xl font-black text-rose-700 tabular-nums tracking-tight">
                    Rp {totalUnpaidNet.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-rose-600 font-bold mt-1">
                    {filteredRows.filter(r => r.unpaidNet > 0).length} Penjahit Siap Dibayarkan
                  </p>
                </div>

                <div className="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-sky-600">
                      Total Tabungan Pekerja
                    </p>
                    <PiggyBank size={16} className="text-sky-500" />
                  </div>
                  <p className="text-2xl font-black text-sky-700 tabular-nums tracking-tight">
                    Rp {totalTabungan.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-sky-600 font-bold mt-1">
                    Saldo Berjalan Seluruh Penjahit
                  </p>
                </div>

                <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                      Total Kasbon Aktif
                    </p>
                    <Receipt size={16} className="text-amber-500" />
                  </div>
                  <p className="text-2xl font-black text-amber-700 tabular-nums tracking-tight">
                    Rp {totalKasbon.toLocaleString('id-ID')}
                  </p>
                  <p className="text-[10px] text-amber-600 font-bold mt-1">
                    Pinjaman Belum Terpotong
                  </p>
                </div>

                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                      Total Setoran Qty
                    </p>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  </div>
                  <p className="text-2xl font-black text-emerald-700 tabular-nums tracking-tight">
                    {totalUnpaidQty.toLocaleString('id-ID')} <span className="text-xs font-bold text-emerald-600">pcs</span>
                  </p>
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">
                    Hasil Jahit Menunggu Pembayaran
                  </p>
                </div>
              </div>

              {/* ========================================================
                  3. TABEL UTAMA: RINCIAN PENGGAJIAN PENJAHIT
                  ======================================================== */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-5 bg-indigo-600 rounded-full"></div>
                    <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                      Rincian Lengkap Penggajian & Rekapitulasi Upah per Penjahit
                    </h2>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Menampilkan {filteredRows.length} penjahit
                  </span>
                </div>

                <div className="border-2 border-slate-900 rounded-xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[10px]">
                        <th className="p-3 text-center w-10">No</th>
                        <th className="p-3 min-w-[260px]">Nama Penjahit & Hasil Kerja</th>
                        <th className="p-3 text-center">Grade</th>
                        <th className="p-3 text-right">Qty Setor</th>
                        <th className="p-3 text-right">Upah Bruto</th>
                        <th className="p-3 text-right">Bonus Grade</th>
                        <th className="p-3 text-right">Pot. Kasbon</th>
                        <th className="p-3 text-right">Penyesuaian</th>
                        <th className="p-3 text-right">Gaji Bersih</th>
                        <th className="p-3 text-right">Tabungan</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-slate-400 italic">
                            Tidak ada data gaji penjahit yang memenuhi kriteria filter.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((row, idx) => {
                          const isEven = idx % 2 === 0;
                          return (
                            <tr
                              key={row.id}
                              className={isEven ? 'bg-white' : 'bg-slate-50/60'}
                              style={{ pageBreakInside: 'avoid' }}
                            >
                              <td className="p-2.5 text-center font-bold text-slate-500 text-[11px] align-top">
                                {idx + 1}
                              </td>
                              <td className="p-2.5 align-top">
                                <div className="font-extrabold text-slate-900 text-[12px] leading-tight">
                                  {row.name}
                                </div>
                                {row.partnerName && (
                                  <div className="text-[10px] font-bold text-slate-500 italic mt-0.5">
                                    Collab: {row.partnerName}
                                  </div>
                                )}
                                {row.productionNumber && (
                                  <div className="text-[9px] font-mono text-slate-400 mt-0.5">
                                    No #{row.productionNumber}
                                  </div>
                                )}

                                {/* Rincian Hasil Kerja (PO, Qty x Tarif) */}
                                {showPoBreakdown && (
                                  <div className="mt-2 pt-2 border-t border-slate-200">
                                    <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
                                      <span className="flex items-center gap-1 text-indigo-700">
                                        <Scissors size={10} className="text-indigo-600 shrink-0" />
                                        Hasil Kerja:
                                      </span>
                                      {row.workItems && row.workItems.length > 0 && (
                                        <span className="text-[8px] font-black px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                                          {row.workItems.length} PO
                                        </span>
                                      )}
                                    </div>

                                    {row.workItems && row.workItems.length > 0 ? (
                                      <div className="space-y-1">
                                        {row.workItems.map((w, wIdx) => (
                                          <div
                                            key={wIdx}
                                            className="text-[10px] bg-slate-50/90 border border-slate-200 rounded p-1.5 leading-snug"
                                          >
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="font-extrabold text-indigo-700 tracking-tight text-[10px] truncate max-w-[170px]" title={w.poLabel}>
                                                {w.poLabel}
                                              </span>
                                              <span className="font-black text-slate-900 text-[10px] shrink-0 font-mono">
                                                {w.subtotalFormatted}
                                              </span>
                                            </div>
                                            <div className="text-[9px] text-slate-600 flex items-center justify-between gap-1 mt-0.5">
                                              <span className="truncate max-w-[130px] text-slate-500 font-medium" title={w.itemDescription}>
                                                {w.itemDescription}
                                              </span>
                                              <span className="font-bold text-slate-800 shrink-0 bg-white px-1.5 py-0.5 rounded border border-slate-200 text-[9px] font-mono">
                                                {w.qty.toLocaleString('id-ID')} pcs × {w.rateFormatted}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[9px] text-slate-400 italic">Belum ada catatan setoran PO</p>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="p-2.5 text-center align-top">
                                {row.gradeName !== '-' ? (
                                  <span className="inline-block px-2 py-0.5 rounded font-black text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    {row.gradeName}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-bold">-</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-black text-slate-800 tabular-nums align-top">
                                {row.unpaidQty > 0 ? `${row.unpaidQty.toLocaleString('id-ID')} pcs` : '-'}
                              </td>
                              <td className="p-2.5 text-right font-black text-slate-900 tabular-nums align-top">
                                {row.unpaidGrossWage > 0 ? `Rp ${row.unpaidGrossWage.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="p-2.5 text-right font-black text-emerald-600 tabular-nums align-top">
                                {row.bonus > 0 ? `+Rp ${row.bonus.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="p-2.5 text-right font-black text-rose-600 tabular-nums align-top">
                                {row.tUnpaidKasbon > 0 ? `-Rp ${row.tUnpaidKasbon.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="p-2.5 text-right font-black tabular-nums align-top">
                                {row.tManualNet !== 0 ? (
                                  <span className={row.tManualNet > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                    {row.tManualNet > 0 ? '+' : ''}Rp {row.tManualNet.toLocaleString('id-ID')}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="p-2.5 text-right font-black text-indigo-700 bg-indigo-50/40 tabular-nums text-[12px] align-top">
                                {row.unpaidNet > 0 ? `Rp ${row.unpaidNet.toLocaleString('id-ID')}` : 'Rp 0'}
                              </td>
                              <td className="p-2.5 text-right font-black text-sky-600 tabular-nums align-top">
                                {row.totalTabunganBalance > 0 ? `Rp ${row.totalTabunganBalance.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="p-2.5 text-center align-top">
                                {row.unpaidNet > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full font-black text-[9px] bg-amber-100 text-amber-800 border border-amber-200">
                                    TERTUNDA
                                  </span>
                                ) : row.totalPaidCount > 0 ? (
                                  <span className="inline-block px-2 py-0.5 rounded-full font-black text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    LUNAS
                                  </span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded-full font-black text-[9px] bg-slate-100 text-slate-600 border border-slate-200">
                                    NIHIL
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}

                      {/* SUMMARY TOTAL ROW */}
                      {filteredRows.length > 0 && (
                        <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-900">
                          <td colSpan={3} className="p-3 text-right uppercase tracking-wider text-[10px]">
                            TOTAL KESELURUHAN ({filteredRows.length} PENJAHIT):
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {totalUnpaidQty.toLocaleString('id-ID')} pcs
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            Rp {totalUnpaidGross.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-right tabular-nums text-emerald-300">
                            +Rp {totalBonus.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-right tabular-nums text-rose-300">
                            -Rp {totalKasbon.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-right tabular-nums">
                            {totalManualNet !== 0 ? `Rp ${totalManualNet.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="p-3 text-right tabular-nums text-amber-300 text-[13px]">
                            Rp {totalUnpaidNet.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-right tabular-nums text-sky-300">
                            Rp {totalTabungan.toLocaleString('id-ID')}
                          </td>
                          <td className="p-3 text-center text-[10px] text-slate-300">
                            SELESAI
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ========================================================
                  4. REKAPITULASI HASIL KERJA PER PO & MODEL
                  ======================================================== */}
              {allAggregatedPOWork.length > 0 && (
                <div className="mb-6" style={{ pageBreakInside: 'avoid' }}>
                  <div className="flex justify-between items-center mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-5 bg-emerald-600 rounded-full"></div>
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                        Rekapitulasi Hasil Kerja per PO & Model (Audit Produksi)
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                      {allAggregatedPOWork.length} Item PO Dikerjakan
                    </span>
                  </div>

                  <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-white font-black uppercase tracking-wider text-[10px]">
                          <th className="p-2.5 text-center w-10">No</th>
                          <th className="p-2.5">Nomor PO & Pelanggan</th>
                          <th className="p-2.5">Model / Item</th>
                          <th className="p-2.5">Penjahit Bertugas</th>
                          <th className="p-2.5 text-right">Qty Disetor</th>
                          <th className="p-2.5 text-right">Tarif Satuan</th>
                          <th className="p-2.5 text-right">Total Upah</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {allAggregatedPOWork.map((poWork, pIdx) => (
                          <tr key={pIdx} className={pIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                            <td className="p-2 text-center font-bold text-slate-500 text-[11px]">
                              {pIdx + 1}
                            </td>
                            <td className="p-2 font-black text-slate-900">
                              <span className="text-indigo-700">{poWork.poNumber}</span>
                              {poWork.poName && (
                                <span className="text-slate-500 font-semibold text-[11px] block">
                                  {poWork.poName}
                                </span>
                              )}
                            </td>
                            <td className="p-2 font-bold text-slate-800 text-[11px]">
                              {poWork.itemName}
                              {poWork.partType !== 'Set' && (
                                <span className="text-[10px] font-semibold text-slate-500 block italic">
                                  Bagian: {poWork.partType}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-slate-600 text-[11px]">
                              {Array.from(poWork.tailorsInvolved).join(', ')}
                            </td>
                            <td className="p-2 text-right font-black text-slate-900 tabular-nums">
                              {poWork.totalQty.toLocaleString('id-ID')} pcs
                            </td>
                            <td className="p-2 text-right font-bold text-slate-700 tabular-nums">
                              Rp {poWork.rate.toLocaleString('id-ID')}
                            </td>
                            <td className="p-2 text-right font-black text-emerald-700 tabular-nums">
                              Rp {poWork.totalWage.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-black border-t-2 border-slate-300 text-xs">
                          <td colSpan={4} className="p-2.5 text-right uppercase tracking-wider text-[10px] text-slate-700">
                            Total Hasil Kerja PO:
                          </td>
                          <td className="p-2.5 text-right text-slate-900 tabular-nums">
                            {allAggregatedPOWork.reduce((s, w) => s + w.totalQty, 0).toLocaleString('id-ID')} pcs
                          </td>
                          <td className="p-2.5 text-right text-slate-400">-</td>
                          <td className="p-2.5 text-right text-emerald-800 tabular-nums font-black">
                            Rp {allAggregatedPOWork.reduce((s, w) => s + w.totalWage, 0).toLocaleString('id-ID')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ========================================================
                  4. DETAIL KOMPONEN PEMBAYARAN & REKAP KASBON/TABUNGAN
                  ======================================================== */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {/* Ringkasan Beban Pengeluaran */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                    <Wallet size={14} className="text-indigo-600" /> Ringkasan Komponen Beban Upah
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Total Upah Jahit Murni (Bruto)</span>
                      <span className="font-black text-slate-900 tabular-nums">Rp {totalUnpaidGross.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="font-semibold text-emerald-700">Total Bonus Penghargaan Grade</span>
                      <span className="font-black text-emerald-700 tabular-nums">+Rp {totalBonus.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="font-semibold text-rose-600">Total Pemotongan Cicilan Kasbon</span>
                      <span className="font-black text-rose-600 tabular-nums">-Rp {totalKasbon.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Penyesuaian Manual (Koreksi)</span>
                      <span className="font-black text-slate-900 tabular-nums">{totalManualNet !== 0 ? `Rp ${totalManualNet.toLocaleString('id-ID')}` : 'Rp 0'}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 text-sm font-black text-slate-900">
                      <span className="uppercase tracking-wider text-xs">Kewajiban Kas Keluar (Netto)</span>
                      <span className="text-base text-indigo-700 tabular-nums">Rp {totalUnpaidNet.toLocaleString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                {/* Status Tabungan & Kasbon Penjahit */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                    <PiggyBank size={14} className="text-sky-600" /> Monitoring Pos Finansial Pekerja
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Total Tabungan Terkumpul</span>
                      <span className="font-black text-sky-600 tabular-nums">Rp {totalTabungan.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Jumlah Penjahit Aktif Menabung</span>
                      <span className="font-black text-slate-900">{filteredRows.filter(r => r.totalTabunganBalance > 0).length} Orang</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Total Pinjaman / Kasbon Aktif</span>
                      <span className="font-black text-amber-600 tabular-nums">Rp {totalKasbon.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="font-semibold text-slate-600">Jumlah Penjahit Berkasbon</span>
                      <span className="font-black text-slate-900">{filteredRows.filter(r => r.tUnpaidKasbon > 0).length} Orang</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 text-xs font-bold text-slate-500 italic">
                      <span>*Tabungan penjahit dicatat terpisah dan dipotong otomatis per pcs sesuai tarif PO</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ========================================================
                  5. TANDA TANGAN & PENGESAHAN DOKUMEN
                  ======================================================== */}
              <div className="border-t-2 border-slate-200 pt-6 mt-8" style={{ pageBreakInside: 'avoid' }}>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center mb-6">
                  PENGESAHAN LAPORAN KEUANGAN & GAJI
                </p>
                <div className="grid grid-cols-3 gap-6 text-center text-xs">
                  <div>
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Dibuat Oleh</p>
                    <div className="h-20 flex items-end justify-center">
                      <p className="font-black text-slate-900 underline uppercase">{currentUsername}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Admin Produksi / Payroll</p>
                  </div>

                  <div>
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Diperiksa Oleh</p>
                    <div className="h-20 flex items-end justify-center">
                      <p className="font-black text-slate-900 underline uppercase">Supervisor Produksi</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Kepala Bagian Penjahitan</p>
                  </div>

                  <div>
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Disetujui Oleh</p>
                    <div className="h-20 flex items-end justify-center">
                      <p className="font-black text-slate-900 underline uppercase">Pimpinan / Finance</p>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Manajer Keuangan / Owner</p>
                  </div>
                </div>
              </div>

              {/* Document Footer */}
              <div className="mt-8 pt-4 border-t border-slate-200 text-center">
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  Dokumen ini sah dan dikeluarkan secara otomatis oleh Sistem Manajemen Konfeksi.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
