import { useState } from "react";
import { db, useLiveQuery } from "@/lib/db";
import {
  Package,
  Users,
  Wallet,
  PiggyBank,
  TrendingUp,
  CheckCircle2,
  X,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
} from "lucide-react";
import { motion } from "framer-motion";

export default function DashboardView() {
  const [detailModalPO, setDetailModalPO] = useState<any>(null);
  const pos = useLiveQuery(() => db.pos.toArray(), []) || [];
  const poItems = useLiveQuery(() => db.poItems.toArray(), []) || [];
  const submissions =
    useLiveQuery(() => db.sewingSubmissions.toArray(), []) || [];
  const withdrawals =
    useLiveQuery(() => db.tabunganWithdrawals.toArray(), []) || [];
  const kasbons = useLiveQuery(() => db.kasbons.toArray(), []) || [];
  const jobs = useLiveQuery(() => db.sewingJobs.toArray(), []) || [];
  const tailors = useLiveQuery(() => db.tailors.toArray(), []) || [];

  const activePos = pos.filter(
    (p) =>
      p.status === "Proses" || p.status === "Aktif" || p.status === "Siap Kirim"
  );

  // Progress computation
  const totalItemQty = poItems
    .filter((i) => activePos.some((ap) => ap.id === i.poId))
    .reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  const unpaidSalaries = submissions
    .filter((s) => !s.isPaid)
    .reduce((sum, s) => sum + (Number(s.wageTotal) || 0), 0);
  const totalTabungan =
    submissions.reduce((sum, s) => sum + (Number(s.tabunganTotal) || 0), 0) -
    withdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);
  const unpaidKasbon = kasbons
    .filter((k) => !k.isPaid)
    .reduce((sum, k) => sum + (Number(k.amount) || 0), 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Dashboard Utama
          </h2>
          <p className="text-slate-500 font-medium mt-1">
            Status terbaru operasional konfeksi Bunic
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-indigo-200">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
          Live Update Aktivitas
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <motion.div
          variants={itemVariants}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute -right-2 -bottom-2 opacity-5 text-indigo-600 group-hover:scale-110 transition-transform">
            <Package size={100} />
          </div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-inner">
              <Package size={24} />
            </div>
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
              PO AKTIF
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">
            Total PO Berjalan
          </p>
          <p className="text-4xl font-extrabold text-slate-900 tabular-nums">
            {activePos.length}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute -right-2 -bottom-2 opacity-5 text-blue-600 group-hover:scale-110 transition-transform">
            <TrendingUp size={100} />
          </div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-inner">
              <TrendingUp size={24} />
            </div>
            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              PRODUKSI
            </span>
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">
            Estimasi Qty Proses
          </p>
          <p className="text-4xl font-extrabold text-slate-900 tabular-nums">
            {totalItemQty.toLocaleString("id-ID")}{" "}
            <span className="text-sm font-semibold text-slate-400">pcs</span>
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute -right-2 -bottom-2 opacity-10 text-rose-600 group-hover:scale-110 transition-transform">
            <Wallet size={100} />
          </div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100 shadow-inner">
              <Wallet size={24} />
            </div>
            <ArrowUpRight size={20} className="text-rose-400" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">
            Gaji Belum Dibayar
          </p>
          <p className="text-3xl font-extrabold text-rose-600 tabular-nums truncate">
            Rp {unpaidSalaries.toLocaleString("id-ID")}
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
        >
          <div className="absolute -right-2 -bottom-2 opacity-5 text-amber-600 group-hover:scale-110 transition-transform">
            <Activity size={100} />
          </div>
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 shadow-inner">
              <Activity size={24} />
            </div>
            <ArrowDownRight size={20} className="text-amber-400" />
          </div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em] mb-1">
            Kasbon Berjalan
          </p>
          <p className="text-3xl font-extrabold text-amber-600 tabular-nums truncate">
            Rp {unpaidKasbon.toLocaleString("id-ID")}
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-slate-900 text-xl tracking-tight flex items-center gap-2">
              <Activity size={22} className="text-indigo-600" /> Progress
              Rincian PO
            </h3>
          </div>
          <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden divide-y divide-slate-100">
            {activePos.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <Package size={32} />
                </div>
                <p className="text-slate-400 font-medium">
                  Belum ada PO yang sedang diproses.
                </p>
              </div>
            ) : (
              activePos.map((po) => {
                const thisPoItems = poItems.filter((i) => i.poId === po.id);
                const poQty = thisPoItems.reduce(
                  (s, i) => s + (Number(i.qty) || 0),
                  0
                );
                const poJobs = jobs.filter((j) =>
                  thisPoItems.some((i) => i.id === j.poItemId)
                );
                const thisPoSubs = submissions.filter((s) =>
                  poJobs.some((j) => j.id === s.jobId)
                );
                const poCompleted = thisPoSubs.reduce(
                  (s, sub) => s + (Number(sub.qtySubmitted) || 0),
                  0
                );
                const progress =
                  poQty > 0
                    ? Math.min(100, Math.round((poCompleted / poQty) * 100))
                    : 0;

                let statusText = po.status;
                let statusColor =
                  "bg-indigo-100 text-indigo-700 border-indigo-200";

                if (
                  progress >= 100 &&
                  (po.status === "Aktif" || po.status === "Proses")
                ) {
                  statusText = "Siap Kirim";
                  statusColor =
                    "bg-emerald-100 text-emerald-700 border-emerald-200";
                } else if (po.status === "Siap Kirim") {
                  statusColor =
                    "bg-emerald-100 text-emerald-700 border-emerald-200";
                } else if (po.status === "Selesai") {
                  statusColor = "bg-slate-100 text-slate-600 border-slate-200";
                }

                return (
                  <div
                    key={po.id}
                    className="p-6 hover:bg-slate-50/50 transition-colors group"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
                      <div className="flex items-center gap-4">
                        {po.photoData ? (
                          <img
                            src={po.photoData}
                            alt="Thumb"
                            className="w-14 h-14 object-cover rounded-2xl border border-slate-200 shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 shrink-0 border border-slate-100 group-hover:bg-indigo-50 transition-colors">
                            <Package size={24} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-extrabold text-slate-900 text-lg flex items-center gap-3 tracking-tight">
                            {po.poNumber}
                            <span
                              className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-md border ${statusColor}`}
                            >
                              {statusText}
                            </span>
                          </h4>
                          <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                            {po.customerName}{" "}
                            <span className="mx-2 text-slate-300">|</span>{" "}
                            {poQty} pcs total
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setDetailModalPO(po)}
                        className="text-xs font-bold text-indigo-600 hover:text-white hover:bg-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl transition-all active:scale-95 shadow-sm"
                      >
                        Lihat Detail
                      </button>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                          Progress Jahit:{" "}
                          <span className="text-indigo-600 font-black">
                            {poCompleted}
                          </span>{" "}
                          / {poQty}
                        </div>
                        <span
                          className={`text-sm font-black ${progress >= 100 ? "text-emerald-600" : "text-indigo-600"}`}
                        >
                          {progress}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-full rounded-full ${progress >= 100 ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-indigo-500 to-indigo-400"}`}
                        ></motion.div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="space-y-6">
          <div className="bg-indigo-600 text-white rounded-[2rem] p-8 shadow-xl shadow-indigo-600/20 relative overflow-hidden h-full flex flex-col justify-between">
            <div className="absolute -right-4 -top-4 opacity-15 rotate-12">
              <PiggyBank size={180} />
            </div>

            <div>
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                <PiggyBank size={24} />
              </div>
              <p className="text-xs font-bold text-indigo-200 uppercase tracking-[0.2em] mb-2">
                Total Tabungan Lebaran
              </p>
              <h4 className="text-4xl font-extrabold tracking-tighter mb-4 leading-none">
                Rp {totalTabungan.toLocaleString("id-ID")}
              </h4>
              <p className="text-sm text-indigo-100/70 font-medium leading-relaxed">
                Total akumulasi tabungan penjahit yang sedang disimpan dan belum
                dicairkan.
              </p>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <button className="w-full py-3 bg-white text-indigo-600 rounded-2xl font-bold text-sm shadow-lg hover:shadow-white/20 transition-all active:scale-95">
                Lihat Rincian Tabungan
              </button>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Detail Modal */}
      {detailModalPO && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-inner">
                  <Package size={24} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xl tracking-tight leading-none">
                    Detail Rincian PO
                  </h3>
                  <p className="text-sm text-slate-500 mt-1 font-semibold">
                    {detailModalPO.poNumber} — {detailModalPO.customerName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalPO(null)}
                className="text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 p-2 rounded-xl transition-all active:scale-95"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-8 custom-scrollbar">
              {(() => {
                const thisPoItems = poItems.filter(
                  (i: any) => i.poId === detailModalPO.id
                );
                const poJobs = jobs.filter((j: any) =>
                  thisPoItems.some((i: any) => i.id === j.poItemId)
                );
                const jobSummary = tailors
                  .map((t: any) => {
                    const tJobs = poJobs.filter(
                      (j: any) => j.tailorId === t.id
                    );
                    if (tJobs.length === 0) return null;
                    const totalAmbil = tJobs.reduce(
                      (s: number, j: any) => s + (Number(j.qtyTaken) || 0),
                      0
                    );
                    const tSubs = submissions.filter((s: any) =>
                      tJobs.some((j: any) => j.id === s.jobId)
                    );
                    const totalSetor = tSubs.reduce(
                      (s: number, sub: any) =>
                        s + (Number(sub.qtySubmitted) || 0),
                      0
                    );
                    const sisa = Math.max(0, totalAmbil - totalSetor);
                    return {
                      tailorId: t.id,
                      tailorName: t.name,
                      totalAmbil,
                      totalSetor,
                      sisa,
                    };
                  })
                  .filter(Boolean);

                const poTotalQty = thisPoItems.reduce(
                  (s: number, i: any) => s + (Number(i.qty) || 0),
                  0
                );
                const assignedQty = jobSummary.reduce(
                  (s: number, j: any) => s + (Number(j.totalAmbil) || 0),
                  0
                );
                const unassignedQty = Math.max(0, poTotalQty - assignedQty);

                return (
                  <div className="space-y-8">
                    {unassignedQty > 0 && (
                      <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-amber-900 text-sm flex gap-4 shadow-sm border-l-4 border-l-amber-500">
                        <Info size={24} className="shrink-0 text-amber-500" />
                        <div>
                          <p className="font-extrabold text-base tracking-tight mb-1">
                            Sebagian Belum Diambil
                          </p>
                          <p className="opacity-80 font-medium">
                            Terdapat{" "}
                            <span className="font-bold underline">
                              {unassignedQty} pcs
                            </span>{" "}
                            dari total {poTotalQty} pcs pada PO ini yang belum
                            dimasukkan ke data pengambilan penjahit.
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="font-extrabold text-slate-900 text-lg flex items-center gap-3">
                          <Users size={20} className="text-indigo-500" />{" "}
                          Progress Penjahit
                        </h4>
                        <div className="text-xs font-bold bg-slate-100 px-3 py-1.5 rounded-full text-slate-600">
                          {jobSummary.length} Penjahit Berkontribusi
                        </div>
                      </div>

                      {jobSummary.length === 0 ? (
                        <div className="bg-slate-50 border border-slate-200 p-12 text-center rounded-3xl">
                          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300 shadow-sm">
                            <Users size={32} />
                          </div>
                          <p className="text-slate-500 font-medium tracking-tight">
                            Belum ada penjahit yang mengambil jahitan dari PO
                            ini.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {jobSummary.map((s: any) => (
                            <div
                              key={s.tailorId}
                              className={`group border-2 p-5 rounded-3xl flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 transition-all duration-300 ${s.sisa > 0 ? "bg-amber-50/30 border-amber-100 hover:border-amber-300" : "bg-white border-slate-100 hover:border-indigo-100 hover:shadow-md"}`}
                            >
                              <div>
                                <div className="flex items-center gap-3">
                                  <p className="font-extrabold text-lg text-slate-900 tracking-tight">
                                    {s.tailorName}
                                  </p>
                                  {s.sisa > 0 ? (
                                    <span className="text-[9px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1 shadow-sm shadow-amber-500/20">
                                      <TrendingUp size={10} /> Proses
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest flex items-center gap-1 shadow-sm shadow-emerald-500/20">
                                      <CheckCircle2 size={10} /> Lunas
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-4 text-xs mt-3 font-bold">
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">
                                      Sudah Ambil
                                    </span>
                                    <span className="text-slate-900 bg-slate-100 px-2 py-1 rounded-lg text-sm">
                                      {s.totalAmbil} pcs
                                    </span>
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="text-slate-400 uppercase tracking-widest text-[9px] mb-0.5">
                                      Sudah Setor
                                    </span>
                                    <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg text-sm">
                                      {s.totalSetor} pcs
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="sm:text-right border-t border-slate-100 sm:border-0 pt-4 sm:pt-0">
                                {s.sisa > 0 ? (
                                  <div className="flex sm:flex-col justify-between items-center sm:items-end">
                                    <p className="text-[10px] text-rose-500 font-extrabold uppercase tracking-[0.2em] mb-1">
                                      Masih Hutang
                                    </p>
                                    <p className="text-3xl font-black text-rose-600 tracking-tighter tabular-nums">
                                      {s.sisa}{" "}
                                      <span className="text-xs font-bold text-rose-400 -ml-1">
                                        pcs
                                      </span>
                                    </p>
                                  </div>
                                ) : (
                                  <div className="text-emerald-500 flex flex-col items-end opacity-60 group-hover:opacity-100 transition-opacity">
                                    <CheckCircle2 size={32} />
                                    <p className="text-[9px] font-black uppercase tracking-widest mt-1">
                                      Selesai
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
