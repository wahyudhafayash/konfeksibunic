import { useState } from "react";
import {
  db,
  useLiveQuery,
  SewingSubmission,
  Kasbon,
  GradeRule,
  ManualAdjustment,
  SalaryPayment,
} from "@/lib/db";
import {
  CheckCircle2,
  Wallet,
  Info,
  Eye,
  EyeOff,
  Search,
  X,
  ChevronRight,
  PiggyBank,
  RefreshCcw,
  TrendingUp,
  ArrowRight,
  User,
  Calculator,
  ArrowUpRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function SalaryView({
  onNavigate,
  userRole,
  currentUsername,
}: {
  onNavigate?: (tab: string) => void;
  userRole?: string;
  currentUsername?: string;
}) {
  const tailors = useLiveQuery(() => db.tailors.toArray(), []) || [];
  const submissions =
    useLiveQuery(
      () => db.sewingSubmissions.orderBy("id").reverse().toArray(),
      []
    ) || [];
  const kasbons = useLiveQuery(() => db.kasbons.toArray(), []) || [];
  const manualAdjustments =
    useLiveQuery(() => db.manualAdjustments.toArray(), []) || [];
  const jobs = useLiveQuery(() => db.sewingJobs.toArray(), []) || [];
  const poItems = useLiveQuery(() => db.poItems.toArray(), []) || [];
  const gradeRules =
    useLiveQuery(
      () => db.gradeRules.orderBy("minQtySingle").reverse().toArray(),
      []
    ) || [];

  const [showAmountsGlobal, setShowAmountsGlobal] = useState(false);
  const [visibleAmounts, setVisibleAmounts] = useState<Record<string, boolean>>(
    {}
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmPaymentData, setConfirmPaymentData] = useState<{
    tailorId: number;
    stats: any;
    subs: SewingSubmission[];
  } | null>(null);

  const [detailModalData, setDetailModalData] = useState<{
    tailorId: number;
    subs: SewingSubmission[];
    tailorName: string;
    stats?: any;
  } | null>(null);

  const toggleVisibility = (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    setVisibleAmounts((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getJobDetails = (jobId: number) => {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return { itemInfo: "Unknown", wage: 0, tabungan: 0 };
    const item = poItems.find((i) => i.id === job.poItemId);
    return {
      itemInfo: item
        ? `${item.itemName} (${item.color}, ${item.size})`
        : "Unknown",
      wage: job.wagePerPcs,
      tabungan: job.tabunganPerPcs || 0,
    };
  };

  const unpaidSubs = submissions.filter((s) => !s.isPaid);

  const calculateTailorStats = (tailorId: number, subs: SewingSubmission[]) => {
    const tailor = tailors.find((t) => t.id === tailorId);
    const isCollab = !!tailor?.partnerName;
    const totalQty = subs.reduce(
      (sum, s) => sum + (Number(s.qtySubmitted) || 0),
      0
    );
    const totalWage = subs.reduce(
      (sum, s) => sum + (Number(s.wageTotal) || 0),
      0
    );
    const totalTabungan = subs.reduce(
      (sum, s) => sum + (Number(s.tabunganTotal) || 0),
      0
    );

    let bonus = 0;
    let gradeName = "-";

    for (const rule of gradeRules) {
      if (isCollab) {
        if (totalQty >= rule.minQtyCollab) {
          bonus = rule.bonusCollab;
          gradeName = rule.name;
          break;
        }
      } else {
        if (totalQty >= rule.minQtySingle) {
          bonus = rule.bonusSingle;
          gradeName = rule.name;
          break;
        }
      }
    }

    const tailorKasbons = kasbons.filter(
      (k) => k.tailorId === tailorId && !k.isPaid
    );
    const totalKasbon = tailorKasbons.reduce((sum, k) => sum + k.amount, 0);

    const tailorAdjustments = manualAdjustments.filter(
      (m) => m.tailorId === tailorId && !m.isPaid
    );
    const totalAdjustment = tailorAdjustments.reduce(
      (sum, m) => sum + m.amount,
      0
    );

    const netPayment = Math.max(
      0,
      totalWage + bonus - totalKasbon + totalAdjustment
    );

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
      tailorName: tailor
        ? `${tailor.name} ${isCollab ? `(& ${tailor.partnerName})` : ""}`
        : "Unknown",
    };
  };

  async function payTailorSalary() {
    if (isProcessing || !confirmPaymentData) return;
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
        manualNote: (stats.tailorAdjustments || [])
          .map((a: any) => a.notes)
          .join(", "),
        createdBy: currentUsername,
      };
      const paymentId = await db.salaryPayments.add(paymentRecord);

      // Arasip Gaji
      await db.archiveSalaries.add({
        originalId: paymentId,
        data: paymentRecord,
        archivedAt: new Date().toISOString(),
        archivedBy: currentUsername || "System",
      });

      const submissionUpdates = subs.map((s) => ({
        key: s.id!,
        changes: { isPaid: true, paymentId, updatedBy: currentUsername },
      }));
      const kasbonUpdates = (stats.tailorKasbons || []).map((k: any) => ({
        key: k.id!,
        changes: { isPaid: true, paymentId, updatedBy: currentUsername },
      }));
      const adjustmentUpdates = (stats.tailorAdjustments || []).map(
        (a: any) => ({
          key: a.id!,
          changes: { isPaid: true, paymentId, updatedBy: currentUsername },
        })
      );

      if (submissionUpdates.length > 0)
        await db.sewingSubmissions.bulkUpdate(submissionUpdates);
      if (kasbonUpdates.length > 0) await db.kasbons.bulkUpdate(kasbonUpdates);
      if (adjustmentUpdates.length > 0)
        await db.manualAdjustments.bulkUpdate(adjustmentUpdates);

      // Update Active Tabungan Summary in Mongo
      if (stats.totalTabungan > 0) {
        const activeTabRes = await db.activeTabungan.toArray();
        const existingSummary = activeTabRes.find(
          (a) => a.tailorId === tailorId
        );
        if (!existingSummary) {
          await db.activeTabungan.add({
            tailorId,
            tailorName: stats.tailorName,
            totalIn: stats.totalTabungan,
            totalOut: 0,
            balance: stats.totalTabungan,
            lastUpdated: new Date().toISOString(),
          });
        } else {
          await db.activeTabungan.update(existingSummary.id!, {
            totalIn: (existingSummary.totalIn || 0) + stats.totalTabungan,
            balance: (existingSummary.balance || 0) + stats.totalTabungan,
            lastUpdated: new Date().toISOString(),
          });
        }
      }

      alert("Gaji berhasil dibayarkan dan telah diarsipkan.");
      setConfirmPaymentData(null);
      setDetailModalData(null);
      if (onNavigate) onNavigate("history");
    } catch (err) {
      alert(
        "Gagal memproses pembayaran: " +
          (err instanceof Error ? err.message : "Terjadi kesalahan sistem.")
      );
    } finally {
      setIsProcessing(false);
    }
  }

  const groupedUnpaidSubsRaw = unpaidSubs.reduce(
    (acc, sub) => {
      if (!acc[sub.tailorId]) acc[sub.tailorId] = [];
      acc[sub.tailorId].push(sub);
      return acc;
    },
    {} as Record<number, SewingSubmission[]>
  );

  const unpaidTotalAll = Object.entries(groupedUnpaidSubsRaw).reduce(
    (acc, [tailorIdStr, subs]) => {
      const stats = calculateTailorStats(Number(tailorIdStr), subs);
      return acc + stats.netPayment;
    },
    0
  );

  const matchedTailors = tailors
    .filter(
      (t) =>
        t.status !== "Dihapus" &&
        ((t.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (t.partnerName || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase()))
    )
    .map((t) => t.id!);

  const groupedUnpaidSubs = Object.fromEntries(
    Object.entries(groupedUnpaidSubsRaw).filter(([tailorId]) =>
      matchedTailors.includes(Number(tailorId))
    )
  );

  const displayAmount = (
    amount: number,
    key: string,
    customClass: string = ""
  ) => {
    const isVisible = showAmountsGlobal || visibleAmounts[key];
    return (
      <span
        className={`inline-flex items-center gap-2 cursor-pointer transition-all hover:opacity-75 ${customClass}`}
        onClick={(e) => toggleVisibility(e, key)}
      >
        {isVisible ? `Rp ${amount.toLocaleString("id-ID")}` : "Rp ••••••"}
        <span className="p-1 rounded-md bg-slate-100/50 group-hover:bg-slate-200/50">
          {isVisible ? <EyeOff size={12} /> : <Eye size={12} />}
        </span>
      </span>
    );
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Pembayaran Gaji
          </h2>
          <p className="text-slate-500 font-medium mt-1 uppercase tracking-wider text-[10px]">
            Penyelesaian upah pekerja produksi
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
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
            className={`w-full sm:w-auto px-5 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm border ${showAmountsGlobal ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {showAmountsGlobal ? <EyeOff size={18} /> : <Eye size={18} />}
            {showAmountsGlobal ? "Sembunyikan" : "Buka Masking"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="md:col-span-1 bg-white border-2 border-rose-100 rounded-[2.5rem] p-8 shadow-sm relative overflow-hidden group"
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-600 group-hover:scale-110 transition-transform">
            <Wallet size={120} />
          </div>
          <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em] mb-2">
            Estimasi Utang Gaji
          </p>
          <h3 className="text-3xl font-black text-slate-900 tabular-nums">
            {displayAmount(unpaidTotalAll, "globalUnpaid", "text-rose-600")}
          </h3>
          <div className="mt-6 flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-50 px-3 py-1.5 rounded-xl w-fit">
            <Info size={14} /> Perlu Segera Dibayar
          </div>
        </motion.div>

        <motion.div
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          transition={{ delay: 0.1 }}
          className="md:col-span-2 bg-indigo-600 rounded-[2.5rem] p-8 shadow-xl shadow-indigo-600/20 text-white relative overflow-hidden group"
        >
          <div className="absolute right-0 top-0 opacity-10 -rotate-12 group-hover:rotate-0 transition-transform duration-700">
            <CheckCircle2 size={240} />
          </div>
          <div className="relative z-10">
            <h4 className="text-xl font-bold mb-2">Informasi Pembayaran</h4>
            <p className="text-indigo-100 text-sm font-medium leading-relaxed max-w-lg mb-6">
              Gaji dihitung berdasarkan akumulasi setoran (submission) yang
              belum dibayarkan. Sistem otomatis menghitung bonus grade dan
              memotong kasbon berjalan.
            </p>
            <div className="flex gap-4">
              <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold border border-white/10">
                Total {Object.keys(groupedUnpaidSubs).length} Penjahit Antre
              </div>
              <div className="bg-emerald-400/20 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-bold border border-emerald-400/20 text-emerald-300">
                Auto-Deduct Kasbon Aktif
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2 px-2">
          <TrendingUp size={20} className="text-indigo-600" /> Daftar Tunggu
          Gajian
        </h3>

        <AnimatePresence mode="popLayout">
          {Object.keys(groupedUnpaidSubs).length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 bg-white border border-slate-100 rounded-[3rem] shadow-sm"
            >
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                Semua gaji sudah lunas terbayar
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(groupedUnpaidSubs).map(([tailorIdStr, _subs]) => {
                const subs = _subs as SewingSubmission[];
                const tId = parseInt(tailorIdStr);
                const stats = calculateTailorStats(tId, subs);

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={tId}
                    className="bg-white border border-slate-100 p-6 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all group flex flex-col md:flex-row justify-between items-center gap-6"
                  >
                    <div className="flex items-center gap-6 w-full">
                      <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-[1.5rem] flex items-center justify-center font-black text-2xl text-indigo-600 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                        {stats.tailorName.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl font-black text-slate-900 tracking-tight">
                          {stats.tailorName}
                        </h4>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">
                            {stats.totalQty} PCS
                          </span>
                          {stats.gradeName !== "-" && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-black uppercase tracking-widest border border-emerald-100">
                              GRADE {stats.gradeName}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-8 w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-50 pt-6 md:pt-0 md:pl-8 shrink-0">
                      <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                          Diterima Bersih
                        </p>
                        <div className="text-2xl font-black text-slate-900 tabular-nums">
                          {displayAmount(
                            stats.netPayment,
                            `unpNet_${tId}`,
                            "text-indigo-600"
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        {(userRole === "super_admin" ||
                          userRole === "superadmin" ||
                          userRole === "admin") && (
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmPaymentData({
                                tailorId: tId,
                                stats,
                                subs,
                              })
                            }
                            className="bg-slate-900 text-white hover:bg-indigo-600 px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-slate-900/10 active:scale-95 whitespace-nowrap"
                          >
                            Bayar Gaji
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setDetailModalData({
                              tailorId: tId,
                              subs,
                              tailorName: stats.tailorName,
                              stats,
                            })
                          }
                          className="flex items-center justify-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-indigo-600 transition-colors"
                        >
                          Lihat Rincian <ArrowRight size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

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
                    <Calculator size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">
                      {detailModalData.tailorName}
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-2 font-black uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-lg inline-block">
                      Rincian Slip Gaji Periode Ini
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap sm:flex-nowrap gap-3">
                  <button
                    onClick={() => setShowAmountsGlobal(!showAmountsGlobal)}
                    className={`flex px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest items-center justify-center gap-2 transition-all shadow-sm border ${showAmountsGlobal ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
                  >
                    {showAmountsGlobal ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                    {showAmountsGlobal ? "Sembunyi" : "Lihat Angka"}
                  </button>
                  {(userRole === "super_admin" ||
                    userRole === "superadmin" ||
                    userRole === "admin") && (
                    <button
                      onClick={() =>
                        setConfirmPaymentData({
                          tailorId: detailModalData.tailorId,
                          stats: detailModalData.stats,
                          subs: detailModalData.subs,
                        })
                      }
                      className="bg-slate-900 text-white hover:bg-indigo-600 px-8 py-3 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all active:scale-95"
                    >
                      Proses Bayar
                    </button>
                  )}
                  <button
                    onClick={() => setDetailModalData(null)}
                    className="text-slate-400 hover:text-slate-900 bg-white border border-slate-100 p-3 rounded-2xl transition-all active:scale-95 shadow-sm"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 custom-scrollbar">
                <div className="lg:col-span-7">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                      <ListIcon size={22} className="text-indigo-600" /> Detail
                      Setoran Pekerjaan
                    </h4>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {detailModalData.subs.length} Rekaman
                    </span>
                  </div>

                  <div className="space-y-4">
                    {detailModalData.subs.map((s) => {
                      const details = getJobDetails(s.jobId);
                      return (
                        <div
                          key={s.id}
                          className="bg-slate-50/50 border border-slate-100 rounded-[1.5rem] p-5 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all"
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">
                                {new Date(s.dateSubmitted).toLocaleDateString(
                                  "id-ID",
                                  { day: "numeric", month: "short" }
                                )}
                              </span>
                              <h5 className="font-bold text-slate-800 text-sm">
                                {details.itemInfo}
                              </h5>
                              <span className="text-[8px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                {s.partType || "Set"}
                              </span>
                            </div>
                            <div className="flex gap-4">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                  Setoran
                                </span>
                                <span className="text-xs font-black text-slate-700 uppercase tabular-nums">
                                  {s.qtySubmitted} PCS
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                                  Upah/Pcs
                                </span>
                                <span className="text-xs font-black text-slate-700 uppercase tabular-nums">
                                  Rp {details.wage.toLocaleString("id-ID")}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Subtotal Wage
                            </p>
                            <p className="font-black text-slate-900 text-lg tabular-nums">
                              {displayAmount(s.wageTotal, `mtw_${s.id}`)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-8">
                  {/* Paper-style Receipt */}
                  <div className="bg-white border-4 border-slate-50 rounded-[3rem] p-8 shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-100 rounded-b-full"></div>
                    <h4 className="text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.4em] mb-10 pt-4">
                      Ringkasan Slip
                    </h4>

                    <div className="space-y-6">
                      <div className="flex justify-between items-center group">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Total Upah Jahit
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            Akumulasi {detailModalData.stats!.totalQty} Pcs
                          </span>
                        </div>
                        <span className="text-xl font-black text-slate-900 tabular-nums">
                          {displayAmount(
                            detailModalData.stats!.totalWage,
                            "h_wage"
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            Bonus Grade
                          </span>
                          <span className="text-xs font-bold text-emerald-400/60 uppercase">
                            Tier: {detailModalData.stats!.gradeName}
                          </span>
                        </div>
                        <span className="text-xl font-black text-emerald-600 tabular-nums">
                          +
                          {displayAmount(
                            detailModalData.stats!.bonus,
                            "h_bonus"
                          )}
                        </span>
                      </div>

                      {detailModalData.stats?.tailorAdjustments?.length > 0 &&
                        detailModalData.stats.tailorAdjustments.map(
                          (m: any) => (
                            <div
                              key={m.id}
                              className="flex justify-between items-center"
                            >
                              <div className="flex flex-col">
                                <span
                                  className={`text-[10px] font-black uppercase tracking-widest ${m.amount > 0 ? "text-purple-400" : "text-rose-400"}`}
                                >
                                  Edit Gaji Manual
                                </span>
                                <span className="text-xs font-bold text-slate-400">
                                  {m.notes}
                                </span>
                              </div>
                              <span
                                className={`text-xl font-black tabular-nums ${m.amount > 0 ? "text-purple-600" : "text-rose-500"}`}
                              >
                                {m.amount > 0 ? "+" : ""}
                                {displayAmount(m.amount, "h_adj_" + m.id)}
                              </span>
                            </div>
                          )
                        )}

                      <div className="flex justify-between items-center py-4 border-y border-slate-50 border-dashed">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                            Dipotong Kasbon
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            Otomatis Lunas
                          </span>
                        </div>
                        <span className="text-xl font-black text-rose-500 tabular-nums">
                          -
                          {displayAmount(
                            detailModalData.stats!.totalKasbon,
                            "h_kasbon"
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between items-end pt-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">
                            Total Bersih
                          </span>
                          <span className="text-[10px] font-bold text-slate-300">
                            Ready to Transfer
                          </span>
                        </div>
                        <div className="text-4xl font-black text-indigo-600 tracking-tighter tabular-nums drop-shadow-sm">
                          {displayAmount(
                            detailModalData.stats!.netPayment,
                            "h_net"
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-8 border-t-2 border-slate-50 flex items-center justify-between text-sky-600">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-sky-50 rounded-xl">
                          <PiggyBank size={18} />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Akumulasi Tabungan
                        </span>
                      </div>
                      <span className="font-black text-lg">
                        +
                        {displayAmount(
                          detailModalData.stats!.totalTabungan,
                          "h_tab"
                        )}
                      </span>
                    </div>
                  </div>

                  {detailModalData.stats?.tailorKasbons?.length > 0 && (
                    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                      <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Info size={14} /> Rincian Kasbon Terpotong
                      </h5>
                      <div className="space-y-3">
                        {detailModalData.stats.tailorKasbons.map((k: any) => (
                          <div
                            key={k.id}
                            className="flex justify-between items-center text-xs"
                          >
                            <span className="font-bold text-slate-600">
                              {new Date(k.date).toLocaleDateString("id-ID")} —{" "}
                              {k.notes || "Pinjaman"}
                            </span>
                            <span className="font-black text-rose-500">
                              Rp {k.amount.toLocaleString("id-ID")}
                            </span>
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

      {/* Salary Confirmation Modal */}
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
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">
                  Konfirmasi Bayar Gaji
                </h3>
                <p className="text-slate-500 font-medium text-sm mt-3 px-4">
                  Pastikan uang tunai atau transfer sudah disiapkan sebelum
                  menekan tombol oke.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">
                    Nama Penerima
                  </p>
                  <p className="font-black text-slate-900 text-xl text-center tracking-tight">
                    {confirmPaymentData.stats.tailorName}
                  </p>
                </div>

                <div className="p-6 bg-indigo-50 rounded-[2rem] border-2 border-indigo-100 flex flex-col items-center">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">
                    Total Transfer / Tunai
                  </p>
                  <p className="font-black text-indigo-600 text-4xl tracking-tighter">
                    Rp{" "}
                    {confirmPaymentData.stats.netPayment.toLocaleString(
                      "id-ID"
                    )}
                  </p>
                </div>

                <ul className="py-4 space-y-2">
                  <li className="flex items-center gap-3 text-xs font-bold text-slate-500">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={12} />
                    </div>
                    Setoran ditandai "Sudah Dibayar"
                  </li>
                  <li className="flex items-center gap-3 text-xs font-bold text-slate-500">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={12} />
                    </div>
                    Kasbon berjalan otomatis Lunas
                  </li>
                  <li className="flex items-center gap-3 text-xs font-bold text-slate-500">
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={12} />
                    </div>
                    Arsip masuk ke Rekap Gaji & Histori
                  </li>
                </ul>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setConfirmPaymentData(null)}
                    className="flex-1 bg-white border-2 border-slate-100 text-slate-400 hover:text-slate-600 font-black uppercase tracking-widest py-4 rounded-[1.5rem] transition-all text-xs"
                  >
                    Batal
                  </button>
                  <button
                    onClick={payTailorSalary}
                    disabled={isProcessing}
                    className="flex-1 bg-slate-900 text-white font-black uppercase tracking-widest py-4 rounded-[1.5rem] hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 text-xs active:scale-95"
                  >
                    {isProcessing ? (
                      <RefreshCcw size={18} className="animate-spin" />
                    ) : (
                      "Ya, Bayar"
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

function ListIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  );
}
