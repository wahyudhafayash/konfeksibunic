import { useState } from 'react';
import { db, useLiveQuery, GradeRule } from '@/lib/db';
import { Edit2, ShieldCheck, Trash2, Plus, X, Save, Lock, User, Users, CheckCircle2, ChevronRight, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsView({ userRole, currentUsername }: { userRole?: string, currentUsername?: string }) {
  const grades = useLiveQuery(() => db.gradeRules.toArray(), []) || [];
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<Partial<GradeRule>>({ name: '', minQtySingle: 0, bonusSingle: 0, minQtyCollab: 0, bonusCollab: 0 });
  const [editId, setEditId] = useState<number | null>(null);

  // Auth States
  const [isAuthFormOpen, setIsAuthFormOpen] = useState(false);
  const [authForm, setAuthForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [authStatus, setAuthStatus] = useState({ type: '', message: '' });
  const [isUpdatingAuth, setIsUpdatingAuth] = useState(false);

  async function handleSave(e: React.FormEvent) {
     e.preventDefault();
     if(!form.name) return;
     if (editId) {
        await db.gradeRules.update(editId, { ...form, updatedBy: currentUsername });
     } else {
        await db.gradeRules.add({ ...form, createdBy: currentUsername } as GradeRule);
     }
     setIsFormOpen(false);
     setEditId(null);
  }

  function openEdit(g: GradeRule) {
     setEditId(g.id!);
     setForm({ ...g });
     setIsFormOpen(true);
  }

  async function handleDelete(id: number) {
     if(confirm('Anda yakin ingin menghapus konfigurasi grade ini?')) {
        await db.gradeRules.delete(id);
     }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (authForm.newPassword !== authForm.confirmPassword) {
      setAuthStatus({ type: 'error', message: 'Konfirmasi password tidak cocok' });
      return;
    }

    setIsUpdatingAuth(true);
    setAuthStatus({ type: '', message: '' });

    try {
      const res = await fetch('/api/auth/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: currentUsername,
          currentPassword: authForm.currentPassword,
          newPassword: authForm.newPassword
        }),
      });

      const data = await res.json();
      if (data.success) {
        setAuthStatus({ type: 'success', message: 'Password berhasil diperbarui!' });
        setAuthForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setIsAuthFormOpen(false), 2000);
      } else {
        setAuthStatus({ type: 'error', message: data.message || 'Gagal memperbarui password' });
      }
    } catch (err) {
      setAuthStatus({ type: 'error', message: 'Terjadi kesalahan sistem.' });
    } finally {
      setIsUpdatingAuth(false);
    }
  }

  return (
    <div className="space-y-10 pb-20 max-w-5xl mx-auto">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Pengaturan Sistem</h2>
            <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">Konfigurasi grade produksi & akses keamanan</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <button 
               onClick={() => setIsAuthFormOpen(true)} 
               className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center justify-center gap-2"
             >
                <Lock size={18}/> Keamanan
             </button>
             {(userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin') && (
               <button 
                 onClick={() => { setForm({ name: '', minQtySingle: 0, bonusSingle: 0, minQtyCollab: 0, bonusCollab: 0 }); setEditId(null); setIsFormOpen(true); }}
                 className="flex-1 md:flex-none bg-slate-900 text-white hover:bg-indigo-600 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
               >
                  <Plus size={18}/> Tambah Grade
               </button>
             )}
          </div>
       </div>

       {/* Security Section UI */}
       <AnimatePresence>
       {isAuthFormOpen && (
         <motion.div 
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -20 }}
           className="bg-indigo-900 text-white rounded-[2.5rem] p-8 shadow-2xl shadow-indigo-900/20 relative overflow-hidden group"
         >
            <div className="absolute top-0 right-0 p-8 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform"><ShieldCheck size={160}/></div>
            
            <div className="relative z-10">
               <div className="flex justify-between items-start mb-8">
                  <div>
                     <h3 className="text-2xl font-black tracking-tight">Keamanan Akses</h3>
                     <p className="text-indigo-200 text-sm font-medium mt-1">Ubah kata sandi login admin untuk keamanan data.</p>
                  </div>
                  <button onClick={() => setIsAuthFormOpen(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                     <X size={20}/>
                  </button>
               </div>

               <form onSubmit={handleUpdatePassword} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                     <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest">Password Saat Ini</label>
                     <input 
                        type="password" 
                        required 
                        value={authForm.currentPassword}
                        onChange={e => setAuthForm({...authForm, currentPassword: e.target.value})}
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm focus:bg-white/20 focus:outline-none transition-all placeholder:text-white/20" 
                        placeholder="••••••••"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest">Password Baru</label>
                     <input 
                        type="password" 
                        required 
                        value={authForm.newPassword}
                        onChange={e => setAuthForm({...authForm, newPassword: e.target.value})}
                        className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm focus:bg-white/20 focus:outline-none transition-all placeholder:text-white/20" 
                        placeholder="Min. 6 Karakter"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="block text-[10px] font-black text-indigo-300 uppercase tracking-widest">Konfirmasi Password</label>
                     <div className="flex gap-2">
                        <input 
                           type="password" 
                           required 
                           value={authForm.confirmPassword}
                           onChange={e => setAuthForm({...authForm, confirmPassword: e.target.value})}
                           className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-sm focus:bg-white/20 focus:outline-none transition-all placeholder:text-white/20" 
                           placeholder="Ulangi Password"
                        />
                        <button type="submit" disabled={isUpdatingAuth} className="bg-white text-indigo-950 hover:bg-indigo-50 px-5 rounded-xl text-xs font-black uppercase flex items-center justify-center transition-all disabled:opacity-50">
                           {isUpdatingAuth ? <RefreshCcw size={18} className="animate-spin"/> : <Save size={18}/>}
                        </button>
                     </div>
                  </div>
               </form>

               {authStatus.message && (
                 <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={`mt-6 px-4 py-2 rounded-xl text-xs font-bold w-fit ${authStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    {authStatus.message}
                 </motion.div>
               )}
            </div>
         </motion.div>
       )}
       </AnimatePresence>

       {/* Grade Rules Section */}
       <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 px-2 flex items-center gap-3">
             <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div> Definisi Grade Produksi
          </h3>

          <AnimatePresence>
          {isFormOpen && (
             <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden no-scrollbar"
             >
                <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-xl shadow-indigo-100/20 mb-8">
                   <div className="flex justify-between items-center mb-8 border-b border-slate-50 pb-4">
                     <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                        {editId ? `Modifikasi ${form.name}` : 'Grade Rule Baru'}
                     </h3>
                     <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-slate-900 bg-slate-50 p-2 rounded-xl"><X size={20}/></button>
                   </div>
                   <form onSubmit={handleSave} className="space-y-8">
                      <div className="max-w-md">
                         <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Identifier Nama Grade</label>
                         <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-lg font-black text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none transition-all" required placeholder="CONTOH: GRADE A" />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="space-y-6 p-8 bg-slate-50/50 rounded-[2rem] border-2 border-slate-50 relative group hover:border-indigo-100 transition-all">
                            <div className="absolute -right-2 top-4 rotate-12 opacity-5 text-indigo-600"><User size={80}/></div>
                            <h4 className="font-black text-slate-900 text-xs flex items-center gap-3 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-indigo-500"></div> Pekerja Tunggal (Single)</h4>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Min. Setoran</label>
                                  <input type="number" min="0" value={form.minQtySingle || ''} onChange={e => setForm({...form, minQtySingle: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 text-base font-black focus:border-indigo-500 focus:outline-none" required placeholder="0"/>
                               </div>
                               <div className="space-y-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Bonus Total (Rp)</label>
                                  <input type="number" min="0" value={form.bonusSingle || ''} onChange={e => setForm({...form, bonusSingle: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 text-base font-black focus:border-indigo-500 focus:outline-none" required placeholder="0"/>
                               </div>
                            </div>
                         </div>

                         <div className="space-y-6 p-8 bg-slate-50/50 rounded-[2rem] border-2 border-slate-50 relative group hover:border-emerald-100 transition-all">
                            <div className="absolute -right-2 top-4 rotate-12 opacity-5 text-emerald-600"><User size={80}/></div>
                            <h4 className="font-black text-slate-900 text-xs flex items-center gap-3 uppercase tracking-widest"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Pekerja Kolaborasi (Partner)</h4>
                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Min. Setoran</label>
                                  <input type="number" min="0" value={form.minQtyCollab || ''} onChange={e => setForm({...form, minQtyCollab: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 text-base font-black focus:border-emerald-500 focus:outline-none" required placeholder="0"/>
                               </div>
                               <div className="space-y-2">
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Bonus Total (Rp)</label>
                                  <input type="number" min="0" value={form.bonusCollab || ''} onChange={e => setForm({...form, bonusCollab: Number(e.target.value)})} className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-3 text-base font-black focus:border-emerald-500 focus:outline-none" required placeholder="0"/>
                               </div>
                            </div>
                         </div>
                      </div>

                      <div className="flex justify-end pt-4">
                         <button type="submit" className="w-full md:w-auto bg-indigo-600 text-white hover:bg-slate-900 px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-indigo-600/20 transition-all active:scale-95">
                            <Save size={18}/> {editId ? 'Selesaikan Perubahan' : 'Publish Rule Baru'}
                         </button>
                      </div>
                   </form>
                </div>
             </motion.div>
          )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {grades.map(g => (
                <motion.div 
                   layout
                   key={g.id} 
                   className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-4 translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="flex gap-2">
                         {(userRole === 'super_admin' || userRole === 'superadmin' || userRole === 'admin') && (
                           <>
                             <button onClick={() => openEdit(g)} className="bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 p-2 rounded-xl shadow-sm transition-colors"><Edit2 size={16}/></button>
                             <button onClick={() => handleDelete(g.id!)} className="bg-white border border-slate-200 text-slate-400 hover:text-rose-600 p-2 rounded-xl shadow-sm transition-colors"><Trash2 size={16}/></button>
                           </>
                         )}
                      </div>
                   </div>

                   <div className="mb-8">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1 block">Rule Configuration</span>
                     <h4 className="text-2xl font-black text-slate-900 tracking-tight uppercase group-hover:text-indigo-600 transition-colors">{g.name}</h4>
                   </div>

                   <div className="space-y-6">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all"><User size={18}/></div>
                         <div>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Potensi Single</p>
                            <p className="text-xs font-bold text-slate-700">Min. {g.minQtySingle} pcs → <span className="font-black text-indigo-600">+Rp {g.bonusSingle.toLocaleString('id-ID')}</span></p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-all"><Users size={18}/></div>
                         <div>
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Potensi Berdua</p>
                            <p className="text-xs font-bold text-slate-700">Min. {g.minQtyCollab} pcs → <span className="font-black text-emerald-600">+Rp {g.bonusCollab.toLocaleString('id-ID')}</span></p>
                         </div>
                      </div>
                   </div>
                </motion.div>
             ))}
             {grades.length === 0 && (
                <div className="md:col-span-3 py-20 text-center opacity-40 font-bold border-2 border-dashed border-slate-100 rounded-[3rem]">
                   <Settings className="mx-auto mb-4 text-slate-200" size={48}/>
                   <p className="uppercase tracking-widest text-[10px]">Belum Ada Grade Terdaftar</p>
                </div>
             )}
          </div>
       </div>
    </div>
  )
}

function RefreshCcw({ size, className }: { size: number, className?: string }) {
   return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
         <path d="M21 2v6h-6"></path>
         <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
         <path d="M3 22v-6h6"></path>
         <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
      </svg>
   )
}
