import { useState } from "react";
import { db, useLiveQuery } from "@/lib/db";
import {
  PiggyBank,
  Search,
  Download,
  EyeOff,
  Eye,
  History,
  Trash2,
  ArrowUpRight,
  TrendingUp,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TabunganView({
  userRole,
  currentUsername,
}: {
  userRole?: string;
  currentUsername?: string;
}) {
  const tailors = useLiveQuery(() => db.tailors.toArray(), []) || [];

  // Data exclusively from MongoDB
  const archiveTabungan =
    useLiveQuery(() => db.archiveTabungan.toArray(), []) || [];
  const activeTabunganMongo =
    useLiveQuery(() => db.activeTabungan.toArray(), []) || [];

  const [searchTerm, setSearchTerm] = useState("");
  const [showAmountsGlobal, setShowAmountsGlobal] = useState(false);
  const [visibleAmounts, setVisibleAmounts] = useState<Record<number, boolean>>(
    {}
  );
  const [confirmWithdraw, setConfirmWithdraw] = useState<{
    tailorId: number;
    amount: number;
    tailorName: string;
  } | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);

  // Filter Active Tabungan from MongoDB
  const filtered = activeTabunganMongo.filter(
    (a) =>
      (a.tailorName || "").toLowerCase().includes(searchTerm.toLowerCase()) &&
      a.balance > 0
  );

  const toggleVisibility = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setVisibleAmounts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const archivedWithdrawals = [...archiveTabungan].sort(
    (a, b) =>
      new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime()
  );

  async function handleWithdraw() {
    if (!confirmWithdraw || isSyncing) return;
    setIsSyncing(true);
    try {
      const { tailorId, amount, tailorName } = confirmWithdraw;

      // 1. Add to Archive (Mongo)
      await db.archiveTabungan.add({
        originalId: Date.now(), // fallback id
        data: {
          tailorId,
          tailorName,
          amount,
          date: new Date().toISOString(),
          createdBy: currentUsername,
        },
        archivedAt: new Date().toISOString(),
        archivedBy: currentUsername || "System",
      });

      // 2. Update Active Summary in Mongo
      const existingSummary = activeTabunganMongo.find(
        (a) => a.tailorId === tailorId
      );
      if (existingSummary) {
        await db.activeTabungan.update(existingSummary.id!, {
          totalOut: (existingSummary.totalOut || 0) + amount,
          balance: existingSummary.balance - amount,
          lastUpdated: new Date().toISOString(),
        });
      }

      setConfirmWithdraw(null);
      alert("Pencairan tabungan berhasil diproses ke database.");
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mencairkan tabungan.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleDeleteWithdrawal(id: number) {
    if (
      confirm(
        "Hapus histori pencairan ini? Saldo akan kembali ke tabungan penjahit (Manual adjustment recommended)."
      )
    ) {
      const arc = archiveTabungan.find(
        (a) => a.id === id || a.originalId === id
      );
      if (arc) {
        await db.archiveTabungan.delete(arc.id!);

        // We should also revert the summary
        const existingSummary = activeTabunganMongo.find(
          (a) => a.tailorId === arc.data.tailorId
        );
        if (existingSummary) {
          await db.activeTabungan.update(existingSummary.id!, {
            totalOut: Math.max(
              0,
              (existingSummary.totalOut || 0) - arc.data.amount
            ),
            balance: existingSummary.balance + arc.data.amount,
            lastUpdated: new Date().toISOString(),
          });
        }
      }
    }
  }

  const displayAmount = (
    amount: number,
    tailorId: number,
    customClass: string = ""
  ) => {
    const isVisible = showAmountsGlobal || visibleAmounts[tailorId];
    return (
      <span
        className={`inline-flex items-center gap-2 cursor-pointer transition-all ${customClass}`}
        onClick={(e) => toggleVisibility(e, tailorId)}
      >
        {isVisible ? `Rp ${amount.toLocaleString("id-ID")}` : "Rp ••••••"}
        <span className="p-1 rounded-md bg-slate-100 group-hover:bg-indigo-50 transition-colors">
          {isVisible ? <EyeOff size={11} /> : <Eye size={11} />}
        </span>
      </span>
    );
  };

  const totalTabunganVolume = activeTabunganMongo.reduce(
    (sum, b) => sum + b.balance,
    0
  );

  return (
    <div className="space-y-10 pb-24">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-none">
            Tabungan Pekerja
          </h2>
          <p className="text-slate-500 font-medium mt-2 uppercase tracking-widest text-[10px]">
            Iuran wajib per item untuk simpanan hari raya
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80 group">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors"
            />
            <input
              type="text"
              placeholder="Cari nama penjahit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
            />
          </div>

          <button
            onClick={() => setShowAmountsGlobal(!showAmountsGlobal)}
            className={`w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm border ${showAmountsGlobal ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {showAmountsGlobal ? (
              <EyeOff size={18} className="inline mr-2" />
            ) : (
              <Eye size={18} className="inline mr-2" />
            )}
            {showAmountsGlobal ? "Masking" : "Buka Masking"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 shadow-sm flex flex-col justify-between group overflow-hidden relative"
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 text-indigo-600 group-hover:scale-110 transition-transform">
            <PiggyBank size={140} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Total Tabungan Terkumpul
            </p>
            <h3 className="text-3xl font-black text-slate-900 tabular-nums">
              Rp {totalTabunganVolume.toLocaleString("id-ID")}
            </h3>
          </div>
          <div className="mt-8 flex items-center gap-2 text-[10px] font-black text-emerald-500 bg-emerald-50 px-3 py-1.5 rounded-xl w-fit border border-emerald-100">
            <TrendingUp size={14} /> Potensi Nominal Berjalan
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 bg-indigo-600 text-white rounded-[2.5rem] p-8 shadow-xl shadow-indigo-600/20 relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform duration-700">
            <Info size={240} />
          </div>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <h4 className="text-xl font-bold mb-2">Kebijakan Tabungan</h4>
              <p className="text-indigo-100 text-sm font-medium leading-relaxed max-w-xl">
                Tabungan dipotong otomatis dari setiap setoran (submission)
                penjahit sesuai kesepakatan per item. Saldo akan diakumulasi dan
                hanya dapat dicairkan melalui persetujuan admin.
              </p>
            </div>
            <div className="flex gap-4 mt-6">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
                Auto-Calculated
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10">
                Audit Trail Active
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xl font-black text-slate-900 px-2 flex items-center gap-3">
          <div className="w-1.5 h-6 bg-slate-900 rounded-full"></div> Saldo
          Aktif Penjahit
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filtered.map((b) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                key={b.tailorId}
                className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group relative flex flex-col"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-[1.25rem] flex items-center justify-center text-indigo-600 font-black text-xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                    {b.tailorName.charAt(0)}
                  </div>
                  {(userRole === "super_admin" ||
                    userRole === "superadmin" ||
                    userRole === "admin") && (
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmWithdraw({
                          tailorId: b.tailorId!,
                          amount: b.balance,
                          tailorName: b.tailorName,
                        })
                      }
                      className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl shadow-slate-900/10 hover:bg-rose-600 transition-all active:scale-95 translate-x-4 -translate-y-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0"
                      title="Cairkan Seluruh Tabungan"
                    >
                      <Download size={18} />
                    </button>
                  )}
                </div>

                <div className="flex-1">
                  <h4 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1 group-hover:text-indigo-600 transition-colors uppercase">
                    {b.tailorName}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Active Balance (Cloud)
                  </p>
                </div>

                <div className="mt-8 pt-8 border-t-2 border-slate-50">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1.5 flex justify-between">
                    Saldo Tersimpan{" "}
                    <span>
                      {displayAmount(
                        b.totalIn,
                        b.tailorId!,
                        "text-[8px] font-bold text-slate-300"
                      )}{" "}
                      total in
                    </span>
                  </p>
                  <div className="text-3xl font-black text-slate-900 tabular-nums tracking-tighter">
                    {displayAmount(b.balance, b.tailorId!, "text-indigo-600")}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center opacity-40 font-bold border-2 border-dashed border-slate-100 rounded-[3rem]">
              <PiggyBank className="mx-auto mb-4 text-slate-200" size={48} />
              <p className="uppercase tracking-widest text-[10px]">
                Belum Ada Iuran Tabungan Masuk
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed History Table */}
      <div className="bg-white border-2 border-slate-100 rounded-[3rem] shadow-sm overflow-hidden flex flex-col mt-4">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <History size={22} className="text-indigo-600" />
            <h3 className="font-black text-slate-900 tracking-tight uppercase text-lg">
              Log Pencairan Tabungan
            </h3>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Global Archive
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <tr>
                <th className="px-8 py-5">Timestamp</th>
                <th className="px-8 py-5">Identitas Pekerja</th>
                <th className="px-8 py-5 text-right">Nominal Cair</th>
                <th className="px-8 py-5 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {archivedWithdrawals.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-8 py-20 text-center text-slate-400 italic"
                  >
                    Belum ada riwayat aktivitas pencairan.
                  </td>
                </tr>
              ) : (
                archivedWithdrawals.map((arc) => {
                  const w = arc.data;
                  return (
                    <tr
                      key={arc.id}
                      className="hover:bg-slate-50/50 transition-colors group"
                    >
                      <td className="px-8 py-6">
                        <div className="font-black text-slate-900 text-sm">
                          {new Date(arc.archivedAt).toLocaleDateString(
                            "id-ID",
                            { day: "numeric", month: "long", year: "numeric" }
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                          {new Date(arc.archivedAt).toLocaleTimeString(
                            "id-ID",
                            { hour: "2-digit", minute: "2-digit" }
                          )}
                          {arc.archivedBy && (
                            <span className="ml-2 text-indigo-300 italic opacity-60">
                              By: {arc.archivedBy}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-black text-slate-800 uppercase tracking-tight">
                          {w.tailorName || "Unknown"}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-rose-500 tabular-nums text-lg">
                        Rp {w.amount.toLocaleString("id-ID")}
                      </td>
                      <td className="px-8 py-6 text-center">
                        {(userRole === "super_admin" ||
                          userRole === "superadmin" ||
                          userRole === "admin") && (
                          <button
                            onClick={() => handleDeleteWithdrawal(arc.id!)}
                            className="p-3 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shadow-sm border border-slate-50 hover:border-rose-100 bg-white"
                            title="Pembatalan Pencairan"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmWithdraw && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md ">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md p-8 border border-slate-100"
            >
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl shadow-rose-600/10">
                  <ArrowUpRight size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none uppercase">
                  Konfirmasi Cair
                </h3>
                <p className="text-slate-500 font-medium text-sm mt-3 px-4">
                  Tindakan ini akan meriset saldo tabungan menjadi{" "}
                  <span className="font-bold text-slate-900 underline">
                    Rp 0
                  </span>{" "}
                  secara permanen.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 flex flex-col items-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Penjahit Terkait
                  </p>
                  <p className="font-black text-slate-900 text-xl tracking-tight uppercase">
                    {confirmWithdraw.tailorName}
                  </p>
                </div>

                <div className="p-6 bg-emerald-50 rounded-[2rem] border-2 border-emerald-100 flex flex-col items-center">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">
                    Total Dana Dicairkan
                  </p>
                  <p className="font-black text-emerald-600 text-4xl tracking-tighter tabular-nums">
                    Rp {confirmWithdraw.amount.toLocaleString("id-ID")}
                  </p>
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    onClick={() => setConfirmWithdraw(null)}
                    className="flex-1 bg-white border-2 border-slate-100 text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest py-4 rounded-[1.5rem] transition-all text-xs"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={isSyncing}
                    className="flex-1 bg-rose-600 text-white font-black uppercase tracking-widest py-4 rounded-[1.5rem] hover:bg-slate-900 transition-all shadow-xl shadow-rose-600/10 flex items-center justify-center gap-2 text-xs active:scale-95"
                  >
                    {isSyncing ? (
                      <TrendingUp size={18} className="animate-spin" />
                    ) : (
                      "Ya, Cairkan Sekarang"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
