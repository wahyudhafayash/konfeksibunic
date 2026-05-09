import { useState } from "react";
import {
  db,
  useLiveQuery,
  Tailor,
  SewingJob,
  SewingSubmission,
  Kasbon,
  ManualAdjustment,
} from "@/lib/db";
import {
  UserPlus,
  Save,
  Scissors,
  CheckCircle2,
  ChevronRight,
  FileOutput,
  FilePlus2,
  X,
  Search,
  Edit2,
  Trash2,
  Banknote,
  Calculator,
  Download,
  Calendar,
  User,
  Phone,
  MapPin,
  Activity,
  Package,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TailorView({
  currentUsername,
  userRole,
}: {
  currentUsername?: string;
  userRole?: string;
}) {
  const tailors =
    useLiveQuery(() => db.tailors.orderBy("id").reverse().toArray(), []) || [];
  const poItems = useLiveQuery(() => db.poItems.toArray(), []) || [];
  const pos = useLiveQuery(() => db.pos.toArray(), []) || [];
  const jobs =
    useLiveQuery(() => db.sewingJobs.orderBy("id").reverse().toArray(), []) ||
    [];
  const submissions =
    useLiveQuery(() => db.sewingSubmissions.toArray(), []) || [];

  const [activeTailor, setActiveTailor] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [tailorToDelete, setTailorToDelete] = useState<Tailor | null>(null);

  // Formulir Penjahit
  const [isTailorFormOpen, setIsTailorFormOpen] = useState(false);
  const [tailorForm, setTailorForm] = useState<Partial<Tailor>>({
    name: "",
    partnerName: "",
    phone: "",
    address: "",
  });
  const [editTailorId, setEditTailorId] = useState<number | null>(null);

  // Formulir Ambil Jahitan
  const [isTakeJobOpen, setIsTakeJobOpen] = useState(false);
  const [takeJobForm, setTakeJobForm] = useState({
    poItemId: 0,
    qtyTaken: 0,
    wagePerPcs: 0,
    tabunganPerPcs: 0,
    productionNumber: "",
  });

  // Formulir Setor Jahitan
  const [isSubmitJobOpen, setIsSubmitJobOpen] = useState(false);
  const [submitJobForm, setSubmitJobForm] = useState<{
    jobId: number;
    qtySubmitted: number;
    partType: "Set" | "Inner" | "Outer";
  }>({ jobId: 0, qtySubmitted: 0, partType: "Set" });

  // Formulir Kasbon
  const [isKasbonFormOpen, setIsKasbonFormOpen] = useState(false);
  const [kasbonForm, setKasbonForm] = useState({ amount: 0, notes: "" });

  // Formulir Edit Manual Gaji
  const [isManualAdjustmentOpen, setIsManualAdjustmentOpen] = useState(false);
  const [manualAdjustmentForm, setManualAdjustmentForm] = useState({
    amount: 0,
    notes: "",
  });

  const [showAllJobsHistory, setShowAllJobsHistory] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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

  async function handleSaveTailor(e: React.FormEvent) {
    e.preventDefault();
    if (!tailorForm.name) return;
    if (editTailorId) {
      await db.tailors.update(editTailorId, {
        ...tailorForm,
        updatedBy: currentUsername,
      });
    } else {
      await db.tailors.add({
        ...tailorForm,
        createdBy: currentUsername,
      } as Tailor);
    }
    setIsTailorFormOpen(false);
    setEditTailorId(null);
    setTailorForm({ name: "", partnerName: "", phone: "", address: "" });
  }

  function editTailor(t: Tailor) {
    setEditTailorId(t.id!);
    setTailorForm(t);
    setIsTailorFormOpen(true);
  }

  async function deleteTailor(id: number, e: React.MouseEvent) {
    if (e) e.stopPropagation();
    const tailor = tailors.find((t) => t.id === id);
    if (tailor) setTailorToDelete(tailor);
  }

  async function confirmDeleteTailor() {
    if (!tailorToDelete) return;
    try {
      await db.archiveTailors.add({
        originalId: tailorToDelete.id!,
        data: tailorToDelete,
        archivedAt: new Date().toISOString(),
        archivedBy: currentUsername || "System",
      });
      await db.tailors.update(tailorToDelete.id!, { status: "Dihapus" });
      if (activeTailor === tailorToDelete.id!) setActiveTailor(null);
    } catch (error) {
      console.error(error);
    }
    setTailorToDelete(null);
  }

  async function handleTakeJob(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTailor) return;
    if (!takeJobForm.poItemId)
      return alert("Silakan pilih item PO (Sisa Bahan) terlebih dahulu.");
    if (takeJobForm.qtyTaken <= 0)
      return alert("Kuantitas ambil harus lebih dari 0.");

    const poItem = poItems.find((i) => i.id === takeJobForm.poItemId);
    const existingJobsForItem = jobs.filter(
      (j) => j.poItemId === takeJobForm.poItemId
    );
    const totalTaken = existingJobsForItem.reduce(
      (sum, j) => sum + j.qtyTaken,
      0
    );

    if (poItem && totalTaken + takeJobForm.qtyTaken > poItem.qty) {
      const remaining = poItem.qty - totalTaken;
      return alert(
        `Stok tidak mencukupi!\nTotal PO: ${poItem.qty}\nSudah diambil: ${totalTaken}\nTersisa: ${remaining < 0 ? 0 : remaining}`
      );
    }

    await db.sewingJobs.add({
      tailorId: activeTailor,
      tailorName: selectedTailor?.name,
      poItemId: takeJobForm.poItemId,
      qtyTaken: takeJobForm.qtyTaken,
      qtySubmitted: 0,
      wagePerPcs: takeJobForm.wagePerPcs,
      tabunganPerPcs: takeJobForm.tabunganPerPcs || 0,
      dateTaken: new Date().toISOString(),
      productionNumber: takeJobForm.productionNumber,
      status: "Proses",
      createdBy: currentUsername,
    });
    setIsTakeJobOpen(false);
    setTakeJobForm({
      poItemId: 0,
      qtyTaken: 0,
      wagePerPcs: 0,
      tabunganPerPcs: 0,
      productionNumber: "",
    });
  }

  async function handleSubmitJob(e: React.FormEvent) {
    e.preventDefault();
    if (!submitJobForm.jobId || submitJobForm.qtySubmitted <= 0) return;

    const job = jobs.find((j) => j.id === submitJobForm.jobId);
    if (!job) return;

    const jobSubs = submissions.filter((s) => s.jobId === job.id);
    const prevSet = jobSubs
      .filter((s) => !s.partType || s.partType === "Set")
      .reduce((a, s) => a + s.qtySubmitted, 0);
    const prevInner =
      jobSubs
        .filter((s) => s.partType === "Inner")
        .reduce((a, s) => a + s.qtySubmitted, 0) + prevSet;
    const prevOuter =
      jobSubs
        .filter((s) => s.partType === "Outer")
        .reduce((a, s) => a + s.qtySubmitted, 0) + prevSet;

    const remInner = job.qtyTaken - prevInner;
    const remOuter = job.qtyTaken - prevOuter;

    if (
      submitJobForm.partType === "Set" &&
      submitJobForm.qtySubmitted > Math.min(remInner, remOuter)
    ) {
      return alert(
        `Jumlah setor Set (${submitJobForm.qtySubmitted}) melebihi sisa (Inner: ${remInner}, Outer: ${remOuter}).`
      );
    } else if (
      submitJobForm.partType === "Inner" &&
      submitJobForm.qtySubmitted > remInner
    ) {
      return alert(
        `Jumlah setor Inner (${submitJobForm.qtySubmitted}) melebihi sisa (${remInner}).`
      );
    } else if (
      submitJobForm.partType === "Outer" &&
      submitJobForm.qtySubmitted > remOuter
    ) {
      return alert(
        `Jumlah setor Outer (${submitJobForm.qtySubmitted}) melebihi sisa (${remOuter}).`
      );
    }

    const multiplier = submitJobForm.partType === "Set" ? 1 : 0.5;
    const wageTotal = submitJobForm.qtySubmitted * multiplier * job.wagePerPcs;
    const tabunganTotal =
      submitJobForm.qtySubmitted * multiplier * (job.tabunganPerPcs || 0);

    await db.sewingSubmissions.add({
      jobId: job.id!,
      tailorId: job.tailorId,
      tailorName: selectedTailor?.name,
      qtySubmitted: submitJobForm.qtySubmitted,
      partType: submitJobForm.partType,
      wageTotal: wageTotal,
      tabunganTotal: tabunganTotal,
      dateSubmitted: new Date().toISOString(),
      isPaid: false,
      createdBy: currentUsername,
    });

    const newQty = job.qtySubmitted + submitJobForm.qtySubmitted * multiplier;

    await db.sewingJobs.update(job.id!, {
      qtySubmitted: newQty,
      status: newQty >= job.qtyTaken ? "Selesai" : "Proses",
      updatedBy: currentUsername,
    });

    setIsSubmitJobOpen(false);
    setSubmitJobForm({ jobId: 0, qtySubmitted: 0, partType: "Set" });
  }

  async function handleAddKasbon(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTailor || kasbonForm.amount <= 0) return;
    await db.kasbons.add({
      tailorId: activeTailor,
      tailorName: selectedTailor?.name,
      amount: kasbonForm.amount,
      notes: kasbonForm.notes,
      date: new Date().toISOString(),
      isPaid: false,
      createdBy: currentUsername,
    });
    setIsKasbonFormOpen(false);
    setKasbonForm({ amount: 0, notes: "" });
  }

  async function handleAddManualAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTailor || !manualAdjustmentForm.amount) return;
    await db.manualAdjustments.add({
      tailorId: activeTailor,
      tailorName: selectedTailor?.name,
      amount: manualAdjustmentForm.amount,
      notes: manualAdjustmentForm.notes || "",
      date: new Date().toISOString(),
      isPaid: false,
      createdBy: currentUsername,
    } as ManualAdjustment);
    setIsManualAdjustmentOpen(false);
    setManualAdjustmentForm({ amount: 0, notes: "" });
  }

  const handleExportJobsCSV = () => {
    if (!selectedTailor || tailorJobs.length === 0) return;

    const headers = [
      "Tanggal Ambil",
      "PO / Barang",
      "Qty Ambil",
      "Qty Setor",
      "Upah/Pcs",
      "Tabungan/Pcs",
      "Status",
    ];
    const rows = tailorJobs.map((j) => [
      new Date(j.dateTaken).toLocaleDateString("id-ID"),
      getPoItemLabel(j.poItemId),
      j.qtyTaken,
      j.qtySubmitted,
      j.wagePerPcs,
      j.tabunganPerPcs,
      j.status,
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `Pekerjaan_${selectedTailor.name}_${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const selectedTailor = tailors.find((t) => t.id === activeTailor);
  const tailorJobs = jobs.filter(
    (j) => j.tailorId === activeTailor && isWithinDateRange(j.dateTaken)
  );
  const filteredTailors = tailors.filter(
    (t) =>
      t.status !== "Dihapus" &&
      ((t.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.partnerName || "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function getPoItemLabel(poItemId: number) {
    const item = poItems.find((i) => i.id === poItemId);
    if (!item) return "Unknown";
    const po = pos.find((p) => p.id === item.poId);
    return `${po?.poNumber || "?"} - ${item.itemName} (${item.color}, ${item.size})`;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 lg:gap-6 h-full min-h-full max-h-full relative overflow-hidden">
      {/* Kiri: Daftar Penjahit (Hidden on mobile when a tailor is selected) */}
      <div
        className={`${activeTailor ? "hidden md:flex" : "flex"} w-full md:w-80 lg:w-96 flex-col h-full overflow-y-auto shrink-0 transition-all custom-scrollbar pr-2 pb-24`}
      >
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              SDM Penjahit
            </h2>
            <button
              onClick={() => {
                setEditTailorId(null);
                setTailorForm({
                  name: "",
                  partnerName: "",
                  phone: "",
                  address: "",
                });
                setIsTailorFormOpen(true);
              }}
              className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg shadow-slate-900/10 hover:bg-indigo-600 transition-all active:scale-95"
            >
              <UserPlus size={20} />
            </button>
          </div>

          <div className="relative group">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors"
            />
            <input
              type="text"
              placeholder="Cari penjahit..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 focus:outline-none transition-all shadow-sm"
            />
          </div>
        </div>

        <AnimatePresence>
          {isTailorFormOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-6 bg-indigo-50/50 rounded-3xl border-2 border-indigo-100 mb-6 space-y-4"
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-indigo-900 uppercase tracking-widest">
                  {editTailorId ? "MODIFIKASI DATA" : "PENJAHIT BARU"}
                </span>
                <button
                  onClick={() => setIsTailorFormOpen(false)}
                  className="text-indigo-400 hover:text-indigo-900"
                >
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handleSaveTailor} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={tailorForm.name}
                    onChange={(e) =>
                      setTailorForm({ ...tailorForm, name: e.target.value })
                    }
                    className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                    Nama Partner
                  </label>
                  <input
                    type="text"
                    value={tailorForm.partnerName || ""}
                    onChange={(e) =>
                      setTailorForm({
                        ...tailorForm,
                        partnerName: e.target.value,
                      })
                    }
                    placeholder="Opsional"
                    className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                    WhatsApp / HP
                  </label>
                  <input
                    type="text"
                    value={tailorForm.phone}
                    onChange={(e) =>
                      setTailorForm({ ...tailorForm, phone: e.target.value })
                    }
                    className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95"
                >
                  Simpan Data
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-visible w-full pr-2 space-y-3">
          {filteredTailors.length === 0 && (
            <div className="text-center py-12 opacity-40">
              <User size={48} className="mx-auto mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">
                Kosong
              </p>
            </div>
          )}
          {filteredTailors.map((t) => (
            <motion.div
              layout
              key={t.id}
              onClick={() => setActiveTailor(t.id!)}
              className={`group relative p-5 rounded-[2rem] border transition-all cursor-pointer ${activeTailor === t.id ? "bg-slate-900 border-slate-900 shadow-xl shadow-slate-900/20" : "bg-white border-slate-100 hover:border-indigo-100"}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={`font-black tracking-tight ${activeTailor === t.id ? "text-white" : "text-slate-900"}`}
                    >
                      {t.name}
                    </p>
                    {t.partnerName && (
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${activeTailor === t.id ? "bg-white/10 text-white/60" : "bg-slate-100 text-slate-400"}`}
                      >
                        & {t.partnerName}
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-xs font-bold flex items-center justify-between gap-1.5 ${activeTailor === t.id ? "text-white/60" : "text-slate-400"}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <Phone size={12} /> {t.phone || "No Phone"}
                    </span>
                    {(t.createdBy || t.updatedBy) && (
                      <span className="text-[8px] font-black italic uppercase">
                        By: {t.updatedBy || t.createdBy}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      editTailor(t);
                    }}
                    className={`p-2 rounded-xl transition-all ${activeTailor === t.id ? "text-white/40 hover:text-white" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"}`}
                  >
                    <Edit2 size={14} className="pointer-events-none" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => deleteTailor(t.id!, e)}
                    className={`p-2 rounded-xl transition-all ${activeTailor === t.id ? "text-white/40 hover:text-white" : "text-slate-400 hover:text-rose-600 hover:bg-rose-50"}`}
                  >
                    <Trash2 size={14} className="pointer-events-none" />
                  </button>
                </div>
              </div>
              {activeTailor === t.id && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute -right-1 top-1/2 -translate-y-1/2 w-2 h-10 bg-indigo-500 rounded-full"
                />
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Kanan: Detail Penjahit (Visible on mobile when tailor selected) */}
      <div
        className={`${activeTailor ? "flex" : "hidden md:flex"} flex-1 bg-white border border-slate-200 rounded-[3rem] shadow-sm flex-col h-full overflow-y-auto relative custom-scrollbar pb-24`}
      >
        {!activeTailor ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-300">
              <Scissors size={48} />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Kelola Aktivitas Jahit
            </h3>
            <p className="text-slate-500 font-medium mt-2 max-w-xs">
              Silakan pilih nama penjahit untuk mencatat pengambilan barang,
              setoran, atau kasbon.
            </p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full"
          >
            <div className="p-8 border-b border-slate-100 flex flex-col gap-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActiveTailor(null)}
                    className="md:hidden p-2 bg-slate-100 rounded-xl"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div>
                    <h2 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
                      {selectedTailor?.name}
                      {selectedTailor?.partnerName && (
                        <span className="text-slate-400 font-bold text-lg ml-3">
                          & {selectedTailor.partnerName}
                        </span>
                      )}
                    </h2>
                    <div className="flex items-center gap-4 mt-3">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <Phone size={14} className="text-indigo-400" />{" "}
                        {selectedTailor?.phone || "-"}
                      </span>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                        <MapPin size={14} className="text-indigo-400" />{" "}
                        {selectedTailor?.address || "Lokasi Belum Atur"}
                      </span>
                      {(selectedTailor?.createdBy ||
                        selectedTailor?.updatedBy) && (
                        <span className="text-[10px] font-black text-slate-300 italic uppercase">
                          Operator:{" "}
                          {selectedTailor?.updatedBy ||
                            selectedTailor?.createdBy}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleExportJobsCSV}
                    className="hidden sm:flex bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-bold items-center gap-2 transition-all shadow-sm active:scale-95"
                  >
                    <Download size={16} /> Cetak Laporan
                  </button>
                  <button
                    type="button"
                    onClick={(e) => deleteTailor(selectedTailor!.id!, e)}
                    className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white p-2 md:px-4 md:py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm border border-rose-100"
                    title="Hapus Penjahit"
                  >
                    <Trash2 size={16} />{" "}
                    <span className="hidden md:inline">Hapus</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-3">
                <button
                  onClick={() => setIsTakeJobOpen(true)}
                  className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-95 flex-1 lg:flex-none"
                >
                  <FilePlus2 size={18} /> Ambil Jahitan
                </button>
                <button
                  onClick={() => setIsKasbonFormOpen(true)}
                  className="bg-amber-100 text-amber-700 border border-amber-200 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-amber-200 transition-all flex items-center justify-center gap-2 flex-1 lg:flex-none"
                >
                  <Banknote size={18} /> Kasbon
                </button>
                <button
                  onClick={() => setIsManualAdjustmentOpen(true)}
                  className="bg-purple-100 text-purple-700 border border-purple-200 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-purple-200 transition-all flex items-center justify-center gap-2 flex-1 lg:flex-none"
                >
                  <Calculator size={18} /> Edit Gaji
                </button>

                <div className="lg:ml-auto flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-2xl shadow-inner w-full lg:w-auto">
                  <Calendar size={16} className="text-slate-400 ml-2" />
                  <div className="flex items-center flex-1">
                    <input
                      type="date"
                      className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full md:w-28 text-slate-600"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                    />
                    <span className="text-slate-300 mx-2">-</span>
                    <input
                      type="date"
                      className="bg-transparent border-0 p-0 text-[11px] font-black focus:ring-0 w-full md:w-28 text-slate-600"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                    />
                  </div>
                  {(fromDate || toDate) && (
                    <button
                      onClick={() => {
                        setFromDate("");
                        setToDate("");
                      }}
                      className="text-rose-500 p-1.5 hover:bg-rose-50 rounded-xl transition-colors"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-visible bg-slate-50/30 relative">
              {tailorJobs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-60">
                  <Activity size={48} className="mb-4" />
                  <p className="text-xs font-black uppercase tracking-widest">
                    Belum Ada Aktivitas Pekerjaan
                  </p>
                </div>
              ) : (
                <div className="p-8">
                  <div className="grid grid-cols-1 gap-4">
                    {tailorJobs
                      .slice(0, showAllJobsHistory ? undefined : 5)
                      .map((j) => {
                        const progress = Math.round(
                          (j.qtySubmitted / j.qtyTaken) * 100
                        );
                        const jobSubs = submissions.filter(
                          (s) => s.jobId === j.id
                        );
                        const totallyPaid =
                          jobSubs.length > 0 && jobSubs.every((s) => s.isPaid);
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
                          <motion.div
                            layout
                            key={j.id}
                            onClick={() => {
                              if (j.status !== "Selesai") {
                                setSubmitJobForm({
                                  jobId: j.id!,
                                  partType: "Set",
                                  qtySubmitted: 0,
                                });
                                setIsSubmitJobOpen(true);
                              }
                            }}
                            className={`bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group ${j.status !== "Selesai" ? "cursor-pointer hover:border-emerald-200 hover:ring-2 hover:ring-emerald-500/20" : ""}`}
                          >
                            <div className="flex flex-col lg:flex-row justify-between gap-6">
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                    {new Date(j.dateTaken).toLocaleDateString(
                                      "id-ID",
                                      { day: "numeric", month: "short" }
                                    )}
                                  </span>
                                  {j.createdBy && (
                                    <span className="text-[9px] font-bold italic text-slate-300 uppercase">
                                      By: {j.createdBy}
                                    </span>
                                  )}
                                  {paidBadge}
                                  <span
                                    className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${j.status === "Selesai" ? "bg-emerald-500 text-white border-emerald-400" : "bg-amber-100 text-amber-700 border-amber-200"}`}
                                  >
                                    {j.status}
                                  </span>
                                </div>
                                <h4 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                                  {getPoItemLabel(j.poItemId)}
                                </h4>
                                {j.productionNumber && (
                                  <div className="flex items-center gap-2 mb-3">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      No Produksi:
                                    </span>
                                    <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                                      {j.productionNumber}
                                    </span>
                                  </div>
                                )}
                                <div className="flex gap-4 items-center">
                                  <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
                                      Gaji
                                    </span>
                                    <span className="text-sm font-black text-indigo-700">
                                      Rp {j.wagePerPcs.toLocaleString("id-ID")}
                                    </span>
                                  </div>
                                  {j.tabunganPerPcs > 0 && (
                                    <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                                        Tbg
                                      </span>
                                      <span className="text-sm font-black text-emerald-700">
                                        Rp{" "}
                                        {j.tabunganPerPcs.toLocaleString(
                                          "id-ID"
                                        )}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="w-full lg:w-64 flex flex-col justify-end">
                                <div className="flex justify-between items-end mb-2">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Realisasi Kerja
                                  </p>
                                  <p className="text-sm font-black text-slate-900">
                                    <span className="text-lg">
                                      {j.qtySubmitted}
                                    </span>{" "}
                                    / {j.qtyTaken}{" "}
                                    <span className="text-[10px] text-slate-400 font-bold ml-1">
                                      PCS
                                    </span>
                                  </p>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-200/50">
                                  <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progress}%` }}
                                    className={`h-full rounded-full transition-all duration-1000 ${progress >= 100 ? "bg-gradient-to-r from-emerald-500 to-teal-400" : "bg-gradient-to-r from-amber-400 to-orange-400"}`}
                                  />
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                  {tailorJobs.length > 5 && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() =>
                          setShowAllJobsHistory(!showAllJobsHistory)
                        }
                        className="bg-white border-2 border-slate-100 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                      >
                        {showAllJobsHistory
                          ? "Sembunyikan"
                          : "Lihat Semua History"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Overlays for forms */}
            <AnimatePresence>
              {(isTakeJobOpen ||
                isSubmitJobOpen ||
                isKasbonFormOpen ||
                isManualAdjustmentOpen) && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] z-20 flex items-start sm:items-center justify-center p-6 pt-8 sm:pt-6"
                >
                  <motion.div
                    initial={{ scale: 0.95, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
                  >
                    {/* Form Header */}
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-black text-slate-900 tracking-tight text-xl uppercase">
                        {isTakeJobOpen && "Ambil Jahitan"}
                        {isSubmitJobOpen && "Setor Selesai"}
                        {isKasbonFormOpen && "Catat Kasbon"}
                        {isManualAdjustmentOpen && "Edit Manual Gaji"}
                      </h3>
                      <button
                        onClick={() => {
                          setIsTakeJobOpen(false);
                          setIsSubmitJobOpen(false);
                          setIsKasbonFormOpen(false);
                          setIsManualAdjustmentOpen(false);
                        }}
                        className="text-slate-400 hover:text-slate-900 bg-white p-2 rounded-xl border border-slate-100 shadow-sm"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-8 overflow-y-auto custom-scrollbar">
                      {isTakeJobOpen && (
                        <form onSubmit={handleTakeJob} className="space-y-6">
                          <div className="space-y-3">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Pilih Item PO (Sisa Bahan)
                            </label>
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                              {poItems.map((item) => {
                                const po = pos.find((p) => p.id === item.poId);
                                if (
                                  !po ||
                                  !["Proses", "Aktif", "Siap Kirim"].includes(
                                    po.status
                                  )
                                )
                                  return null;
                                const taken = jobs
                                  .filter((j) => j.poItemId === item.id)
                                  .reduce((sum, j) => sum + j.qtyTaken, 0);
                                const remaining = item.qty - taken;
                                if (remaining <= 0) return null;

                                const isSelected =
                                  takeJobForm.poItemId === item.id;

                                return (
                                  <motion.div
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    key={item.id}
                                    onClick={() =>
                                      setTakeJobForm({
                                        ...takeJobForm,
                                        poItemId: item.id!,
                                      })
                                    }
                                    className={`flex items-center gap-4 p-5 rounded-3xl border-2 transition-all cursor-pointer ${isSelected ? "bg-indigo-50 border-indigo-500 ring-4 ring-indigo-50" : "bg-slate-50 border-slate-100 hover:border-indigo-200"}`}
                                  >
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate mb-0.5">
                                        {po.poNumber}
                                      </p>
                                      <h4 className="text-base font-black text-slate-900 truncate tracking-tight">
                                        {item.itemName}
                                      </h4>
                                      <div className="flex gap-2 mt-1">
                                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-500 uppercase">
                                          {item.color}
                                        </span>
                                        <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-500 uppercase">
                                          {item.size}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">
                                        Sisa
                                      </p>
                                      <p className="text-xl font-black text-slate-900 leading-none">
                                        {remaining}{" "}
                                        <span className="text-[10px] text-slate-400">
                                          pcs
                                        </span>
                                      </p>
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                Kuantitas Ambil
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={takeJobForm.qtyTaken || ""}
                                onChange={(e) =>
                                  setTakeJobForm({
                                    ...takeJobForm,
                                    qtyTaken: Number(e.target.value),
                                  })
                                }
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none"
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                No Produksi
                              </label>
                              <input
                                type="text"
                                value={takeJobForm.productionNumber}
                                onChange={(e) =>
                                  setTakeJobForm({
                                    ...takeJobForm,
                                    productionNumber: e.target.value,
                                  })
                                }
                                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none"
                                placeholder="Ex: PRD-001"
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Upah/Pcs (Rp)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={takeJobForm.wagePerPcs || ""}
                              onChange={(e) =>
                                setTakeJobForm({
                                  ...takeJobForm,
                                  wagePerPcs: Number(e.target.value),
                                })
                              }
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] font-black text-emerald-500 uppercase tracking-widest">
                              Setoran Tabungan/Pcs (Rp)
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={takeJobForm.tabunganPerPcs || ""}
                              onChange={(e) =>
                                setTakeJobForm({
                                  ...takeJobForm,
                                  tabunganPerPcs: Number(e.target.value),
                                })
                              }
                              className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-emerald-500 focus:outline-none"
                              placeholder="Opsional"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-slate-900 text-white font-black py-4 rounded-3xl hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95 uppercase tracking-widest text-xs mt-4"
                          >
                            Simpan Pekerjaan
                          </button>
                        </form>
                      )}

                      {isSubmitJobOpen && (
                        <form onSubmit={handleSubmitJob} className="space-y-6">
                          <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Job yang Disetor
                            </label>
                            <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold text-slate-700">
                              {(() => {
                                const j = tailorJobs.find(
                                  (x) => x.id === submitJobForm.jobId
                                );
                                if (!j) return "-";
                                const jobSubs = submissions.filter(
                                  (s) => s.jobId === j.id
                                );
                                const prevSet = jobSubs
                                  .filter(
                                    (s) => !s.partType || s.partType === "Set"
                                  )
                                  .reduce((a, s) => a + s.qtySubmitted, 0);
                                const prevInner =
                                  jobSubs
                                    .filter((s) => s.partType === "Inner")
                                    .reduce((a, s) => a + s.qtySubmitted, 0) +
                                  prevSet;
                                const prevOuter =
                                  jobSubs
                                    .filter((s) => s.partType === "Outer")
                                    .reduce((a, s) => a + s.qtySubmitted, 0) +
                                  prevSet;
                                const remInner = j.qtyTaken - prevInner;
                                const remOuter = j.qtyTaken - prevOuter;
                                return `${getPoItemLabel(j.poItemId)} - Sisa (I: ${remInner}, O: ${remOuter})`;
                              })()}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Kuantitas Setoran
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="number"
                                min="1"
                                value={submitJobForm.qtySubmitted || ""}
                                onChange={(e) =>
                                  setSubmitJobForm({
                                    ...submitJobForm,
                                    qtySubmitted: Number(e.target.value),
                                  })
                                }
                                className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-emerald-500 focus:outline-none"
                                placeholder="Berapa pcs?"
                                required
                              />
                              <select
                                value={submitJobForm.partType}
                                onChange={(e) =>
                                  setSubmitJobForm({
                                    ...submitJobForm,
                                    partType: e.target.value as any,
                                  })
                                }
                                className="bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-bold focus:bg-white focus:border-emerald-500 focus:outline-none"
                              >
                                <option value="Set">Set</option>
                                <option value="Inner">Inner</option>
                                <option value="Outer">Outer</option>
                              </select>
                            </div>
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-emerald-600 text-white font-black py-4 rounded-3xl hover:bg-slate-900 transition-all shadow-xl shadow-emerald-500/10 active:scale-95 uppercase tracking-widest text-xs mt-4"
                          >
                            Konfirmasi Setoran
                          </button>
                        </form>
                      )}

                      {isKasbonFormOpen && (
                        <form onSubmit={handleAddKasbon} className="space-y-6">
                          <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Total Pinjaman (Rp)
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={kasbonForm.amount || ""}
                              onChange={(e) =>
                                setKasbonForm({
                                  ...kasbonForm,
                                  amount: Number(e.target.value),
                                })
                              }
                              className="w-full bg-amber-50 border-2 border-amber-100 rounded-2xl px-5 py-3 text-xl font-black text-amber-900 focus:bg-white focus:border-amber-500 focus:outline-none transition-all"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Tujuan / Catatan
                            </label>
                            <input
                              type="text"
                              value={kasbonForm.notes}
                              onChange={(e) =>
                                setKasbonForm({
                                  ...kasbonForm,
                                  notes: e.target.value,
                                })
                              }
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white focus:border-amber-500 focus:outline-none"
                              placeholder="Misal: Kebutuhan keluarga"
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-amber-500 text-white font-black py-4 rounded-3xl hover:bg-slate-900 transition-all shadow-xl shadow-amber-500/10 active:scale-95 uppercase tracking-widest text-xs mt-4"
                          >
                            Bukukan Kasbon
                          </button>
                        </form>
                      )}

                      {isManualAdjustmentOpen && (
                        <form
                          onSubmit={handleAddManualAdjustment}
                          className="space-y-6"
                        >
                          <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Nominal Penyesuaian (Rp)
                            </label>
                            <input
                              type="number"
                              value={manualAdjustmentForm.amount || ""}
                              onChange={(e) =>
                                setManualAdjustmentForm({
                                  ...manualAdjustmentForm,
                                  amount: Number(e.target.value),
                                })
                              }
                              className="w-full bg-purple-50 border-2 border-purple-100 rounded-2xl px-5 py-3 text-xl font-black text-purple-900 focus:bg-white focus:border-purple-500 focus:outline-none"
                              required
                              placeholder="Gunakan minus (-) untuk memotong"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                              Penjelasan
                            </label>
                            <input
                              type="text"
                              value={manualAdjustmentForm.notes}
                              onChange={(e) =>
                                setManualAdjustmentForm({
                                  ...manualAdjustmentForm,
                                  notes: e.target.value,
                                })
                              }
                              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white focus:border-purple-500 focus:outline-none"
                              placeholder="Alasan edit manual..."
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            className="w-full bg-purple-600 text-white font-black py-4 rounded-3xl hover:bg-slate-900 transition-all shadow-xl shadow-purple-600/10 active:scale-95 uppercase tracking-widest text-xs mt-4"
                          >
                            Simpan Perubahan
                          </button>
                        </form>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Tailor Delete Modal */}
      <AnimatePresence>
        {tailorToDelete && (
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
              <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">
                Hapus Penjahit?
              </h3>
              <p className="text-sm font-medium text-slate-500 mb-8">
                Apakah Anda yakin ingin menghapus penjahit{" "}
                <span className="font-bold text-slate-900">
                  {tailorToDelete.name}
                </span>
                ? Semua data pekerjaan yang terkait di database mungkin akan
                terpengaruh.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setTailorToDelete(null)}
                  className="flex-1 px-4 py-3.5 rounded-2xl text-slate-500 font-bold bg-slate-50 hover:bg-slate-100 transition-colors active:scale-95 text-sm"
                >
                  Batal
                </button>
                <button
                  onClick={confirmDeleteTailor}
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
  );
}
