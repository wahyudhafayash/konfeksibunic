import { useState, Fragment } from "react";
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
  Download,
  FileText,
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
  const manualAdjustments =
    useLiveQuery(() => db.manualAdjustments.toArray(), []) || [];
  const activeTabunganMongo =
    useLiveQuery(() => db.activeTabungan.toArray(), []) || [];
  const gradeRules =
    useLiveQuery(
      () => db.gradeRules.orderBy("minQtySingle").reverse().toArray(),
      []
    ) || [];

  const activePos = pos.filter(
    (p) =>
      p.status === "Proses" || p.status === "Aktif" || p.status === "Siap Kirim"
  );

  // Progress computation
  const totalItemQty = poItems
    .filter((i) => activePos.some((ap) => ap.id === i.poId))
    .reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

  const masterTailorsReport = tailors
    .filter((t) => t.status !== "Dihapus")
    .map((t) => {
      const tJobs = jobs.filter((j) => j.tailorId === t.id);
      const tUnpaidSubs = submissions.filter(
        (s) => !s.isPaid && tJobs.some((j) => j.id === s.jobId)
      );
      const unpaidWage = tUnpaidSubs.reduce(
        (sum, s) => sum + (Number(s.wageTotal) || 0),
        0
      );
      const tTabunganPeriodeIni = tUnpaidSubs.reduce(
        (sum, s) => sum + (Number(s.tabunganTotal) || 0),
        0
      );

      const at = activeTabunganMongo.find((a) => a.tailorId === t.id);
      const tTabungan = (at ? Number(at.balance) : 0) + tTabunganPeriodeIni;

      const isCollab = !!(t.partnerName && t.partnerName.trim() !== "");
      const totalQty = tUnpaidSubs.reduce(
        (sum, s) => sum + (Number(s.qtySubmitted) || 0),
        0
      );

      let gradeName = "-";
      let bonus = 0;
      for (const rule of gradeRules) {
        if (isCollab) {
          if (totalQty >= rule.minQtyCollab) {
            gradeName = rule.name;
            bonus = rule.bonusCollab;
            break;
          }
        } else {
          if (totalQty >= rule.minQtySingle) {
            gradeName = rule.name;
            bonus = rule.bonusSingle;
            break;
          }
        }
      }

      const tUnpaidKasbon = kasbons
        .filter((k) => k.tailorId === t.id && !k.isPaid)
        .reduce((sum, k) => sum + (Number(k.amount) || 0), 0);
      const tUnpaidManualObj = manualAdjustments.filter(
        (m) => m.tailorId === t.id && !m.isPaid
      );
      const tUnpaidManual = tUnpaidManualObj.reduce(
        (sum, m) => sum + (Number(m.amount) || 0),
        0
      );

      const netWage = Math.max(
        0,
        unpaidWage + bonus - tUnpaidKasbon + tUnpaidManual
      );

      return {
        id: t.id,
        name: t.name,
        unpaidWage: netWage,
        tTabunganPeriodeIni,
        tTabungan,
        tUnpaidKasbon,
        tUnpaidManual,
        gradeName,
      };
    })
    .filter(
      (t) =>
        t.unpaidWage > 0 ||
        t.tTabungan > 0 ||
        t.tUnpaidKasbon > 0 ||
        t.tUnpaidManual !== 0
    );

  const unpaidTabungan = submissions
    .filter((s) => !s.isPaid)
    .reduce((sum, s) => sum + (Number(s.tabunganTotal) || 0), 0);
  const unpaidSalaries = masterTailorsReport.reduce(
    (sum, t) => sum + t.unpaidWage,
    0
  );
  const totalTabungan =
    activeTabunganMongo.reduce((sum, a) => sum + (Number(a.balance) || 0), 0) +
    unpaidTabungan;
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

  const formatShortQty = (remInner: number, remOuter: number) => {
    if (remInner <= 0 && remOuter <= 0) return "Selesai";
    if (remInner === remOuter) return `-${remInner} Set`;
    const parts = [];
    const sets = Math.min(remInner, remOuter);
    if (sets > 0) parts.push(`-${sets} Set`);
    const rIn = remInner - sets;
    const rOut = remOuter - sets;
    if (rIn > 0) parts.push(`-${rIn} Inner`);
    if (rOut > 0) parts.push(`-${rOut} Outer`);
    return parts.join(" / ");
  };

  const handleDownloadCSV = () => {
    // Generate Tailors Report
    let csvContent = "LAPORAN KEUANGAN PENJAHIT\n";
    csvContent +=
      "Nama Penjahit,Gaji Tertunda,Tabungan Berjalan,Grade,Kasbon,Penyesuaian\n";

    if (masterTailorsReport.length === 0) {
      csvContent += "Semua tagihan lunas. Tidak ada data tertunda.,,,,,\n";
    } else {
      masterTailorsReport.forEach((t) => {
        csvContent += `"${t.name}",${t.unpaidWage},${t.tTabunganPeriodeIni},"${t.gradeName}",${t.tUnpaidKasbon},${t.tUnpaidManual}\n`;
      });
    }

    csvContent += "\nPERKEMBANGAN PO AKTIF\n";
    csvContent +=
      "No PO,Customer,Status,Target,Disetor,Progress,Detail Penjahit (Nama: Diambil / Sisa)\n";

    if (activePos.length === 0) {
      csvContent += "Tidak ada Purchase Order yang sedang berjalan.,,,,,,\n";
    } else {
      activePos.forEach((po) => {
        const thisPoItems = poItems.filter((i) => i.poId === po.id);
        const poQty = thisPoItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);
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

        let jobDetails = "";
        if (poJobs.length > 0) {
          const tData = poJobs.reduce(
            (acc, job) => {
              const subForJob = thisPoSubs.filter((s) => s.jobId === job.id);

              const prevSet = subForJob
                .filter((s) => !s.partType || s.partType === "Set")
                .reduce((a, s) => a + (Number(s.qtySubmitted) || 0), 0);
              const prevInner =
                subForJob
                  .filter((s) => s.partType === "Inner")
                  .reduce((a, s) => a + (Number(s.qtySubmitted) || 0), 0) +
                prevSet;
              const prevOuter =
                subForJob
                  .filter((s) => s.partType === "Outer")
                  .reduce((a, s) => a + (Number(s.qtySubmitted) || 0), 0) +
                prevSet;

              const jobQty = Number(job.qtyTaken) || 0;
              const remInner = Math.max(0, jobQty - prevInner);
              const remOuter = Math.max(0, jobQty - prevOuter);

              const tailor = tailors.find((t) => t.id === job.tailorId);
              const tName = job.tailorName || tailor?.name || "Unknown";

              if (!acc[tName])
                acc[tName] = { taken: 0, remInner: 0, remOuter: 0 };
              acc[tName].taken += jobQty;
              acc[tName].remInner += remInner;
              acc[tName].remOuter += remOuter;
              return acc;
            },
            {} as Record<
              string,
              { taken: number; remInner: number; remOuter: number }
            >
          );

          jobDetails = Object.entries(tData)
            .map(([name, d]) => {
              const shortStr = formatShortQty(d.remInner, d.remOuter);
              return `${name}: ${d.taken} (${shortStr})`;
            })
            .join(" | ");
        }

        csvContent += `"${po.poNumber}","${po.customerName}","${po.status}",${poQty},${poCompleted},${progress}%,"${jobDetails}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `Laporan_Konfeksi_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 pb-12"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Dashboard Utama
          </h2>
          <p className="text-slate-500 font-medium mt-1">
            Status terbaru operasional konfeksi Anda
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm print:hidden"
          >
            <FileText size={16} /> Unduh CSV
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-sm print:hidden"
          >
            <Download size={16} /> Cetak / Unduh PDF
          </button>
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full text-xs font-bold ring-1 ring-indigo-200 print:hidden">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            Live Update Aktivitas
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 print:hidden">
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
            Gaji Belum Bayar
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 print:hidden">
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

      {/* PRINT REPORT SECTION */}
      {(() => {
        const reportTotalUnpaidWage = masterTailorsReport.reduce(
          (s, t) => s + t.unpaidWage,
          0
        );
        const reportTotalTabungan = masterTailorsReport.reduce(
          (s, t) => s + t.tTabungan,
          0
        );
        const reportTotalTabunganPeriodeIni = masterTailorsReport.reduce(
          (s, t) => s + t.tTabunganPeriodeIni,
          0
        );
        const reportTotalKasbon = masterTailorsReport.reduce(
          (s, t) => s + t.tUnpaidKasbon,
          0
        );
        const reportTotalManual = masterTailorsReport.reduce(
          (s, t) => s + t.tUnpaidManual,
          0
        );

        return (
          <div className="hidden print:block w-full bg-white text-slate-900 font-sans mt-0">
            {/* Document Header */}
            <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6 mb-8">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                  LAPORAN AKTIVITAS
                </h1>
                <p className="text-sm font-bold text-slate-500 mt-2 uppercase tracking-widest">
                  Periode Berjalan
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-2xl font-black text-indigo-600 uppercase tracking-widest leading-none">
                  KONFEKSI APP
                </h2>
                <p className="text-xs text-slate-500 mt-2 font-medium">
                  Dicetak:{" "}
                  {new Date().toLocaleString("id-ID", {
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-6 mb-10">
              <div className="border-2 border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                  Total Gaji Belum Bayar
                </p>
                <p className="text-3xl font-black text-rose-600 tabular-nums tracking-tighter">
                  Rp {reportTotalUnpaidWage.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="border-2 border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                  Total Tabungan Pekerja
                </p>
                <p className="text-3xl font-black text-sky-600 tabular-nums tracking-tighter">
                  Rp {reportTotalTabungan.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="border-2 border-slate-200 rounded-2xl p-6 bg-slate-50/50">
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">
                  Total Kasbon Aktif
                </p>
                <p className="text-3xl font-black text-amber-600 tabular-nums tracking-tighter">
                  Rp {reportTotalKasbon.toLocaleString("id-ID")}
                </p>
              </div>
            </div>

            {/* Tailors Detail Table */}
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-6 bg-slate-900 rounded-full"></div>
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">
                  Rincian Keuangan Penjahit
                </h2>
              </div>
              <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-100/80">
                    <tr>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200">
                        Nama Penjahit
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-right">
                        Gaji Tertunda
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-right">
                        Tabungan Berjalan
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-center">
                        Grade
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-right">
                        Kasbon
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-right">
                        Penyesuaian
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100">
                    {masterTailorsReport.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-6 text-center text-slate-400 font-medium italic"
                        >
                          Semua tagihan lunas. Tidak ada data tertunda.
                        </td>
                      </tr>
                    ) : (
                      masterTailorsReport.map((t, i) => (
                        <tr
                          key={t.id}
                          className={
                            i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                          }
                          style={{ pageBreakInside: "avoid" }}
                        >
                          <td className="p-4 font-bold text-slate-800">
                            {t.name}
                          </td>
                          <td className="p-4 text-right font-black text-rose-600 tabular-nums">
                            {t.unpaidWage > 0
                              ? `Rp ${t.unpaidWage.toLocaleString("id-ID")}`
                              : "-"}
                          </td>
                          <td className="p-4 text-right font-black text-sky-500 tabular-nums">
                            {t.tTabunganPeriodeIni > 0
                              ? `Rp ${t.tTabunganPeriodeIni.toLocaleString("id-ID")}`
                              : "-"}
                          </td>
                          <td className="p-4 text-center font-black text-emerald-600">
                            {t.gradeName !== "-" ? t.gradeName : "-"}
                          </td>
                          <td className="p-4 text-right font-black text-amber-600 tabular-nums">
                            {t.tUnpaidKasbon > 0
                              ? `Rp ${t.tUnpaidKasbon.toLocaleString("id-ID")}`
                              : "-"}
                          </td>
                          <td
                            className={`p-4 text-right font-black tabular-nums ${t.tUnpaidManual > 0 ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {t.tUnpaidManual !== 0
                              ? `Rp ${t.tUnpaidManual.toLocaleString("id-ID")}`
                              : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                    {masterTailorsReport.length > 0 && (
                      <tr className="bg-slate-100 font-black">
                        <td className="p-4 text-slate-800 uppercase tracking-widest text-xs">
                          Total Keseluruhan
                        </td>
                        <td className="p-4 text-right text-rose-600 tabular-nums">
                          Rp {reportTotalUnpaidWage.toLocaleString("id-ID")}
                        </td>
                        <td className="p-4 text-right text-sky-500 tabular-nums">
                          Rp{" "}
                          {reportTotalTabunganPeriodeIni.toLocaleString(
                            "id-ID"
                          )}
                        </td>
                        <td className="p-4 text-center text-slate-400">-</td>
                        <td className="p-4 text-right text-amber-600 tabular-nums">
                          Rp {reportTotalKasbon.toLocaleString("id-ID")}
                        </td>
                        <td
                          className={`p-4 text-right tabular-nums ${reportTotalManual > 0 ? "text-emerald-600" : "text-rose-600"}`}
                        >
                          {reportTotalManual !== 0
                            ? `Rp ${reportTotalManual.toLocaleString("id-ID")}`
                            : "-"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active POs Table */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-6 bg-slate-900 rounded-full"></div>
                <h2 className="text-lg font-black uppercase tracking-widest text-slate-900">
                  Perkembangan PO Aktif
                </h2>
              </div>
              <div className="border-2 border-slate-200 rounded-2xl overflow-hidden">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="bg-slate-100/80">
                    <tr>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200">
                        No PO / Customer
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-center">
                        Status
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-right">
                        Target
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-right">
                        Disetor
                      </th>
                      <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-widest border-b-2 border-slate-200 text-right">
                        Progress
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100">
                    {activePos.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-6 text-center text-slate-400 font-medium italic"
                        >
                          Tidak ada Purchase Order yang sedang berjalan.
                        </td>
                      </tr>
                    ) : (
                      activePos.map((po, i) => {
                        const thisPoItems = poItems.filter(
                          (i) => i.poId === po.id
                        );
                        const poQty = thisPoItems.reduce(
                          (s, i) => s + (Number(i.qty) || 0),
                          0
                        );
                        const poJobs = jobs.filter((j) =>
                          thisPoItems.some((item) => item.id === j.poItemId)
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
                            ? Math.min(
                                100,
                                Math.round((poCompleted / poQty) * 100)
                              )
                            : 0;
                        return (
                          <Fragment key={po.id}>
                            <tr
                              className={
                                i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                              }
                            >
                              <td className="p-4">
                                <p className="font-black text-slate-900">
                                  {po.poNumber}
                                </p>
                                <p className="text-xs font-bold text-slate-500 uppercase mt-0.5">
                                  {po.customerName}
                                </p>
                              </td>
                              <td className="p-4 text-center">
                                <span className="font-bold text-slate-700 text-xs uppercase tracking-wider">
                                  {po.status}
                                </span>
                              </td>
                              <td className="p-4 text-right font-black text-slate-700 tabular-nums">
                                {poQty.toLocaleString("id-ID")}
                              </td>
                              <td className="p-4 text-right font-black text-slate-700 tabular-nums">
                                {poCompleted.toLocaleString("id-ID")}
                              </td>
                              <td className="p-4 text-right font-black text-indigo-600 tabular-nums">
                                {progress}%
                              </td>
                            </tr>
                            {poJobs.length > 0 && (
                              <tr
                                className={
                                  i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                                }
                              >
                                <td colSpan={5} className="px-4 pb-4 pt-0">
                                  <div className="bg-slate-100 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                                    {Object.entries(
                                      poJobs.reduce(
                                        (acc, job) => {
                                          const subForJob = thisPoSubs.filter(
                                            (s) => s.jobId === job.id
                                          );

                                          const prevSet = subForJob
                                            .filter(
                                              (s) =>
                                                !s.partType ||
                                                s.partType === "Set"
                                            )
                                            .reduce(
                                              (a, s) =>
                                                a +
                                                (Number(s.qtySubmitted) || 0),
                                              0
                                            );
                                          const prevInner =
                                            subForJob
                                              .filter(
                                                (s) => s.partType === "Inner"
                                              )
                                              .reduce(
                                                (a, s) =>
                                                  a +
                                                  (Number(s.qtySubmitted) || 0),
                                                0
                                              ) + prevSet;
                                          const prevOuter =
                                            subForJob
                                              .filter(
                                                (s) => s.partType === "Outer"
                                              )
                                              .reduce(
                                                (a, s) =>
                                                  a +
                                                  (Number(s.qtySubmitted) || 0),
                                                0
                                              ) + prevSet;

                                          const jobQty =
                                            Number(job.qtyTaken) || 0;
                                          const remInner = Math.max(
                                            0,
                                            jobQty - prevInner
                                          );
                                          const remOuter = Math.max(
                                            0,
                                            jobQty - prevOuter
                                          );

                                          const tailor = tailors.find(
                                            (t) => t.id === job.tailorId
                                          );
                                          const tName =
                                            job.tailorName ||
                                            tailor?.name ||
                                            "Unknown";

                                          if (!acc[tName])
                                            acc[tName] = {
                                              taken: 0,
                                              submitted: 0,
                                              remInner: 0,
                                              remOuter: 0,
                                            };

                                          acc[tName].taken += jobQty;
                                          acc[tName].submitted +=
                                            subForJob.reduce(
                                              (s, sub) =>
                                                s +
                                                (Number(sub.qtySubmitted) || 0),
                                              0
                                            );
                                          acc[tName].remInner += remInner;
                                          acc[tName].remOuter += remOuter;
                                          return acc;
                                        },
                                        {} as Record<
                                          string,
                                          {
                                            taken: number;
                                            submitted: number;
                                            remInner: number;
                                            remOuter: number;
                                          }
                                        >
                                      )
                                    ).map(([tName, data], idx) => {
                                      const shortStr = formatShortQty(
                                        data.remInner,
                                        data.remOuter
                                      );
                                      return (
                                        <div
                                          key={idx}
                                          className="flex justify-between items-center text-xs border-b border-slate-200/50 pb-1 last:border-0 last:pb-0"
                                        >
                                          <span className="font-bold text-slate-700 truncate pr-2">
                                            {tName}
                                          </span>
                                          {shortStr !== "Selesai" ? (
                                            <span className="font-bold text-rose-500 tabular-nums">
                                              {shortStr}
                                            </span>
                                          ) : (
                                            <span className="font-bold text-emerald-500 tabular-nums">
                                              Selesai
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-16 text-center">
              <div className="w-16 h-1 bg-slate-200 mx-auto rounded-full mb-6"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">
                Dokumen ini diterbitkan secara otomatis berbasis sistem. Hak
                Cipta &copy; {new Date().getFullYear()} Konfeksi App
              </p>
            </div>
          </div>
        );
      })()}
    </motion.div>
  );
}
