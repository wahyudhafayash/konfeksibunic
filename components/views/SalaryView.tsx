import { useState } from 'react';
import { db, useLiveQuery, SewingSubmission, Kasbon, GradeRule, ManualAdjustment, SalaryPayment, getPOItemPricing, getWageForPart, getSubmissionNominalQty } from '@/lib/db';
import { CheckCircle2, Wallet, Info, Eye, EyeOff, Search, X, ChevronRight, PiggyBank, RefreshCcw, TrendingUp, ArrowRight, User, Calculator, ArrowUpRight, Loader2, AlertCircle, History, Edit3, CheckSquare, Square, Filter, Plus, Trash2, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SalaryView({ onNavigate, userRole, currentUsername }: { onNavigate?: (tab: string) => void, userRole?: string, currentUsername?: string }) {
  const tailors = useLiveQuery(() => db.tailors.toArray(), []) || [];
  const submissions = useLiveQuery(() => db.sewingSubmissions.orderBy('id').reverse().toArray(), []) || [];
  const kasbons = useLiveQuery(() => db.kasbons.toArray(), []) || [];
  const manualAdjustments = useLiveQuery(() => db.manualAdjustments.toArray(), []) || [];
  const jobs = useLiveQuery(() => db.sewingJobs.toArray(), []) || [];
  const poItems = useLiveQuery(() => db.poItems.toArray(), []) || [];
  const pos = useLiveQuery(() => db.pos.toArray(), []) || [];
  const gradeRules = useLiveQuery(() => db.gradeRules.orderBy('minQtySingle').reverse().toArray(), []) || [];

  const [showAmountsGlobal, setShowAmountsGlobal] = useState(false);
  const [visibleAmounts, setVisibleAmounts] = useState<Record<string, boolean>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Full payment confirmation modal
  const [confirmPaymentData, setConfirmPaymentData] = useState<{ tailorId: number, stats: any, subs: SewingSubmission[] } | null>(null);

  // Partial Payment Modal State
  const [partialPaymentModal, setPartialPaymentModal] = useState<{
     tailorId: number;
     tailorName: string;
     subs: SewingSubmission[];
     selectedSubIds: number[];
     customKasbonDeduction: number;
     customTabungan: number;
     customAdjustmentAmount: number;
     customAdjustmentNote: string;
  } | null>(null);

  // Manual Adjustment Modal State
  const [adjustModalTailorId, setAdjustModalTailorId] = useState<number | null>(null);
  const [adjustForm, setAdjustForm] = useState<{ amount: number; notes: string; type: 'bonus' | 'potongan' }>({
     amount: 0,
     notes: '',
     type: 'bonus'
  });

  // Notification / Result Alert Modal
  const [modalAlert, setModalAlert] = useState<{
     isOpen: boolean;
     type: 'success' | 'error' | 'info';
     title: string;
     message: string;
     showCheckHistory?: boolean;
  }>({ isOpen: false, type: 'success', title: '', message: '' });

  // Full Slip Detail Modal
  const [detailModalData, setDetailModalData] = useState<{
     tailorId: number;
     subs: SewingSubmission[];
     tailorName: string;
     stats?: any;
  } | null>(null);

  const toggleVisibility = (e: React.MouseEvent, key: string) => {
     e.stopPropagation();
     setVisibleAmounts(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getJobDetails = (jobId: number, partType?: any) => {
     const job = jobs.find(j => j.id === jobId);
     if(!job) return { poNumber: '-', itemInfo: 'Unknown', wage: 0, tabungan: 0, color: '-', size: '-' };
     const item = poItems.find(i => i.id === job.poItemId);
     const po = pos.find(p => p.id === item?.poId);
     const pricing = getPOItemPricing(item, po, job);
     const wage = getWageForPart(partType || job.assignedPart || 'Set', pricing);
     return {
        poNumber: po?.poNumber || '-',
        itemInfo: item ? `${item.itemName} (${item.color}, ${item.size})` : 'Unknown',
        itemName: item?.itemName || 'Item',
        color: item?.color || '-',
        size: item?.size || '-',
        wage,
        tabungan: pricing.tabunganPerPcs
     };
  };

  const unpaidSubs = submissions.filter(s => !s.isPaid);
  
  const calculateTailorStats = (tailorId: number, subs: SewingSubmission[]) => {
     const tailor = tailors.find(t => t.id === tailorId);
     const isCollab = !!tailor?.partnerName;
     const pCount = tailor?.partnerCount !== undefined ? tailor.partnerCount : (isCollab ? 1 : 0);
     
     const totalQty = subs.reduce((sum, s) => sum + (Number(s.qtySubmitted) || 0), 0);
     const totalWage = subs.reduce((sum, s) => sum + (Number(s.wageTotal) || 0), 0);
     const totalTabungan = subs.reduce((sum, s) => sum + (Number(s.tabunganTotal) || 0), 0);
     
     let bonus = 0;
     let gradeName = '-';

     // Sort rules descending by minQty to evaluate highest rank first
     for (const rule of [...gradeRules].sort((a,b) => b.minQtySingle - a.minQtySingle)) {
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
        
        if (ruleMinQty > 0 && totalQty >= ruleMinQty) {
           bonus = ruleBonus;
           gradeName = rule.name;
           break;
        }
     }

     const tailorKasbons = kasbons.filter(k => k.tailorId === tailorId && !k.isPaid);
     const totalKasbon = tailorKasbons.reduce((sum, k) => sum + k.amount, 0);

     const tailorAdjustments = manualAdjustments.filter(m => m.tailorId === tailorId && !m.isPaid);
     const totalAdjustment = tailorAdjustments.reduce((sum, m) => sum + m.amount, 0);

     const netPayment = Math.max(0, totalWage + bonus - totalKasbon + totalAdjustment);

     return { 
        totalQty, 
        totalWage, 
        bonus, 
        gradeName, 
        totalKasbon, 
        netPayment, 
        totalTabungan, 
        tailorKasbons, 
        tailorAdjustments, 
        totalAdjustment, 
        isCollab, 
        pCount, 
        tailorName: tailor ? `${tailor.name} ${isCollab ? `(& ${tailor.partnerName})` : ''}` : 'Unknown' 
     };
  };

  // Open Partial Payment Modal for a tailor
  const openPartialPayment = (tailorId: number, tailorSubs: SewingSubmission[]) => {
     const stats = calculateTailorStats(tailorId, tailorSubs);
     const allIds = tailorSubs.map(s => s.id!).filter(Boolean);
     
     setPartialPaymentModal({
        tailorId,
        tailorName: stats.tailorName,
        subs: tailorSubs,
        selectedSubIds: allIds, // Default: select all, user can uncheck
        customKasbonDeduction: stats.totalKasbon,
        customTabungan: stats.totalTabungan,
        customAdjustmentAmount: 0,
        customAdjustmentNote: ''
     });
  };

  // Execute full payment
  async function payTailorSalary() {
     if(isProcessing || !confirmPaymentData) return;
     const { tailorId, stats, subs } = confirmPaymentData;
     setIsProcessing(true);
     try {
        const paymentRecord: SalaryPayment = {
           tailorId,
           tailorName: stats.tailorName,
           date: new Date().toISOString(),
           totalQty: stats.totalQty,
           totalWage: stats.totalWage,
           gradeName: stats.gradeName,
           bonusAmount: stats.bonus,
           kasbonDeducted: stats.totalKasbon,
           netPayment: stats.netPayment,
           tabunganAccumulated: stats.totalTabungan,
           manualAdjustment: stats.totalAdjustment,
           manualNote: (stats.tailorAdjustments || []).map((a:any) => a.notes).join(', '),
           createdBy: currentUsername
        };
        const paymentId = await db.salaryPayments.add(paymentRecord);

        // Arsip Gaji
        await db.archiveSalaries.add({
           originalId: paymentId,
           data: paymentRecord,
           archivedAt: new Date().toISOString(),
           archivedBy: currentUsername || 'System'
        });

        const submissionUpdates = subs.map(s => ({ key: s.id!, changes: { isPaid: true, paymentId, updatedBy: currentUsername } }));
        const kasbonUpdates = (stats.tailorKasbons || []).map((k: any) => ({ key: k.id!, changes: { isPaid: true, paymentId, updatedBy: currentUsername } }));
        const adjustmentUpdates = (stats.tailorAdjustments || []).map((a: any) => ({ key: a.id!, changes: { isPaid: true, paymentId, updatedBy: currentUsername } }));

        if (submissionUpdates.length > 0) await db.sewingSubmissions.bulkUpdate(submissionUpdates);
        if (kasbonUpdates.length > 0) await db.kasbons.bulkUpdate(kasbonUpdates);
        if (adjustmentUpdates.length > 0) await db.manualAdjustments.bulkUpdate(adjustmentUpdates);

        // Update Active Tabungan Summary
        if (stats.totalTabungan > 0) {
           const activeTabRes = await db.activeTabungan.toArray();
           const existingSummary = activeTabRes.find(a => a.tailorId === tailorId);
           if (!existingSummary) {
              await db.activeTabungan.add({
                 tailorId,
                 tailorName: stats.tailorName,
                 totalIn: stats.totalTabungan,
                 totalOut: 0,
                 balance: stats.totalTabungan,
                 lastUpdated: new Date().toISOString()
              });
           } else {
              await db.activeTabungan.update(existingSummary.id!, {
                 totalIn: (existingSummary.totalIn || 0) + stats.totalTabungan,
                 balance: (existingSummary.balance || 0) + stats.totalTabungan,
                 lastUpdated: new Date().toISOString()
              });
           }
        }

        const paidName = stats.tailorName;
        const paidNet = stats.netPayment;
        setConfirmPaymentData(null);
        setDetailModalData(null);
        setModalAlert({
           isOpen: true,
           type: 'success',
           title: 'Pembayaran Gaji Berhasil',
           message: `Gaji untuk ${paidName} sebesar Rp ${paidNet.toLocaleString('id-ID')} berhasil dibayarkan dan telah masuk ke arsip history.`,
           showCheckHistory: true
        });
     } catch (err) {
        setModalAlert({
           isOpen: true,
           type: 'error',
           title: 'Gagal Memproses Pembayaran',
           message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menyimpan data gaji.',
           showCheckHistory: false
        });
     } finally {
        setIsProcessing(false);
     }
  }

  // Execute Partial Payment based on selected submissions
  async function executePartialPayment() {
     if (isProcessing || !partialPaymentModal) return;
     if (partialPaymentModal.selectedSubIds.length === 0) {
        setModalAlert({
           isOpen: true,
           type: 'error',
           title: 'Belum Ada Setoran Dipilih',
           message: 'Silakan pilih minimal 1 setoran/PO yang ingin dibayarkan.',
           showCheckHistory: false
        });
        return;
     }

     setIsProcessing(true);
     const { tailorId, tailorName, subs, selectedSubIds, customKasbonDeduction, customTabungan, customAdjustmentAmount, customAdjustmentNote } = partialPaymentModal;
     
     try {
        const selectedSubs = subs.filter(s => selectedSubIds.includes(s.id!));
        const partialStats = calculateTailorStats(tailorId, selectedSubs);

        const activeTailorKasbons = kasbons.filter(k => k.tailorId === tailorId && !k.isPaid);
        const activeTailorAdjustments = manualAdjustments.filter(m => m.tailorId === tailorId && !m.isPaid);

        const effectiveKasbonDeduct = Math.max(0, Math.min(customKasbonDeduction, partialStats.totalKasbon));
        const effectiveTabungan = Math.max(0, customTabungan);
        
        // Net payment calculation
        const totalAdj = (activeTailorAdjustments.reduce((s, a) => s + a.amount, 0)) + customAdjustmentAmount;
        const netPayment = Math.max(0, partialStats.totalWage + partialStats.bonus - effectiveKasbonDeduct + totalAdj);

        let manualNotesCombined = activeTailorAdjustments.map(a => a.notes).join(', ');
        if (customAdjustmentNote) {
           manualNotesCombined = manualNotesCombined ? `${manualNotesCombined}; ${customAdjustmentNote}` : customAdjustmentNote;
        }

        const paymentRecord: SalaryPayment = {
           tailorId,
           tailorName,
           date: new Date().toISOString(),
           totalQty: partialStats.totalQty,
           totalWage: partialStats.totalWage,
           gradeName: partialStats.gradeName,
           bonusAmount: partialStats.bonus,
           kasbonDeducted: effectiveKasbonDeduct,
           netPayment: netPayment,
           tabunganAccumulated: effectiveTabungan,
           manualAdjustment: totalAdj,
           manualNote: manualNotesCombined,
           createdBy: currentUsername
        };

        const paymentId = await db.salaryPayments.add(paymentRecord);

        // Arsip Gaji
        await db.archiveSalaries.add({
           originalId: paymentId,
           data: paymentRecord,
           archivedAt: new Date().toISOString(),
           archivedBy: currentUsername || 'System'
        });

        // 1. Mark ONLY selected submissions as paid!
        const submissionUpdates = selectedSubs.map(s => ({
           key: s.id!,
           changes: { isPaid: true, paymentId, updatedBy: currentUsername }
        }));
        await db.sewingSubmissions.bulkUpdate(submissionUpdates);

        // 2. Handle Kasbon deduction cleanly
        if (effectiveKasbonDeduct > 0) {
           let remainingDeduct = effectiveKasbonDeduct;
           for (const k of activeTailorKasbons) {
              if (remainingDeduct <= 0) break;
              if (k.amount <= remainingDeduct) {
                 await db.kasbons.update(k.id!, { isPaid: true, paymentId, updatedBy: currentUsername });
                 remainingDeduct -= k.amount;
              } else {
                 // Kasbon is partially paid: reduce the current kasbon amount and create a paid record for the deducted portion
                 const deductedPart = remainingDeduct;
                 const remainingKasbonAmount = k.amount - deductedPart;
                 await db.kasbons.update(k.id!, { amount: remainingKasbonAmount, updatedBy: currentUsername });
                 await db.kasbons.add({
                    tailorId: k.tailorId,
                    tailorName: k.tailorName,
                    amount: deductedPart,
                    date: new Date().toISOString(),
                    notes: `${k.notes || 'Kasbon'} (Terpotong Gaji Sebagian)`,
                    isPaid: true,
                    paymentId,
                    createdBy: currentUsername
                 });
                 remainingDeduct = 0;
              }
           }
        }

        // 3. Mark existing manual adjustments as paid & add custom adjustment if any
        if (activeTailorAdjustments.length > 0) {
           const adjustmentUpdates = activeTailorAdjustments.map(a => ({
              key: a.id!,
              changes: { isPaid: true, paymentId, updatedBy: currentUsername }
           }));
           await db.manualAdjustments.bulkUpdate(adjustmentUpdates);
        }

        if (customAdjustmentAmount !== 0) {
           await db.manualAdjustments.add({
              tailorId,
              tailorName,
              amount: customAdjustmentAmount,
              date: new Date().toISOString(),
              notes: customAdjustmentNote || 'Penyesuaian Gaji Parsial',
              isPaid: true,
              paymentId,
              createdBy: currentUsername
           });
        }

        // 4. Update Active Tabungan Summary
        if (effectiveTabungan > 0) {
           const activeTabRes = await db.activeTabungan.toArray();
           const existingSummary = activeTabRes.find(a => a.tailorId === tailorId);
           if (!existingSummary) {
              await db.activeTabungan.add({
                 tailorId,
                 tailorName,
                 totalIn: effectiveTabungan,
                 totalOut: 0,
                 balance: effectiveTabungan,
                 lastUpdated: new Date().toISOString()
              });
           } else {
              await db.activeTabungan.update(existingSummary.id!, {
                 totalIn: (existingSummary.totalIn || 0) + effectiveTabungan,
                 balance: (existingSummary.balance || 0) + effectiveTabungan,
                 lastUpdated: new Date().toISOString()
              });
           }
        }

        const remainingUnpaidCount = subs.length - selectedSubs.length;
        setPartialPaymentModal(null);
        setDetailModalData(null);
        setModalAlert({
           isOpen: true,
           type: 'success',
           title: 'Pembayaran Sebagian Berhasil',
           message: `Berhasil membayar ${selectedSubs.length} setoran untuk ${tailorName} sebesar Rp ${netPayment.toLocaleString('id-ID')}. ${remainingUnpaidCount > 0 ? `Tersisa ${remainingUnpaidCount} setoran belum dibayar untuk periode berikutnya.` : 'Semua setoran telah lunas.'}`,
           showCheckHistory: true
        });
     } catch (err) {
        setModalAlert({
           isOpen: true,
           type: 'error',
           title: 'Gagal Memproses Pembayaran',
           message: err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menyimpan pembayaran sebagian.',
           showCheckHistory: false
        });
     } finally {
        setIsProcessing(false);
     }
  }

  // Handle Save Manual Adjustment from Adjust Modal
  async function handleSaveAdjustment(e: React.FormEvent) {
     e.preventDefault();
     if (!adjustModalTailorId || adjustForm.amount <= 0 || isProcessing) return;
     setIsProcessing(true);
     try {
        const tailor = tailors.find(t => t.id === adjustModalTailorId);
        const finalAmount = adjustForm.type === 'bonus' ? Math.abs(adjustForm.amount) : -Math.abs(adjustForm.amount);
        
        await db.manualAdjustments.add({
           tailorId: adjustModalTailorId,
           tailorName: tailor?.name,
           amount: finalAmount,
           notes: adjustForm.notes || (adjustForm.type === 'bonus' ? 'Bonus Tambahan' : 'Potongan Khusus'),
           date: new Date().toISOString(),
           isPaid: false,
           createdBy: currentUsername
        });

        setAdjustModalTailorId(null);
        setAdjustForm({ amount: 0, notes: '', type: 'bonus' });
        setModalAlert({
           isOpen: true,
           type: 'success',
           title: 'Penyesuaian Disimpan',
           message: `Penyesuaian ${adjustForm.type === 'bonus' ? 'Bonus' : 'Potongan'} sebesar Rp ${Math.abs(adjustForm.amount).toLocaleString('id-ID')} berhasil dicatat pada tagihan penjahit.`
        });
     } catch (err) {
        setModalAlert({
           isOpen: true,
           type: 'error',
           title: 'Gagal Menyimpan',
           message: 'Terjadi kesalahan saat menyimpan penyesuaian manual.'
        });
     } finally {
        setIsProcessing(false);
     }
  }

  async function handleDeleteAdjustment(adjId: number) {
     if (isProcessing) return;
     setIsProcessing(true);
     try {
        await db.manualAdjustments.delete(adjId);
        setModalAlert({
           isOpen: true,
           type: 'success',
           title: 'Penyesuaian Dihapus',
           message: 'Data penyesuaian manual berhasil dibatalkan.'
        });
     } catch (err) {
        setModalAlert({
           isOpen: true,
           type: 'error',
           title: 'Gagal Menghapus',
           message: 'Terjadi kesalahan saat menghapus data penyesuaian.'
        });
     } finally {
        setIsProcessing(false);
     }
  }

  const groupedUnpaidSubsRaw = unpaidSubs.reduce((acc, sub) => {
     if(!acc[sub.tailorId]) acc[sub.tailorId] = [];
     acc[sub.tailorId].push(sub);
     return acc;
  }, {} as Record<number, SewingSubmission[]>);

  const unpaidTotalAll = Object.entries(groupedUnpaidSubsRaw).reduce((acc, [tailorIdStr, subs]) => {
     const stats = calculateTailorStats(Number(tailorIdStr), subs);
     return acc + stats.netPayment;
  }, 0);

  const matchedTailors = tailors.filter(t => t.status !== 'Dihapus' && ((t.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (t.partnerName || '').toLowerCase().includes(searchTerm.toLowerCase()))).map(t => t.id!);

  const groupedUnpaidSubs = Object.fromEntries(
    Object.entries(groupedUnpaidSubsRaw).filter(([tailorId]) => matchedTailors.includes(Number(tailorId)))
  );

  const displayAmount = (amount: number, key: string, customClass: string = "") => {
     const isVisible = showAmountsGlobal || visibleAmounts[key];
     return (
        <span className={`inline-flex items-center gap-2 cursor-pointer transition-all hover:opacity-75 ${customClass}`} onClick={(e) => toggleVisibility(e, key)}>
           {isVisible ? `Rp ${amount.toLocaleString('id-ID')}` : 'Rp ••••••'}
           <span className="p-1 rounded-md bg-slate-100/50 group-hover:bg-slate-200/50">
             {isVisible ? <EyeOff size={12}/> : <Eye size={12}/>}
           </span>
        </span>
     );
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="space-y-8 pb-20">
       {/* Header */}
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
             <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Pembayaran Gaji</h2>
             <p className="text-slate-500 font-medium mt-1 uppercase tracking-wider text-[10px]">Penyelesaian upah pekerja produksi & pelunasan parsial</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
             <div className="relative w-full sm:w-80 group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Cari nama penjahit..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all shadow-sm" 
                />
             </div>
             
             <button 
               onClick={() => setShowAmountsGlobal(!showAmountsGlobal)} 
               className={`w-full sm:w-auto px-5 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm border ${showAmountsGlobal ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
             >
                {showAmountsGlobal ? <EyeOff size={18}/> : <Eye size={18}/>} 
                {showAmountsGlobal ? 'Sembunyikan' : 'Buka Masking'}
             </button>
          </div>
       </div>

       {/* Overview Cards */}
       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div variants={itemVariants} initial="hidden" animate="visible" className="md:col-span-1 bg-white border-2 border-rose-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group">
             <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-600 group-hover:scale-110 transition-transform"><Wallet size={120}/></div>
             <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-2">Estimasi Utang Gaji</p>
             <h3 className="text-3xl font-black text-slate-900 tabular-nums">
                {displayAmount(unpaidTotalAll, 'globalUnpaid', "text-rose-600")}
             </h3>
             <div className="mt-6 flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-50 px-3 py-1.5 rounded-xl w-fit">
               <Info size={14}/> Perlu Segera Dibayar
             </div>
          </motion.div>

          <motion.div variants={itemVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }} className="md:col-span-2 bg-indigo-600 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-600/20 text-white relative overflow-hidden group">
             <div className="absolute right-0 top-0 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform duration-700"><CheckCircle2 size={240}/></div>
             <div className="relative z-10">
                <h4 className="text-xl font-bold mb-2">Informasi Pembayaran & Opsi Bayar Parsial</h4>
                <p className="text-indigo-100 text-sm font-medium leading-relaxed max-w-xl mb-6">
                   Anda dapat membayar seluruh tagihan sekaligus atau menggunakan tombol <strong>Bayar Sebagian</strong> untuk memilih PO tertentu yang ingin dicairkan terlebih dahulu, serta mengatur potongan kasbon dan tabungan secara fleksibel.
                </p>
                <div className="flex flex-wrap gap-3">
                   <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold border border-white/10">
                      Total {Object.keys(groupedUnpaidSubs).length} Penjahit Antre
                   </div>
                   <div className="bg-emerald-400/20 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold border border-emerald-400/20 text-emerald-300">
                      Fitur Pilih Setoran PO Aktif
                   </div>
                </div>
             </div>
          </motion.div>
       </div>

       {/* Daftar Antrian Gaji */}
       <div className="space-y-4">
          <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 px-2">
            <TrendingUp size={20} className="text-indigo-600" /> Daftar Tunggu Gajian Penjahit
          </h3>
          
          <AnimatePresence mode="popLayout">
          {Object.keys(groupedUnpaidSubs).length === 0 ? (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20 bg-white border border-slate-100 rounded-[3rem] shadow-sm">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                   <CheckCircle2 size={32}/>
                </div>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Semua gaji sudah lunas terbayar</p>
             </motion.div>
          ) : (
             <div className="grid grid-cols-1 gap-4">
               {Object.entries(groupedUnpaidSubs).map(([tailorIdStr, _subs]) => {
                  const subs = _subs as SewingSubmission[];
                  const tId = parseInt(tailorIdStr);
                  const stats = calculateTailorStats(tId, subs);

                  // Extract unique PO numbers in this tailor's unpaid list
                  const uniquePOs = Array.from(new Set(subs.map(s => getJobDetails(s.jobId).poNumber))).filter(p => p !== '-');

                  return (
                     <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={tId} 
                        className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all group flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6"
                     >
                        <div className="flex items-start sm:items-center gap-5 w-full">
                           <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center font-black text-2xl text-indigo-600 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300 shrink-0">
                              {stats.tailorName.charAt(0)}
                           </div>
                           <div className="flex-1 min-w-0">
                              <h4 className="text-xl font-black text-slate-900 tracking-tight">{stats.tailorName}</h4>
                              <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-indigo-100">
                                   {subs.length} Setoran ({stats.totalQty} Set)
                                </span>
                                {stats.gradeName !== '-' && (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-100">
                                     GRADE {stats.gradeName} (+Rp {stats.bonus.toLocaleString('id-ID')})
                                  </span>
                                )}
                                {stats.totalKasbon > 0 && (
                                  <span className="text-[10px] bg-amber-50 text-amber-700 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-amber-200">
                                     Kasbon: Rp {stats.totalKasbon.toLocaleString('id-ID')}
                                  </span>
                                )}
                                {stats.totalAdjustment !== 0 && (
                                  <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest border ${stats.totalAdjustment > 0 ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                     Adj: {stats.totalAdjustment > 0 ? '+' : ''}Rp {stats.totalAdjustment.toLocaleString('id-ID')}
                                  </span>
                                )}
                              </div>
                              {uniquePOs.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                                   <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1">Tersedia PO:</span>
                                   {uniquePOs.map(po => (
                                     <span key={po} className="text-[9px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                                        {po}
                                     </span>
                                   ))}
                                </div>
                              )}
                           </div>
                        </div>

                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between xl:justify-end gap-6 w-full xl:w-auto border-t xl:border-t-0 xl:border-l border-slate-50 pt-5 xl:pt-0 xl:pl-8 shrink-0">
                           <div className="text-left xl:text-right">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Bersih</p>
                              <div className="text-2xl font-black text-slate-900 tabular-nums">
                                 {displayAmount(stats.netPayment, `unpNet_${tId}`, "text-indigo-600")}
                              </div>
                           </div>
                           
                           <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                              {(userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin') && (
                                <>
                                  {/* Tombol Bayar Sebagian / Pilih Setoran */}
                                  <button 
                                     type="button"
                                     disabled={isProcessing}
                                     onClick={() => openPartialPayment(tId, subs)} 
                                     className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-600/10 active:scale-95 whitespace-nowrap flex items-center gap-1.5 disabled:opacity-50"
                                     title="Pilih setoran/PO tertentu yang ingin dibayarkan sekarang"
                                  >
                                     <Sliders size={14} /> Bayar Sebagian
                                  </button>

                                  {/* Tombol Bayar Semua */}
                                  <button 
                                     type="button"
                                     disabled={isProcessing}
                                     onClick={() => setConfirmPaymentData({ tailorId: tId, stats, subs })} 
                                     className="bg-slate-900 text-white hover:bg-indigo-600 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-900/10 active:scale-95 whitespace-nowrap disabled:opacity-50"
                                  >
                                     Bayar Semua
                                  </button>

                                  {/* Tombol Edit Manual / Penyesuaian */}
                                  <button
                                     type="button"
                                     disabled={isProcessing}
                                     onClick={() => {
                                        setAdjustModalTailorId(tId);
                                        setAdjustForm({ amount: 0, notes: '', type: 'bonus' });
                                     }}
                                     className="p-3 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                                     title="Edit manual: Tambah bonus atau potongan khusus"
                                  >
                                     <Edit3 size={16} />
                                  </button>
                                </>
                              )}

                              <button 
                                type="button"
                                onClick={() => setDetailModalData({ tailorId: tId, subs, tailorName: stats.tailorName, stats })} 
                                className="p-3 bg-slate-50 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 rounded-2xl transition-all"
                                title="Lihat Rincian Lengkap"
                              >
                                 <ArrowRight size={18}/>
                              </button>
                           </div>
                        </div>
                     </motion.div>
                  )
               })}
             </div>
          )}
          </AnimatePresence>
       </div>

       {/* Modal Bayar Sebagian / Pilih Setoran (Interactive Partial Payment) */}
       <AnimatePresence>
       {partialPaymentModal && (() => {
          const { tailorId, tailorName, subs, selectedSubIds, customKasbonDeduction, customTabungan, customAdjustmentAmount, customAdjustmentNote } = partialPaymentModal;
          
          const selectedSubs = subs.filter(s => selectedSubIds.includes(s.id!));
          const currentStats = calculateTailorStats(tailorId, selectedSubs);
          const fullStats = calculateTailorStats(tailorId, subs);

          // Unique PO list for filter
          const uniquePOs = Array.from(new Set(subs.map(s => getJobDetails(s.jobId).poNumber))).filter(p => p !== '-');

          const toggleSubSelection = (id: number) => {
             const newSelected = selectedSubIds.includes(id)
                ? selectedSubIds.filter(x => x !== id)
                : [...selectedSubIds, id];
             
             const newSelectedSubs = subs.filter(s => newSelected.includes(s.id!));
             const newStats = calculateTailorStats(tailorId, newSelectedSubs);

             setPartialPaymentModal({
                ...partialPaymentModal,
                selectedSubIds: newSelected,
                customTabungan: newStats.totalTabungan
             });
          };

          const toggleAllPOs = (poNum: string) => {
             const poSubIds = subs.filter(s => getJobDetails(s.jobId).poNumber === poNum).map(s => s.id!).filter(Boolean);
             const allSelected = poSubIds.every(id => selectedSubIds.includes(id));
             
             let newSelected: number[];
             if (allSelected) {
                newSelected = selectedSubIds.filter(id => !poSubIds.includes(id));
             } else {
                newSelected = Array.from(new Set([...selectedSubIds, ...poSubIds]));
             }

             const newSelectedSubs = subs.filter(s => newSelected.includes(s.id!));
             const newStats = calculateTailorStats(tailorId, newSelectedSubs);

             setPartialPaymentModal({
                ...partialPaymentModal,
                selectedSubIds: newSelected,
                customTabungan: newStats.totalTabungan
             });
          };

          const selectAll = () => {
             const allIds = subs.map(s => s.id!).filter(Boolean);
             setPartialPaymentModal({
                ...partialPaymentModal,
                selectedSubIds: allIds,
                customTabungan: fullStats.totalTabungan
             });
          };

          const deselectAll = () => {
             setPartialPaymentModal({
                ...partialPaymentModal,
                selectedSubIds: [],
                customTabungan: 0
             });
          };

          const effectiveKasbon = Math.max(0, Math.min(customKasbonDeduction, currentStats.totalKasbon));
          const effectiveTabungan = Math.max(0, Number(customTabungan) || 0);
          const totalAdjustment = currentStats.totalAdjustment + (Number(customAdjustmentAmount) || 0);
          const calculatedNet = Math.max(0, currentStats.totalWage + currentStats.bonus - effectiveKasbon + totalAdjustment);

          return (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm no-print">
                <motion.div 
                   initial={{ y: 40, opacity: 0, scale: 0.96 }}
                   animate={{ y: 0, opacity: 1, scale: 1 }}
                   exit={{ y: 40, opacity: 0, scale: 0.96 }}
                   className="bg-white sm:rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-screen sm:max-h-[92vh] flex flex-col overflow-hidden"
                >
                   {/* Header */}
                   <div className="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <div className="flex items-center gap-4">
                         <div className="bg-emerald-600 text-white p-3.5 rounded-2xl shadow-lg shadow-emerald-600/20">
                            <Sliders size={26} />
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                               <h3 className="font-black text-slate-900 text-xl sm:text-2xl tracking-tight leading-none uppercase">{tailorName}</h3>
                               <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] px-2.5 py-0.5 rounded-md uppercase tracking-wider">Bayar Sebagian</span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-1 font-bold">Pilih tagihan setoran PO yang ingin dibayarkan pada periode ini.</p>
                         </div>
                      </div>
                      <button 
                         disabled={isProcessing}
                         onClick={() => setPartialPaymentModal(null)} 
                         className="text-slate-400 hover:text-slate-900 bg-white border border-slate-100 p-3 rounded-2xl transition-all active:scale-95 shadow-sm"
                      >
                         <X size={20}/>
                      </button>
                   </div>

                   {/* Body Grid */}
                   <div className="overflow-y-auto flex-1 p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 custom-scrollbar">
                      {/* Left: Checklist of Submissions */}
                      <div className="lg:col-span-7 space-y-4">
                         <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                            <div className="flex items-center gap-2">
                               <button 
                                  type="button" 
                                  onClick={selectAll} 
                                  className="text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 transition-all"
                               >
                                  Pilih Semua ({subs.length})
                                </button>
                               <button 
                                  type="button" 
                                  onClick={deselectAll} 
                                  className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 bg-slate-100 px-3 py-1.5 rounded-xl transition-all"
                               >
                                  Batal Pilih
                               </button>
                            </div>
                            <span className="text-xs font-black text-slate-600">
                               Terpilih: <strong className="text-emerald-600">{selectedSubIds.length}</strong> dari {subs.length} Setoran
                            </span>
                         </div>

                         {/* PO Filter Chips */}
                         {uniquePOs.length > 1 && (
                            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex flex-wrap items-center gap-2">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mr-1">
                                  <Filter size={11} /> Filter Cepat PO:
                               </span>
                               {uniquePOs.map(po => {
                                  const poSubs = subs.filter(s => getJobDetails(s.jobId).poNumber === po);
                                  const allPoSelected = poSubs.every(s => selectedSubIds.includes(s.id!));
                                  return (
                                     <button
                                        key={po}
                                        type="button"
                                        onClick={() => toggleAllPOs(po)}
                                        className={`text-[10px] font-black uppercase px-3 py-1 rounded-xl transition-all border ${allPoSelected ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                                     >
                                        {po} ({poSubs.length})
                                     </button>
                                  );
                               })}
                            </div>
                         )}

                         {/* Submissions List */}
                         <div className="space-y-3">
                            {subs.map(s => {
                               const details = getJobDetails(s.jobId, s.partType);
                               const nomQty = getSubmissionNominalQty(s);
                               const isSelected = selectedSubIds.includes(s.id!);

                               return (
                                  <div 
                                     key={s.id}
                                     onClick={() => toggleSubSelection(s.id!)}
                                     className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-4 ${isSelected ? 'bg-emerald-50/40 border-emerald-500 shadow-sm' : 'bg-slate-50/60 border-slate-100 opacity-60 hover:opacity-100 hover:bg-white'}`}
                                  >
                                     <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-1 rounded-lg ${isSelected ? 'text-emerald-600' : 'text-slate-300'}`}>
                                           {isSelected ? <CheckSquare size={22} className="fill-emerald-100" /> : <Square size={22} />}
                                        </div>
                                        <div className="min-w-0">
                                           <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                              <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                 {details.poNumber}
                                              </span>
                                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                 {new Date(s.dateSubmitted).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                              </span>
                                              <span className="text-[8px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full uppercase">
                                                 {s.partType || 'Set'}
                                              </span>
                                           </div>
                                           <p className="font-bold text-slate-800 text-xs truncate">{details.itemInfo}</p>
                                           <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                                              Setor: <strong className="text-slate-900">{nomQty} pcs ({s.qtySubmitted} Set)</strong> • Upah: Rp {(s.wageTotal || 0).toLocaleString('id-ID')}
                                           </p>
                                        </div>
                                     </div>

                                     <div className="text-right shrink-0">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Subtotal</p>
                                        <p className={`font-black text-base tabular-nums ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`}>
                                           Rp {(s.wageTotal || 0).toLocaleString('id-ID')}
                                        </p>
                                     </div>
                                  </div>
                               );
                            })}
                         </div>
                      </div>

                      {/* Right: Real-time Calculation & Custom Adjustment Inputs */}
                      <div className="lg:col-span-5 space-y-6">
                         <div className="bg-slate-900 text-white rounded-[2.5rem] p-6 sm:p-7 shadow-xl relative overflow-hidden">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-6">Kalkulasi Pembayaran Terpilih</h4>
                            
                            <div className="space-y-4">
                               <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-400 font-bold">Total Setoran Terpilih:</span>
                                  <span className="font-black text-white">{selectedSubIds.length} Setoran ({currentStats.totalQty} Set)</span>
                               </div>

                               <div className="flex justify-between items-center text-xs">
                                  <span className="text-slate-400 font-bold">Total Upah Jahit:</span>
                                  <span className="font-black text-white text-base">Rp {currentStats.totalWage.toLocaleString('id-ID')}</span>
                               </div>

                               <div className="flex justify-between items-center text-xs">
                                  <span className="text-emerald-400 font-bold">Bonus Grade ({currentStats.gradeName}):</span>
                                  <span className="font-black text-emerald-400 text-base">+Rp {currentStats.bonus.toLocaleString('id-ID')}</span>
                               </div>

                               {/* Edit Potongan Kasbon */}
                               <div className="pt-3 border-t border-slate-800 space-y-1.5">
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="text-amber-400 font-bold">Potong Kasbon (Maks: Rp {currentStats.totalKasbon.toLocaleString('id-ID')}):</span>
                                     <span className="font-black text-amber-400">-Rp {effectiveKasbon.toLocaleString('id-ID')}</span>
                                  </div>
                                  {currentStats.totalKasbon > 0 && (
                                     <div className="flex items-center gap-2 pt-1">
                                        <input 
                                           type="number" 
                                           min="0"
                                           max={currentStats.totalKasbon}
                                           value={customKasbonDeduction}
                                           onChange={e => setPartialPaymentModal({ ...partialPaymentModal, customKasbonDeduction: Number(e.target.value) || 0 })}
                                           className="w-full bg-slate-800 text-white font-black text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-amber-400"
                                           placeholder="Nominal potong kasbon..."
                                        />
                                        <button 
                                           type="button" 
                                           onClick={() => setPartialPaymentModal({ ...partialPaymentModal, customKasbonDeduction: 0 })}
                                           className="text-[9px] font-black uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-2 rounded-lg border border-slate-700"
                                        >
                                           Rp 0
                                        </button>
                                        <button 
                                           type="button" 
                                           onClick={() => setPartialPaymentModal({ ...partialPaymentModal, customKasbonDeduction: currentStats.totalKasbon })}
                                           className="text-[9px] font-black uppercase bg-amber-400/20 text-amber-300 px-2 py-2 rounded-lg border border-amber-400/30"
                                        >
                                           Semua
                                        </button>
                                     </div>
                                  )}
                               </div>

                               {/* Edit Tabungan */}
                               <div className="pt-3 border-t border-slate-800 space-y-1.5">
                                  <div className="flex justify-between items-center text-xs">
                                     <span className="text-sky-400 font-bold">Nominal Tabungan Masuk:</span>
                                     <span className="font-black text-sky-400">+Rp {effectiveTabungan.toLocaleString('id-ID')}</span>
                                  </div>
                                  <input 
                                     type="number" 
                                     min="0"
                                     value={customTabungan}
                                     onChange={e => setPartialPaymentModal({ ...partialPaymentModal, customTabungan: Number(e.target.value) || 0 })}
                                     className="w-full bg-slate-800 text-white font-black text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-sky-400"
                                     placeholder="Nominal tabungan..."
                                  />
                               </div>

                               {/* Penyesuaian Manual Tambahan */}
                               <div className="pt-3 border-t border-slate-800 space-y-2">
                                  <label className="block text-[10px] font-black text-purple-300 uppercase tracking-wider">
                                     Penyesuaian Manual (Bonus / Potongan)
                                  </label>
                                  <div className="grid grid-cols-2 gap-2">
                                     <input 
                                        type="number"
                                        value={customAdjustmentAmount || ''}
                                        onChange={e => setPartialPaymentModal({ ...partialPaymentModal, customAdjustmentAmount: Number(e.target.value) || 0 })}
                                        className="bg-slate-800 text-white font-black text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-400"
                                        placeholder="Nominal (+ / -)"
                                     />
                                     <input 
                                        type="text"
                                        value={customAdjustmentNote}
                                        onChange={e => setPartialPaymentModal({ ...partialPaymentModal, customAdjustmentNote: e.target.value })}
                                        className="bg-slate-800 text-white font-medium text-xs px-3 py-2 rounded-xl border border-slate-700 focus:outline-none focus:border-purple-400"
                                        placeholder="Catatan..."
                                     />
                                  </div>
                               </div>

                               {/* Net Total Output */}
                               <div className="pt-4 border-t-2 border-slate-800 flex justify-between items-end">
                                  <div>
                                     <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-0.5">Total Diterima Bersih</p>
                                     <p className="text-[10px] text-slate-400 font-bold">Siap Dicairkan</p>
                                  </div>
                                  <div className="text-3xl font-black text-emerald-400 tracking-tight tabular-nums">
                                     Rp {calculatedNet.toLocaleString('id-ID')}
                                  </div>
                               </div>
                            </div>
                         </div>

                         {/* Action Buttons */}
                         <div className="flex gap-3">
                            <button
                               type="button"
                               disabled={isProcessing}
                               onClick={() => setPartialPaymentModal(null)}
                               className="flex-1 bg-white border-2 border-slate-200 text-slate-600 font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-slate-50 transition-all text-xs disabled:opacity-50"
                            >
                               Batal
                            </button>
                            <button
                               type="button"
                               disabled={isProcessing || selectedSubIds.length === 0}
                               onClick={executePartialPayment}
                               className="flex-[2] bg-emerald-600 text-white font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 text-xs active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                               {isProcessing ? (
                                  <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                               ) : (
                                  `Bayar ${selectedSubIds.length} Setoran Terpilih`
                                )}
                            </button>
                         </div>
                      </div>
                   </div>
                </motion.div>
             </div>
          );
       })()}
       </AnimatePresence>

       {/* Modal Edit Manual Penyesuaian Gaji */}
       <AnimatePresence>
       {adjustModalTailorId && (() => {
          const tailor = tailors.find(t => t.id === adjustModalTailorId);
          const activeAdjs = manualAdjustments.filter(m => m.tailorId === adjustModalTailorId && !m.isPaid);

          return (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/70 backdrop-blur-sm no-print">
                <motion.div
                   initial={{ scale: 0.9, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   exit={{ scale: 0.9, opacity: 0 }}
                   className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg p-8 border border-slate-100"
                >
                   <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                         <div className="bg-purple-600 text-white p-3 rounded-2xl shadow-lg shadow-purple-600/20">
                            <Edit3 size={22} />
                         </div>
                         <div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">Penyesuaian Manual</h3>
                            <p className="text-xs font-bold text-slate-500 uppercase">{tailor?.name}</p>
                         </div>
                      </div>
                      <button onClick={() => setAdjustModalTailorId(null)} className="text-slate-400 hover:text-slate-900 p-2 rounded-xl">
                         <X size={20} />
                      </button>
                   </div>

                   <form onSubmit={handleSaveAdjustment} className="space-y-4">
                      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                         <button
                            type="button"
                            onClick={() => setAdjustForm({ ...adjustForm, type: 'bonus' })}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${adjustForm.type === 'bonus' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                         >
                            + Tambahan / Bonus
                         </button>
                         <button
                            type="button"
                            onClick={() => setAdjustForm({ ...adjustForm, type: 'potongan' })}
                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${adjustForm.type === 'potongan' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                         >
                            - Potongan Khusus
                         </button>
                      </div>

                      <div className="space-y-2">
                         <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            Nominal (Rp)
                         </label>
                         <input 
                            type="number"
                            min="1"
                            value={adjustForm.amount || ''}
                            onChange={e => setAdjustForm({ ...adjustForm, amount: Number(e.target.value) || 0 })}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black focus:bg-white focus:border-purple-500 focus:outline-none"
                            placeholder="Contoh: 50000"
                            required
                         />
                      </div>

                      <div className="space-y-2">
                         <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                            Alasan / Keterangan Penyesuaian
                         </label>
                         <input 
                            type="text"
                            value={adjustForm.notes}
                            onChange={e => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white focus:border-purple-500 focus:outline-none"
                            placeholder="Misal: Insentif lembur cepat / Denda barang cacat"
                            required
                         />
                      </div>

                      {activeAdjs.length > 0 && (
                         <div className="pt-3 border-t border-slate-100">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Penyesuaian Belum Dibayar:</p>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                               {activeAdjs.map(adj => (
                                  <div key={adj.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl text-xs font-bold">
                                     <span className="text-slate-700">{adj.notes}</span>
                                     <div className="flex items-center gap-2">
                                        <span className={adj.amount > 0 ? 'text-purple-600 font-black' : 'text-rose-600 font-black'}>
                                           {adj.amount > 0 ? '+' : ''}Rp {adj.amount.toLocaleString('id-ID')}
                                        </span>
                                        <button 
                                           type="button"
                                           onClick={() => handleDeleteAdjustment(adj.id!)}
                                           className="text-rose-400 hover:text-rose-600 p-1"
                                        >
                                           <Trash2 size={13} />
                                        </button>
                                     </div>
                                  </div>
                               ))}
                            </div>
                         </div>
                      )}

                      <div className="flex gap-3 pt-4">
                         <button
                            type="button"
                            disabled={isProcessing}
                            onClick={() => setAdjustModalTailorId(null)}
                            className="flex-1 bg-white border-2 border-slate-200 text-slate-500 font-bold uppercase tracking-widest py-3.5 rounded-2xl text-xs"
                         >
                            Batal
                         </button>
                         <button
                            type="submit"
                            disabled={isProcessing}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest py-3.5 rounded-2xl text-xs shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                         >
                            {isProcessing ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</> : 'Simpan Penyesuaian'}
                         </button>
                      </div>
                   </form>
                </motion.div>
             </div>
          );
       })()}
       </AnimatePresence>

       {/* Detail Modal */}
       <AnimatePresence>
       {detailModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm no-print">
             <motion.div 
               initial={{ y: 50, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               exit={{ y: 50, opacity: 0 }}
               className="bg-white sm:rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-screen sm:max-h-[92vh] flex flex-col overflow-hidden"
             >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                   <div className="flex items-center gap-5">
                      <div className="bg-indigo-600 text-white p-4 rounded-[1.5rem] shadow-lg shadow-indigo-600/30">
                         <Calculator size={28}/>
                      </div>
                      <div>
                         <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">{detailModalData.tailorName}</h3>
                         <p className="text-[10px] text-slate-500 mt-2 font-black uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg inline-block">Rincian Slip Gaji Periode Ini</p>
                      </div>
                   </div>
                   <div className="flex flex-wrap sm:flex-nowrap gap-3">
                      <button 
                         onClick={() => setShowAmountsGlobal(!showAmountsGlobal)} 
                         className={`flex px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest items-center justify-center gap-2 transition-all shadow-sm border ${showAmountsGlobal ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                      >
                         {showAmountsGlobal ? <EyeOff size={16}/> : <Eye size={16}/>} 
                         {showAmountsGlobal ? 'Sembunyi' : 'Lihat Angka'}
                      </button>
                      {(userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin') && (
                         <>
                            <button 
                               onClick={() => {
                                  const tId = detailModalData.tailorId;
                                  const sbs = detailModalData.subs;
                                  setDetailModalData(null);
                                  openPartialPayment(tId, sbs);
                               }} 
                               className="bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/10 transition-all active:scale-95 flex items-center gap-1.5"
                            >
                               <Sliders size={15} /> Bayar Sebagian
                            </button>
                            <button 
                               onClick={() => setConfirmPaymentData({ tailorId: detailModalData.tailorId, stats: detailModalData.stats, subs: detailModalData.subs })} 
                               className="bg-slate-900 text-white hover:bg-indigo-600 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all active:scale-95"
                            >
                               Bayar Semua
                            </button>
                         </>
                      )}
                      <button onClick={() => setDetailModalData(null)} className="text-slate-400 hover:text-slate-900 bg-white border border-slate-100 p-3 rounded-2xl transition-all active:scale-95 shadow-sm">
                         <X size={24}/>
                      </button>
                   </div>
                </div>
                
                <div className="overflow-y-auto flex-1 p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 custom-scrollbar">
                   <div className="lg:col-span-7">
                      <div className="flex items-center justify-between mb-6">
                         <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <ListIcon size={22} className="text-indigo-600"/> Detail Setoran Pekerjaan
                         </h4>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {detailModalData.subs.length} Rekaman
                         </span>
                      </div>
                      
                      <div className="space-y-4">
                        {detailModalData.subs.map(s => {
                           const details = getJobDetails(s.jobId, s.partType);
                           const nomQty = getSubmissionNominalQty(s);
                           return (
                              <div key={s.id} className="bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-5 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                                 <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                       <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{details.poNumber}</span>
                                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(s.dateSubmitted).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                                       <span className="text-[8px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-widest">{s.partType || 'Set'}</span>
                                    </div>
                                    <h5 className="font-bold text-slate-800 text-sm mb-1">{details.itemInfo}</h5>
                                    <div className="flex gap-4">
                                       <div className="flex flex-col">
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Setoran</span>
                                          <span className="text-xs font-black text-slate-700 uppercase tabular-nums">
                                             {s.partType && s.partType !== 'Set' ? `${nomQty} pcs (${s.qtySubmitted} Set)` : `${s.qtySubmitted} Set`}
                                          </span>
                                       </div>
                                       <div className="flex flex-col">
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Upah ({s.partType || 'Set'})</span>
                                          <span className="text-xs font-black text-slate-700 uppercase tabular-nums">Rp {details.wage.toLocaleString('id-ID')}</span>
                                       </div>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subtotal Wage</p>
                                    <p className="font-black text-slate-900 text-lg tabular-nums">
                                       {displayAmount(s.wageTotal, `mtw_${s.id}`)}
                                    </p>
                                 </div>
                              </div>
                           )
                        })}
                      </div>
                   </div>

                   <div className="lg:col-span-5 space-y-8">
                      {/* Paper-style Receipt */}
                      <div className="bg-white border-4 border-slate-50 rounded-[3rem] p-8 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                         <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-100 rounded-b-full"></div>
                         <h4 className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-10 pt-4">Ringkasan Slip</h4>
                         
                         <div className="space-y-6">
                            <div className="flex justify-between items-center group">
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Upah Jahit</span>
                                  <span className="text-xs font-bold text-slate-400">Akumulasi {detailModalData.stats!.totalQty} Pcs</span>
                               </div>
                               <span className="text-xl font-black text-slate-900 tabular-nums">
                                  {displayAmount(detailModalData.stats!.totalWage, 'h_wage')}
                                </span>
                            </div>

                            <div className="flex justify-between items-center">
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Bonus Grade</span>
                                  <span className="text-xs font-bold text-emerald-400/60 uppercase">Tier: {detailModalData.stats!.gradeName}</span>
                               </div>
                               <span className="text-xl font-black text-emerald-600 tabular-nums">
                                  +{displayAmount(detailModalData.stats!.bonus, 'h_bonus')}
                               </span>
                            </div>

                            {detailModalData.stats?.tailorAdjustments?.length > 0 && (
                               detailModalData.stats.tailorAdjustments.map((m: any) => (
                                  <div key={m.id} className="flex justify-between items-center">
                                     <div className="flex flex-col">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${m.amount > 0 ? 'text-purple-400' : 'text-rose-400'}`}>Edit Gaji Manual</span>
                                        <span className="text-xs font-bold text-slate-400">{m.notes}</span>
                                     </div>
                                     <span className={`text-xl font-black tabular-nums ${m.amount > 0 ? 'text-purple-600' : 'text-rose-500'}`}>
                                        {m.amount > 0 ? '+' : ''}{displayAmount(m.amount, 'h_adj_'+m.id)}
                                     </span>
                                  </div>
                               ))
                            )}

                            <div className="flex justify-between items-center py-4 border-y border-slate-50 border-dashed">
                               <div className="flex flex-col">
                                  <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Dipotong Kasbon</span>
                                  <span className="text-xs font-bold text-slate-400">Otomatis Lunas</span>
                                </div>
                               <span className="text-xl font-black text-rose-500 tabular-nums">
                                  -{displayAmount(detailModalData.stats!.totalKasbon, 'h_kasbon')}
                                </span>
                            </div>

                            <div className="flex justify-between items-end pt-4">
                               <div className="flex flex-col">
                                  <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Total Bersih</span>
                                  <span className="text-[10px] font-bold text-slate-300">Ready to Transfer</span>
                               </div>
                               <div className="text-4xl font-black text-indigo-600 tracking-tighter tabular-nums drop-shadow-sm">
                                  {displayAmount(detailModalData.stats!.netPayment, 'h_net')}
                               </div>
                            </div>
                         </div>
                         
                         <div className="mt-8 pt-8 border-t-2 border-slate-50 flex items-center justify-between text-sky-600">
                            <div className="flex items-center gap-2">
                               <div className="p-2 bg-sky-50 rounded-xl">
                                  <PiggyBank size={18}/>
                               </div>
                               <span className="text-[10px] font-black uppercase tracking-widest">Akumulasi Tabungan</span>
                            </div>
                            <span className="font-black text-lg">+{displayAmount(detailModalData.stats!.totalTabungan, 'h_tab')}</span>
                         </div>
                      </div>

                      {detailModalData.stats?.tailorKasbons?.length > 0 && (
                        <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                           <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Info size={14}/> Rincian Kasbon Terpotong
                           </h5>
                           <div className="space-y-3">
                              {detailModalData.stats.tailorKasbons.map((k:any) => (
                                 <div key={k.id} className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-slate-600">{new Date(k.date).toLocaleDateString('id-ID')} — {k.notes || 'Pinjaman'}</span>
                                    <span className="font-black text-rose-500">Rp {k.amount.toLocaleString('id-ID')}</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                      )}
                   </div>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Salary Full Confirmation Modal */}
       <AnimatePresence>
       {confirmPaymentData && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md no-print">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-8 border border-slate-100"
             >
                <div className="flex flex-col items-center text-center mb-8">
                   <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-indigo-600/10">
                      <Wallet size={40} />
                   </div>
                   <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Konfirmasi Bayar Gaji</h3>
                   <p className="text-slate-500 font-medium text-sm mt-3 px-4">Pastikan uang tunai atau transfer sudah disiapkan sebelum menekan tombol konfirmasi.</p>
                </div>
                
                <div className="space-y-4">
                   <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Nama Penerima</p>
                      <p className="font-black text-slate-900 text-xl text-center tracking-tight">{confirmPaymentData.stats.tailorName}</p>
                   </div>
                   
                   <div className="p-6 bg-indigo-50 rounded-[2rem] border-2 border-indigo-100 flex flex-col items-center">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">Total Transfer / Tunai</p>
                      <p className="font-black text-indigo-600 text-4xl tracking-tighter">Rp {confirmPaymentData.stats.netPayment.toLocaleString('id-ID')}</p>
                   </div>

                   <ul className="py-4 space-y-2">
                      <li className="flex items-center gap-3 text-xs font-bold text-slate-500">
                         <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 size={12}/></div>
                         {confirmPaymentData.subs.length} Setoran ditandai "Sudah Dibayar"
                      </li>
                      <li className="flex items-center gap-3 text-xs font-bold text-slate-500">
                         <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 size={12}/></div>
                         Kasbon berjalan otomatis Lunas
                      </li>
                      <li className="flex items-center gap-3 text-xs font-bold text-slate-500">
                         <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle2 size={12}/></div>
                         Arsip masuk ke Rekap Gaji & Histori
                      </li>
                   </ul>

                   <div className="flex gap-4 pt-4">
                      <button 
                         type="button"
                         disabled={isProcessing}
                         onClick={() => !isProcessing && setConfirmPaymentData(null)}
                         className="flex-1 bg-white border-2 border-slate-100 text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest py-4 rounded-[1.5rem] transition-all text-xs disabled:opacity-50"
                      >
                         Batal
                      </button>
                      <button 
                         type="button"
                         onClick={payTailorSalary}
                         disabled={isProcessing}
                         className="flex-1 bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-[1.5rem] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 text-xs active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                         {isProcessing ? (
                            <><Loader2 size={18} className="animate-spin" /> Memproses...</>
                         ) : (
                            'Ya, Bayar'
                         )}
                      </button>
                   </div>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Notification / Result Modal (Cek History atau Tutup) */}
       <AnimatePresence>
       {modalAlert.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md no-print">
             <motion.div
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-8 text-center"
             >
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 ${
                  modalAlert.type === 'error'
                    ? 'bg-rose-50 text-rose-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {modalAlert.type === 'error' ? <AlertCircle size={32} /> : <CheckCircle2 size={32} />}
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-2">{modalAlert.title}</h3>
                <p className="text-sm font-medium text-slate-500 mb-7 leading-relaxed">{modalAlert.message}</p>

                <div className="flex gap-3">
                   {modalAlert.showCheckHistory && onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalAlert(prev => ({ ...prev, isOpen: false }));
                          onNavigate('history');
                        }}
                        className="flex-1 px-4 py-3.5 rounded-2xl text-indigo-700 font-black bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-1.5"
                      >
                        <History size={15} /> Cek History
                      </button>
                   )}
                   <button
                     type="button"
                     onClick={() => setModalAlert(prev => ({ ...prev, isOpen: false }))}
                     className="flex-1 px-4 py-3.5 rounded-2xl text-white font-black bg-slate-900 hover:bg-slate-800 transition-colors active:scale-95 text-xs uppercase tracking-widest"
                   >
                     Tutup
                   </button>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>
    </div>
  );
}

function ListIcon({ size, className }: { size: number, className?: string }) {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
         <line x1="8" y1="6" x2="21" y2="6"></line>
         <line x1="8" y1="12" x2="21" y2="12"></line>
         <line x1="8" y1="18" x2="21" y2="18"></line>
         <line x1="3" y1="6" x2="3.01" y2="6"></line>
         <line x1="3" y1="12" x2="3.01" y2="12"></line>
         <line x1="3" y1="18" x2="3.01" y2="18"></line>
      </svg>
   );
}
