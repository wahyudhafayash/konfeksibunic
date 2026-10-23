"use client"
import { useState, useEffect } from 'react';
import POView from '@/components/views/POView';
import TailorView from '@/components/views/TailorView';
import SalaryView from '@/components/views/SalaryView';
import DashboardView from '@/components/views/DashboardView';
import TabunganView from '@/components/views/TabunganView';
import SettingsView from '@/components/views/SettingsView';
import InhouseWorkerView from '@/components/views/InhouseWorkerView';
import CatatanView from '@/components/views/CatatanView';
import HistoryView from '@/components/views/HistoryView';
import LoginView from '@/components/LoginView';
import { Package, Users, Wallet, LayoutDashboard, PiggyBank, Settings, HardHat, FileText, History, LogOut, Menu, X as CloseIcon, ChevronRight, Clock } from 'lucide-react';
import { db } from '@/lib/db';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>('admin');
  const [currentUsername, setCurrentUsername] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  const SESSION_DURATION = 3600000; // 1 Hour in ms

  useEffect(() => {
    setMounted(true);
    const session = localStorage.getItem('konfeksi_session');
    const role = localStorage.getItem('konfeksi_role');
    const user = localStorage.getItem('konfeksi_username');
    const loginTime = localStorage.getItem('konfeksi_login_time');

    if (session === 'authenticated') {
      // Check if session has expired
      if (loginTime) {
        const elapsed = Date.now() - parseInt(loginTime);
        if (elapsed >= SESSION_DURATION) {
          handleLogout(true);
          return;
        }
      }

      setIsLoggedIn(true);
      setUserRole(role || 'admin');
      setCurrentUsername(user || 'unknown');
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  // Periodic session check
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkInterval = setInterval(() => {
      const loginTime = localStorage.getItem('konfeksi_login_time');
      if (loginTime) {
        const elapsed = Date.now() - parseInt(loginTime);
        if (elapsed >= SESSION_DURATION) {
          handleLogout(true);
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkInterval);
  }, [isLoggedIn]);

  const handleLogin = (role: string, username: string) => {
    localStorage.setItem('konfeksi_session', 'authenticated');
    localStorage.setItem('konfeksi_role', role);
    localStorage.setItem('konfeksi_username', username);
    localStorage.setItem('konfeksi_login_time', Date.now().toString());
    setUserRole(role);
    setCurrentUsername(username);
    setIsLoggedIn(true);
  };

  const handleLogout = (isTimeout: boolean = false) => {
    localStorage.removeItem('konfeksi_session');
    localStorage.removeItem('konfeksi_role');
    localStorage.removeItem('konfeksi_username');
    localStorage.removeItem('konfeksi_login_time');
    setIsLoggedIn(false);
    setConfirmLogout(false);
    if (isTimeout) {
      setShowTimeoutModal(true);
    } else {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    db.gradeRules.count().then(count => {
       if (count === 0) {
          db.gradeRules.bulkAdd([
             { name: 'Grade A', minQtySingle: 75, bonusSingle: 100000, minQtyCollab: 152, bonusCollab: 200000 },
             { name: 'Grade B', minQtySingle: 50, bonusSingle: 50000, minQtyCollab: 52, bonusCollab: 100000 }
          ]).catch(err => console.warn('Failed to bulk add grade rules:', err.message));
       }
    }).catch(err => console.warn('Failed to init grade rules:', err.message));
  }, []);

  if (!mounted || isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-bold" suppressHydrationWarning>
        <div 
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-2xl shadow-indigo-500/20"
        />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <>
        <LoginView onLogin={handleLogin} />
        {/* Timeout Modal */}
        <AnimatePresence>
          {showTimeoutModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl relative border-4 border-indigo-50/50"
              >
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                  <Clock size={40} className="animate-pulse" />
                </div>
                <h3 className="text-2xl font-black text-center text-slate-900 mb-3 tracking-tight">Sesi Berakhir</h3>
                <p className="text-center text-slate-500 text-base mb-10 font-medium leading-relaxed">
                  Demi keamanan, sesi Anda telah habis karena sudah mencapai batas 1 jam. Silahkan login kembali.
                </p>
                <button 
                  onClick={() => setShowTimeoutModal(false)} 
                  className="w-full px-6 py-4 rounded-2xl text-white font-black uppercase tracking-widest bg-indigo-600 hover:bg-slate-900 transition-all shadow-xl shadow-indigo-600/20 active:scale-95 text-sm"
                >
                  Masuk Kembali
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  const menuItems = [
    { section: 'MANAGEMENT', items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'po', label: 'PO & Master Barang', icon: Package },
    ]},
    { section: 'PRODUCTION', items: [
      { id: 'tailor', label: 'Ambil & Setor Finish', icon: Users },
      { id: 'inhouse', label: 'Tenaga Inhouse', icon: HardHat },
    ]},
    { section: 'FINANCIAL', items: [
      { id: 'salary', label: 'Penggajian', icon: Wallet },
      { id: 'tabungan', label: 'Tabungan Pekerja', icon: PiggyBank },
    ]},
    { section: 'RECORDS', items: [
      { id: 'history', label: 'Histori & Log', icon: History },
      { id: 'catatan', label: 'Catatan Admin', icon: FileText },
    ]},
    { section: 'SYSTEM', items: [
      { id: 'settings', label: 'Konfigurasi', icon: Settings },
    ]}
  ];

  return (
    <div className="min-h-screen flex flex-col xl:flex-row font-sans bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900 text-xs sm:text-sm">
      {/* Top Header (Mobile & Tablet - up to xl) */}
      <header className="xl:hidden no-print h-13 bg-white border-b border-slate-100 flex items-center justify-between px-3 sm:px-5 sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-xs">B</div>
          <div className="flex flex-col">
            <span className="font-black text-xs sm:text-sm tracking-tight text-slate-900">Konfeksi Bunda</span>
            <span className="text-[8px] sm:text-[9px] text-indigo-500 font-black uppercase tracking-widest leading-none">Admin Panel</span>
          </div>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-1.5 sm:p-2 text-slate-600 hover:text-indigo-600 active:scale-95 transition-all rounded-lg hover:bg-slate-50 border border-slate-200/60"
          aria-label="Toggle menu navigasi"
        >
          {isSidebarOpen ? <CloseIcon size={18}/> : <Menu size={18}/>}
        </button>
      </header>

      {/* Bottom Navigation (Mobile & Tablet - up to xl) */}
      <nav className="xl:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-md border-t border-slate-100 px-2 sm:px-4 flex items-center justify-around z-40 no-print shadow-[0_-4px_25px_rgba(0,0,0,0.06)] pb-safe">
         {[
           { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
           { id: 'po', label: 'PO', icon: Package },
           { id: 'tailor', label: 'Penjahit', icon: Users },
           { id: 'salary', label: 'Gaji', icon: Wallet },
         ].map(item => (
           <button 
             key={item.id}
             onClick={() => setActiveTab(item.id)}
             className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-lg transition-all ${
               activeTab === item.id 
                 ? 'text-indigo-600 font-black' 
                 : 'text-slate-400 hover:text-slate-600 font-bold'
             }`}
           >
             <div className={`p-1 rounded-lg transition-all ${activeTab === item.id ? 'bg-indigo-50 text-indigo-600 shadow-xs' : ''}`}>
               <item.icon size={16} />
             </div>
             <span className="text-[8.5px] tracking-tight leading-none">{item.label}</span>
           </button>
         ))}
         {/* Menu / Lainnya button that triggers drawer */}
         <button 
           onClick={() => setIsSidebarOpen(true)}
           className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2 rounded-lg transition-all ${
             ['inhouse', 'tabungan', 'history', 'catatan', 'settings'].includes(activeTab)
               ? 'text-indigo-600 font-black' 
               : 'text-slate-400 hover:text-slate-600 font-bold'
           }`}
         >
           <div className={`p-1 rounded-lg transition-all ${['inhouse', 'tabungan', 'history', 'catatan', 'settings'].includes(activeTab) ? 'bg-indigo-50 text-indigo-600 shadow-xs' : ''}`}>
             <Menu size={16} />
           </div>
           <span className="text-[8.5px] tracking-tight leading-none">Lainnya</span>
         </button>
      </nav>

      {/* Mobile & Tablet Drawer (< xl) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs"
              onClick={() => setIsSidebarOpen(false)}
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="no-print fixed inset-y-0 left-0 w-72 max-w-[88vw] bg-slate-900 flex flex-col text-slate-300 shadow-2xl z-10"
            >
              <div className="p-4 flex items-center justify-between border-b border-white/10 bg-slate-950/30">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
                    <LayoutDashboard size={18} />
                  </div>
                  <div>
                    <span className="font-black text-white text-sm tracking-tight block leading-tight">KONFEKSI BUNDA</span>
                    <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] leading-none mt-1 block">Admin Cloud</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
                  aria-label="Tutup menu navigasi"
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <nav className="p-3 flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar-hidden">
                {menuItems.map((section) => (
                  <div key={section.section} className="space-y-1.5">
                    <p className="text-[10.5px] font-black text-slate-400 tracking-[0.2em] pl-3 uppercase">{section.section}</p>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <button 
                          key={item.id}
                          onClick={() => {
                            setActiveTab(item.id);
                            setIsSidebarOpen(false);
                          }}
                          className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all text-sm ${
                            activeTab === item.id 
                              ? 'bg-white text-slate-900 shadow-md font-extrabold' 
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon size={18} className={`${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'} transition-colors shrink-0`}/> 
                            <span className="tracking-tight text-sm font-bold">{item.label}</span>
                          </div>
                          {activeTab === item.id && (
                            <span className="w-2 h-2 bg-indigo-600 rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </nav>

              <div className="p-3.5 mt-auto border-t border-white/10 bg-slate-950/50">
                <button 
                  type="button"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setConfirmLogout(true);
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2"><LogOut size={16}/> Keluar Sistem</span>
                  <ChevronRight size={14} className="opacity-60" />
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Permanent Sidebar (xl:flex) - Larger Width & Clearer Text */}
      <aside className="no-print hidden xl:flex w-64 2xl:w-72 bg-slate-900 flex-shrink-0 flex-col text-slate-300 h-screen sticky top-0 border-r border-white/5">
        <div className="p-4 2xl:p-5 flex items-center justify-between border-b border-white/10 bg-slate-950/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
              <LayoutDashboard size={18} />
            </div>
            <div>
              <span className="font-black text-white text-sm 2xl:text-base tracking-tight block leading-tight">KONFEKSI BUNDA</span>
              <span className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] leading-none mt-1 block">Admin Cloud</span>
            </div>
          </div>
        </div>

        <nav className="p-3 2xl:p-3.5 flex flex-col gap-4 flex-1 overflow-y-auto custom-scrollbar-hidden">
          {menuItems.map((section) => (
            <div key={section.section} className="space-y-1.5">
              <p className="text-[10.5px] font-black text-slate-400 tracking-[0.2em] pl-3 uppercase">{section.section}</p>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button 
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl font-bold transition-all text-sm ${
                      activeTab === item.id 
                        ? 'bg-white text-slate-900 shadow-md font-extrabold' 
                        : 'text-slate-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className={`${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'} transition-colors shrink-0`}/> 
                      <span className="tracking-tight text-sm font-bold">{item.label}</span>
                    </div>
                    {activeTab === item.id && (
                      <span className="w-2 h-2 bg-indigo-600 rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-3.5 mt-auto border-t border-white/10 bg-slate-950/50">
          <button 
            type="button"
            onClick={() => setConfirmLogout(true)}
            className="flex w-full items-center justify-between px-4 py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2"><LogOut size={16}/> Keluar Sistem</span>
            <ChevronRight size={14} className="opacity-60" />
          </button>
        </div>
      </aside>

      {/* Main Content Area - Always Scrollable on Large Screens */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto h-[calc(100dvh-3.25rem)] xl:h-screen pb-20 md:pb-6 xl:pb-6 relative p-2 sm:p-3 xl:p-5 scroll-smooth custom-scrollbar">
         <div className="max-w-[1400px] mx-auto h-full">
           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               className="h-full"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2, ease: "easeOut" }}
             >
               {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} currentUsername={currentUsername} userRole={userRole} />}
               {activeTab === 'po' && <POView currentUsername={currentUsername} onNavigate={setActiveTab} />}
               {activeTab === 'tailor' && <TailorView currentUsername={currentUsername} userRole={userRole} onNavigate={setActiveTab} />}
               {activeTab === 'inhouse' && <InhouseWorkerView currentUsername={currentUsername} userRole={userRole} />}
               {activeTab === 'salary' && <SalaryView onNavigate={setActiveTab} userRole={userRole} currentUsername={currentUsername} />}
               {activeTab === 'tabungan' && <TabunganView userRole={userRole} currentUsername={currentUsername} onNavigate={setActiveTab} />}
               {activeTab === 'settings' && <SettingsView userRole={userRole} currentUsername={currentUsername} />}
               {activeTab === 'history' && <HistoryView />}
               {activeTab === 'catatan' && <CatatanView currentUsername={currentUsername} />}
             </motion.div>
           </AnimatePresence>
         </div>
      </main>

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {confirmLogout && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl relative"
            >
              <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6">
                <LogOut size={32} />
              </div>
              <h3 className="text-xl font-black text-center text-slate-900 mb-2">Keluar Sistem?</h3>
              <p className="text-center text-slate-500 text-sm mb-8 font-medium">Apakah Anda yakin ingin keluar dari sistem? Anda harus login kembali.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmLogout(false)} 
                  className="flex-1 px-4 py-3.5 rounded-2xl text-slate-500 font-bold bg-slate-50 hover:bg-slate-100 transition-colors active:scale-95 text-sm"
                >
                  Batal
                </button>
                <button 
                  onClick={() => handleLogout(false)} 
                  className="flex-1 px-4 py-3.5 rounded-2xl text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/30 active:scale-95 text-sm"
                >
                  Ya, Keluar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
