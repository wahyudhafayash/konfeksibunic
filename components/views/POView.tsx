import { useState, useRef } from 'react';
import { db, useLiveQuery, PO, POItem, POSetType, getPOItemPricing, getWageForPart, getSubmissionNominalQty } from '@/lib/db';
import { Plus, Trash2, Edit2, Save, X, Package, Eye, Printer, Image as ImageIcon, Search, ChevronRight, FileText, Calendar, LayoutGrid, List, CheckCircle2, Banknote, PiggyBank, Loader2, AlertCircle, History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function POView({ currentUsername, onNavigate }: { currentUsername?: string; onNavigate?: (tab: string) => void }) {
  const pos = useLiveQuery(() => db.pos.orderBy('id').reverse().toArray(), []) || [];
  const poItems = useLiveQuery(() => db.poItems.toArray(), []) || [];
  const sewingJobs = useLiveQuery(() => db.sewingJobs.toArray(), []) || [];
  const subs = useLiveQuery(() => db.sewingSubmissions.toArray(), []) || [];
  const tailors = useLiveQuery(() => db.tailors.toArray(), []) || [];
  const jobs = sewingJobs;

  const isPoFull = (poId: number) => {
     const items = poItems.filter(i => i.poId === poId);
     if (items.length === 0) return false;
     const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
     if (totalQty === 0) return false;
     
     const poJobIds = sewingJobs.filter(j => items.some(it => it.id === j.poItemId)).map(j => j.id);
     const totalSubmitted = subs.filter(s => poJobIds.includes(s.jobId)).reduce((sum, s) => sum + (Number(s.qtySubmitted) || 0), 0);
     
     return totalSubmitted >= totalQty;
  };

  const getPoStatus = (po: PO) => {
     if (po.status === 'Selesai' || po.status === 'Dihapus') return po.status;
     if (isPoFull(po.id!)) return 'Siap Kirim';
     if (po.status === 'Siap Kirim' && !isPoFull(po.id!)) return 'Proses';
     return po.status;
  };

  const [isPOFormOpen, setIsPOFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [poForm, setPoForm] = useState<Partial<PO>>({
    poNumber: '',
    customerName: '',
    status: 'Proses',
    description: '',
    photoData: '',
    setType: 'Set',
    wageSet: 0,
    wageInner: 0,
    wageOuter: 0,
    wageAtasan: 0,
    wageBawahan: 0,
    tabunganPerPcs: 0
  });
  const [itemForms, setItemForms] = useState<Partial<POItem>[]>([
    { itemName: '', color: '', size: '', qty: 0, qtyCut: 0 }
  ]);

  const [viewPOId, setViewPOId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [deletePOId, setDeletePOId] = useState<number | null>(null);
  const [finishPOId, setFinishPOId] = useState<number | null>(null);
  const [statusUpdatePOId, setStatusUpdatePOId] = useState<number | null>(null);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const isBusy = submittingAction !== null;

  const [modalAlert, setModalAlert] = useState<{
    isOpen: boolean;
    type: 'success' | 'error' | 'confirm';
    title: string;
    message: string;
    showCheckHistory?: boolean;
    onConfirm?: () => void;
    confirmLabel?: string;
  }>({ isOpen: false, type: 'success', title: '', message: '' });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const viewingPOInfo = pos.find(p => p.id === viewPOId);
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order - ${viewingPOInfo?.poNumber}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
             @media print {
               @page { margin: 1.5cm; }
               .no-print { display: none; }
             }
             body { font-family: sans-serif; padding: 20px; color: black; }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            window.onload = () => {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  function openCreateForm() {
    setEditId(null);
    setPoForm({
      poNumber: '',
      customerName: '',
      status: 'Proses',
      description: '',
      photoData: '',
      setType: 'Set',
      wageSet: 0,
      wageInner: 0,
      wageOuter: 0,
      wageAtasan: 0,
      wageBawahan: 0,
      tabunganPerPcs: 0
    });
    setItemForms([{ itemName: '', color: '', size: '', qty: 0, qtyCut: 0 }]);
    setIsPOFormOpen(true);
  }

  function openEditForm(e: React.MouseEvent, po: PO) {
    e.stopPropagation();
    setEditId(po.id!);
    const items = poItems.filter(i => i.poId === po.id).map(i => ({ ...i }));
    const pricing = getPOItemPricing(po, items[0]);
    setPoForm({
      poNumber: po.poNumber,
      customerName: po.customerName,
      status: po.status,
      description: po.description || '',
      photoData: po.photoData || '',
      setType: pricing.setType,
      wageSet: pricing.wageSet,
      wageInner: pricing.wageInner,
      wageOuter: pricing.wageOuter,
      wageAtasan: pricing.wageAtasan,
      wageBawahan: pricing.wageBawahan,
      tabunganPerPcs: pricing.tabunganPerPcs
    });
    
    if(items.length > 0) {
      setItemForms(items);
    } else {
      setItemForms([{ itemName: '', color: '', size: '', qty: 0, qtyCut: 0 }]);
    }
    
    setIsPOFormOpen(true);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
       const base64str = event.target?.result as string;
       setPoForm(prev => ({...prev, photoData: base64str}));
    };
    reader.readAsDataURL(file);
  }

  async function handleSavePO(e: React.FormEvent) {
    e.preventDefault();
    if(!poForm.poNumber || isBusy) return;

    const validFormItems = itemForms.filter(i => i.itemName && Number(i.qty) > 0);
    if (validFormItems.length === 0) {
      setModalAlert({
        isOpen: true,
        type: 'error',
        title: 'Item PO Belum Lengkap',
        message: 'Masukkan minimal 1 item model dengan kuantitas lebih dari 0.'
      });
      return;
    }

    setSubmittingAction('savePO');
    try {
      let poId = editId;
      const isEditing = !!poId;
      const savedPoNumber = poForm.poNumber;
      const setType: POSetType = poForm.setType || 'Set';
      const wageSet = Number(poForm.wageSet) || 0;
      const wageInner = Number(poForm.wageInner) || 0;
      const wageOuter = Number(poForm.wageOuter) || 0;
      const wageAtasan = Number(poForm.wageAtasan) || 0;
      const wageBawahan = Number(poForm.wageBawahan) || 0;
      const tabunganPerPcs = Number(poForm.tabunganPerPcs) || 0;

      const newTotalQty = validFormItems.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);

      if (poId) {
        const existingPoItems = poItems.filter(i => i.poId === poId);
        const poJobIds = sewingJobs.filter(j => existingPoItems.some(it => it.id === j.poItemId)).map(j => j.id);
        const totalSubmitted = subs.filter(s => poJobIds.includes(s.jobId)).reduce((sum, s) => sum + (Number(s.qtySubmitted) || 0), 0);
        const updatedStatus = (poForm.status === 'Siap Kirim' && totalSubmitted < newTotalQty) ? 'Proses' : (poForm.status || 'Proses');

        await db.pos.update(poId, {
           poNumber: poForm.poNumber,
           customerName: poForm.customerName || '',
           description: poForm.description || '',
           photoData: poForm.photoData || '',
           status: updatedStatus,
           setType,
           wageSet,
           wageInner,
           wageOuter,
           wageAtasan,
           wageBawahan,
           tabunganPerPcs,
           updatedBy: currentUsername
        });

        // Preserve existing POItem IDs so SewingJobs & Submissions remain connected!
        const itemsToUpdate = validFormItems.filter(i => i.id !== undefined);
        const itemsToAdd = validFormItems.filter(i => i.id === undefined);

        if (itemsToUpdate.length > 0) {
          await db.poItems.bulkUpdate(
            itemsToUpdate.map(i => ({
              key: i.id!,
              changes: {
                itemName: i.itemName!,
                color: i.color!,
                size: i.size!,
                qty: Number(i.qty),
                qtyCut: Number(i.qty),
                setType,
                wageSet,
                wageInner,
                wageOuter,
                wageAtasan,
                wageBawahan,
                tabunganPerPcs,
                updatedBy: currentUsername
              }
            }))
          );
        }

        if (itemsToAdd.length > 0) {
          await db.poItems.bulkAdd(
            itemsToAdd.map(i => ({
              poId: poId!,
              itemName: i.itemName!,
              color: i.color!,
              size: i.size!,
              qty: Number(i.qty),
              qtyCut: Number(i.qty),
              setType,
              wageSet,
              wageInner,
              wageOuter,
              wageAtasan,
              wageBawahan,
              tabunganPerPcs,
              createdBy: currentUsername
            }))
          );
        }

        // Only delete removed POItems if they have NO sewingJobs attached
        const keptIds = new Set(itemsToUpdate.map(i => i.id!));
        const safeToDeleteIds = existingPoItems
          .filter(oldItem => !keptIds.has(oldItem.id!) && !sewingJobs.some(j => j.poItemId === oldItem.id))
          .map(oldItem => oldItem.id!);
        if (safeToDeleteIds.length > 0) {
          await db.poItems.bulkDelete(safeToDeleteIds);
        }

        // Sync updated PO pricing to existing SewingJobs & unpaid Submissions for this PO
        const updatedPricing = getPOItemPricing({
          poNumber: poForm.poNumber,
          customerName: poForm.customerName || '',
          date: '',
          status: updatedStatus,
          setType,
          wageSet,
          wageInner,
          wageOuter,
          wageAtasan,
          wageBawahan,
          tabunganPerPcs
        });
        const relatedJobs = sewingJobs.filter(j => existingPoItems.some(it => it.id === j.poItemId));
        if (relatedJobs.length > 0) {
          await db.sewingJobs.bulkUpdate(
            relatedJobs.map(j => ({
              key: j.id!,
              changes: {
                setType,
                wageSet,
                wageInner,
                wageOuter,
                wageAtasan,
                wageBawahan,
                tabunganPerPcs,
                wagePerPcs: getWageForPart(j.assignedPart || 'Set', updatedPricing)
              }
            }))
          );

          const unpaidRelatedSubs = subs.filter(s => !s.isPaid && relatedJobs.some(j => j.id === s.jobId));
          if (unpaidRelatedSubs.length > 0) {
            await db.sewingSubmissions.bulkUpdate(
              unpaidRelatedSubs.map(s => {
                const part = s.partType || 'Set';
                const nominal = getSubmissionNominalQty(s);
                const mult = part === 'Set' ? 1 : 0.5;
                const partWage = getWageForPart(part, updatedPricing);
                return {
                  key: s.id!,
                  changes: {
                    wageTotal: nominal * partWage,
                    tabunganTotal: nominal * mult * tabunganPerPcs
                  }
                };
              })
            );
          }
        }
      } else {
        poId = await db.pos.add({
           poNumber: poForm.poNumber,
           customerName: poForm.customerName || '',
           description: poForm.description || '',
           photoData: poForm.photoData || '',
           date: new Date().toISOString(),
           status: poForm.status || 'Proses',
           setType,
           wageSet,
           wageInner,
           wageOuter,
           wageAtasan,
           wageBawahan,
           tabunganPerPcs,
           createdBy: currentUsername
        });

        const itemsToSave = validFormItems.map(i => ({
           poId: poId!,
           itemName: i.itemName!,
           color: i.color!,
           size: i.size!,
           qty: Number(i.qty),
           qtyCut: Number(i.qty),
           setType,
           wageSet,
           wageInner,
           wageOuter,
           wageAtasan,
           wageBawahan,
           tabunganPerPcs,
           createdBy: currentUsername
        }));

        if(itemsToSave.length > 0) {
          await db.poItems.bulkAdd(itemsToSave);
        }
      }

      setIsPOFormOpen(false);
      setEditId(null);
      setModalAlert({
        isOpen: true,
        type: 'success',
        title: isEditing ? 'PO Berhasil Diperbarui' : 'PO Berhasil Dipublish',
        message: `Data Purchase Order "${savedPoNumber}" telah berhasil disimpan ke database.`,
        showCheckHistory: true
      });
    } catch (err) {
      setModalAlert({
        isOpen: true,
        type: 'error',
        title: 'Gagal Menyimpan PO',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan saat menyimpan data PO.'
      });
    } finally {
      setSubmittingAction(null);
    }
  }

  async function requestFinishPO(e: React.MouseEvent, id: number) {
     e.stopPropagation();
     setFinishPOId(id);
  }

  async function confirmFinishPO() {
    if (!finishPOId || isBusy) return;
    setSubmittingAction('finishPO');
    try {
      const poToArchive = pos.find(p => p.id === finishPOId);
      if (poToArchive) {
         await db.archivePOs.add({
            originalId: finishPOId,
            data: poToArchive,
            archivedAt: new Date().toISOString(),
            archivedBy: currentUsername || 'System'
         });
      }

      await db.pos.update(finishPOId, { 
        status: 'Selesai',
        updatedBy: currentUsername 
      });
      setFinishPOId(null);
      setModalAlert({
        isOpen: true,
        type: 'success',
        title: 'PO Selesai & Diarsipkan',
        message: `PO "${poToArchive?.poNumber || ''}" telah ditandai Selesai dan dipindahkan ke History.`,
        showCheckHistory: true
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingAction(null);
    }
  }

  async function updatePOStatus(poId: number, newStatus: string) {
    if (isBusy) return;
    setSubmittingAction('updateStatus');
    try {
      const poToArchive = pos.find(p => p.id === poId);
      if ((newStatus === 'Selesai' || newStatus === 'Dihapus') && poToArchive) {
         await db.archivePOs.add({
            originalId: poId,
            data: poToArchive,
            archivedAt: new Date().toISOString(),
            archivedBy: currentUsername || 'System'
         });
      }

      await db.pos.update(poId, { 
        status: newStatus as any,
        updatedBy: currentUsername 
      });
      setStatusUpdatePOId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingAction(null);
    }
  }

  async function requestDeletePO(e: React.MouseEvent, id: number) {
     e.stopPropagation();
     setDeletePOId(id);
  }

  async function confirmDeletePO() {
    if (!deletePOId || isBusy) return;
    setSubmittingAction('deletePO');
    try {
      const poToArchive = pos.find(p => p.id === deletePOId);
      if (poToArchive) {
         await db.archivePOs.add({
            originalId: deletePOId,
            data: poToArchive,
            archivedAt: new Date().toISOString(),
            archivedBy: currentUsername || 'System'
         });
      }
      await db.pos.update(deletePOId, { status: 'Dihapus' });
      setDeletePOId(null);
      setModalAlert({
        isOpen: true,
        type: 'success',
        title: 'PO Berhasil Dihapus',
        message: `PO "${poToArchive?.poNumber || ''}" telah dihapus dan masuk ke arsip History.`,
        showCheckHistory: true
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingAction(null);
    }
  }

  const viewingPOInfo = pos.find(p => p.id === viewPOId);
  const viewingPOItems = poItems.filter(i => i.poId === viewPOId);

  const filteredPOs = pos.filter(p => {
    const computedStatus = getPoStatus(p);
    const matchesSearch = (p.poNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (p.customerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = filterDate ? p.date === filterDate : true;
    const matchesStatus = filterStatus ? computedStatus === filterStatus : true;
    
    // By default (no status filter), do we exclude 'Selesai' and 'Dihapus'?
    const isVisibleInPO = computedStatus !== 'Selesai' && computedStatus !== 'Dihapus';

    return matchesSearch && matchesDate && (filterStatus ? matchesStatus : isVisibleInPO);
  });

  return (
    <div className="space-y-8 pb-20">
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Pesanan (PO)</h2>
            <p className="text-slate-500 font-medium mt-1 uppercase tracking-wider text-[10px]">Manajemen produksi barang & stok</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
             <div className="flex gap-2 w-full sm:w-auto">
                <input 
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
                />
                <select 
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
                >
                  <option value="">Semua Status Aktif</option>
                  <option value="Proses">Proses</option>
                  <option value="Siap Kirim">Siap Kirim</option>
                  <option value="Selesai">Selesai</option>
                  <option value="Dihapus">Dihapus</option>
                </select>
             </div>
             <div className="relative w-full sm:w-80 group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Cari PO, customer, atau model..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all shadow-sm" 
                />
             </div>
             
             <button 
               onClick={openCreateForm} 
               className="w-full sm:w-auto bg-slate-900 text-white hover:bg-indigo-600 px-6 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10 transition-all active:scale-95 group"
             >
               <Plus size={20} className="group-hover:rotate-90 transition-transform" /> 
               Buat PO Baru
             </button>
          </div>
       </div>

       {/* View Mode Toggle */}
       <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit self-end ml-auto">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <List size={18}/>
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <LayoutGrid size={18}/>
          </button>
       </div>

       <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
          <AnimatePresence mode="popLayout">
          {filteredPOs.map(po => {
             const items = poItems.filter(i => i.poId === po.id);
             const totalQty = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
             
             return (
                <motion.div 
                  layout
                  key={po.id} 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setViewPOId(po.id!)}
                  className={`bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group flex ${viewMode === 'list' ? 'flex-col md:flex-row' : 'flex-col'}`}
                >
                   {/* Thumbnail */}
                   <div className={`${viewMode === 'list' ? 'w-full md:w-48' : 'w-full'} aspect-[4/3] md:aspect-auto overflow-hidden bg-slate-50 relative shrink-0`}>
                      {po.photoData ? (
                        <img src={po.photoData} alt="PO" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                           <Package size={48} className="mb-2 opacity-20" />
                           <span className="text-[10px] font-bold uppercase tracking-widest opacity-50">No Image</span>
                        </div>
                      )}
                      <div className="absolute top-4 left-4">
                         <span className={`text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full border shadow-sm backdrop-blur-md ${getPoStatus(po) === 'Siap Kirim' ? 'bg-emerald-500/90 text-white border-emerald-400' : 'bg-slate-900/80 text-white border-white/20'}`}>
                           {getPoStatus(po)}
                         </span>
                      </div>
                   </div>

                   <div className="p-6 flex-1 flex flex-col justify-between">
                      <div>
                         <div className="flex justify-between items-start mb-2">
                            <h3 className="font-extrabold text-slate-900 text-xl tracking-tight group-hover:text-indigo-600 transition-colors">
                              {po.poNumber}
                            </h3>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <button onClick={(e) => { e.stopPropagation(); setStatusUpdatePOId(po.id!); }} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors" title="Perbarui Status Manual">
                                  <Package size={16}/>
                               </button>
                               {getPoStatus(po) === 'Siap Kirim' && (
                                  <button 
                                    onClick={(e) => requestFinishPO(e, po.id!)} 
                                    className="p-2 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-xl transition-all shadow-sm group/finish" 
                                    title="Selesaikan PO"
                                  >
                                     <CheckCircle2 size={16}/>
                                  </button>
                               )}
                               <button onClick={(e) => openEditForm(e, po)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                                  <Edit2 size={16}/>
                               </button>
                               <button onClick={(e) => requestDeletePO(e, po.id!)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                                  <Trash2 size={16}/>
                               </button>
                            </div>
                         </div>
                         
                         <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 truncate">
                            {po.customerName || 'Customer Umum'}
                         </p>

                         <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Pesanan</p>
                               <p className="font-black text-slate-900">{totalQty} <span className="text-xs font-normal text-slate-500">pcs</span></p>
                            </div>
                            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                               <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Dibuat</p>
                               <p className="font-black text-slate-900 text-sm">{new Date(po.date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric' })}</p>
                            </div>
                         </div>

                         {(() => {
                            const pricing = getPOItemPricing(po, items[0]);
                            return (
                               <div className="flex flex-wrap gap-2 mb-4">
                                  <span className="text-[9px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                                     {pricing.setType}
                                  </span>
                                  {pricing.totalFullWage > 0 && (
                                     <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-100">
                                        Upah: Rp {pricing.totalFullWage.toLocaleString('id-ID')}/set
                                     </span>
                                  )}
                                  {pricing.tabunganPerPcs > 0 && (
                                     <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-100">
                                        Tbg: Rp {pricing.tabunganPerPcs.toLocaleString('id-ID')}/set
                                     </span>
                                  )}
                               </div>
                            );
                         })()}

                         {viewMode === 'list' && (
                           <div className="hidden md:block">
                              <div className="flex flex-wrap gap-2">
                                 {items.slice(0, 4).map((item, idx) => (
                                    <span key={idx} className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md border border-indigo-100">
                                       {item.itemName} ({item.size})
                                    </span>
                                 ))}
                                 {items.length > 4 && <span className="text-[9px] font-bold text-slate-400">+{items.length - 4} lainnya</span>}
                              </div>
                           </div>
                         )}
                      </div>

                      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                         <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                               <Calendar size={14}/>
                               {new Date(po.date).toLocaleDateString('id-ID')}
                            </div>
                            {(po.createdBy || po.updatedBy) && (
                               <span className="text-[9px] text-slate-300 font-bold italic uppercase tracking-tighter">
                                 {po.updatedBy ? `Updated: ${po.updatedBy}` : `By: ${po.createdBy}`}
                               </span>
                            )}
                         </div>
                         <div className="flex items-center gap-1 text-indigo-600 text-xs font-black uppercase tracking-widest group-hover:gap-2 transition-all">
                            Lihat Detail <ChevronRight size={16}/>
                         </div>
                      </div>
                   </div>
                </motion.div>
             )
          })}
          </AnimatePresence>
       </div>

       {filteredPOs.length === 0 && !isPOFormOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="text-center py-24 bg-white rounded-[3rem] border border-slate-200 border-dashed"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
               <Package size={40}/>
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">Belum ada PO aktif</h3>
            <p className="text-slate-500 font-medium mt-2">Daftar PO yang sedang dalam proses produksi akan tampil di sini.</p>
            <button onClick={openCreateForm} className="mt-8 bg-indigo-600 text-white font-bold px-8 py-3 rounded-2xl hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/20">
               Tambah PO Sekarang
            </button>
          </motion.div>
       )}

       {/* PO Form Drawer/Modal */}
       <AnimatePresence>
       {isPOFormOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-end p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm no-print">
             <motion.div 
               initial={{ x: '100%' }}
               animate={{ x: 0 }}
               exit={{ x: '100%' }}
               transition={{ type: 'spring', damping: 25, stiffness: 200 }}
               className="bg-white h-full w-full max-w-2xl sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden"
             >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">{editId ? 'Sempurnakan PO' : 'Daftarkan PO Baru'}</h3>
                      <p className="text-sm font-semibold text-slate-500 mt-1 uppercase tracking-widest text-[10px]">Isi detail pesanan untuk memulai produksi</p>
                   </div>
                   <button onClick={() => setIsPOFormOpen(false)} className="text-slate-400 hover:text-slate-900 bg-white p-3 rounded-2xl shadow-sm border border-slate-100 transition-all active:scale-95">
                      <X size={24}/>
                   </button>
                </div>
                
                <form onSubmit={handleSavePO} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Nomor PO Utama</label>
                        <input 
                          type="text" 
                          value={poForm.poNumber} 
                          onChange={e => setPoForm({...poForm, poNumber: e.target.value})} 
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" 
                          required 
                          placeholder="Misal: PO-ICHA-001" 
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Customer / Pemesan</label>
                        <input 
                          type="text" 
                          value={poForm.customerName} 
                          onChange={e => setPoForm({...poForm, customerName: e.target.value})} 
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" 
                          placeholder="Nama toko atau klien" 
                        />
                      </div>
                   </div>

                   <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Keterangan Khusus</label>
                      <textarea 
                        rows={3} 
                        value={poForm.description} 
                        onChange={e => setPoForm({...poForm, description: e.target.value})} 
                        className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" 
                        placeholder="Detail tambahan seperti model saku, kerut, dll..."
                      />
                   </div>
                   
                   <div className="space-y-2">
                      <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Lampiran Foto Model</label>
                      <div className="flex items-center gap-6 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100 border-dashed group hover:border-indigo-200 transition-colors">
                         <div className="w-24 h-24 shrink-0 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-md">
                            {poForm.photoData ? (
                               <img src={poForm.photoData} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                               <div className="w-full h-full flex items-center justify-center text-slate-400">
                                  <ImageIcon size={32}/>
                               </div>
                            )}
                         </div>
                         <div>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                            <button 
                              type="button" 
                              onClick={() => fileInputRef.current?.click()} 
                              className="bg-white text-slate-900 hover:text-indigo-600 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-100 shadow-sm transition-all active:scale-95"
                            >
                               {poForm.photoData ? 'Ganti Foto' : 'Unggah Foto'}
                            </button>
                            <p className="text-[10px] text-slate-400 font-bold mt-2 leading-relaxed">Pilih foto referensi model untuk memudahkan tim produksi memantau detail barang.</p>
                         </div>
                      </div>
                   </div>

                   {/* Konfigurasi Tipe Setelan, Upah Jahit & Tabungan */}
                   <div className="space-y-5 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                         <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest bg-amber-50 text-amber-700 px-3 py-1 rounded-lg flex items-center gap-2">
                            <Banknote size={16}/> Pilihan Model Setelan & Upah Penjahit
                         </h4>
                      </div>

                      <div className="space-y-2">
                         <label className="block text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Pilihan Tipe Pakaian</label>
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {(['Set', 'Inner & Outer', 'Atasan & Bawahan', 'Inner, Outer & Bawahan'] as POSetType[]).map((typeOption) => {
                               const isSelected = (poForm.setType || 'Set') === typeOption;
                               return (
                                  <button
                                    key={typeOption}
                                    type="button"
                                    onClick={() => setPoForm({ ...poForm, setType: typeOption })}
                                    className={`px-3 py-3 rounded-2xl text-xs font-black uppercase tracking-wider border-2 transition-all text-center ${
                                       isSelected
                                         ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/20'
                                         : 'bg-slate-50 text-slate-600 border-slate-100 hover:border-indigo-200'
                                    }`}
                                  >
                                     {typeOption}
                                  </button>
                               );
                            })}
                         </div>
                      </div>

                      {/* Dynamic Wage Inputs */}
                      <div className="bg-slate-50/80 p-5 rounded-3xl border border-slate-100 space-y-4">
                         {(!poForm.setType || poForm.setType === 'Set') && (
                            <div className="space-y-2">
                               <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-widest">Upah Jahit Set / Pcs (Rp)</label>
                               <input
                                 type="number"
                                 min="0"
                                 value={poForm.wageSet || ''}
                                 onChange={e => setPoForm({ ...poForm, wageSet: Number(e.target.value) })}
                                 className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:outline-none"
                                 placeholder="Contoh: 25000"
                                 required
                               />
                            </div>
                         )}

                         {poForm.setType === 'Inner & Outer' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-widest">Upah Inner / Pcs (Rp)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={poForm.wageInner || ''}
                                    onChange={e => setPoForm({ ...poForm, wageInner: Number(e.target.value) })}
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:outline-none"
                                    placeholder="Upah Inner"
                                    required
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-widest">Upah Outer / Pcs (Rp)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={poForm.wageOuter || ''}
                                    onChange={e => setPoForm({ ...poForm, wageOuter: Number(e.target.value) })}
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:outline-none"
                                    placeholder="Upah Outer"
                                    required
                                  />
                               </div>
                               <div className="sm:col-span-2 text-right text-xs font-black text-slate-500">
                                  Total Upah 1 Set Lengkap: <span className="text-indigo-600">Rp {((Number(poForm.wageInner) || 0) + (Number(poForm.wageOuter) || 0)).toLocaleString('id-ID')}</span>
                               </div>
                            </div>
                         )}

                         {poForm.setType === 'Atasan & Bawahan' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-widest">Upah Atasan / Pcs (Rp)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={poForm.wageAtasan || ''}
                                    onChange={e => setPoForm({ ...poForm, wageAtasan: Number(e.target.value) })}
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:outline-none"
                                    placeholder="Upah Atasan"
                                    required
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-widest">Upah Bawahan / Pcs (Rp)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={poForm.wageBawahan || ''}
                                    onChange={e => setPoForm({ ...poForm, wageBawahan: Number(e.target.value) })}
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:outline-none"
                                    placeholder="Upah Bawahan"
                                    required
                                  />
                               </div>
                               <div className="sm:col-span-2 text-right text-xs font-black text-slate-500">
                                  Total Upah 1 Set Lengkap: <span className="text-indigo-600">Rp {((Number(poForm.wageAtasan) || 0) + (Number(poForm.wageBawahan) || 0)).toLocaleString('id-ID')}</span>
                               </div>
                            </div>
                         )}

                         {poForm.setType === 'Inner, Outer & Bawahan' && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                               <div className="space-y-2">
                                  <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-widest">Upah Inner (Rp)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={poForm.wageInner || ''}
                                    onChange={e => setPoForm({ ...poForm, wageInner: Number(e.target.value) })}
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:outline-none"
                                    placeholder="Upah Inner"
                                    required
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-widest">Upah Outer (Rp)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={poForm.wageOuter || ''}
                                    onChange={e => setPoForm({ ...poForm, wageOuter: Number(e.target.value) })}
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:outline-none"
                                    placeholder="Upah Outer"
                                    required
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="block text-[11px] font-black text-indigo-600 uppercase tracking-widest">Upah Bawahan (Rp)</label>
                                  <input
                                    type="number"
                                    min="0"
                                    value={poForm.wageBawahan || ''}
                                    onChange={e => setPoForm({ ...poForm, wageBawahan: Number(e.target.value) })}
                                    className="w-full bg-white border-2 border-slate-200 rounded-2xl px-4 py-3 text-sm font-black focus:border-indigo-500 focus:outline-none"
                                    placeholder="Upah Bawahan"
                                    required
                                  />
                               </div>
                               <div className="sm:col-span-3 text-right text-xs font-black text-slate-500">
                                  Total Upah 1 Set Lengkap: <span className="text-indigo-600">Rp {((Number(poForm.wageInner) || 0) + (Number(poForm.wageOuter) || 0) + (Number(poForm.wageBawahan) || 0)).toLocaleString('id-ID')}</span>
                               </div>
                            </div>
                         )}

                         {/* 1 Input Tabungan untuk semua pilihan */}
                         <div className="pt-3 border-t border-slate-200/60 space-y-2">
                            <label className="block text-[11px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-1.5">
                               <PiggyBank size={14}/> Tabungan Penjahit / Pcs (Rp) — 1 Harga Untuk Semua Pilihan
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={poForm.tabunganPerPcs || ''}
                              onChange={e => setPoForm({ ...poForm, tabunganPerPcs: Number(e.target.value) })}
                              className="w-full bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl px-4 py-3 text-sm font-black text-emerald-900 focus:bg-white focus:border-emerald-500 focus:outline-none"
                              placeholder="Contoh: 1000 (Opsional)"
                            />
                            <p className="text-[10px] font-bold text-slate-400">
                               Catatan: Jika penjahit menyetor 1 set penuh akan mendapat 100% tabungan. Jika menyetor parsial (misal hanya Inner/Outer/Atasan/Bawahan), setoran & tabungan otomatis dihitung 1/2 (50%).
                            </p>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-4 pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between">
                         <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg">Rincian Barang</h4>
                         <button 
                           type="button" 
                           onClick={() => setItemForms([...itemForms, { itemName: '', color: '', size: '', qty: 0, qtyCut: 0 }])} 
                           className="text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                         >
                            <Plus size={14}/> Tambah Rincian
                         </button>
                      </div>
                      
                      <div className="space-y-4">
                         {itemForms.map((item, idx) => (
                            <motion.div 
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              key={item.id ? `item-${item.id}` : `new-${idx}`} 
                              className="grid grid-cols-12 gap-3 items-end bg-slate-50/50 p-4 rounded-2xl border border-slate-100 relative group"
                            >
                               <div className="col-span-12 md:col-span-5">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama / Model</label>
                                  <input 
                                    type="text" 
                                    value={item.itemName} 
                                    onChange={e => {
                                      const newItems = [...itemForms]; newItems[idx] = { ...newItems[idx], itemName: e.target.value }; setItemForms(newItems);
                                    }} 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:outline-none" 
                                    placeholder="Contoh: Gamis" 
                                    required
                                  />
                               </div>
                               <div className="col-span-4 md:col-span-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Warna</label>
                                  <input 
                                    type="text" 
                                    value={item.color} 
                                    onChange={e => {
                                      const newItems = [...itemForms]; newItems[idx] = { ...newItems[idx], color: e.target.value }; setItemForms(newItems);
                                    }} 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:outline-none" 
                                    placeholder="Navi" 
                                    required
                                  />
                               </div>
                               <div className="col-span-4 md:col-span-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Size</label>
                                  <input 
                                    type="text" 
                                    value={item.size} 
                                    onChange={e => {
                                      const newItems = [...itemForms]; newItems[idx] = { ...newItems[idx], size: e.target.value }; setItemForms(newItems);
                                    }} 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-indigo-100 focus:outline-none" 
                                    placeholder="L" 
                                    required
                                  />
                               </div>
                               <div className="col-span-3 md:col-span-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Qty</label>
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={item.qty || ''} 
                                    onChange={e => {
                                      const newItems = [...itemForms]; newItems[idx] = { ...newItems[idx], qty: Number(e.target.value) }; setItemForms(newItems);
                                    }} 
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black focus:ring-2 focus:ring-indigo-100 focus:outline-none text-right" 
                                    placeholder="0" 
                                    required
                                  />
                               </div>
                               <div className="col-span-1 flex justify-center">
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      if (item.id && sewingJobs.some(j => j.poItemId === item.id)) {
                                        setModalAlert({
                                          isOpen: true,
                                          type: 'error',
                                          title: 'Item Sudah Dikerjakan Penjahit',
                                          message: 'Item ini sudah diambil oleh penjahit dan memiliki data pekerjaan aktif. Silakan ubah nama model, warna, size, atau qty secara langsung tanpa menghapus baris ini agar data penjahit tetap terhubung.'
                                        });
                                        return;
                                      }
                                      if(itemForms.length > 1) setItemForms(itemForms.filter((_, i) => i !== idx));
                                    }} 
                                    className="text-rose-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-colors mb-1"
                                  >
                                    <Trash2 size={16}/>
                                  </button>
                               </div>
                            </motion.div>
                         ))}
                      </div>
                   </div>
                </form>

                <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estimasi Total</span>
                      <span className="text-xl font-black text-slate-900">{itemForms.reduce((sum, i) => sum + (Number(i.qty) || 0), 0)} pcs</span>
                   </div>
                   <button 
                     onClick={handleSavePO}
                     disabled={isBusy}
                     type="button" 
                     className="bg-indigo-600 text-white hover:bg-indigo-700 px-10 py-4 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.1em] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
                   >
                      {submittingAction === 'savePO' ? (
                        <><Loader2 size={20} className="animate-spin" /> Menyimpan...</>
                      ) : (
                        <><Save size={20}/> {editId ? 'Simpan Update' : 'Publish Order'}</>
                      )}
                   </button>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Detailed View Modal */}
       <AnimatePresence>
       {viewPOId && viewingPOInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md no-print">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white sm:rounded-[3rem] shadow-2xl w-full max-w-5xl max-h-screen sm:max-h-[92vh] overflow-hidden flex flex-col"
             >
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                   <div className="flex items-center gap-5">
                      <div className="bg-indigo-600 text-white p-4 rounded-[1.5rem] shadow-lg shadow-indigo-600/30">
                         <Package size={28}/>
                      </div>
                      <div>
                         <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">{viewingPOInfo.poNumber}</h3>
                         <div className="flex items-center gap-3 mt-2 font-bold text-xs uppercase tracking-widest text-slate-400">
                             <span className="text-indigo-600">Production Document</span>
                             <span className="w-1.5 h-1.5 bg-slate-200 rounded-full"></span>
                             <span>{new Date(viewingPOInfo.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                         </div>
                      </div>
                   </div>
                   <div className="flex gap-3">
                      {getPoStatus(viewingPOInfo) === 'Siap Kirim' && (
                         <button 
                           onClick={(e) => {
                             requestFinishPO(e, viewingPOInfo.id!);
                             setViewPOId(null);
                           }} 
                           className="bg-emerald-600 text-white hover:bg-emerald-700 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                         >
                            <CheckCircle2 size={18}/> Selesaikan PO
                         </button>
                      )}
                      <button 
                        onClick={handlePrint} 
                        className="bg-slate-900 text-white hover:bg-slate-800 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-lg transition-all active:scale-95"
                      >
                         <Printer size={18}/> Cetak Surat
                      </button>
                      <button 
                        onClick={() => setViewPOId(null)} 
                        className="text-slate-400 hover:text-slate-900 bg-white border border-slate-100 p-3 rounded-2xl shadow-sm transition-all active:scale-95"
                      >
                        <X size={24}/>
                      </button>
                   </div>
                </div>
                
                <div className="overflow-y-auto p-10 bg-white grid grid-cols-1 lg:grid-cols-12 gap-10 custom-scrollbar" ref={printRef}>
                    <div className="lg:col-span-4 space-y-8 no-break-print">
                       <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Foto Referensi Model</p>
                          <div className="rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-xl bg-slate-50 aspect-[4/5]">
                             {viewingPOInfo.photoData ? (
                                <img 
                                  src={viewingPOInfo.photoData} 
                                  alt="Referensi" 
                                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" 
                                  onClick={() => setFullScreenPhoto(viewingPOInfo.photoData!)}
                                />
                             ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-200">
                                   <ImageIcon size={64} className="mb-4" />
                                   <span className="text-xs font-black uppercase tracking-widest">No Model Photo</span>
                                </div>
                             )}
                          </div>
                       </div>
                       
                       <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 space-y-6">
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Customer / Klien</p>
                             <p className="text-xl font-extrabold text-slate-900 tracking-tight">{viewingPOInfo.customerName || 'Customer Umum'}</p>
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status Produksi</p>
                             <div className="mt-2 flex items-center gap-3">
                                <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${getPoStatus(viewingPOInfo) === 'Siap Kirim' ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-slate-900 text-white border-slate-700'}`}>
                                   {getPoStatus(viewingPOInfo)}
                                </span>
                                <button 
                                  onClick={() => setStatusUpdatePOId(viewingPOInfo.id!)}
                                  className="text-[10px] font-black text-indigo-600 hover:underline uppercase tracking-widest"
                                >
                                   Perbarui Status Manual
                                </button>
                             </div>
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Catatan Pengerjaan</p>
                             <p className="text-sm font-semibold text-slate-600 leading-relaxed italic">
                                {viewingPOInfo.description || 'Tidak ada instruksi khusus untuk pesanan ini.'}
                             </p>
                          </div>
                          {(() => {
                             const pricing = getPOItemPricing(viewingPOInfo, viewingPOItems[0]);
                             return (
                                <div className="pt-4 border-t border-slate-200/60 space-y-2">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upah Jahit & Tabungan ({pricing.setType})</p>
                                   <div className="space-y-1 text-xs font-bold text-slate-700">
                                      {pricing.setType === 'Set' && (
                                         <div className="flex justify-between"><span>Upah Set:</span><span className="font-black text-indigo-600">Rp {pricing.wageSet.toLocaleString('id-ID')}</span></div>
                                      )}
                                      {pricing.setType === 'Inner & Outer' && (
                                         <>
                                            <div className="flex justify-between"><span>Upah Inner:</span><span className="font-black text-indigo-600">Rp {pricing.wageInner.toLocaleString('id-ID')}</span></div>
                                            <div className="flex justify-between"><span>Upah Outer:</span><span className="font-black text-indigo-600">Rp {pricing.wageOuter.toLocaleString('id-ID')}</span></div>
                                            <div className="flex justify-between border-t border-slate-200 pt-1"><span>Total Set:</span><span className="font-black text-slate-900">Rp {pricing.totalFullWage.toLocaleString('id-ID')}</span></div>
                                         </>
                                      )}
                                      {pricing.setType === 'Atasan & Bawahan' && (
                                         <>
                                            <div className="flex justify-between"><span>Upah Atasan:</span><span className="font-black text-indigo-600">Rp {pricing.wageAtasan.toLocaleString('id-ID')}</span></div>
                                            <div className="flex justify-between"><span>Upah Bawahan:</span><span className="font-black text-indigo-600">Rp {pricing.wageBawahan.toLocaleString('id-ID')}</span></div>
                                            <div className="flex justify-between border-t border-slate-200 pt-1"><span>Total Set:</span><span className="font-black text-slate-900">Rp {pricing.totalFullWage.toLocaleString('id-ID')}</span></div>
                                         </>
                                      )}
                                      {pricing.setType === 'Inner, Outer & Bawahan' && (
                                         <>
                                            <div className="flex justify-between"><span>Upah Inner:</span><span className="font-black text-indigo-600">Rp {pricing.wageInner.toLocaleString('id-ID')}</span></div>
                                            <div className="flex justify-between"><span>Upah Outer:</span><span className="font-black text-indigo-600">Rp {pricing.wageOuter.toLocaleString('id-ID')}</span></div>
                                            <div className="flex justify-between"><span>Upah Bawahan:</span><span className="font-black text-indigo-600">Rp {pricing.wageBawahan.toLocaleString('id-ID')}</span></div>
                                            <div className="flex justify-between border-t border-slate-200 pt-1"><span>Total Set:</span><span className="font-black text-slate-900">Rp {pricing.totalFullWage.toLocaleString('id-ID')}</span></div>
                                         </>
                                      )}
                                      <div className="flex justify-between pt-1 text-emerald-700">
                                         <span>Tabungan / Set:</span>
                                         <span className="font-black">Rp {pricing.tabunganPerPcs.toLocaleString('id-ID')}</span>
                                      </div>
                                   </div>
                                </div>
                             );
                          })()}
                       </div>
                    </div>

                    <div className="lg:col-span-8 space-y-10 no-break-print">
                       <div>
                          <div className="flex items-center justify-between mb-6">
                             <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <List size={22} className="text-indigo-600"/> Rincian Barang & Material
                             </h4>
                             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Total {viewingPOItems.length} Variasi
                             </div>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-separate border-spacing-y-2">
                               <thead>
                                  <tr className="bg-slate-100 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                     <th className="px-6 py-4 rounded-l-2xl">Item</th>
                                     <th className="px-6 py-4">Spesifikasi</th>
                                     <th className="px-6 py-4 text-right rounded-r-2xl">Kuantitas</th>
                                  </tr>
                               </thead>
                               <tbody className="text-sm font-bold">
                                  {viewingPOItems.map((item, idx) => (
                                     <tr key={item.id} className="bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
                                        <td className="px-6 py-5 rounded-l-2xl border-y border-l border-slate-100">
                                           <div className="flex items-center gap-4">
                                              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xs">
                                                 {idx + 1}
                                              </div>
                                              <span className="text-slate-900 group-hover:text-indigo-600 transition-colors uppercase">{item.itemName}</span>
                                           </div>
                                        </td>
                                        <td className="px-6 py-5 border-y border-slate-100">
                                           <div className="flex gap-2">
                                              <span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] text-slate-600 uppercase tabular-nums">{item.color}</span>
                                              <span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] text-slate-600 uppercase tabular-nums">SIZE {item.size}</span>
                                           </div>
                                        </td>
                                        <td className="px-6 py-5 text-right font-black text-slate-900 border-y border-r border-slate-100 rounded-r-2xl tabular-nums text-lg">
                                           {item.qty} <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest -ml-1">pcs</span>
                                        </td>
                                     </tr>
                                  ))}
                               </tbody>
                            </table>
                          </div>

                          <div className="mt-8 bg-slate-900 text-white rounded-[2rem] p-8 flex flex-col md:flex-row justify-between items-center gap-6 shadow-2xl shadow-indigo-600/10">
                             <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                   <FileText size={24}/>
                                </div>
                                <div>
                                   <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Total Kuantitas Produksi</p>
                                   <p className="text-3xl font-black tracking-tighter leading-none">
                                      {viewingPOItems.reduce((acc, i) => acc + i.qty, 0)} <span className="text-sm font-bold uppercase tracking-widest opacity-60">Pieces</span>
                                   </p>
                                </div>
                             </div>
                             <div className="w-full md:w-auto">
                                <div className="bg-white/10 px-6 py-4 rounded-2xl border border-white/10 backdrop-blur-md text-center md:text-right">
                                   <p className="text-[10px] font-black text-indigo-100 uppercase tracking-widest mb-1">Status Dokumen</p>
                                   <p className="font-black flex items-center justify-center md:justify-end gap-2 uppercase tracking-widest">
                                      <CheckCircle2 size={16} className="text-emerald-400"/> Terverifikasi Sistem
                                   </p>
                                </div>
                             </div>
                          </div>

                          {/* Progress & Tailors */}
                          <div className="mt-12 space-y-6">
                             <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50 pb-4">Status Pengerjaan & Penjahit</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Summary Progress */}
                                <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                                   {(() => {
                                      const totalPcs = viewingPOItems.reduce((acc, i) => acc + i.qty, 0);
                                      const poJobIds = jobs.filter(j => viewingPOItems.some(it => it.id === j.poItemId)).map(j => j.id);
                                      const finishedPcs = subs.filter(s => poJobIds.includes(s.jobId)).reduce((sum, s) => sum + s.qtySubmitted, 0);
                                      const isComplete = finishedPcs >= totalPcs;
                                      
                                      return (
                                         <div className="space-y-4">
                                            <div>
                                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Target</p>
                                               <div className="text-3xl font-black text-slate-900">{totalPcs} <span className="text-sm">PCS</span></div>
                                            </div>
                                            <div>
                                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Disetor (Selesai)</p>
                                               <div className={`text-3xl font-black ${isComplete ? 'text-emerald-600' : 'text-indigo-600'}`}>{finishedPcs} <span className="text-sm">PCS</span></div>
                                            </div>
                                            <div className="w-full bg-slate-200 rounded-full h-3 mt-4">
                                               <div className={`h-3 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, totalPcs > 0 ? (finishedPcs / totalPcs) * 100 : 0)}%` }}></div>
                                            </div>
                                         </div>
                                      );
                                   })()}
                                </div>
                                
                                {/* Tailors List */}
                                <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100 max-h-[250px] overflow-y-auto custom-scrollbar">
                                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Penjahit Yang Mengerjakan</p>
                                   {(() => {
                                      const poJobs = jobs.filter(j => viewingPOItems.some(it => it.id === j.poItemId));
                                      const tailorIds = Array.from(new Set(poJobs.map(j => j.tailorId)));
                                      
                                      if (tailorIds.length === 0) return <p className="text-xs text-slate-500 italic">Belum ada pekerjaan yang dibagikan.</p>;
                                      
                                      return (
                                         <div className="space-y-3">
                                            {tailorIds.map(tid => {
                                               const tailorName = tailors.find(t => t.id === tid)?.name || 'Unknown';
                                               const jobsForTailor = poJobs.filter(j => j.tailorId === tid);
                                               const totalTaken = jobsForTailor.reduce((sum, j) => sum + j.qtyTaken, 0);
                                               const poJobIdsForTailor = jobsForTailor.map(j => j.id);
                                               const totalFinished = subs.filter(s => poJobIdsForTailor.includes(s.jobId)).reduce((sum, s) => sum + s.qtySubmitted, 0);
                                               
                                               return (
                                                  <div key={tid} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                                     <span className="font-bold text-slate-800 text-sm uppercase">{tailorName}</span>
                                                     <div className="text-right">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase">Diambil: {totalTaken}</div>
                                                        <div className="text-[10px] font-black text-emerald-600 uppercase">Selesai: {totalFinished}</div>
                                                     </div>
                                                  </div>
                                               );
                                            })}
                                         </div>
                                      );
                                   })()}
                                </div>
                             </div>
                          </div>

                       </div>
                    </div>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Status Update Modal */}
       <AnimatePresence>
       {statusUpdatePOId && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden p-8"
             >
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
                   <Package className="text-indigo-600" /> Perbarui Status
                </h3>
                <div className="space-y-3">
                   {['Proses', 'Siap Kirim', 'Selesai', 'Dihapus'].map((status) => (
                      <button 
                        key={status}
                        disabled={isBusy}
                        onClick={() => updatePOStatus(statusUpdatePOId, status)}
                        className={`w-full py-4 px-6 rounded-2xl border-2 transition-all font-bold text-left flex justify-between items-center group disabled:opacity-50 ${
                           pos.find(p => p.id === statusUpdatePOId)?.status === status 
                           ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                           : 'border-slate-100 hover:border-indigo-200 text-slate-600'
                        }`}
                      >
                        <span>{status}</span>
                        {submittingAction === 'updateStatus' ? (
                          <Loader2 size={18} className="animate-spin text-indigo-600" />
                        ) : (
                          <ChevronRight size={18} className="opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"/>
                        )}
                      </button>
                   ))}
                </div>
                <button 
                  disabled={isBusy}
                  onClick={() => !isBusy && setStatusUpdatePOId(null)} 
                  className="mt-6 w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Finish PO Modal */}
       <AnimatePresence>
       {finishPOId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 p-8 text-center"
             >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Selesaikan PO?</h3>
                <p className="text-sm font-medium text-slate-500 mb-8">Yakin ingin menyelesaikan PO ini? PO akan dipindahkan ke histori/arsip sebagai catatan final.</p>
                <div className="flex gap-3">
                  <button 
                    disabled={isBusy}
                    onClick={() => !isBusy && setFinishPOId(null)} 
                    className="flex-1 px-4 py-3.5 rounded-2xl text-slate-500 font-bold bg-slate-50 hover:bg-slate-100 transition-colors active:scale-95 text-sm disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button 
                    disabled={isBusy}
                    onClick={confirmFinishPO} 
                    className="flex-1 px-4 py-3.5 rounded-2xl text-white font-bold bg-emerald-600 hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30 active:scale-95 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submittingAction === 'finishPO' ? (
                      <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                    ) : (
                      'Ya, Selesai'
                    )}
                  </button>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Delete PO Modal */}
       <AnimatePresence>
       {deletePOId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 p-8 text-center"
             >
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Hapus PO?</h3>
                <p className="text-sm font-medium text-slate-500 mb-8">Apakah Anda yakin ingin menghapus PO ini? PO akan terhapus dan dipindahkan ke histori/arsip.</p>
                <div className="flex gap-3">
                  <button 
                    disabled={isBusy}
                    onClick={() => !isBusy && setDeletePOId(null)} 
                    className="flex-1 px-4 py-3.5 rounded-2xl text-slate-500 font-bold bg-slate-50 hover:bg-slate-100 transition-colors active:scale-95 text-sm disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button 
                    disabled={isBusy}
                    onClick={confirmDeletePO} 
                    className="flex-1 px-4 py-3.5 rounded-2xl text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/30 active:scale-95 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submittingAction === 'deletePO' ? (
                      <><Loader2 size={16} className="animate-spin" /> Menghapus...</>
                    ) : (
                      'Ya, Hapus'
                    )}
                  </button>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Full Screen Photo Modal */}
       <AnimatePresence>
       {fullScreenPhoto && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl cursor-zoom-out"
            onClick={() => setFullScreenPhoto(null)}
          >
             <motion.img 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.8, opacity: 0 }}
               src={fullScreenPhoto} 
               alt="Full Screen" 
               className="max-w-full max-h-full object-contain rounded-2xl"
             />
          </div>
       )}
       </AnimatePresence>

       {/* Custom Notification / Confirmation Modal */}
       <AnimatePresence>
       {modalAlert.isOpen && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
             <motion.div
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-8 text-center"
             >
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 ${
                  modalAlert.type === 'error'
                    ? 'bg-rose-50 text-rose-600'
                    : modalAlert.type === 'confirm'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {modalAlert.type === 'error' && <AlertCircle size={32} />}
                  {modalAlert.type === 'confirm' && <AlertCircle size={32} />}
                  {modalAlert.type === 'success' && <CheckCircle2 size={32} />}
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-2">{modalAlert.title}</h3>
                <p className="text-sm font-medium text-slate-500 mb-7 leading-relaxed">{modalAlert.message}</p>

                {modalAlert.type === 'confirm' ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setModalAlert(prev => ({ ...prev, isOpen: false }))}
                      className="flex-1 px-4 py-3.5 rounded-2xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => modalAlert.onConfirm && modalAlert.onConfirm()}
                      className="flex-1 px-4 py-3.5 rounded-2xl text-white font-black bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/25 active:scale-95 text-xs uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isBusy ? (
                        <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                      ) : (
                        modalAlert.confirmLabel || 'Ya, Lanjutkan'
                      )}
                    </button>
                  </div>
                ) : (
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
                )}
             </motion.div>
          </div>
       )}
       </AnimatePresence>
    </div>
  )
}
