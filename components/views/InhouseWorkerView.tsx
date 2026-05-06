import { useState } from 'react';
import { db, useLiveQuery, InhouseWorker, InhouseSalary } from '@/lib/db';
import { Plus, Trash2, Edit2, Save, X, Search, FileText, HardHat, Phone, MapPin, Calendar, Receipt, ChevronRight, AlertCircle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function InhouseWorkerView({ currentUsername, userRole }: { currentUsername?: string, userRole?: string }) {
  const workers = useLiveQuery(() => db.inhouseWorkers.toArray(), []) || [];
  const salaries = useLiveQuery(() => db.inhouseSalaries.toArray(), []) || [];

  const [activeWorkerId, setActiveWorkerId] = useState<number | null>(null);
  
  // Worker modal state
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [workerForm, setWorkerForm] = useState<Partial<InhouseWorker>>({ name: '', phone: '', address: '' });
  const [workerEditId, setWorkerEditId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [workerToDelete, setWorkerToDelete] = useState<InhouseWorker | null>(null);

  // Salary modal state
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState<Partial<InhouseSalary>>({ date: new Date().toISOString().split('T')[0], amount: 0, notes: '' });
  const [salaryEditId, setSalaryEditId] = useState<number | null>(null);

  const filteredWorkers = workers.filter(w => (w.name || '').toLowerCase().includes(searchTerm.toLowerCase()));

  // ---- Worker Handlers ----
  function openAddWorker() {
    setWorkerEditId(null);
    setWorkerForm({ name: '', phone: '', address: '' });
    setIsWorkerModalOpen(true);
  }

  function openEditWorker(e: React.MouseEvent, worker: InhouseWorker) {
    e.stopPropagation();
    setWorkerEditId(worker.id!);
    setWorkerForm({
      name: worker.name,
      phone: worker.phone,
      address: worker.address
    });
    setIsWorkerModalOpen(true);
  }

  async function handleSaveWorker(e: React.FormEvent) {
    e.preventDefault();
    if (!workerForm.name) return;

    if (workerEditId) {
      await db.inhouseWorkers.update(workerEditId, { ...workerForm, updatedBy: currentUsername } as InhouseWorker);
    } else {
      await db.inhouseWorkers.add({ ...workerForm, createdBy: currentUsername } as InhouseWorker);
    }
    setIsWorkerModalOpen(false);
  }

  async function handleDeleteWorker(e: React.MouseEvent, id: number) {
    if (e) e.stopPropagation();
    const worker = workers.find(w => w.id === id);
    if (worker) setWorkerToDelete(worker);
  }

  async function confirmDeleteWorker() {
    if (!workerToDelete) return;
    try {
      await db.inhouseWorkers.delete(workerToDelete.id!);
      const relatedSalaries = salaries.filter(s => s.workerId === workerToDelete.id!).map(s => s.id!);
      if (relatedSalaries.length > 0) {
        await db.inhouseSalaries.bulkDelete(relatedSalaries);
      }
      if (activeWorkerId === workerToDelete.id!) setActiveWorkerId(null);
    } catch (error) {
      console.error(error);
    }
    setWorkerToDelete(null);
  }

  // ---- Salary Handlers ----
  function openAddSalary(workerId: number) {
    setActiveWorkerId(workerId);
    setSalaryEditId(null);
    setSalaryForm({ date: new Date().toISOString().split('T')[0], amount: 0, notes: '' });
    setIsSalaryModalOpen(true);
  }

  function openEditSalary(salary: InhouseSalary) {
    setSalaryEditId(salary.id!);
    setSalaryForm({
      date: salary.date.split('T')[0],
      amount: salary.amount,
      notes: salary.notes
    });
    setIsSalaryModalOpen(true);
  }

  async function handleSaveSalary(e: React.FormEvent) {
    e.preventDefault();
    if (!activeWorkerId || !salaryForm.amount) return;

    const formattedDate = new Date(salaryForm.date!).toISOString();

    if (salaryEditId) {
      await db.inhouseSalaries.update(salaryEditId, {
        date: formattedDate,
        amount: Number(salaryForm.amount),
        notes: salaryForm.notes,
        updatedBy: currentUsername
      });
    } else {
      await db.inhouseSalaries.add({
        workerId: activeWorkerId,
        date: formattedDate,
        amount: Number(salaryForm.amount),
        notes: salaryForm.notes || '',
        createdBy: currentUsername
      });
    }
    setIsSalaryModalOpen(false);
  }

  async function handleDeleteSalary(id: number) {
    if (confirm('Hapus riwayat gaji ini?')) {
      await db.inhouseSalaries.delete(id);
    }
  }

  const activeWorkerInfo = workers.find(w => w.id === activeWorkerId);
  const activeWorkerSalaries = salaries.filter(s => s.workerId === activeWorkerId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const totalSalaryForActive = activeWorkerSalaries.reduce((sum, s) => sum + s.amount, 0);

  return (
    <div className="space-y-8 pb-24">
       <div className="no-print flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">Tenaga Anak Dalam</h2>
            <p className="text-slate-500 font-medium mt-2 uppercase tracking-widest text-[10px]">Manajemen pekerja harian/tetap in-house</p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
             <div className="relative w-full sm:w-64 group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Cari nama pekerja..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all shadow-sm" 
                />
             </div>
             <button 
               onClick={openAddWorker} 
               className="w-full sm:w-auto bg-slate-900 text-white hover:bg-slate-800 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 shrink-0 active:scale-95"
             >
                <Plus size={18}/> Registrasi Pekerja
             </button>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Worker List */}
          <div className="lg:col-span-1 space-y-4">
             <AnimatePresence mode="popLayout">
             {filteredWorkers.map(w => (
                <motion.div 
                   layout
                   initial={{ opacity: 0, x: -20 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   key={w.id} 
                   className={`group relative bg-white rounded-[2rem] border-2 p-6 cursor-pointer transition-all ${activeWorkerId === w.id ? 'border-indigo-600 shadow-xl shadow-indigo-600/5' : 'border-slate-50 hover:border-slate-200 shadow-sm'}`} 
                   onClick={() => setActiveWorkerId(w.id!)}
                >
                   <div className="flex justify-between items-center mb-6">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeWorkerId === w.id ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>
                         <HardHat size={24}/>
                      </div>
                      <div className="flex gap-1 transition-all">
                         <button type="button" onClick={e => openEditWorker(e, w)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors">
                            <Edit2 size={16} className="pointer-events-none"/>
                         </button>
                         <button type="button" onClick={e => handleDeleteWorker(e, w.id!)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                            <Trash2 size={16} className="pointer-events-none"/>
                         </button>
                      </div>
                   </div>
                   
                   <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{w.name}</h3>
                   
                   <div className="mt-4 space-y-2">
                     <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                        <Phone size={14} className="text-slate-300"/> {w.phone || '-'}
                     </div>
                     <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                        <MapPin size={14} className="text-slate-300"/> {w.address || '-'}
                     </div>
                     {(w.createdBy || w.updatedBy) && (
                       <div className="text-[8px] font-black italic text-slate-300 uppercase mt-2 text-right">By: {w.updatedBy || w.createdBy}</div>
                     )}
                   </div>

                   {activeWorkerId === w.id && (
                     <motion.div layoutId="active-indicator" className="absolute -left-[2px] top-1/2 -translate-y-1/2 w-1.5 h-12 bg-indigo-600 rounded-r-full" />
                   )}
                </motion.div>
             ))}
             </AnimatePresence>
             {filteredWorkers.length === 0 && (
                <div className="text-center py-16 bg-white border-2 border-slate-50 border-dashed rounded-[2.5rem] opacity-40">
                   <Users className="mx-auto mb-3 text-slate-300" size={40}/>
                   <p className="text-[10px] uppercase font-black tracking-widest">Tidak Ada Pekerja</p>
                </div>
             )}
          </div>

          {/* Salary History */}
          <div className="lg:col-span-2">
             <AnimatePresence mode="wait">
             {activeWorkerId ? (
                <motion.div 
                   key={activeWorkerId}
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: -20 }}
                   className="bg-white rounded-[3rem] border-2 border-slate-50 shadow-sm relative overflow-hidden"
                >
                   {/* Header Detail */}
                   <div className="p-8 sm:p-10 border-b-2 border-slate-50 bg-slate-50/30 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                      <div className="flex items-center gap-5">
                         <div className="w-16 h-16 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center text-indigo-600 font-black text-2xl">
                            {activeWorkerInfo?.name.charAt(0)}
                         </div>
                         <div>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">{activeWorkerInfo?.name}</h3>
                            <div className="flex items-center gap-4 mt-2">
                               <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{activeWorkerSalaries.length} Record Gaji</p>
                               <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                               <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest underline decoration-2 underline-offset-4">Total: Rp {totalSalaryForActive.toLocaleString('id-ID')}</p>
                            </div>
                         </div>
                      </div>
                    <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full sm:w-auto">
                       <button 
                         type="button"
                         onClick={() => openAddSalary(activeWorkerId)} 
                         className="flex-1 sm:flex-none bg-slate-900 text-white hover:bg-indigo-600 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-lg shadow-slate-900/10 transition-all active:scale-95"
                       >
                          <Receipt size={18}/> Catat Gaji Baru
                       </button>
                       <button 
                         type="button"
                         onClick={(e) => handleDeleteWorker(e, activeWorkerId!)} 
                         className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white p-4 rounded-2xl transition-all shadow-sm border border-rose-100 flex items-center justify-center"
                         title="Hapus Pekerja"
                       >
                          <Trash2 size={18}/>
                       </button>
                    </div>
                   </div>

                   <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-sm">
                         <thead>
                            <tr className="bg-white border-b-2 border-slate-50 text-[10px] font-black text-slate-400 lg:text-slate-500 uppercase tracking-[0.2em]">
                               <th className="px-10 py-6">Tanggal</th>
                               <th className="px-10 py-6">Keterangan</th>
                               <th className="px-10 py-6 text-right">Nominal (Rp)</th>
                               <th className="px-10 py-6 text-center">Opsi</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y-2 divide-slate-50">
                            {activeWorkerSalaries.length === 0 ? (
                               <tr><td colSpan={4} className="px-10 py-24 text-center text-slate-300 italic font-bold">Belum ada riwayat gaji tercatat.</td></tr>
                            ) : (
                               activeWorkerSalaries.map(sal => (
                                  <tr key={sal.id} className="hover:bg-slate-50/50 transition-colors group">
                                     <td className="px-10 py-6">
                                        <div className="flex items-center gap-3">
                                           <div className="p-2 bg-slate-100 rounded-lg text-slate-400 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors"><Calendar size={14}/></div>
                                           <span className="font-black text-slate-900 tracking-tight uppercase text-sm">{new Date(sal.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                        </div>
                                     </td>
                                     <td className="px-10 py-6">
                                        <div className="text-xs font-bold text-slate-600 max-w-xs">{sal.notes || '-'}</div>
                                        {(sal.createdBy || sal.updatedBy) && (
                                           <div className="text-[8px] font-black italic text-slate-300 uppercase mt-1">Admin: {sal.updatedBy || sal.createdBy}</div>
                                        )}
                                     </td>
                                     <td className="px-10 py-6 text-right">
                                        <span className="text-lg font-black text-emerald-600 tabular-nums">
                                           {sal.amount.toLocaleString('id-ID')}
                                        </span>
                                     </td>
                                     <td className="px-10 py-6">
                                        <div className="flex justify-center gap-2">
                                           <button onClick={() => openEditSalary(sal)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all"><Edit2 size={16}/></button>
                                           <button onClick={() => handleDeleteSalary(sal.id!)} className="p-2 text-slate-300 hover:text-rose-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all"><Trash2 size={16}/></button>
                                        </div>
                                     </td>
                                  </tr>
                               ))
                            )}
                         </tbody>
                      </table>
                   </div>
                </motion.div>
             ) : (
                <div className="group h-[500px] bg-white border-2 border-slate-50 border-dashed rounded-[3rem] flex flex-col items-center justify-center p-12 text-center transition-all hover:bg-indigo-50/30 hover:border-indigo-100">
                   <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-8 text-slate-200 group-hover:bg-white group-hover:text-indigo-200 transition-all group-hover:scale-110 group-hover:rotate-6">
                      <FileText size={48} />
                   </div>
                   <h3 className="text-xl font-black text-slate-400 tracking-tight leading-none group-hover:text-indigo-400 transition-colors">SELEKSI PEKERJA</h3>
                   <p className="text-xs font-bold text-slate-300 mt-4 max-w-[240px] uppercase tracking-widest leading-relaxed">Klik salah satu nama di samping untuk melihat rekam jejak penggajian</p>
                   <ChevronRight size={32} className="text-slate-100 mt-8 group-hover:translate-x-2 transition-transform"/>
                </div>
             )}
             </AnimatePresence>
          </div>
       </div>

       {/* Worker Modal */}
       <AnimatePresence>
       {isWorkerModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
             >
                <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/50">
                   <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">{workerEditId ? 'Detail Pekerja' : 'Pekerja Baru'}</h3>
                   <button onClick={() => setIsWorkerModalOpen(false)} className="bg-white text-slate-400 hover:text-slate-900 p-2 rounded-xl transition-colors shadow-sm"><X size={20}/></button>
                </div>
                <form onSubmit={handleSaveWorker} className="p-8 space-y-6">
                   <div className="space-y-2">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Identitas Nama</label>
                     <input type="text" value={workerForm.name} onChange={e => setWorkerForm({...workerForm, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none transition-all placeholder:text-slate-300" required placeholder="NAMA LENGKAP" />
                   </div>
                   <div className="space-y-2">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nomor Telepon</label>
                     <input type="text" value={workerForm.phone} onChange={e => setWorkerForm({...workerForm, phone: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" placeholder="08..." />
                   </div>
                   <div className="space-y-2">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Domisili / Alamat</label>
                     <textarea rows={3} value={workerForm.address} onChange={e => setWorkerForm({...workerForm, address: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" placeholder="ALAMAT LENGKAP"></textarea>
                   </div>
                   <div className="pt-4">
                     <button type="submit" className="w-full bg-indigo-600 text-white hover:bg-slate-900 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 active:scale-95">
                        <Save size={18}/> Simpan Informasi
                     </button>
                   </div>
                </form>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Salary Modal */}
       <AnimatePresence>
       {isSalaryModalOpen && activeWorkerInfo && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100"
             >
                <div className="p-8 border-b-2 border-slate-50 flex justify-between items-center bg-slate-50/50">
                   <div>
                     <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase leading-none">{salaryEditId ? 'Koreksi Gaji' : 'Input Gaji'}</h3>
                     <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest mt-2">{activeWorkerInfo.name}</p>
                   </div>
                   <button onClick={() => setIsSalaryModalOpen(false)} className="bg-white text-slate-400 hover:text-slate-900 p-2 rounded-xl transition-colors shadow-sm"><X size={20}/></button>
                </div>
                <form onSubmit={handleSaveSalary} className="p-8 space-y-6">
                   <div className="space-y-2">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Tanggal Pencatatan</label>
                     <input type="date" value={salaryForm.date} onChange={e => setSalaryForm({...salaryForm, date: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" required />
                   </div>
                   <div className="space-y-2">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Nominal Gaji (Rp)</label>
                     <input type="number" min="0" value={salaryForm.amount || ''} onChange={e => setSalaryForm({...salaryForm, amount: Number(e.target.value)})} className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl px-5 py-4 text-xl font-black text-emerald-600 focus:bg-white focus:border-emerald-500 focus:outline-none transition-all" required />
                   </div>
                   <div className="space-y-2">
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Catatan / Detail Pekerjaan</label>
                     <textarea rows={3} value={salaryForm.notes} onChange={e => setSalaryForm({...salaryForm, notes: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" placeholder="Misal: Gaji Minggu Pertama..."></textarea>
                   </div>
                   <div className="pt-4 flex gap-3">
                     <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3 flex-1 mb-2">
                        <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5"/>
                        <p className="text-[10px] font-bold text-amber-700 leading-relaxed uppercase tracking-wider">Pastikan jumlah uang sudah sesuai sebelum menyimpan data.</p>
                     </div>
                   </div>
                   <button type="submit" className="w-full bg-emerald-600 text-white hover:bg-slate-900 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 active:scale-95">
                      <Save size={18}/> {salaryEditId ? 'Simpan Perubahan' : 'Publish & Cetak'}
                   </button>
                </form>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Worker Delete Modal */}
       <AnimatePresence>
       {workerToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[3rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 p-8 text-center"
             >
                <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Hapus Pekerja?</h3>
                <p className="text-sm font-medium text-slate-500 mb-8">Apakah Anda yakin ingin menghapus pekerja <span className="font-bold text-slate-900">{workerToDelete.name}</span>? Semua data gajinya juga akan terhapus secara permanen.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setWorkerToDelete(null)} 
                    className="flex-1 px-4 py-3.5 rounded-2xl text-slate-500 font-bold bg-slate-50 hover:bg-slate-100 transition-colors active:scale-95 text-sm"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={confirmDeleteWorker} 
                    className="flex-1 px-4 py-3.5 rounded-2xl text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/30 active:scale-95 text-sm"
                  >
                    Ya, Yakin
                  </button>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>
    </div>
  )
}
