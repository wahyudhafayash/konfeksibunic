import { useState, useRef, useMemo } from 'react';
import { db, useLiveQuery, PO, SalaryPayment, TabunganWithdrawal, Kasbon, SewingSubmission, SewingJob, getPOItemPricing } from '@/lib/db';
import { Search, ChevronRight, CheckCircle2, Wallet, PiggyBank, Package, Clock, Filter, Calendar, X, Eye, EyeOff, Printer, Info, Download, ArrowRight, User, TrendingUp, Users, Phone, MapPin, BadgePercent, CheckSquare, Layers, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HistoryView() {
  const [activeTab, setActiveTab] = useState<'po' | 'salary' | 'tabungan' | 'tailors' | 'logs'>('po');
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedTailorId, setSelectedTailorId] = useState<number | null>(null);
  const [showAmountsGlobal, setShowAmountsGlobal] = useState(false);
  const [visibleAmounts, setVisibleAmounts] = useState<Record<string, boolean>>({});
  
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [selectedSalary, setSelectedSalary] = useState<any>(null);
  const [selectedDeletedTailor, setSelectedDeletedTailor] = useState<any>(null);
  const [tailorModalSubTab, setTailorModalSubTab] = useState<'jobs' | 'submissions' | 'salaries' | 'finances' | 'profile'>('jobs');
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [selectedArchiveInfo, setSelectedArchiveInfo] = useState<any>(null);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [tailorHistoryTab, setTailorHistoryTab] = useState<'all' | 'deleted'>('all');
  const [deletedTailorFilter, setDeletedTailorFilter] = useState<{ fromDate: string; toDate: string; sortBy: 'terbaru' | 'terlama' }>({
     fromDate: '',
     toDate: '',
     sortBy: 'terbaru'
  });
  const printRef = useRef<HTMLDivElement>(null);

  const tailors = useLiveQuery(() => db.tailors.toArray(), []) || [];
  const poItems = useLiveQuery(() => db.poItems.toArray(), []) || [];
  const pos = useLiveQuery(() => db.pos.toArray(), []) || [];
  const subs = useLiveQuery(() => db.sewingSubmissions.orderBy('id').reverse().toArray(), []) || [];
  const jobs = useLiveQuery(() => db.sewingJobs.toArray(), []) || [];
  const salaryPayments = useLiveQuery(() => db.salaryPayments.orderBy('id').reverse().toArray(), []) || [];
  const kasbons = useLiveQuery(() => db.kasbons.toArray(), []) || [];
  const tabunganWithdrawals = useLiveQuery(() => db.tabunganWithdrawals.toArray(), []) || [];
  const activeTabunganList = useLiveQuery(() => db.activeTabungan.toArray(), []) || [];
  const logs = useLiveQuery(() => db.appLogs.orderBy('date').reverse().toArray(), []) || [];

  const archivePOs = useLiveQuery(() => db.archivePOs.orderBy('archivedAt').reverse().toArray(), []) || [];
  const archiveSalaries = useLiveQuery(() => db.archiveSalaries.orderBy('archivedAt').reverse().toArray(), []) || [];
  const archiveTabungan = useLiveQuery(() => db.archiveTabungan.orderBy('archivedAt').reverse().toArray(), []) || [];
  const archiveTailors = useLiveQuery(() => db.archiveTailors.orderBy('archivedAt').reverse().toArray(), []) || [];

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Struk Digital - Konfeksi</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>@media print { @page { margin: 1cm; } .no-print { display: none; } } body { font-family: sans-serif; padding: 20px; }</style>
        </head>
        <body>${printContent}<script>window.onload = () => { window.print(); window.close(); };</script></body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPOCSV = (po: PO) => {
    const items = poItems.filter(it => it.poId === po.id);
    const headers = ['PO Number', 'Customer', 'Date', 'Item Name', 'Color', 'Size', 'Qty (pcs)'];
    const rows = items.map(item => [po.poNumber, po.customerName, po.date, item.itemName, item.color, item.size, item.qty]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `PO_${po.poNumber}_${po.customerName}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getTailorName = (tailorId: number, fallbackName?: string) => {
     const t = tailors.find(x => x.id === tailorId);
     if (!t) return fallbackName || 'Unknown';
     return t.partnerName ? `${t.name} & ${t.partnerName}` : t.name;
  };

  const isWithinDateRange = (dateStr: string) => {
    if (!fromDate && !toDate) return true;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      if (date < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
    return true;
  };

  const currentPOs = useMemo(() => {
    const raw = archivePOs.filter(a => {
      const livePo = pos.find(x => x.id === (a.originalId || a.data?.id));
      const p = livePo ? { ...a.data, ...livePo } : a.data;
      const matchesSearch = (p.poNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) || (p.customerName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = isWithinDateRange(a.archivedAt);
      return matchesSearch && matchesDate;
    });

    const seenPoIds = new Set();
    return raw.filter(a => {
      if (!a.originalId) return true;
      if (seenPoIds.has(a.originalId)) return false;
      seenPoIds.add(a.originalId);
      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.archivedAt).getTime();
      const timeB = new Date(b.archivedAt).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [archivePOs, pos, searchQuery, fromDate, toDate, sortOrder]);

  const currentSalaries = useMemo(() => {
    const raw = archiveSalaries.filter(s => {
      const d = s.data;
      const tailorName = getTailorName(d.tailorId, d.tailorName);
      const matchesSearch = tailorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = isWithinDateRange(s.archivedAt);
      const matchesTailor = selectedTailorId ? d.tailorId === selectedTailorId : true;
      return matchesSearch && matchesDate && matchesTailor;
    });

    const seenSalaryIds = new Set();
    return raw.filter(s => {
      if (!s.originalId) return true;
      if (seenSalaryIds.has(s.originalId)) return false;
      seenSalaryIds.add(s.originalId);
      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.archivedAt).getTime();
      const timeB = new Date(b.archivedAt).getTime();
      if (timeA === timeB) {
        return sortOrder === 'desc' ? (b.originalId || 0) - (a.originalId || 0) : (a.originalId || 0) - (b.originalId || 0);
      }
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [archiveSalaries, tailors, searchQuery, fromDate, toDate, selectedTailorId, sortOrder]);

  const currentTabungan = useMemo(() => {
    const raw = archiveTabungan.filter(w => {
      const d = w.data;
      const tailorName = getTailorName(d.tailorId, d.tailorName);
      const matchesSearch = tailorName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = isWithinDateRange(w.archivedAt);
      const matchesTailor = selectedTailorId ? d.tailorId === selectedTailorId : true;
      return matchesSearch && matchesDate && matchesTailor;
    });

    const seenTabunganIds = new Set();
    return raw.filter(w => {
      if (!w.originalId) return true;
      if (seenTabunganIds.has(w.originalId)) return false;
      seenTabunganIds.add(w.originalId);
      return true;
    }).sort((a, b) => {
      const timeA = new Date(a.archivedAt).getTime();
      const timeB = new Date(b.archivedAt).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [archiveTabungan, tailors, searchQuery, fromDate, toDate, selectedTailorId, sortOrder]);

  const currentTailors = useMemo(() => {
    return archiveTailors.filter(t => {
      const d = t.data;
      const matchesSearch = (d.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (d.partnerName || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = isWithinDateRange(t.archivedAt);
      return matchesSearch && matchesDate;
    }).sort((a, b) => {
      const timeA = new Date(a.archivedAt).getTime();
      const timeB = new Date(b.archivedAt).getTime();
      return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
    });
  }, [archiveTailors, searchQuery, fromDate, toDate, sortOrder]);

  const displayAmount = (amount: number, key: string, customClass: string = "") => {
    const isVisible = showAmountsGlobal || visibleAmounts[key];
    return (
       <span className={`inline-flex items-center gap-2 cursor-pointer hover:opacity-80 transition-all ${customClass}`} onClick={() => setVisibleAmounts(prev => ({ ...prev, [key]: !prev[key] }))}>
          {isVisible ? `Rp ${amount.toLocaleString('id-ID')}` : 'Rp ••••••'}
          <span className="p-1 rounded-md bg-slate-100 group-hover:bg-slate-200">
             {isVisible ? <EyeOff size={10}/> : <Eye size={10}/>}
          </span>
       </span>
    );
  };

  const formatDate = (dateStr: string) => {
     try {
        const d = new Date(dateStr);
        return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(d);
     } catch (e) { return dateStr; }
  };

  const getJobDetailsById = (jobId: number) => {
    const job = jobs.find(j => j.id === jobId);
    if (!job) return { itemInfo: 'Unknown', wage: 0, tabungan: 0, poNumber: '-' };
    const item = poItems.find(i => i.id === job.poItemId);
    const po = item ? pos.find(p => p.id === item.poId) : null;
    return {
      poNumber: po?.poNumber || 'Unknown PO',
      itemInfo: item ? `${item.itemName} (${item.color}, ${item.size})` : 'Unknown',
      wage: job.wagePerPcs,
      tabungan: job.tabunganPerPcs || 0
    };
  };

  function getPoItemLabel(poItemId: number) {
     const item = poItems.find(i => i.id === poItemId);
     if(!item) return 'Unknown';
     const po = pos.find(p => p.id === item.poId);
     return `${po?.poNumber || '?'} - ${item.itemName} (${item.color}, ${item.size})`;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1 }
  };

  return (
    <div className="space-y-10 pb-24">
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Histori Sistem</h2>
            <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Basis data riwayat produksi dan log aktivitas</p>
          </div>
          <div className="flex flex-wrap gap-3 w-full lg:w-auto items-center">
             <button 
               onClick={() => setShowAmountsGlobal(!showAmountsGlobal)} 
               className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm border ${showAmountsGlobal ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
             >
               {showAmountsGlobal ? <EyeOff size={16} className="inline mr-2"/> : <Eye size={16} className="inline mr-2"/>} 
               {showAmountsGlobal ? 'Masking Angka' : 'Tampilkan Angka'}
             </button>
          </div>
       </div>

       <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600" size={18} />
              <input 
                type="text" 
                placeholder="Cari kata kunci..."
                className="pl-12 pr-4 py-3 w-full text-sm font-bold border-2 border-slate-50 rounded-2xl focus:border-indigo-500 focus:outline-none bg-slate-50/50 transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50/50 border-2 border-slate-50 rounded-2xl px-4 py-2 sm:py-1 col-span-1 lg:col-span-1 min-w-fit">
              <Calendar size={18} className="text-slate-400 shrink-0" />
              <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                <input type="date" className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full min-w-[110px]" value={fromDate} onChange={(e) => setFromDate(e.target.value)}/>
                <span className="text-slate-300 text-xs font-black shrink-0">TO</span>
                <input type="date" className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full min-w-[110px]" value={toDate} onChange={(e) => setToDate(e.target.value)}/>
              </div>
            </div>

            {(activeTab === 'salary' || activeTab === 'tabungan') && (
              <div className="flex items-center gap-3 bg-slate-50/50 border-2 border-slate-50 rounded-2xl px-4 py-1">
                <User size={18} className="text-slate-400" />
                <select className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full uppercase" value={selectedTailorId || ''} onChange={(e) => setSelectedTailorId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Semua Penjahit</option>
                  {tailors.map(t => <option key={t.id} value={t.id}>{t.name} {t.partnerName ? `& ${t.partnerName}` : ''}</option>)}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 bg-slate-50/50 border-2 border-slate-50 rounded-2xl px-4 py-1">
              <TrendingUp size={18} className="text-slate-400" />
              <select 
                className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full uppercase" 
                value={sortOrder} 
                onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
              >
                <option value="desc">Terbaru ke Terlama</option>
                <option value="asc">Terlama ke Terbaru</option>
              </select>
            </div>

            {(fromDate || toDate || selectedTailorId || searchQuery) && (
              <button onClick={() => { setFromDate(''); setToDate(''); setSelectedTailorId(null); setSearchQuery(''); }} className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
                <X size={16} /> Reset Filter
              </button>
            )}
          </div>

          <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl self-start w-full sm:w-auto overflow-x-auto custom-scrollbar flex-wrap">
             <button onClick={() => setActiveTab('po')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'po' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Histori PO</button>
             <button onClick={() => setActiveTab('salary')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'salary' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Riwayat Gaji</button>
             <button onClick={() => setActiveTab('tabungan')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'tabungan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Riwayat Tabungan</button>
             <button onClick={() => setActiveTab('tailors')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'tailors' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Data Penjahit & Detail</button>
             <button onClick={() => setActiveTab('logs')} className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Log Aktivitas</button>
          </div>
       </div>

       <motion.div variants={containerVariants} initial="hidden" animate="visible" key={activeTab}>
          {activeTab === 'po' && (
             <div className="space-y-12">
                {currentPOs.length === 0 ? (
                   <div className="text-center py-20 opacity-40 italic font-bold">Data riwayat PO tidak ditemukan.</div>
                ) : (
                   Object.entries(
                     currentPOs.reduce((acc, arc) => {
                       const livePo = pos.find(x => x.id === (arc.originalId || arc.data?.id));
                       const po = livePo ? { ...arc.data, ...livePo } : arc.data;
                       const name = po.customerName;
                       if (!acc[name]) acc[name] = [];
                       acc[name].push({ ...po, archiveInfo: arc });
                       return acc;
                     }, {} as Record<string, any[]>)
                   ).map(([customerName, itemsInGroup]) => (
                     <div key={customerName} className="space-y-6">
                       <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
                         <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div> {customerName}
                       </h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {itemsInGroup.map(item => {
                             const po = item;
                             const arc = item.archiveInfo;
                             const items = poItems.filter(i => i.poId === po.id || i.poId === arc.originalId);
                             const totalPcs = items.reduce((sum, i) => sum + i.qty, 0);
                             return (
                                <motion.div variants={itemVariants} key={arc.id} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 shadow-sm hover:border-emerald-100 hover:shadow-md transition-all group relative overflow-hidden">
                                   <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => { setSelectedPO(po); setSelectedArchiveInfo(arc); }} className="bg-white border border-slate-200 p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm">
                                         <Info size={16}/>
                                      </button>
                                   </div>
                                   <div className="mb-6">
                                      <div className="flex items-center gap-2 mb-1">
                                         <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] block">Data Terarsip: {formatDate(arc.archivedAt)}</span>
                                      </div>
                                      <h3 className="font-black text-slate-900 text-xl tracking-tight leading-tight uppercase group-hover:text-emerald-600 transition-colors">#{po.poNumber}</h3>
                                      <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Oleh: {arc.archivedBy}</p>
                                   </div>
                                   
                                   <div className="space-y-1 mt-auto">
                                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Kapasitas Produksi</p>
                                      <div className="flex items-center gap-2">
                                         <span className="text-2xl font-black text-slate-900">{totalPcs}</span>
                                         <span className="text-xs font-black text-slate-400 uppercase tracking-widest">PCS TOTAL</span>
                                      </div>
                                   </div>
                                   
                                   <div className="mt-6 flex gap-2">
                                      {po.status === 'Dihapus' ? (
                                        <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-rose-100/50">
                                           <X size={12}/> DELETED
                                        </span>
                                      ) : (
                                        <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-emerald-100/50">
                                           <CheckCircle2 size={12}/> CLOSED
                                        </span>
                                      )}
                                   </div>
                                </motion.div>
                             );
                          })}
                       </div>
                     </div>
                   ))
                )}
             </div>
           )}

           {activeTab === 'salary' && (
             <div className="space-y-12">
                {currentSalaries.length === 0 ? (
                   <div className="text-center py-20 opacity-40 italic font-bold">Data riwayat gaji tidak ditemukan.</div>
                ) : (
                   Object.entries(
                     currentSalaries.reduce((acc, arc) => {
                       const sal = arc.data;
                       const name = getTailorName(sal.tailorId, sal.tailorName);
                       if (!acc[name]) acc[name] = [];
                       acc[name].push({ ...sal, archiveInfo: arc });
                       return acc;
                     }, {} as Record<string, any[]>)
                   ).map(([name, allItemsInGroup]) => {
                     const isSpecificTailor = selectedTailorId !== null;
                     const itemsInGroup = isSpecificTailor ? allItemsInGroup : allItemsInGroup.slice(0, 3);
                     const hasMore = allItemsInGroup.length > 3 && !isSpecificTailor;
                     const groupTailorId = allItemsInGroup[0].tailorId;

                     return (
                      <div key={name} className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                           <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                             <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div> {name}
                           </h3>
                           {hasMore && (
                              <button 
                                onClick={() => setSelectedTailorId(groupTailorId)}
                                className="text-xs font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1 group"
                              >
                                Lihat semua riwayat {name}
                                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                              </button>
                           )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {itemsInGroup.map(item => {
                            const sal = item;
                            const arc = item.archiveInfo;
                            return (
                               <motion.div variants={itemVariants} key={arc.id} onClick={() => { setSelectedSalary(sal); setSelectedArchiveInfo(arc); }} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all cursor-pointer group">
                                  <div className="flex justify-between items-start mb-6">
                                     <div>
                                        <div className="flex items-center gap-2 mb-1">
                                           <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">Data Terarsip: {formatDate(arc.archivedAt)}</p>
                                        </div>
                                        <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">Slip #{arc.originalId || sal.id}</h4>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Oleh: {arc.archivedBy}</p>
                                     </div>
                                     <div className="bg-indigo-50 text-indigo-500 p-2.5 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                        <Wallet size={20}/>
                                     </div>
                                  </div>
                                  
                                  <div className="space-y-3 mb-8">
                                     <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2.5 rounded-xl">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Qty Setor</span>
                                        <span className="text-sm font-black text-slate-700 tabular-nums">{sal.totalQty} PCS</span>
                                     </div>
                                     <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-400">Upah Bruto</span>
                                        <span className="font-black text-slate-700">{displayAmount(sal.totalWage, `arc_sal_wage_${arc.id}`)}</span>
                                     </div>
                                     <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-400">Bonus Grade</span>
                                        <span className="font-black text-emerald-600">+{displayAmount(sal.bonusAmount || 0, `arc_sal_bonus_${arc.id}`)}</span>
                                     </div>
                                     {!!sal.manualAdjustment && (
                                        <div className="flex justify-between items-center text-xs">
                                           <span className="font-bold text-slate-400">Penyesuaian</span>
                                           <span className={`font-black ${sal.manualAdjustment > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                              {sal.manualAdjustment > 0 ? '+' : ''}{displayAmount(sal.manualAdjustment, `arc_sal_adj_${arc.id}`)}
                                           </span>
                                        </div>
                                     )}
                                     <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-400">Potong Kasbon</span>
                                        <span className="font-black text-rose-600">-{displayAmount(sal.kasbonDeducted || 0, `arc_sal_kasbon_${arc.id}`)}</span>
                                     </div>
                                     <div className="flex justify-between items-center text-xs">
                                        <span className="font-bold text-slate-400">Tabungan Masuk</span>
                                        <span className="font-black text-sky-600">+{displayAmount(sal.tabunganAccumulated || 0, `arc_sal_tab_${arc.id}`)}</span>
                                     </div>
                                  </div>

                                  <div className="pt-6 border-t border-slate-50 flex justify-between items-end">
                                     <div>
                                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest block">Total Bersih (Netto)</span>
                                        <span className="text-xl font-black text-indigo-600 tabular-nums">
                                           {displayAmount(sal.netPayment, `arc_sal_net_${arc.id}`)}
                                        </span>
                                     </div>
                                     <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                                        Lihat Slip <ArrowRight size={12}/>
                                     </span>
                                  </div>
                               </motion.div>
                            );
                          })}
                        </div>
                      </div>
                     );
                   })
                )}
             </div>
           )}

           {activeTab === 'tabungan' && (
              <div className="space-y-12">
                 {currentTabungan.length === 0 ? (
                    <div className="text-center py-20 opacity-40 italic font-bold">Data riwayat tabungan tidak ditemukan.</div>
                 ) : (
                    Object.entries(
                      currentTabungan.reduce((acc, arc) => {
                        const wd = arc.data;
                        const name = getTailorName(wd.tailorId, wd.tailorName);
                        if (!acc[name]) acc[name] = [];
                        acc[name].push({ ...wd, archiveInfo: arc });
                        return acc;
                      }, {} as Record<string, any[]>)
                    ).map(([name, itemsInGroup]) => (
                      <div key={name} className="space-y-6">
                        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
                          <div className="w-1.5 h-6 bg-sky-500 rounded-full"></div> {name}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                           {itemsInGroup.map(item => {
                              const wd = item;
                              const arc = item.archiveInfo;
                              return (
                                 <motion.div variants={itemVariants} key={arc.id} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 shadow-sm hover:border-sky-100 transition-all flex items-center justify-between group">
                                    <div className="flex items-center gap-5">
                                       <div className="bg-sky-50 text-sky-500 p-4 rounded-3xl group-hover:bg-sky-600 group-hover:text-white transition-all shadow-inner">
                                          <PiggyBank size={24}/>
                                       </div>
                                       <div>
                                          <div className="flex items-center gap-2 mb-1">
                                             <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Data Terarsip: {formatDate(arc.archivedAt)}</p>
                                          </div>
                                          <h4 className="text-lg font-black text-slate-900 uppercase">Pencairan</h4>
                                          <p className="text-[9px] font-bold text-slate-400 uppercase">Oleh: {arc.archivedBy}</p>
                                       </div>
                                    </div>
                                    <div className="text-right">
                                       <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Nominal</p>
                                       <p className="text-xl font-black text-sky-600 tabular-nums leading-none">{displayAmount(wd.amount, `arc_wd_${arc.id}`)}</p>
                                    </div>
                                 </motion.div>
                              );
                           })}
                        </div>
                      </div>
                    ))
                 )}
              </div>
           )}

           {activeTab === 'tailors' && (
              <div className="space-y-6">
                 <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
                    <button
                       type="button"
                       onClick={() => setTailorHistoryTab('all')}
                       className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tailorHistoryTab === 'all' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                       Semua Penjahit ({tailors.filter(t => t.status !== 'Dihapus').length})
                    </button>
                    <button
                       type="button"
                       onClick={() => setTailorHistoryTab('deleted')}
                       className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${tailorHistoryTab === 'deleted' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                       Arsip Penjahit Dihapus ({currentTailors.length})
                    </button>
                 </div>

                 {tailorHistoryTab === 'all' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {tailors.filter(t => t.status !== 'Dihapus' && ((t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (t.partnerName || '').toLowerCase().includes(searchQuery.toLowerCase()))).map(t => {
                          const tailorJobs = jobs.filter(j => j.tailorId === t.id);
                          const tailorSubs = subs.filter(s => s.tailorId === t.id);
                          const totalEarned = tailorSubs.reduce((sum, s) => sum + (Number(s.wageTotal) || 0), 0);
                          const totalPcs = tailorSubs.reduce((sum, s) => sum + (Number(s.qtySubmitted) || 0), 0);

                          return (
                             <div key={t.id} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                                <div>
                                   <div className="flex items-center gap-4 mb-4">
                                      <div className="bg-indigo-50 text-indigo-600 p-4 rounded-[1.5rem] font-black text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                         {t.name.charAt(0)}
                                      </div>
                                      <div className="min-w-0">
                                         <h4 className="font-black text-slate-900 text-xl tracking-tight leading-tight uppercase truncate">{t.name}</h4>
                                         {t.partnerName && (
                                            <p className="text-xs font-bold text-slate-500 mt-0.5 uppercase tracking-widest">& {t.partnerName}</p>
                                         )}
                                         <div className="flex items-center gap-2 mt-1">
                                            <span className="inline-block bg-emerald-50 text-emerald-700 text-[9px] font-black px-2 py-0.5 rounded-md uppercase">
                                               Aktif
                                            </span>
                                            {t.productionNumber && (
                                               <span className="inline-block bg-slate-100 text-slate-700 text-[9px] font-black px-2 py-0.5 rounded-md">
                                                  No: {t.productionNumber}
                                               </span>
                                            )}
                                         </div>
                                      </div>
                                   </div>

                                   <div className="space-y-2.5 pt-3 border-t border-slate-50">
                                      <div className="flex justify-between text-xs font-bold text-slate-500">
                                         <span>Total Pekerjaan:</span>
                                         <span className="font-black text-slate-900">{tailorJobs.length} Job</span>
                                      </div>
                                      <div className="flex justify-between text-xs font-bold text-slate-500">
                                         <span>Total Disetor:</span>
                                         <span className="font-black text-slate-900">{totalPcs} Set / Pcs</span>
                                      </div>
                                      <div className="flex justify-between text-xs font-bold text-slate-500">
                                         <span>Akumulasi Upah:</span>
                                         <span className="font-black text-indigo-600">{displayAmount(totalEarned, `th_earn_${t.id}`)}</span>
                                      </div>
                                   </div>
                                </div>

                                <div className="mt-5 pt-4 border-t border-slate-50">
                                   <button 
                                      onClick={() => { setSelectedDeletedTailor(t); setSelectedArchiveInfo(null); setTailorModalSubTab('jobs'); }} 
                                      className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
                                   >
                                     <User size={15}/> Lihat Riwayat & Detail Lengkap
                                   </button>
                                </div>
                             </div>
                          );
                       })}
                    </div>
                 ) : (
                    currentTailors.length === 0 ? (
                       <div className="text-center py-20 opacity-40 italic font-bold">Data arsip penjahit dihapus tidak ditemukan.</div>
                    ) : (
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {currentTailors.map(arc => {
                             const t = arc.data;
                             const tailorJobs = jobs.filter(j => j.tailorId === (t.id || arc.originalId));
                             return (
                                <div key={arc.id} className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                                   <div>
                                      <div className="flex items-center gap-4 mb-6">
                                         <div className="bg-rose-50 text-rose-500 p-4 rounded-[1.5rem]">
                                            <User size={24}/>
                                         </div>
                                         <div>
                                            <h4 className="font-black text-slate-900 text-xl tracking-tight leading-tight uppercase">{t.name}</h4>
                                            {t.partnerName && (
                                               <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">& {t.partnerName}</p>
                                            )}
                                            <div className="flex items-center gap-2 mt-2">
                                               <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Arsip {formatDate(arc.archivedAt)}</span>
                                            </div>
                                         </div>
                                      </div>
                                      <div className="space-y-4 pt-4 border-t border-slate-50 border-dashed">
                                         <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2.5 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Penjahit</span>
                                            <span className="text-sm font-black text-slate-700">#{arc.originalId || t.id}</span>
                                         </div>
                                         <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2.5 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Pekerjaan</span>
                                            <span className="text-sm font-black text-slate-700">{tailorJobs.length} Job</span>
                                         </div>
                                         <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2.5 rounded-xl">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diarsipkan Oleh</span>
                                            <span className="text-sm font-black text-rose-600 uppercase italic">{arc.archivedBy}</span>
                                         </div>
                                      </div>
                                   </div>
                                   <div className="mt-5 pt-4 border-t border-slate-50">
                                      <button onClick={() => { setSelectedDeletedTailor(t); setSelectedArchiveInfo(arc); setTailorModalSubTab('jobs'); }} className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2">
                                        <User size={15}/> Lihat Riwayat & Detail Lengkap
                                      </button>
                                   </div>
                                </div>
                             );
                          })}
                       </div>
                    )
                 )}
              </div>
           )}

           {activeTab === 'logs' && (
              <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-sm">
                       <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 uppercase tracking-widest text-[9px]">
                          <tr>
                             <th className="px-8 py-5">Waktu</th>
                             <th className="px-8 py-5">Oleh</th>
                             <th className="px-8 py-5">Aksi</th>
                             <th className="px-8 py-5">Deskripsi</th>
                             <th className="px-8 py-5">Modul</th>
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50">
                          {logs.length === 0 ? (
                             <tr><td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold italic">Belum ada riwayat aktivitas sistem.</td></tr>
                          ) : (
                             logs.filter(log => 
                                log.user.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                (log.table || '').toLowerCase().includes(searchQuery.toLowerCase())
                             ).map(log => (
                                <tr key={log.id} className="hover:bg-slate-50/10 transition-colors group cursor-pointer" onClick={() => setSelectedLog(log)}>
                                   <td className="px-8 py-5 text-slate-500 font-medium tabular-nums">{new Date(log.date).toLocaleString('id-ID')}</td>
                                   <td className="px-8 py-5">
                                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200/50">
                                         {log.user}
                                      </span>
                                   </td>
                                   <td className="px-8 py-5">
                                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                         log.action === 'TAMBAH' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                         log.action === 'EDIT' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                                         'bg-rose-50 text-rose-600 border-rose-100'
                                      }`}>
                                         {log.action}
                                      </span>
                                   </td>
                                   <td className="px-8 py-5 font-bold text-slate-700">{log.details}</td>
                                   <td className="px-8 py-5 flex items-center justify-between">
                                      <span className="opacity-40 group-hover:opacity-100 font-black text-[9px] uppercase tracking-widest transition-opacity px-2 py-1 bg-slate-50 rounded-lg">
                                         {log.table}
                                      </span>
                                      <ChevronRight size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all"/>
                                   </td>
                                </tr>
                             ))
                          )}
                       </tbody>
                    </table>
                 </div>
              </div>
           )}
        </motion.div>

        {/* PO Detail Modal */}
        <AnimatePresence>
        {selectedPO && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm no-print">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
              >
                 <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-5">
                       <div className="bg-emerald-600 text-white p-4 rounded-[1.5rem] shadow-lg shadow-emerald-600/20">
                          <Package size={28}/>
                       </div>
                       <div>
                          <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">PO #{selectedPO.poNumber}</h3>
                          <div className="flex items-center gap-2 mt-2">
                             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-white border border-slate-100 px-3 py-1 rounded-lg inline-block">Pemesan: {selectedPO.customerName}</p>
                             {selectedArchiveInfo && (
                                <span className="text-[9px] text-indigo-500 font-black uppercase bg-indigo-50 px-2 py-0.5 rounded-md tracking-widest">Archived by: {selectedArchiveInfo.archivedBy}</span>
                             )}
                          </div>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => handleDownloadPOCSV(selectedPO)} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all">
                          <Download size={14}/> CSV
                       </button>
                       <button onClick={handlePrint} className="bg-slate-900 hover:bg-black text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm">
                          <Printer size={14}/> Cetak
                       </button>
                       <button onClick={() => setSelectedPO(null)} className="text-slate-400 hover:text-slate-900 bg-white border border-slate-100 p-2.5 rounded-xl transition-all">
                          <X size={20}/>
                       </button>
                    </div>
                 </div>

                 <div className="overflow-y-auto flex-1 p-8 custom-scrollbar" ref={printRef}>
                    <div className="space-y-6">
                       <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No. PO</p>
                             <p className="text-base font-black text-slate-900 mt-1 uppercase">#{selectedPO.poNumber}</p>
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</p>
                             <p className="text-base font-black text-slate-900 mt-1 uppercase">{selectedPO.customerName}</p>
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal PO</p>
                             <p className="text-base font-black text-slate-900 mt-1">{formatDate(selectedPO.date)}</p>
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                             <span className="inline-block mt-1 px-3 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                                {selectedPO.status || 'Selesai'}
                             </span>
                          </div>
                       </div>

                       {/* PO Items Table */}
                       <div className="border border-slate-100 rounded-2xl overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs">
                             <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-500 uppercase tracking-wider">
                                <tr>
                                   <th className="p-4">Nama Barang</th>
                                   <th className="p-4">Warna</th>
                                   <th className="p-4">Ukuran</th>
                                   <th className="p-4 text-right">Jumlah (Pcs)</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                {poItems.filter(i => i.poId === selectedPO.id || i.poId === selectedArchiveInfo?.originalId).map(item => (
                                   <tr key={item.id}>
                                      <td className="p-4 font-bold">{item.itemName}</td>
                                      <td className="p-4">{item.color}</td>
                                      <td className="p-4">{item.size}</td>
                                      <td className="p-4 text-right font-black text-slate-900">{item.qty} Pcs</td>
                                   </tr>
                                ))}
                             </tbody>
                          </table>
                       </div>

                       {selectedPO.photoData && (
                          <div className="pt-4">
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Foto Desain / Sampel</p>
                             <img src={selectedPO.photoData} alt="Foto PO" className="max-h-72 object-contain rounded-2xl border border-slate-200" />
                          </div>
                       )}
                    </div>
                 </div>
              </motion.div>
           </div>
        )}
        </AnimatePresence>

        {/* Salary Detail Modal */}
        <AnimatePresence>
        {selectedSalary && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm no-print">
              <motion.div 
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
              >
                 <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-5">
                       <div className="bg-indigo-600 text-white p-4 rounded-[1.5rem] shadow-lg shadow-indigo-600/20">
                          <Wallet size={28}/>
                       </div>
                       <div>
                          <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">SLIP GAJI: {selectedSalary.tailorName || getTailorName(selectedSalary.tailorId)}</h3>
                          <div className="flex items-center gap-2 mt-2">
                             <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-white border border-slate-100 px-3 py-1 rounded-lg inline-block">Payment Ref: #{selectedArchiveInfo?.originalId || selectedSalary.id}</p>
                             {selectedArchiveInfo ? (
                                <span className="text-[9px] text-indigo-500 font-black uppercase bg-indigo-50 px-2 py-0.5 rounded-md tracking-widest">Archived by: {selectedArchiveInfo.archivedBy}</span>
                             ) : selectedSalary.createdBy && (
                                <span className="text-[9px] text-slate-400 font-bold italic uppercase">By: {selectedSalary.createdBy}</span>
                             )}
                          </div>
                       </div>
                    </div>
                    <div className="flex gap-3">
                       <button onClick={handlePrint} className="bg-slate-900 text-white hover:bg-black px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all flex items-center gap-2">
                          <Printer size={18}/> Cetak Kwitansi
                       </button>
                       <button onClick={() => setSelectedSalary(null)} className="text-slate-400 hover:text-slate-900 bg-white border border-slate-100 p-3 rounded-2xl transition-all">
                          <X size={24}/>
                       </button>
                    </div>
                 </div>
                 <div className="overflow-y-auto flex-1 p-10 custom-scrollbar" ref={printRef}>
                    <div className="space-y-8 bg-white max-w-xl mx-auto p-8 border-2 border-slate-50 rounded-[3rem] shadow-sm relative">
                       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-slate-100 rounded-b-full"></div>
                       
                       <div className="text-center flex flex-col items-center mb-10 pt-4">
                          <h1 className="text-2xl font-black uppercase tracking-[0.3em] text-slate-900">KONFEKSI APP</h1>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Official Detailed Pay Statement</p>
                       </div>

                       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                          <div className="space-y-6">
                             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Rincian Pembayaran</h4>
                             <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                                   <span className="font-bold text-slate-500">Upah Borongan ({selectedSalary.totalQty} PCS)</span>
                                   <span className="font-black text-slate-900">{displayAmount(selectedSalary.totalWage, 'm_w')}</span>
                                </div>
                                <div className="flex justify-between items-center text-emerald-600 text-sm">
                                   <span className="font-black uppercase tracking-tight italic">Bonus Grade ({selectedSalary.gradeName || '-'})</span>
                                   <span className="font-black">+{displayAmount(selectedSalary.bonusAmount || 0, 'm_b')}</span>
                                </div>
                                {!!selectedSalary.manualAdjustment && (
                                   <div className={`flex justify-between items-center text-sm ${selectedSalary.manualAdjustment > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      <span className="font-black uppercase tracking-tight italic">Penyesuaian ({selectedSalary.manualNote || 'Manual'})</span>
                                      <span className="font-black">{selectedSalary.manualAdjustment > 0 ? '+' : ''}{displayAmount(selectedSalary.manualAdjustment, 'm_ma')}</span>
                                   </div>
                                )}
                                <div className="flex justify-between items-center text-rose-600 text-sm">
                                   <span className="font-black uppercase tracking-tight italic">Potong Kasbon</span>
                                   <span className="font-black">-{displayAmount(selectedSalary.kasbonDeducted || 0, 'm_k')}</span>
                                </div>
                                <div className="flex justify-between items-center text-sky-600 text-sm">
                                   <span className="font-black uppercase tracking-tight italic">Tabungan Masuk</span>
                                   <span className="font-black">+{displayAmount(selectedSalary.tabunganAccumulated || 0, 'm_t')}</span>
                                </div>
                                <div className="flex justify-between items-end pt-5 border-t-2 border-slate-100 mt-2">
                                   <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">Netto Diterima</span>
                                   <span className="text-2xl font-black text-indigo-600 tabular-nums leading-none tracking-tighter">{displayAmount(selectedSalary.netPayment, 'm_n')}</span>
                                </div>
                             </div>
                          </div>
                          <div className="space-y-4">
                             <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Rincian Pekerjaan Terbayar</h4>
                             <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {subs.filter(s => s.paymentId === (selectedArchiveInfo?.originalId || selectedSalary.id)).map(s => {
                                   const job = getJobDetailsById(s.jobId);
                                   return (
                                      <div key={s.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100/50">
                                         <div className="flex justify-between items-start">
                                            <div className="text-left">
                                               <p className="text-[8px] font-black text-slate-400 uppercase leading-none mb-1">#{job.poNumber}</p>
                                               <h5 className="text-[10px] font-bold text-slate-800 uppercase leading-tight line-clamp-1">{job.itemInfo}</h5>
                                               <span className="text-[8px] font-bold text-slate-400 uppercase">{s.partType || 'Set'} • {s.qtySubmitted} Pcs</span>
                                            </div>
                                            <p className="text-[10px] font-black text-slate-900">Rp {(s.wageTotal || 0).toLocaleString()}</p>
                                         </div>
                                      </div>
                                   );
                                })}
                             </div>
                          </div>
                       </div>
                  
                       <div className="pt-12 mt-12 border-t-2 border-slate-50 hidden print:block text-center">
                          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic tracking-[0.2em]">Dokumen ini diterbitkan secara digital oleh KonfeksiApp Manajemen &copy; {new Date().getFullYear()}</p>
                       </div>
                    </div>
                 </div>
              </motion.div>
           </div>
        )}
        </AnimatePresence>

        {/* Comprehensive Tailor Detail Modal (Active & Archived) */}
        <AnimatePresence>
        {selectedDeletedTailor && (() => {
           const tailor = selectedDeletedTailor;
           const tailorId = tailor.id || selectedArchiveInfo?.originalId;
           const isArchived = !!selectedArchiveInfo || tailor.status === 'Dihapus';

           const tailorJobs = jobs.filter(j => j.tailorId === tailorId);
           const tailorSubs = subs.filter(s => s.tailorId === tailorId);
           const tailorSalaries = salaryPayments.filter(sp => sp.tailorId === tailorId);
           const tailorKasbons = kasbons.filter(k => k.tailorId === tailorId);
           const tailorWithdrawals = tabunganWithdrawals.filter(w => w.tailorId === tailorId);
           const tabSummary = activeTabunganList.find(a => a.tailorId === tailorId);

           const totalPcsSubmitted = tailorSubs.reduce((sum, s) => sum + (Number(s.qtySubmitted) || 0), 0);
           const totalGrossEarned = tailorSubs.reduce((sum, s) => sum + (Number(s.wageTotal) || 0), 0);
           const totalActiveKasbon = tailorKasbons.filter(k => !k.isPaid).reduce((sum, k) => sum + k.amount, 0);
           const tabunganBalance = tabSummary?.balance || 0;

           // Filtered Jobs
           let filteredJobs = [...tailorJobs];
           if (deletedTailorFilter.fromDate) {
              const from = new Date(deletedTailorFilter.fromDate);
              from.setHours(0, 0, 0, 0);
              filteredJobs = filteredJobs.filter(j => new Date(j.dateTaken) >= from);
           }
           if (deletedTailorFilter.toDate) {
              const to = new Date(deletedTailorFilter.toDate);
              to.setHours(23, 59, 59, 999);
              filteredJobs = filteredJobs.filter(j => new Date(j.dateTaken) <= to);
           }
           filteredJobs.sort((a, b) => {
              const timeA = new Date(a.dateTaken).getTime();
              const timeB = new Date(b.dateTaken).getTime();
              return deletedTailorFilter.sortBy === 'terbaru' ? timeB - timeA : timeA - timeB;
           });

           return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm no-print">
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.95, y: 20 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95, y: 20 }}
                   className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-100"
                 >
                    {/* Header */}
                    <div className="p-6 sm:p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
                       <div className="flex items-center gap-4">
                          <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-black text-2xl text-white shadow-lg ${isArchived ? 'bg-rose-600 shadow-rose-600/20' : 'bg-indigo-600 shadow-indigo-600/20'}`}>
                             {tailor.name.charAt(0)}
                          </div>
                          <div>
                             <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">{tailor.name}</h3>
                                {tailor.partnerName && (
                                   <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">& {tailor.partnerName}</span>
                                )}
                             </div>
                             <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${isArchived ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                   {isArchived ? 'Penjahit Nonaktif (Diarsipkan)' : 'Penjahit Aktif'}
                                </span>
                                {tailor.productionNumber && (
                                   <span className="text-[10px] font-black bg-slate-200 text-slate-800 px-3 py-1 rounded-full">
                                      No. Produksi: #{tailor.productionNumber}
                                   </span>
                                )}
                                {selectedArchiveInfo && (
                                   <span className="text-[9px] text-slate-400 font-bold italic">
                                      Arsip oleh: {selectedArchiveInfo.archivedBy} ({formatDate(selectedArchiveInfo.archivedAt)})
                                   </span>
                                )}
                             </div>
                          </div>
                       </div>
                       <button 
                          onClick={() => setSelectedDeletedTailor(null)} 
                          className="text-slate-400 hover:text-slate-900 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-all self-end sm:self-auto"
                       >
                          <X size={20}/>
                       </button>
                    </div>

                    {/* Quick KPI Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-6 bg-slate-100/60 border-b border-slate-100 text-xs">
                       <div className="bg-white p-3 rounded-2xl border border-slate-200/60">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Job</p>
                          <p className="text-lg font-black text-slate-900 mt-0.5">{tailorJobs.length} Pekerjaan</p>
                       </div>
                       <div className="bg-white p-3 rounded-2xl border border-slate-200/60">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disetor</p>
                          <p className="text-lg font-black text-emerald-600 mt-0.5">{totalPcsSubmitted} Set / Pcs</p>
                       </div>
                       <div className="bg-white p-3 rounded-2xl border border-slate-200/60">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Akumulasi Upah</p>
                          <p className="text-lg font-black text-indigo-600 mt-0.5">{displayAmount(totalGrossEarned, `dt_wage_${tailorId}`)}</p>
                       </div>
                       <div className="bg-white p-3 rounded-2xl border border-slate-200/60">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kasbon Belum Lunas</p>
                          <p className={`text-lg font-black mt-0.5 ${totalActiveKasbon > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                             {displayAmount(totalActiveKasbon, `dt_kasbon_${tailorId}`)}
                          </p>
                       </div>
                       <div className="bg-white p-3 rounded-2xl border border-slate-200/60 col-span-2 sm:col-span-1">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Saldo Tabungan</p>
                          <p className="text-lg font-black text-sky-600 mt-0.5">{displayAmount(tabunganBalance, `dt_tab_${tailorId}`)}</p>
                       </div>
                    </div>

                    {/* Sub-tabs inside Detail Modal */}
                    <div className="flex border-b border-slate-100 bg-white px-6 pt-3 gap-2 overflow-x-auto custom-scrollbar">
                       <button 
                          onClick={() => setTailorModalSubTab('jobs')} 
                          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 ${tailorModalSubTab === 'jobs' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                       >
                          Daftar Pekerjaan ({tailorJobs.length})
                       </button>
                       <button 
                          onClick={() => setTailorModalSubTab('submissions')} 
                          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 ${tailorModalSubTab === 'submissions' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                       >
                          Riwayat Setoran ({tailorSubs.length})
                       </button>
                       <button 
                          onClick={() => setTailorModalSubTab('salaries')} 
                          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 ${tailorModalSubTab === 'salaries' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                       >
                          Slip Gaji Terbayar ({tailorSalaries.length})
                       </button>
                       <button 
                          onClick={() => setTailorModalSubTab('finances')} 
                          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 ${tailorModalSubTab === 'finances' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                       >
                          Kasbon & Tabungan
                       </button>
                       <button 
                          onClick={() => setTailorModalSubTab('profile')} 
                          className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border-b-2 ${tailorModalSubTab === 'profile' ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
                       >
                          Biodata & Kontak
                       </button>
                    </div>

                    {/* Content Section */}
                    <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                       {/* Tab 1: Jobs */}
                       {tailorModalSubTab === 'jobs' && (
                          <div className="space-y-4">
                             <div className="flex flex-wrap gap-4 mb-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex-1 min-w-[180px]">
                                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dari Tanggal</label>
                                   <input type="date" value={deletedTailorFilter.fromDate} onChange={e => setDeletedTailorFilter({...deletedTailorFilter, fromDate: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all"/>
                                </div>
                                <div className="flex-1 min-w-[180px]">
                                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Sampai Tanggal</label>
                                   <input type="date" value={deletedTailorFilter.toDate} onChange={e => setDeletedTailorFilter({...deletedTailorFilter, toDate: e.target.value})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all"/>
                                </div>
                                <div className="flex-1 min-w-[180px]">
                                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Urutkan</label>
                                   <select value={deletedTailorFilter.sortBy} onChange={e => setDeletedTailorFilter({...deletedTailorFilter, sortBy: e.target.value as 'terbaru' | 'terlama'})} className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all">
                                      <option value="terbaru">Terbaru</option>
                                      <option value="terlama">Terlama</option>
                                   </select>
                                </div>
                                {(deletedTailorFilter.fromDate || deletedTailorFilter.toDate || deletedTailorFilter.sortBy !== 'terbaru') && (
                                   <button onClick={() => setDeletedTailorFilter({fromDate: '', toDate: '', sortBy: 'terbaru'})} className="self-end bg-rose-50 text-rose-600 px-4 py-2 text-[10px] font-black rounded-xl hover:bg-rose-100 uppercase tracking-widest transition-all mb-0.5">Reset</button>
                                )}
                             </div>

                             {filteredJobs.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 font-bold italic">Belum ada tugas yang dikerjakan pada rentang ini.</div>
                             ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {filteredJobs.map(j => {
                                      const progress = Math.min(100, Math.round((j.qtySubmitted / j.qtyTaken) * 100));
                                      const jobSubs = subs.filter(s => s.jobId === j.id);
                                      const totallyPaid = jobSubs.length > 0 && jobSubs.every(s => s.isPaid);
                                      const partiallyPaid = !totallyPaid && jobSubs.some(s => s.isPaid);
                                      
                                      let paidBadge = null;
                                      if (totallyPaid) {
                                         paidBadge = <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">Gaji Lunas</span>;
                                      } else if (partiallyPaid) {
                                         paidBadge = <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-sky-100 text-sky-700 border border-sky-200">Gaji Sebagian</span>;
                                      } else if (jobSubs.length > 0) {
                                         paidBadge = <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">Belum Dibayar</span>;
                                      } else {
                                         paidBadge = <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">Belum Ada Setoran</span>;
                                      }

                                      return (
                                         <div key={j.id} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow transition-all relative">
                                            <div className="flex justify-between items-start mb-3">
                                               <div>
                                                  <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">{formatDate(j.dateTaken)}</span>
                                                  <h5 className="font-black text-slate-900 tracking-tight mt-1">{getPoItemLabel(j.poItemId)}</h5>
                                                  <div className="mt-1.5 flex items-center gap-2">
                                                     {paidBadge}
                                                     {j.assignedPart && (
                                                        <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                           {j.assignedPart}
                                                        </span>
                                                     )}
                                                  </div>
                                               </div>
                                               <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${j.status === 'Selesai' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                  {j.status}
                                               </span>
                                            </div>
                                            {j.productionNumber && (
                                               <div className="mb-4 text-xs font-bold text-slate-500 p-2 bg-slate-50 rounded-xl inline-block">
                                                  No. Produksi: <span className="text-slate-900">{j.productionNumber}</span>
                                               </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-3 mb-4">
                                               <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-50/50">
                                                  <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Upah/Pcs</span>
                                                  <span className="font-black text-indigo-700">Rp {j.wagePerPcs.toLocaleString('id-ID')}</span>
                                               </div>
                                               <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-50/50">
                                                  <span className="block text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">Pencapaian</span>
                                                  <span className="font-black text-emerald-700">{j.qtySubmitted} / {j.qtyTaken} Set</span>
                                               </div>
                                            </div>
                                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                               <div className={`h-full rounded-full ${progress >= 100 ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${progress}%` }}></div>
                                            </div>
                                         </div>
                                      );
                                   })}
                                </div>
                             )}
                          </div>
                       )}

                       {/* Tab 2: Submissions */}
                       {tailorModalSubTab === 'submissions' && (
                          <div className="space-y-4">
                             {tailorSubs.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 font-bold italic">Belum ada catatan setoran untuk penjahit ini.</div>
                             ) : (
                                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                                   <table className="w-full text-left border-collapse text-xs">
                                      <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-500 uppercase tracking-wider">
                                         <tr>
                                            <th className="p-4">Tanggal</th>
                                            <th className="p-4">PO & Item</th>
                                            <th className="p-4">Bagian</th>
                                            <th className="p-4">Jumlah Disetor</th>
                                            <th className="p-4">Upah</th>
                                            <th className="p-4">Status Gaji</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                         {tailorSubs.map(s => {
                                            const job = getJobDetailsById(s.jobId);
                                            return (
                                               <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                                  <td className="p-4 tabular-nums text-slate-500">{formatDate(s.dateSubmitted)}</td>
                                                  <td className="p-4">
                                                     <p className="font-bold text-slate-900">{job.poNumber}</p>
                                                     <p className="text-[10px] text-slate-500">{job.itemInfo}</p>
                                                  </td>
                                                  <td className="p-4">
                                                     <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-black uppercase text-[9px]">
                                                        {s.partType || 'Set'}
                                                     </span>
                                                  </td>
                                                  <td className="p-4 font-bold text-slate-900">
                                                     {s.nominalQty ? `${s.nominalQty} Pcs` : `${s.qtySubmitted} Set`}
                                                  </td>
                                                  <td className="p-4 font-black text-emerald-600">
                                                     Rp {(s.wageTotal || 0).toLocaleString('id-ID')}
                                                  </td>
                                                  <td className="p-4">
                                                     {s.isPaid ? (
                                                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                                                           Lunas (#{s.paymentId})
                                                        </span>
                                                     ) : (
                                                        <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[9px] font-black uppercase">
                                                           Belum Dibayar
                                                        </span>
                                                     )}
                                                  </td>
                                               </tr>
                                            );
                                         })}
                                      </tbody>
                                   </table>
                                </div>
                             )}
                          </div>
                       )}

                       {/* Tab 3: Salary Slips */}
                       {tailorModalSubTab === 'salaries' && (
                          <div className="space-y-4">
                             {tailorSalaries.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 font-bold italic">Belum ada slip pembayaran gaji yang tersimpan.</div>
                             ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                   {tailorSalaries.map(sal => (
                                      <div 
                                         key={sal.id} 
                                         onClick={() => setSelectedSalary(sal)}
                                         className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer group"
                                      >
                                         <div className="flex justify-between items-start mb-4">
                                            <div>
                                               <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{formatDate(sal.date)}</span>
                                               <h5 className="font-black text-slate-900 text-base uppercase mt-0.5">Slip Ref #{sal.id}</h5>
                                               {sal.createdBy && <p className="text-[9px] text-slate-400 font-bold">Oleh: {sal.createdBy}</p>}
                                            </div>
                                            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                               <Wallet size={18}/>
                                            </div>
                                         </div>

                                         <div className="space-y-2 text-xs border-t border-slate-50 pt-3">
                                            <div className="flex justify-between text-slate-500 font-bold">
                                               <span>Total Disetor:</span>
                                               <span className="text-slate-900 font-black">{sal.totalQty} PCS</span>
                                            </div>
                                            <div className="flex justify-between text-slate-500 font-bold">
                                               <span>Upah Bruto:</span>
                                               <span className="text-slate-900 font-black">Rp {sal.totalWage.toLocaleString('id-ID')}</span>
                                            </div>
                                            {!!sal.bonusAmount && (
                                               <div className="flex justify-between text-emerald-600 font-bold">
                                                  <span>Bonus ({sal.gradeName}):</span>
                                                  <span className="font-black">+Rp {sal.bonusAmount.toLocaleString('id-ID')}</span>
                                               </div>
                                            )}
                                            {!!sal.kasbonDeducted && (
                                               <div className="flex justify-between text-rose-600 font-bold">
                                                  <span>Potong Kasbon:</span>
                                                  <span className="font-black">-Rp {sal.kasbonDeducted.toLocaleString('id-ID')}</span>
                                               </div>
                                            )}
                                            <div className="flex justify-between items-end pt-3 border-t border-slate-100">
                                               <span className="text-[9px] font-black text-slate-400 uppercase">Netto Dibayar:</span>
                                               <span className="text-lg font-black text-indigo-600">Rp {sal.netPayment.toLocaleString('id-ID')}</span>
                                            </div>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             )}
                          </div>
                       )}

                       {/* Tab 4: Finances (Kasbon & Tabungan) */}
                       {tailorModalSubTab === 'finances' && (
                          <div className="space-y-6">
                             {/* Kasbon Section */}
                             <div className="space-y-3">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                   <Wallet size={14} className="text-amber-500" /> Riwayat Kasbon ({tailorKasbons.length})
                                </h4>
                                {tailorKasbons.length === 0 ? (
                                   <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs italic font-bold">
                                      Tidak ada catatan pinjaman kasbon.
                                   </div>
                                ) : (
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {tailorKasbons.map(k => (
                                         <div key={k.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                                            <div>
                                               <p className="text-[9px] font-black text-slate-400 uppercase">{formatDate(k.date)}</p>
                                               <p className="font-bold text-slate-800 text-xs mt-0.5">{k.notes || 'Pinjaman Kasbon'}</p>
                                               <span className={`inline-block mt-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${k.isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                                  {k.isPaid ? 'Lunas' : 'Belum Lunas'}
                                               </span>
                                            </div>
                                            <p className="font-black text-base text-slate-900">
                                               Rp {k.amount.toLocaleString('id-ID')}
                                            </p>
                                         </div>
                                      ))}
                                   </div>
                                )}
                             </div>

                             {/* Tabungan Section */}
                             <div className="space-y-3 pt-4 border-t border-slate-100">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                   <PiggyBank size={14} className="text-sky-500" /> Riwayat Penarikan Tabungan ({tailorWithdrawals.length})
                                </h4>
                                {tailorWithdrawals.length === 0 ? (
                                   <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center text-slate-400 text-xs italic font-bold">
                                      Belum ada penarikan tabungan.
                                   </div>
                                ) : (
                                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      {tailorWithdrawals.map(w => (
                                         <div key={w.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm">
                                            <div>
                                               <p className="text-[9px] font-black text-slate-400 uppercase">{formatDate(w.date)}</p>
                                               <p className="font-bold text-slate-800 text-xs mt-0.5">Penarikan Tabungan</p>
                                               {w.createdBy && <p className="text-[8px] text-slate-400">Oleh: {w.createdBy}</p>}
                                            </div>
                                            <p className="font-black text-base text-sky-600">
                                               Rp {w.amount.toLocaleString('id-ID')}
                                            </p>
                                         </div>
                                      ))}
                                   </div>
                                )}
                             </div>
                          </div>
                       )}

                       {/* Tab 5: Profile */}
                       {tailorModalSubTab === 'profile' && (
                          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Utama Penjahit</p>
                                   <p className="text-base font-black text-slate-900 uppercase">{tailor.name}</p>
                                </div>
                                <div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Pasangan / Kolaborasi</p>
                                   <p className="text-base font-black text-slate-900 uppercase">{tailor.partnerName || '-'}</p>
                                </div>
                                <div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nomor Telepon / WhatsApp</p>
                                   <p className="text-base font-black text-slate-900">{tailor.phone || '-'}</p>
                                </div>
                                <div>
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">No. Produksi</p>
                                   <p className="text-base font-black text-slate-900">{tailor.productionNumber || '-'}</p>
                                </div>
                                <div className="sm:col-span-2">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Alamat Tempat Tinggal</p>
                                   <p className="text-sm font-medium text-slate-700">{tailor.address || '-'}</p>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>
                 </motion.div>
              </div>
           );
        })()}
        </AnimatePresence>

        {/* System Log Detail Modal */}
        <AnimatePresence>
        {selectedLog && (
           <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
              >
                 <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                       <div className="bg-slate-900 text-white p-3 rounded-2xl">
                          <Clock size={24}/>
                       </div>
                       <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">Detail Aktivitas</h3>
                    </div>
                    <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-900 transition-colors bg-white p-2 border border-slate-100 rounded-xl">
                       <X size={20}/>
                    </button>
                 </div>
                 
                 <div className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Waktu Kejadian</p>
                          <p className="font-bold text-slate-900 text-sm">{new Date(selectedLog.date).toLocaleString('id-ID')}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Oleh User</p>
                          <p className="font-bold text-slate-900 text-sm uppercase">{selectedLog.user}</p>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tipe Aksi</p>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                             selectedLog.action === 'TAMBAH' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                             selectedLog.action === 'EDIT' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                             'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                             {selectedLog.action}
                          </span>
                       </div>
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tabel Database</p>
                          <p className="font-bold text-slate-900 text-sm font-mono">{selectedLog.table}</p>
                       </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100">
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Deskripsi Lengkap</p>
                       <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm font-bold text-slate-700">
                          {selectedLog.details}
                       </div>
                    </div>
                 </div>
              </motion.div>
           </div>
        )}
        </AnimatePresence>
    </div>
  );
}
