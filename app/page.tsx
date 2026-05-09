"use client";
import { useState, useEffect } from "react";
import POView from "@/components/views/POView";
import TailorView from "@/components/views/TailorView";
import SalaryView from "@/components/views/SalaryView";
import DashboardView from "@/components/views/DashboardView";
import TabunganView from "@/components/views/TabunganView";
import SettingsView from "@/components/views/SettingsView";
import InhouseWorkerView from "@/components/views/InhouseWorkerView";
import CatatanView from "@/components/views/CatatanView";
import HistoryView from "@/components/views/HistoryView";
import LoginView from "@/components/LoginView";
import {
  Package,
  Users,
  Wallet,
  LayoutDashboard,
  PiggyBank,
  Settings,
  HardHat,
  FileText,
  History,
  LogOut,
  Menu,
  X as CloseIcon,
  ChevronRight,
  Clock,
} from "lucide-react";
import { db } from "@/lib/db";
import { motion, AnimatePresence } from "framer-motion";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [userRole, setUserRole] = useState<string>("admin");
  const [currentUsername, setCurrentUsername] = useState<string>("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [showTimeoutModal, setShowTimeoutModal] = useState(false);

  const SESSION_DURATION = 3600000; // 1 Hour in ms

  useEffect(() => {
    const session = localStorage.getItem("konfeksi_session");
    const role = localStorage.getItem("konfeksi_role");
    const user = localStorage.getItem("konfeksi_username");
    const loginTime = localStorage.getItem("konfeksi_login_time");

    if (session === "authenticated") {
      // Check if session has expired
      if (loginTime) {
        const elapsed = Date.now() - parseInt(loginTime);
        if (elapsed >= SESSION_DURATION) {
          handleLogout(true);
          return;
        }
      }

      setIsLoggedIn(true);
      setUserRole(role || "admin");
      setCurrentUsername(user || "unknown");
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  // Periodic session check
  useEffect(() => {
    if (!isLoggedIn) return;

    const checkInterval = setInterval(() => {
      const loginTime = localStorage.getItem("konfeksi_login_time");
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
    localStorage.setItem("konfeksi_session", "authenticated");
    localStorage.setItem("konfeksi_role", role);
    localStorage.setItem("konfeksi_username", username);
    localStorage.setItem("konfeksi_login_time", Date.now().toString());
    setUserRole(role);
    setCurrentUsername(username);
    setIsLoggedIn(true);
  };

  const handleLogout = (isTimeout: boolean = false) => {
    localStorage.removeItem("konfeksi_session");
    localStorage.removeItem("konfeksi_role");
    localStorage.removeItem("konfeksi_username");
    localStorage.removeItem("konfeksi_login_time");
    setIsLoggedIn(false);
    setConfirmLogout(false);
    if (isTimeout) {
      setShowTimeoutModal(true);
    } else {
      window.location.href = "/";
    }
  };

  useEffect(() => {
    db.gradeRules
      .count()
      .then((count) => {
        if (count === 0) {
          db.gradeRules
            .bulkAdd([
              {
                name: "Grade A",
                minQtySingle: 75,
                bonusSingle: 100000,
                minQtyCollab: 152,
                bonusCollab: 200000,
              },
              {
                name: "Grade B",
                minQtySingle: 50,
                bonusSingle: 50000,
                minQtyCollab: 52,
                bonusCollab: 100000,
              },
            ])
            .catch((err) =>
              console.warn("Failed to bulk add grade rules:", err.message)
            );
        }
      })
      .catch((err) => console.warn("Failed to init grade rules:", err.message));
  }, []);

  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-bold">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full shadow-2xl shadow-indigo-500/20"
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
                <h3 className="text-2xl font-black text-center text-slate-900 mb-3 tracking-tight">
                  Sesi Berakhir
                </h3>
                <p className="text-center text-slate-500 text-base mb-10 font-medium leading-relaxed">
                  Demi keamanan, sesi Anda telah habis karena sudah mencapai
                  batas 1 jam. Silahkan login kembali.
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
    {
      section: "MANAGEMENT",
      items: [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "po", label: "PO & Master Barang", icon: Package },
      ],
    },
    {
      section: "PRODUCTION",
      items: [
        { id: "tailor", label: "Ambil & Setor Finish", icon: Users },
        { id: "inhouse", label: "Tenaga Inhouse", icon: HardHat },
      ],
    },
    {
      section: "FINANCIAL",
      items: [
        { id: "salary", label: "Penggajian", icon: Wallet },
        { id: "tabungan", label: "Tabungan Pekerja", icon: PiggyBank },
      ],
    },
    {
      section: "RECORDS",
      items: [
        { id: "history", label: "Histori & Log", icon: History },
        { id: "catatan", label: "Catatan Admin", icon: FileText },
      ],
    },
    {
      section: "SYSTEM",
      items: [{ id: "settings", label: "Konfigurasi", icon: Settings }],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-sans bg-slate-50 selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden">
      {/* Mobile Top Header */}
      <header className="md:hidden no-print h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xs">
            B
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-tight text-slate-900">
              Konfeksi Bunda
            </span>
            <span className="text-[9px] text-indigo-500 font-black uppercase tracking-widest leading-none">
              Admin Panel
            </span>
          </div>
        </div>
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-slate-400 hover:text-indigo-600 active:scale-95 transition-all"
        >
          {isSidebarOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Bottom Navigation (Quick Menu) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-100 px-6 flex items-center justify-between z-40 no-print shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        {[
          { id: "dashboard", icon: LayoutDashboard },
          { id: "po", icon: Package },
          { id: "tailor", icon: Users },
          { id: "salary", icon: Wallet },
          { id: "settings", icon: Settings },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center gap-1 w-12 h-12 rounded-2xl transition-all ${activeTab === item.id ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-slate-400"}`}
          >
            <item.icon size={20} />
          </button>
        ))}
      </nav>

      {/* Desktop Sidebar / Mobile Drawer */}
      <AnimatePresence>
        {(isSidebarOpen || true) && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            className={`no-print fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 flex-shrink-0 flex flex-col text-slate-300 md:static md:translate-x-0 ${!isSidebarOpen ? "hidden md:flex" : "flex"}`}
          >
            {/* Logo Section */}
            <div className="p-5 hidden md:flex items-center gap-3 border-b border-white/5 bg-slate-950/20">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                <LayoutDashboard size={18} />
              </div>
              <div>
                <span className="font-black text-white text-base tracking-tighter block leading-none">
                  KONFEKSI BUNDA
                </span>
                <span className="text-[9px] text-indigo-400 font-black uppercase tracking-[0.2em] leading-none mt-1.5 block">
                  Admin Cloud
                </span>
              </div>
            </div>

            {/* Navigation Menu */}
            <nav className="p-4 flex flex-col gap-6 flex-1 overflow-y-auto custom-scrollbar-hidden">
              {menuItems.map((section) => (
                <div key={section.section} className="space-y-2">
                  <p className="text-[9px] font-black text-slate-500 tracking-[0.3em] pl-3">
                    {section.section}
                  </p>
                  <div className="space-y-1">
                    {section.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setIsSidebarOpen(false);
                        }}
                        className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 rounded-xl font-bold transition-all duration-300 group ${activeTab === item.id ? "bg-white text-slate-900 shadow-lg shadow-white/5" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}
                      >
                        <div className="flex items-center gap-3">
                          <item.icon
                            size={18}
                            className={`${activeTab === item.id ? "text-indigo-600" : "text-slate-600 group-hover:text-indigo-400"} transition-colors`}
                          />
                          <span className="text-sm tracking-tight">
                            {item.label}
                          </span>
                        </div>
                        {activeTab === item.id && (
                          <motion.div
                            layoutId="nav-glow"
                            className="w-1 h-1 bg-indigo-600 rounded-full"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-4 mt-auto border-t border-white/5 bg-slate-950/50 relative z-50">
              <button
                type="button"
                onClick={() => setConfirmLogout(true)}
                className="flex w-full items-center justify-between px-4 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white group shadow-sm cursor-pointer relative z-[100]"
              >
                <span className="flex items-center gap-2">
                  <LogOut
                    size={16}
                    className="group-hover:-translate-x-1 transition-transform"
                  />{" "}
                  Keluar Sistem
                </span>
                <ChevronRight
                  size={14}
                  className="opacity-40 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                />
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto h-[calc(100vh-144px)] md:h-screen relative p-0 sm:p-4 md:p-4 lg:p-6 scroll-smooth custom-scrollbar">
        <div className="max-w-[1400px] mx-auto p-4 sm:p-0 h-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="h-full"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              {activeTab === "dashboard" && <DashboardView />}
              {activeTab === "po" && (
                <POView currentUsername={currentUsername} userRole={userRole} />
              )}
              {activeTab === "tailor" && (
                <TailorView
                  currentUsername={currentUsername}
                  userRole={userRole}
                />
              )}
              {activeTab === "inhouse" && (
                <InhouseWorkerView
                  currentUsername={currentUsername}
                  userRole={userRole}
                />
              )}
              {activeTab === "salary" && (
                <SalaryView
                  onNavigate={setActiveTab}
                  userRole={userRole}
                  currentUsername={currentUsername}
                />
              )}
              {activeTab === "tabungan" && (
                <TabunganView
                  userRole={userRole}
                  currentUsername={currentUsername}
                />
              )}
              {activeTab === "settings" && (
                <SettingsView
                  userRole={userRole}
                  currentUsername={currentUsername}
                />
              )}
              {activeTab === "history" && <HistoryView />}
              {activeTab === "catatan" && (
                <CatatanView currentUsername={currentUsername} />
              )}
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
              <h3 className="text-xl font-black text-center text-slate-900 mb-2">
                Keluar Sistem?
              </h3>
              <p className="text-center text-slate-500 text-sm mb-8 font-medium">
                Apakah Anda yakin ingin keluar dari sistem? Anda harus login
                kembali.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmLogout(false)}
                  className="flex-1 px-4 py-3.5 rounded-2xl text-slate-500 font-bold bg-slate-50 hover:bg-slate-100 transition-colors active:scale-95 text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={handleLogout}
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
  );
}
