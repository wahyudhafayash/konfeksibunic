import { useState, useEffect } from "react";
import { db, useLiveQuery } from "@/lib/db";
import {
  Lock,
  FileText,
  Save,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  Wand2,
  Type,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function CatatanView({
  currentUsername,
}: {
  currentUsername?: string;
}) {
  const [passwordInput, setPasswordInput] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const catatanRecord = useLiveQuery(
    () => db.catatan.toCollection().first(),
    []
  );
  const settings = useLiveQuery(() => db.settings.toArray(), []) || [];
  const notesPasswordSetting = settings.find((s) => s.key === "notes_password");

  useEffect(() => {
    if (catatanRecord && !content) {
      setContent(catatanRecord.content);
    }
  }, [catatanRecord]);

  // Initializing default password if not exists
  useEffect(() => {
    if (settings.length > 0 && !notesPasswordSetting) {
      db.settings.add({
        key: "notes_password",
        value: "adminkonfeksibunic2026",
      });
    }
  }, [settings, notesPasswordSetting]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword =
      notesPasswordSetting?.value || "adminkonfeksibunic2026";
    if (passwordInput === correctPassword) {
      setIsAuthenticated(true);
    } else {
      alert("Password kunci catatan salah!");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    if (catatanRecord && catatanRecord.id) {
      await db.catatan.update(catatanRecord.id, {
        content,
        updatedBy: currentUsername,
      });
    } else {
      await db.catatan.add({ content, createdBy: currentUsername });
    }
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleChangePassword = async () => {
    if (!newPassword) return;
    if (notesPasswordSetting && notesPasswordSetting.id) {
      await db.settings.update(notesPasswordSetting.id, {
        value: newPassword,
        updatedBy: currentUsername,
      });
    } else {
      await db.settings.add({
        key: "notes_password",
        value: newPassword,
        updatedBy: currentUsername,
      });
    }
    alert("Password berhasil diubah!");
    setShowPasswordChange(false);
    setNewPassword("");
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[3rem] shadow-2xl w-full max-w-md border-2 border-slate-50 relative overflow-hidden"
        >
          <div className="absolute -right-4 -top-4 opacity-5 text-indigo-600 rotate-12">
            <Lock size={160} />
          </div>

          <div className="relative z-10">
            <div className="w-20 h-20 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-600/20">
              <ShieldAlert size={40} />
            </div>
            <div className="text-center mb-10">
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-3">
                Enkripsi Catatan
              </h2>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest leading-relaxed">
                Lapisan keamanan kedua diperlukan untuk mengakses data sensitif.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Kunci Privasi
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-base font-black focus:bg-white focus:border-indigo-500 focus:outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 text-white hover:bg-indigo-600 py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-slate-900/10 active:scale-95 mt-4"
              >
                Buka Brankas Catatan
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[82vh] max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-50 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shrink-0 group">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-[1.25rem] flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <FileText size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tighter text-slate-900 uppercase leading-none">
              Admin Personal Logs
            </h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest border-b border-indigo-100">
                Encrypted Area
              </span>
              <div className="w-1 h-1 rounded-full bg-slate-200"></div>
              <p
                className="text-slate-400 font-bold text-[10px] uppercase tracking-widest cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => setShowPasswordChange(!showPasswordChange)}
              >
                Change Password
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex-1 md:flex-none px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-3 active:scale-95 ${saved ? "bg-emerald-500 text-white shadow-emerald-500/20" : "bg-slate-900 text-white hover:bg-indigo-600 shadow-slate-900/10"}`}
          >
            {saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
            {saved ? "Sinkron Berhasil" : "Save To Database"}
          </button>
        </div>
      </div>

      {showPasswordChange && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-indigo-50 border-2 border-indigo-100 p-6 rounded-[2.5rem] flex flex-col sm:flex-row items-end gap-4"
        >
          <div className="flex-1 w-full">
            <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 ml-1">
              Password Baru
            </label>
            <input
              type="text"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-bold focus:border-indigo-500 outline-none transition-all"
              placeholder="Masukkan password baru..."
            />
          </div>
          <button
            onClick={handleChangePassword}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
          >
            Update Password
          </button>
          <button
            onClick={() => setShowPasswordChange(false)}
            className="bg-slate-200 text-slate-500 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all active:scale-95"
          >
            Batal
          </button>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex-1 bg-white border-2 border-slate-50 rounded-[3rem] shadow-sm overflow-hidden flex flex-col relative group"
      >
        <div className="absolute top-8 left-8 flex flex-col gap-4 opacity-20 group-focus-within:opacity-5 transition-opacity">
          <Sparkles size={160} className="text-slate-100" />
        </div>

        <div className="p-4 bg-slate-50/50 border-b-2 border-slate-50 flex items-center gap-6 overflow-x-auto no-scrollbar whitespace-nowrap">
          <div className="flex items-center gap-2 px-4 py-1.5 bg-white rounded-xl shadow-sm">
            <Type size={14} className="text-indigo-400" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Draft Editor
            </span>
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-transparent">
            No-Markdown
          </div>
          <div className="flex items-center gap-2 px-4 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest border border-transparent">
            Plain-Text Only
          </div>
        </div>

        <textarea
          className="w-full h-full p-10 sm:p-14 resize-none focus:outline-none text-slate-800 leading-relaxed font-mono text-base bg-transparent relative z-10 selection:bg-indigo-100 placeholder:text-slate-100 placeholder:font-black placeholder:text-4xl sm:placeholder:text-6xl"
          placeholder="START TYPING NOTES..."
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved(false);
          }}
        ></textarea>

        <div className="p-6 bg-slate-50/30 border-t-2 border-slate-50 flex justify-between items-center text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">
          <div className="flex gap-6">
            <span>
              Words: {content.split(/\s+/).filter((x) => x.length > 0).length}
            </span>
            <span>Chars: {content.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <Wand2 size={12} /> AI Formatting Unavailable
          </div>
        </div>
      </motion.div>
    </div>
  );
}
