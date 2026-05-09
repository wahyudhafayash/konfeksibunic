import { useState, useRef, useEffect } from "react";
import {
  db,
  useLiveQuery,
  PO,
  SalaryPayment,
  TabunganWithdrawal,
} from "@/lib/db";
import {
  Search,
  ChevronRight,
  CheckCircle2,
  Wallet,
  PiggyBank,
  Package,
  Clock,
  Filter,
  Calendar,
  X,
  Eye,
  EyeOff,
  Printer,
  Info,
  Download,
  ArrowRight,
  User,
  TrendingUp,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HistoryView() {
  const [activeTab, setActiveTab] = useState<
    "po" | "salary" | "tabungan" | "tailors" | "logs"
  >("po");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedTailorId, setSelectedTailorId] = useState<number | null>(null);
  const [showAmountsGlobal, setShowAmountsGlobal] = useState(false);
  const [visibleAmounts, setVisibleAmounts] = useState<Record<string, boolean>>(
    {}
  );

  const [selectedPO, setSelectedPO] = useState<any>(null);
  const [selectedSalary, setSelectedSalary] = useState<any>(null);
  const [selectedDeletedTailor, setSelectedDeletedTailor] = useState<any>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [selectedArchiveInfo, setSelectedArchiveInfo] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const tailors = useLiveQuery(() => db.tailors.toArray(), []) || [];
  const poItems = useLiveQuery(() => db.poItems.toArray(), []) || [];
  const pos = useLiveQuery(() => db.pos.toArray(), []) || [];
  const logs =
    useLiveQuery(() => db.appLogs.orderBy("date").reverse().toArray(), []) ||
    [];

  const archivePOs =
    useLiveQuery(
      () => db.archivePOs.orderBy("archivedAt").reverse().toArray(),
      []
    ) || [];
  const archiveSalaries =
    useLiveQuery(
      () => db.archiveSalaries.orderBy("archivedAt").reverse().toArray(),
      []
    ) || [];
  const archiveTabungan =
    useLiveQuery(
      () => db.archiveTabungan.orderBy("archivedAt").reverse().toArray(),
      []
    ) || [];
  const archiveTailors =
    useLiveQuery(
      () => db.archiveTailors.orderBy("archivedAt").reverse().toArray(),
      []
    ) || [];

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Struk Digital - Konfeksi</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>@media print { @page { margin: 1cm; } .no-print { display: none; } } body { font-family: sans-serif; padding: 20px; }</style>
        </head>
        <body>${printContent}<script>window.onload = () => { window.print(); window.close(); };</script></body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadPOCSV = (po: PO) => {
    const items = poItems.filter((it) => it.poId === po.id);
    const headers = [
      "PO Number",
      "Customer",
      "Date",
      "Item Name",
      "Color",
      "Size",
      "Qty (pcs)",
    ];
    const rows = items.map((item) => [
      po.poNumber,
      po.customerName,
      po.date,
      item.itemName,
      item.color,
      item.size,
      item.qty,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `PO_${po.poNumber}_${po.customerName}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getTailorName = (tailorId: number) => {
    const t = tailors.find((x) => x.id === tailorId);
    if (!t) return "Unknown";
    return t.partnerName ? `${t.name} & ${t.partnerName}` : t.name;
  };

  const isWithinDateRange = (dateStr: string) => {
    if (!fromDate && !toDate) return true;
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      if (date < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (date > to) return false;
    }
    return true;
  };

  const archivedPoIds = new Set(archivePOs.map((a) => a.originalId));
  const archivedSalaryIds = new Set(archiveSalaries.map((a) => a.originalId));
  const archivedTabunganIds = new Set(archiveTabungan.map((a) => a.originalId));
  const archivedTailorIds = new Set(archiveTailors.map((a) => a.originalId));

  const currentPOsRaw = archivePOs.filter((a) => {
    const p = a.data;
    const matchesSearch =
      p.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDate = isWithinDateRange(a.archivedAt);
    return matchesSearch && matchesDate;
  });

  const seenPoIds = new Set();
  const currentPOs = currentPOsRaw
    .filter((a) => {
      if (!a.originalId) return true;
      if (seenPoIds.has(a.originalId)) return false;
      seenPoIds.add(a.originalId);
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.archivedAt).getTime();
      const timeB = new Date(b.archivedAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  const currentSalariesRaw = archiveSalaries.filter((s) => {
    const d = s.data;
    const tailorName = d.tailorName || getTailorName(d.tailorId);
    const matchesSearch = tailorName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesDate = isWithinDateRange(s.archivedAt);
    const matchesTailor = selectedTailorId
      ? d.tailorId === selectedTailorId
      : true;
    return matchesSearch && matchesDate && matchesTailor;
  });

  const seenSalaryIds = new Set();
  const currentSalaries = currentSalariesRaw
    .filter((s) => {
      if (!s.originalId) return true;
      if (seenSalaryIds.has(s.originalId)) return false;
      seenSalaryIds.add(s.originalId);
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.archivedAt).getTime();
      const timeB = new Date(b.archivedAt).getTime();
      if (timeA === timeB) {
        return sortOrder === "desc"
          ? (b.originalId || 0) - (a.originalId || 0)
          : (a.originalId || 0) - (b.originalId || 0);
      }
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  const currentTabunganRaw = archiveTabungan.filter((w) => {
    const d = w.data;
    const tailorName = d.tailorName || getTailorName(d.tailorId);
    const matchesSearch = tailorName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesDate = isWithinDateRange(w.archivedAt);
    const matchesTailor = selectedTailorId
      ? d.tailorId === selectedTailorId
      : true;
    return matchesSearch && matchesDate && matchesTailor;
  });

  const seenTabunganIds = new Set();
  const currentTabungan = currentTabunganRaw
    .filter((w) => {
      if (!w.originalId) return true;
      if (seenTabunganIds.has(w.originalId)) return false;
      seenTabunganIds.add(w.originalId);
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.archivedAt).getTime();
      const timeB = new Date(b.archivedAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  const currentTailors = archiveTailors
    .filter((t) => {
      const d = t.data;
      const matchesSearch =
        (d.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.partnerName || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDate = isWithinDateRange(t.archivedAt);
      return matchesSearch && matchesDate;
    })
    .sort((a, b) => {
      const timeA = new Date(a.archivedAt).getTime();
      const timeB = new Date(b.archivedAt).getTime();
      return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
    });

  const displayAmount = (
    amount: number,
    key: string,
    customClass: string = ""
  ) => {
    const isVisible = showAmountsGlobal || visibleAmounts[key];
    return (
      <span
        className={`inline-flex items-center gap-2 cursor-pointer hover:opacity-80 transition-all ${customClass}`}
        onClick={() =>
          setVisibleAmounts((prev) => ({ ...prev, [key]: !prev[key] }))
        }
      >
        {isVisible ? `Rp ${amount.toLocaleString("id-ID")}` : "Rp ••••••"}
        <span className="p-1 rounded-md bg-slate-100 group-hover:bg-slate-200">
          {isVisible ? <EyeOff size={10} /> : <Eye size={10} />}
        </span>
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(
        d
      );
    } catch (e) {
      return dateStr;
    }
  };

  function getPoItemLabel(poItemId: number) {
    const item = poItems.find((i) => i.id === poItemId);
    if (!item) return "Unknown";
    const po = pos.find((p) => p.id === item.poId);
    return `${po?.poNumber || "?"} - ${item.itemName} (${item.color}, ${item.size})`;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.98 },
    visible: { opacity: 1, scale: 1 },
  };

  return (
    <div className="space-y-10 pb-24">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Histori Sistem
          </h2>
          <p className="text-slate-500 font-medium mt-1 uppercase tracking-widest text-[10px]">
            Basis data riwayat produksi dan log aktivitas
          </p>
        </div>
        <div className="flex flex-wrap gap-3 w-full lg:w-auto items-center">
          <button
            onClick={() => setShowAmountsGlobal(!showAmountsGlobal)}
            className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm border ${showAmountsGlobal ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
          >
            {showAmountsGlobal ? (
              <EyeOff size={16} className="inline mr-2" />
            ) : (
              <Eye size={16} className="inline mr-2" />
            )}
            {showAmountsGlobal ? "Masking Angka" : "Tampilkan Angka"}
          </button>
        </div>
      </div>

      <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] p-8 shadow-sm flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative group">
            <Search
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600"
              size={18}
            />
            <input
              type="text"
              placeholder="Cari kata kunci..."
              className="pl-12 pr-4 py-3 w-full text-sm font-bold border-2 border-slate-50 rounded-2xl focus:border-indigo-500 focus:outline-none bg-slate-50/50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-50/50 border-2 border-slate-50 rounded-2xl px-4 py-2 sm:py-1 col-span-1 lg:col-span-1 min-w-fit">
            <Calendar size={18} className="text-slate-400 shrink-0" />
            <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
              <input
                type="date"
                className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full min-w-[110px]"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <span className="text-slate-300 text-xs font-black shrink-0">
                TO
              </span>
              <input
                type="date"
                className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full min-w-[110px]"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>

          {(activeTab === "salary" || activeTab === "tabungan") && (
            <div className="flex items-center gap-3 bg-slate-50/50 border-2 border-slate-50 rounded-2xl px-4 py-1">
              <User size={18} className="text-slate-400" />
              <select
                className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full uppercase"
                value={selectedTailorId || ""}
                onChange={(e) =>
                  setSelectedTailorId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">Semua Penjahit</option>
                {tailors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.partnerName ? `& ${t.partnerName}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 bg-slate-50/50 border-2 border-slate-50 rounded-2xl px-4 py-1">
            <TrendingUp size={18} className="text-slate-400" />
            <select
              className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full uppercase"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as "desc" | "asc")}
            >
              <option value="desc">Terbaru ke Terlama</option>
              <option value="asc">Terlama ke Terbaru</option>
            </select>
          </div>

          {(fromDate || toDate || selectedTailorId || searchQuery) && (
            <button
              onClick={() => {
                setFromDate("");
                setToDate("");
                setSelectedTailorId(null);
                setSearchQuery("");
              }}
              className="bg-rose-50 text-rose-600 hover:bg-rose-100 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
            >
              <X size={16} /> Reset Filter
            </button>
          )}
        </div>

        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl self-start w-full sm:w-auto overflow-x-auto custom-scrollbar flex-wrap">
          <button
            onClick={() => setActiveTab("po")}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "po" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Histori PO
          </button>
          <button
            onClick={() => setActiveTab("salary")}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "salary" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Riwayat Gaji
          </button>
          <button
            onClick={() => setActiveTab("tabungan")}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "tabungan" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Riwayat Tabungan
          </button>
          <button
            onClick={() => setActiveTab("tailors")}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "tailors" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Penjahit Nonaktif
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === "logs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Log Aktivitas
          </button>
        </div>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        key={activeTab}
      >
        {activeTab === "po" && (
          <div className="space-y-12">
            {currentPOs.length === 0 ? (
              <div className="text-center py-20 opacity-40 italic font-bold">
                Data riwayat PO tidak ditemukan.
              </div>
            ) : (
              Object.entries(
                currentPOs.reduce(
                  (acc, arc) => {
                    const po = arc.data;
                    const name = po.customerName;
                    if (!acc[name]) acc[name] = [];
                    acc[name].push({ ...po, archiveInfo: arc });
                    return acc;
                  },
                  {} as Record<string, any[]>
                )
              ).map(([customerName, itemsInGroup]) => (
                <div key={customerName} className="space-y-6">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>{" "}
                    {customerName}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {itemsInGroup.map((item) => {
                      const po = item;
                      const arc = item.archiveInfo;
                      const items = poItems.filter(
                        (i) => i.poId === po.id || i.poId === arc.originalId
                      );
                      const totalPcs = items.reduce((sum, i) => sum + i.qty, 0);
                      return (
                        <motion.div
                          variants={itemVariants}
                          key={arc.id}
                          className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 shadow-sm hover:border-emerald-100 hover:shadow-md transition-all group relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setSelectedPO(po);
                                setSelectedArchiveInfo(arc);
                              }}
                              className="bg-white border border-slate-200 p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all shadow-sm"
                            >
                              <Info size={16} />
                            </button>
                          </div>
                          <div className="mb-6">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] block">
                                Data Terarsip: {formatDate(arc.archivedAt)}
                              </span>
                            </div>
                            <h3 className="font-black text-slate-900 text-xl tracking-tight leading-tight uppercase group-hover:text-emerald-600 transition-colors">
                              #{po.poNumber}
                            </h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                              Oleh: {arc.archivedBy}
                            </p>
                          </div>

                          <div className="space-y-1 mt-auto">
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                              Kapasitas Produksi
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-black text-slate-900">
                                {totalPcs}
                              </span>
                              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                PCS TOTAL
                              </span>
                            </div>
                          </div>

                          <div className="mt-6 flex gap-2">
                            {po.status === "Dihapus" ? (
                              <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-rose-100/50">
                                <X size={12} /> DELETED
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 border border-emerald-100/50">
                                <CheckCircle2 size={12} /> CLOSED
                              </span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "salary" && (
          <div className="space-y-12">
            {currentSalaries.length === 0 ? (
              <div className="text-center py-20 opacity-40 italic font-bold">
                Data riwayat gaji tidak ditemukan.
              </div>
            ) : (
              Object.entries(
                currentSalaries.reduce(
                  (acc, arc) => {
                    const sal = arc.data;
                    const name = sal.tailorName || getTailorName(sal.tailorId);
                    if (!acc[name]) acc[name] = [];
                    acc[name].push({ ...sal, archiveInfo: arc });
                    return acc;
                  },
                  {} as Record<string, any[]>
                )
              ).map(([name, itemsInGroup]) => (
                <div key={name} className="space-y-6">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
                    <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>{" "}
                    {name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {itemsInGroup.map((item) => {
                      const sal = item;
                      const arc = item.archiveInfo;
                      return (
                        <motion.div
                          variants={itemVariants}
                          key={arc.id}
                          onClick={() => {
                            setSelectedSalary(sal);
                            setSelectedArchiveInfo(arc);
                          }}
                          className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-8 shadow-sm hover:border-indigo-100 hover:shadow-md transition-all cursor-pointer group"
                        >
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                                  Data Terarsip: {formatDate(arc.archivedAt)}
                                </p>
                              </div>
                              <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">
                                Slip #{arc.originalId}
                              </h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                                Oleh: {arc.archivedBy}
                              </p>
                            </div>
                            <div className="bg-indigo-50 text-indigo-500 p-2.5 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                              <Wallet size={20} />
                            </div>
                          </div>

                          <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2.5 rounded-xl">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                Qty Setor
                              </span>
                              <span className="text-sm font-black text-slate-700 tabular-nums">
                                {sal.totalQty} PCS
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-400">
                                Upah Bruto
                              </span>
                              <span className="font-black text-slate-700">
                                {displayAmount(
                                  sal.totalWage,
                                  `arc_sal_wage_${arc.id}`
                                )}
                              </span>
                            </div>
                          </div>

                          <div className="pt-6 border-t-2 border-slate-50 flex justify-between items-end">
                            <div>
                              <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">
                                Diterima
                              </p>
                              <p className="text-2xl font-black text-indigo-600 tabular-nums leading-none">
                                {displayAmount(
                                  sal.netPayment,
                                  `arc_sal_net_${arc.id}`
                                )}
                              </p>
                            </div>
                            <ArrowRight
                              size={20}
                              className="text-slate-300 group-hover:text-indigo-600 transition-colors group-hover:translate-x-1 transition-transform"
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === "tabungan" && (
          <div className="space-y-12">
            {currentTabungan.length === 0 ? (
              <div className="text-center py-20 opacity-40 italic font-bold">
                Data riwayat pencairan tabungan tidak ditemukan.
              </div>
            ) : (
              Object.entries(
                currentTabungan.reduce(
                  (acc, arc) => {
                    const wd = arc.data;
                    const name = wd.tailorName || getTailorName(wd.tailorId);
                    if (!acc[name]) acc[name] = [];
                    acc[name].push({ ...wd, archiveInfo: arc });
                    return acc;
                  },
                  {} as Record<string, any[]>
                )
              ).map(([name, itemsInGroup]) => (
                <div key={name} className="space-y-6">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3 px-2">
                    <div className="w-1.5 h-6 bg-sky-500 rounded-full"></div>{" "}
                    {name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {itemsInGroup.map((item) => {
                      const wd = item;
                      const arc = item.archiveInfo;
                      return (
                        <motion.div
                          variants={itemVariants}
                          key={arc.id}
                          className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 shadow-sm hover:border-sky-100 transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-5">
                            <div className="bg-sky-50 text-sky-500 p-4 rounded-3xl group-hover:bg-sky-600 group-hover:text-white transition-all shadow-inner">
                              <PiggyBank size={24} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">
                                  Data Terarsip: {formatDate(arc.archivedAt)}
                                </p>
                              </div>
                              <h4 className="text-lg font-black text-slate-900 uppercase">
                                Pencairan
                              </h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">
                                Oleh: {arc.archivedBy}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">
                              Nominal
                            </p>
                            <p className="text-xl font-black text-sky-600 tabular-nums leading-none">
                              {displayAmount(wd.amount, `arc_wd_${arc.id}`)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "tailors" && (
          <div className="space-y-6">
            {currentTailors.length === 0 ? (
              <div className="text-center py-20 opacity-40 italic font-bold">
                Data arsip penjahit dihapus tidak ditemukan.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentTailors.map((arc) => {
                  const t = arc.data;
                  return (
                    <motion.div
                      variants={itemVariants}
                      key={arc.id}
                      className="bg-white border-2 border-slate-50 rounded-[2.5rem] p-6 shadow-sm hover:shadow-md transition-all"
                    >
                      <div className="flex items-center gap-4 mb-6">
                        <div className="bg-rose-50 text-rose-500 p-4 rounded-[1.5rem]">
                          <User size={24} />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-xl tracking-tight leading-tight uppercase">
                            {t.name}
                          </h4>
                          {t.partnerName && (
                            <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-widest">
                              & {t.partnerName}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                              Arsip {formatDate(arc.archivedAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-4 pt-4 border-t border-slate-50 border-dashed">
                        <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2.5 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            ID Penjahit
                          </span>
                          <span className="text-sm font-black text-slate-700">
                            #{arc.originalId}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-slate-50/50 px-4 py-2.5 rounded-xl">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Diarsipkan Oleh
                          </span>
                          <span className="text-sm font-black text-rose-600 uppercase italic">
                            {arc.archivedBy}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => {
                            setSelectedDeletedTailor(t);
                            setSelectedArchiveInfo(arc);
                          }}
                          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                          Lihat Detail Penjahit
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 uppercase tracking-widest text-[9px]">
                  <tr>
                    <th className="px-8 py-5">Waktu</th>
                    <th className="px-8 py-5">Oleh</th>
                    <th className="px-8 py-5">Aksi</th>
                    <th className="px-8 py-5">Deskripsi</th>
                    <th className="px-8 py-5">Modul</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-8 py-20 text-center text-slate-400 font-bold italic"
                      >
                        Belum ada riwayat aktivitas sistem.
                      </td>
                    </tr>
                  ) : (
                    logs
                      .filter(
                        (log) =>
                          log.user
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                          log.action
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                          log.details
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase()) ||
                          (log.table || "")
                            .toLowerCase()
                            .includes(searchQuery.toLowerCase())
                      )
                      .map((log) => (
                        <tr
                          key={log.id}
                          className="hover:bg-slate-50/10 transition-colors group cursor-pointer"
                          onClick={() => setSelectedLog(log)}
                        >
                          <td className="px-8 py-5 text-slate-500 font-medium tabular-nums">
                            {new Date(log.date).toLocaleString("id-ID")}
                          </td>
                          <td className="px-8 py-5">
                            <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-slate-200/50">
                              {log.user}
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                                log.action === "TAMBAH"
                                  ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                  : log.action === "EDIT"
                                    ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                                    : "bg-rose-50 text-rose-600 border-rose-100"
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="px-8 py-5 font-bold text-slate-700">
                            {log.details}
                          </td>
                          <td className="px-8 py-5 flex items-center justify-between">
                            <span className="opacity-40 group-hover:opacity-100 font-black text-[9px] uppercase tracking-widest transition-opacity px-2 py-1 bg-slate-50 rounded-lg">
                              {log.table}
                            </span>
                            <ChevronRight
                              size={14}
                              className="text-slate-300 opacity-0 group-hover:opacity-100 transition-all"
                            />
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </motion.div>

      {/* System Log Detail Modal */}
      <AnimatePresence>
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="bg-slate-900 text-white p-3 rounded-2xl">
                    <Clock size={24} />
                  </div>
                  <h3 className="font-black text-slate-900 text-xl tracking-tight uppercase">
                    Detail Aktivitas
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="text-slate-400 hover:text-slate-900 transition-colors bg-white p-2 border border-slate-100 rounded-xl"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Waktu Kejadian
                    </p>
                    <p className="font-bold text-slate-900 text-sm">
                      {new Date(selectedLog.date).toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Oleh User
                    </p>
                    <p className="font-bold text-slate-900 text-sm uppercase">
                      {selectedLog.user}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Tipe Aksi
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                        selectedLog.action === "TAMBAH"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                          : selectedLog.action === "EDIT"
                            ? "bg-indigo-50 text-indigo-600 border-indigo-100"
                            : "bg-rose-50 text-rose-600 border-rose-100"
                      }`}
                    >
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Modul Sistem
                    </p>
                    <p className="font-black text-indigo-600 text-xs uppercase tracking-widest">
                      {selectedLog.table}
                    </p>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Deskripsi Lengkap
                  </p>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-sm font-bold text-slate-700 leading-relaxed italic">
                      "{selectedLog.details}"
                    </p>
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-2xl text-[10px] font-bold text-indigo-400 italic">
                  Informasi ini dicatat secara otomatis oleh sistem untuk audit
                  keamanan dan pemantauan aktivitas.
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="bg-white border-2 border-slate-200 text-slate-600 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PO Detail Modal */}
      <AnimatePresence>
        {selectedPO && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm no-print">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <div className="bg-emerald-600 text-white p-4 rounded-[1.5rem] shadow-lg shadow-emerald-600/20">
                    <Package size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">
                      #{selectedPO.poNumber}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-white border border-slate-100 px-3 py-1 rounded-lg inline-block">
                        Client: {selectedPO.customerName}
                      </p>
                      {selectedArchiveInfo ? (
                        <span className="text-[9px] text-indigo-500 font-black uppercase bg-indigo-50 px-2 py-0.5 rounded-md tracking-widest">
                          Archived by: {selectedArchiveInfo.archivedBy}
                        </span>
                      ) : (
                        selectedPO.createdBy && (
                          <span className="text-[9px] text-slate-400 font-bold italic uppercase">
                            By: {selectedPO.createdBy}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => handleDownloadPOCSV(selectedPO)}
                    className="bg-white border-2 border-slate-100 text-slate-600 hover:text-emerald-600 hover:border-emerald-100 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-sm flex items-center gap-2"
                  >
                    <Download size={18} /> Export CSV
                  </button>
                  <button
                    onClick={handlePrint}
                    className="bg-slate-900 text-white hover:bg-emerald-600 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all flex items-center gap-2"
                  >
                    <Printer size={18} /> Cetak Nota
                  </button>
                  <button
                    onClick={() => setSelectedPO(null)}
                    className="text-slate-400 hover:text-slate-900 bg-white border border-slate-100 p-3 rounded-2xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
              <div
                className="overflow-y-auto flex-1 p-10 custom-scrollbar"
                ref={printRef}
              >
                <div className="space-y-10">
                  {/* Brand/Header for Print */}
                  <div className="hidden print:block text-center border-b pb-8 mb-8">
                    <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-slate-900">
                      KONFEKSI APP
                    </h1>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 px-10">
                      Laporan Riwayat Arsip Pesanan (Final Record)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Nomor Order
                      </p>
                      <p className="font-black text-slate-900 text-lg uppercase tracking-tight">
                        {selectedPO.poNumber}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Nama Pelanggan
                      </p>
                      <p className="font-black text-slate-900 text-lg uppercase tracking-tight">
                        {selectedPO.customerName}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Tanggal Berjalan
                      </p>
                      <p className="font-bold text-slate-700 text-lg">
                        {formatDate(selectedPO.date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Status Akhir
                      </p>
                      {selectedPO.status === "Dihapus" ? (
                        <span className="bg-rose-100 text-rose-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2">
                          <X size={14} /> PESANAN DIHAPUS
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2">
                          <CheckCircle2 size={14} /> PESANAN SELESAI
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-12">
                    <h4 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 border-b border-slate-50 pb-4">
                      Daftar Item & Rincian Produksi
                    </h4>
                    <div className="border-4 border-slate-50 rounded-[2.5rem] overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500 uppercase tracking-widest text-[9px]">
                          <tr>
                            <th className="px-8 py-5">Deskripsi Produk</th>
                            <th className="px-8 py-5">Variasi Warna</th>
                            <th className="px-8 py-5">Ukuran</th>
                            <th className="px-8 py-5 text-center">
                              Volume (PCS)
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {poItems
                            .filter(
                              (it) =>
                                it.poId === selectedPO.id ||
                                it.poId === selectedArchiveInfo?.originalId
                            )
                            .map((item) => (
                              <tr
                                key={item.id}
                                className="hover:bg-slate-50/30 transition-colors"
                              >
                                <td className="px-8 py-5 font-black text-slate-900 uppercase tracking-tight">
                                  {item.itemName}
                                </td>
                                <td className="px-8 py-5 font-bold text-slate-600 uppercase">
                                  {item.color}
                                </td>
                                <td className="px-8 py-5 font-bold text-slate-600 uppercase">
                                  {item.size}
                                </td>
                                <td className="px-8 py-5 font-black text-slate-900 text-center text-lg">
                                  {item.qty}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="pt-12 mt-12 border-t-2 border-slate-50 hidden print:block">
                    <div className="flex justify-between">
                      <div className="text-center w-48">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-16">
                          Dibuat Oleh,
                        </p>
                        <div className="w-full border-b-2 border-slate-100"></div>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                          Administrator
                        </p>
                      </div>
                      <div className="text-center w-48">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-16">
                          Penerima,
                        </p>
                        <div className="w-full border-b-2 border-slate-100"></div>
                        <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
                          {selectedPO.customerName}
                        </p>
                      </div>
                    </div>
                    <p className="text-center italic text-[9px] text-slate-300 mt-12">
                      Laporan ini dihasilkan secara otomatis oleh sistem
                      KonfeksiApp pada {new Date().toLocaleString("id-ID")}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Salary Detail Modal */}
      <AnimatePresence>
        {selectedSalary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm no-print">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-5">
                  <div className="bg-indigo-600 text-white p-4 rounded-[1.5rem] shadow-lg shadow-indigo-600/20">
                    <Wallet size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">
                      SLIP GAJI:{" "}
                      {selectedSalary.tailorName ||
                        getTailorName(selectedSalary.tailorId)}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest bg-white border border-slate-100 px-3 py-1 rounded-lg inline-block">
                        Payment Ref: #
                        {selectedArchiveInfo?.originalId || selectedSalary.id}
                      </p>
                      {selectedArchiveInfo ? (
                        <span className="text-[9px] text-indigo-500 font-black uppercase bg-indigo-50 px-2 py-0.5 rounded-md tracking-widest">
                          Archived by: {selectedArchiveInfo.archivedBy}
                        </span>
                      ) : (
                        selectedSalary.createdBy && (
                          <span className="text-[9px] text-slate-400 font-bold italic uppercase">
                            By: {selectedSalary.createdBy}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handlePrint}
                    className="bg-slate-900 text-white hover:bg-black px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all flex items-center gap-2"
                  >
                    <Printer size={18} /> Cetak Kwitansi
                  </button>
                  <button
                    onClick={() => setSelectedSalary(null)}
                    className="text-slate-400 hover:text-slate-900 bg-white border border-slate-100 p-3 rounded-2xl transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>
              <div
                className="overflow-y-auto flex-1 p-10 custom-scrollbar"
                ref={printRef}
              >
                <div className="space-y-8 bg-white max-w-xl mx-auto p-8 border-2 border-slate-50 rounded-[3rem] shadow-sm relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-slate-100 rounded-b-full"></div>

                  <div className="text-center flex flex-col items-center mb-10 pt-4">
                    <h1 className="text-2xl font-black uppercase tracking-[0.3em] text-slate-900">
                      KONFEKSI APP
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                      Official Remuneration Slip
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-8 border-y-2 border-slate-50 border-dashed py-8">
                    <div>
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">
                        Nama Pekerja
                      </p>
                      <p className="font-black text-slate-900 tracking-tight text-lg uppercase">
                        {getTailorName(selectedSalary.tailorId)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">
                        Tanggal Transaksi
                      </p>
                      <p className="font-bold text-slate-700">
                        {formatDate(selectedSalary.date)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center group">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Upah Borongan
                        </span>
                        <span className="text-[9px] font-bold text-slate-300">
                          {selectedSalary.totalQty} PCS Dikerjakan
                        </span>
                      </div>
                      <span className="text-lg font-black text-slate-900 tabular-nums">
                        {displayAmount(
                          selectedSalary.totalWage,
                          `psw_${selectedSalary.id}`
                        )}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-emerald-600">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Bonus Grade Produksi
                        </span>
                        <span className="text-[9px] font-bold opacity-60">
                          Level: {selectedSalary.gradeName}
                        </span>
                      </div>
                      <span className="text-lg font-black tabular-nums">
                        +
                        {displayAmount(
                          selectedSalary.bonusAmount,
                          `psb_${selectedSalary.id}`
                        )}
                      </span>
                    </div>

                    {selectedSalary.manualAdjustment !== 0 && (
                      <div
                        className={`flex justify-between items-center ${selectedSalary.manualAdjustment > 0 ? "text-purple-600" : "text-rose-500"}`}
                      >
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            Penyesuaian Manual
                          </span>
                          <span className="text-[9px] font-bold opacity-60">
                            {selectedSalary.manualNote || "Adjustment"}
                          </span>
                        </div>
                        <span className="text-lg font-black tabular-nums font-mono">
                          {selectedSalary.manualAdjustment > 0 ? "+" : ""}
                          {displayAmount(
                            selectedSalary.manualAdjustment,
                            `psa_${selectedSalary.id}`
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-rose-500 py-4 border-t border-slate-50 border-dashed">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Pelunasan Kasbon
                        </span>
                        <span className="text-[9px] font-bold opacity-60">
                          Automatic Deduction
                        </span>
                      </div>
                      <span className="text-lg font-black tabular-nums">
                        -
                        {displayAmount(
                          selectedSalary.kasbonDeducted,
                          `psk_${selectedSalary.id}`
                        )}
                      </span>
                    </div>

                    <div className="pt-6 border-t-2 border-slate-50 flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">
                          Diterima Bersih
                        </p>
                        <p className="text-[10px] font-bold text-slate-300">
                          Net Take Home Pay
                        </p>
                      </div>
                      <p className="text-4xl font-black text-indigo-600 tabular-nums tracking-tighter shadow-sm">
                        {displayAmount(
                          selectedSalary.netPayment,
                          `psn_${selectedSalary.id}`
                        )}
                      </p>
                    </div>
                  </div>

                  {selectedSalary.tabunganAccumulated > 0 && (
                    <div className="bg-sky-50 border-2 border-sky-100 rounded-[2rem] p-5 flex justify-between items-center">
                      <span className="text-[10px] font-black text-sky-800 uppercase tracking-widest flex items-center gap-2">
                        <PiggyBank size={16} /> Iuran Tabungan Penjahit
                      </span>
                      <span className="font-black text-sky-700 text-lg tabular-nums">
                        +
                        {displayAmount(
                          selectedSalary.tabunganAccumulated,
                          `pst_${selectedSalary.id}`
                        )}
                      </span>
                    </div>
                  )}

                  <div className="pt-12 mt-12 border-t-2 border-slate-50 hidden print:block">
                    <div className="flex justify-between">
                      <div className="text-center w-40">
                        <p className="text-[9px] font-black uppercase tracking-widest mb-16">
                          Finance,
                        </p>
                        <div className="w-full border-b border-slate-200"></div>
                      </div>
                      <div className="text-center w-40">
                        <p className="text-[9px] font-black uppercase tracking-widest mb-16">
                          Penerima,
                        </p>
                        <div className="w-full border-b border-slate-200"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deleted Tailor Detail Modal */}
      <AnimatePresence>
        {selectedDeletedTailor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm no-print">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-5">
                  <div className="bg-rose-500 text-white p-4 rounded-[1.5rem] shadow-lg shadow-rose-500/20">
                    <User size={28} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-2xl tracking-tight leading-none uppercase">
                      DETAIL HISTORI: {selectedDeletedTailor.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[10px] text-rose-500 font-black uppercase tracking-widest bg-rose-50 px-3 py-1 rounded-lg inline-block">
                        PENJAHIT DIHAPUS
                      </span>
                      {selectedArchiveInfo && (
                        <span className="text-[9px] text-indigo-500 font-black uppercase bg-indigo-50 px-2 py-0.5 rounded-md tracking-widest">
                          Archived by: {selectedArchiveInfo.archivedBy}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedDeletedTailor(null)}
                    className="text-slate-400 hover:text-slate-900 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm hover:shadow transition-all"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/30">
                {(() => {
                  let tailorJobs = jobs.filter(
                    (j) => j.tailorId === selectedDeletedTailor.id
                  );

                  if (deletedTailorFilter.fromDate) {
                    const from = new Date(deletedTailorFilter.fromDate);
                    from.setHours(0, 0, 0, 0);
                    tailorJobs = tailorJobs.filter(
                      (j) => new Date(j.dateTaken) >= from
                    );
                  }
                  if (deletedTailorFilter.toDate) {
                    const to = new Date(deletedTailorFilter.toDate);
                    to.setHours(23, 59, 59, 999);
                    tailorJobs = tailorJobs.filter(
                      (j) => new Date(j.dateTaken) <= to
                    );
                  }

                  tailorJobs.sort((a, b) => {
                    const timeA = new Date(a.dateTaken).getTime();
                    const timeB = new Date(b.dateTaken).getTime();
                    return deletedTailorFilter.sortBy === "terbaru"
                      ? timeB - timeA
                      : timeA - timeB;
                  });

                  if (tailorJobs.length === 0) {
                    return (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Dari Tanggal
                            </label>
                            <input
                              type="date"
                              value={deletedTailorFilter.fromDate}
                              onChange={(e) =>
                                setDeletedTailorFilter({
                                  ...deletedTailorFilter,
                                  fromDate: e.target.value,
                                })
                              }
                              className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all"
                            />
                          </div>
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Sampai Tanggal
                            </label>
                            <input
                              type="date"
                              value={deletedTailorFilter.toDate}
                              onChange={(e) =>
                                setDeletedTailorFilter({
                                  ...deletedTailorFilter,
                                  toDate: e.target.value,
                                })
                              }
                              className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all"
                            />
                          </div>
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              Urutkan
                            </label>
                            <select
                              value={deletedTailorFilter.sortBy}
                              onChange={(e) =>
                                setDeletedTailorFilter({
                                  ...deletedTailorFilter,
                                  sortBy: e.target.value as
                                    | "terbaru"
                                    | "terlama",
                                })
                              }
                              className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all"
                            >
                              <option value="terbaru">Terbaru</option>
                              <option value="terlama">Terlama</option>
                            </select>
                          </div>
                          {(deletedTailorFilter.fromDate ||
                            deletedTailorFilter.toDate ||
                            deletedTailorFilter.sortBy !== "terbaru") && (
                            <button
                              onClick={() =>
                                setDeletedTailorFilter({
                                  fromDate: "",
                                  toDate: "",
                                  sortBy: "terbaru",
                                })
                              }
                              className="self-end bg-rose-50 text-rose-600 px-4 py-2 text-[10px] font-black rounded-xl hover:bg-rose-100 uppercase tracking-widest transition-all mb-0.5"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                        <div className="text-center py-20 text-slate-400 font-bold italic">
                          Belum ada tugas yang dikerjakan pada rentang ini.
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-4 mb-6 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Dari Tanggal
                          </label>
                          <input
                            type="date"
                            value={deletedTailorFilter.fromDate}
                            onChange={(e) =>
                              setDeletedTailorFilter({
                                ...deletedTailorFilter,
                                fromDate: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all"
                          />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Sampai Tanggal
                          </label>
                          <input
                            type="date"
                            value={deletedTailorFilter.toDate}
                            onChange={(e) =>
                              setDeletedTailorFilter({
                                ...deletedTailorFilter,
                                toDate: e.target.value,
                              })
                            }
                            className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all"
                          />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                            Urutkan
                          </label>
                          <select
                            value={deletedTailorFilter.sortBy}
                            onChange={(e) =>
                              setDeletedTailorFilter({
                                ...deletedTailorFilter,
                                sortBy: e.target.value as "terbaru" | "terlama",
                              })
                            }
                            className="w-full bg-slate-50 border-0 rounded-xl px-4 py-2 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-slate-200 transition-all"
                          >
                            <option value="terbaru">Terbaru</option>
                            <option value="terlama">Terlama</option>
                          </select>
                        </div>
                        {(deletedTailorFilter.fromDate ||
                          deletedTailorFilter.toDate ||
                          deletedTailorFilter.sortBy !== "terbaru") && (
                          <button
                            onClick={() =>
                              setDeletedTailorFilter({
                                fromDate: "",
                                toDate: "",
                                sortBy: "terbaru",
                              })
                            }
                            className="self-end bg-rose-50 text-rose-600 px-4 py-2 text-[10px] font-black rounded-xl hover:bg-rose-100 uppercase tracking-widest transition-all mb-0.5"
                          >
                            Reset
                          </button>
                        )}
                      </div>

                      <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest pl-2 border-l-4 border-rose-500">
                        History Pekerjaan
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tailorJobs.map((j) => {
                          const progress = Math.round(
                            (j.qtySubmitted / j.qtyTaken) * 100
                          );
                          const jobSubs = submissions.filter(
                            (s) => s.jobId === j.id
                          );
                          const totallyPaid =
                            jobSubs.length > 0 &&
                            jobSubs.every((s) => s.isPaid);
                          const partiallyPaid =
                            !totallyPaid && jobSubs.some((s) => s.isPaid);

                          let paidBadge = null;
                          if (totallyPaid) {
                            paidBadge = (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">
                                Gaji Lunas
                              </span>
                            );
                          } else if (partiallyPaid) {
                            paidBadge = (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 border border-sky-200">
                                Gaji Sebagian
                              </span>
                            );
                          } else if (jobSubs.length > 0) {
                            paidBadge = (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                                Belum Dibayar
                              </span>
                            );
                          } else {
                            paidBadge = (
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                                Belum Ada Setoran
                              </span>
                            );
                          }

                          return (
                            <div
                              key={j.id}
                              className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow transition-all relative"
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <span className="text-[9px] font-black tracking-widest text-slate-400 uppercase">
                                    {formatDate(j.dateTaken)}
                                  </span>
                                  <h5 className="font-black text-slate-900 tracking-tight mt-1">
                                    {getPoItemLabel(j.poItemId)}
                                  </h5>
                                  <div className="mt-1.5">{paidBadge}</div>
                                </div>
                                <span
                                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${j.status === "Selesai" ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"}`}
                                >
                                  {j.status}
                                </span>
                              </div>
                              {j.productionNumber && (
                                <div className="mb-4 text-xs font-bold text-slate-500 p-2 bg-slate-50 rounded-xl inline-block">
                                  No. Produksi:{" "}
                                  <span className="text-slate-900">
                                    {j.productionNumber}
                                  </span>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="bg-indigo-50/50 p-3 rounded-2xl border border-indigo-50/50">
                                  <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">
                                    Upah/Pcs
                                  </span>
                                  <span className="font-black text-indigo-700">
                                    Rp {j.wagePerPcs.toLocaleString("id-ID")}
                                  </span>
                                </div>
                                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-50/50">
                                  <span className="block text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-1">
                                    Pencapaian
                                  </span>
                                  <span className="font-black text-emerald-700">
                                    {j.qtySubmitted} / {j.qtyTaken}
                                  </span>
                                </div>
                              </div>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${progress >= 100 ? "bg-emerald-500" : "bg-amber-400"}`}
                                  style={{ width: `${progress}%` }}
                                ></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
