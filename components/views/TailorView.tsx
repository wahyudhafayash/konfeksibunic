import { useState } from 'react';
import {
  db,
  useLiveQuery,
  Tailor,
  SewingJob,
  SewingSubmission,
  Kasbon,
  ManualAdjustment,
  SubmissionPartType,
  getPOItemPricing,
  getWageForPart,
  getPartOptionsForSetType,
  getSubmissionNominalQty
} from '@/lib/db';
import { UserPlus, Save, Scissors, CheckCircle2, ChevronRight, FileOutput, FilePlus2, X, Search, Edit2, Trash2, Banknote, Calculator, Download, Calendar, User, Phone, MapPin, Activity, Package, ArrowLeft, PiggyBank, Loader2, AlertCircle, History, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TailorView({ currentUsername, userRole, onNavigate }: { currentUsername?: string, userRole?: string, onNavigate?: (tab: string) => void }) {
  const tailors = useLiveQuery(() => db.tailors.orderBy('id').reverse().toArray(), []) || [];
  const poItems = useLiveQuery(() => db.poItems.toArray(), []) || [];
  const pos = useLiveQuery(() => db.pos.toArray(), []) || [];
  const jobs = useLiveQuery(() => db.sewingJobs.orderBy('id').reverse().toArray(), []) || [];
  const submissions = useLiveQuery(() => db.sewingSubmissions.toArray(), []) || [];

  const [activeTailor, setActiveTailor] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [tailorToDelete, setTailorToDelete] = useState<Tailor | null>(null);
  const [submittingAction, setSubmittingAction] = useState<string | null>(null);
  const isBusy = submittingAction !== null;

  // Modal Notifikasi / Alert Pengganti window.alert
  const [modalAlert, setModalAlert] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'confirm' | 'info';
    showCheckHistory?: boolean;
    onConfirm?: () => void;
    confirmLabel?: string;
  }>({ isOpen: false, title: '', message: '', type: 'success' });

  // Modal Konfirmasi Tambahan sebelum aksi penting
  const [confirmActionModal, setConfirmActionModal] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    color?: 'indigo' | 'emerald' | 'amber' | 'purple';
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Formulir Penjahit (Nomor Produksi terdaftar di setiap penjahit)
  const [isTailorFormOpen, setIsTailorFormOpen] = useState(false);
  const [tailorForm, setTailorForm] = useState<Partial<Tailor>>({ name: '', productionNumber: '', partnerName: '', partnerCount: 0, phone: '', address: '' });
  const [editTailorId, setEditTailorId] = useState<number | null>(null);

  // Formulir Ambil Jahitan (Upah, Tabungan & No Produksi otomatis)
  const [isTakeJobOpen, setIsTakeJobOpen] = useState(false);
  const [takeJobForm, setTakeJobForm] = useState({ poItemId: 0, qtyTaken: 0 });

  // Formulir Setor Jahitan
  const [isSubmitJobOpen, setIsSubmitJobOpen] = useState(false);
  const [submitJobForm, setSubmitJobForm] = useState<{jobId: number, qtySubmitted: number, partType: SubmissionPartType}>({ jobId: 0, qtySubmitted: 0, partType: 'Set' });

  // Formulir Transfer Job
  const [isTransferJobOpen, setIsTransferJobOpen] = useState(false);
  const [transferJobForm, setTransferJobForm] = useState<{jobId: number, targetTailorId: number|'', qtyToTransfer: number, partType: SubmissionPartType}>({ jobId: 0, targetTailorId: '', qtyToTransfer: 0, partType: 'Outer' });

  // Formulir Kasbon
  const [isKasbonFormOpen, setIsKasbonFormOpen] = useState(false);
  const [kasbonForm, setKasbonForm] = useState({ amount: 0, notes: '' });

  // Formulir Edit Manual Gaji
  const [isManualAdjustmentOpen, setIsManualAdjustmentOpen] = useState(false);
  const [manualAdjustmentForm, setManualAdjustmentForm] = useState({ amount: 0, notes: '' });

  const [showAllJobsHistory, setShowAllJobsHistory] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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

  function getJobRemainingInfo(job: SewingJob) {
    const poItem = poItems.find(i => i.id === job.poItemId);
    const po = pos.find(p => p.id === poItem?.poId);
    const pricing = getPOItemPricing(po, poItem, job);
    const jobSubs = submissions.filter(s => s.jobId === job.id);
    const nominalTarget = job.nominalQtyTaken !== undefined ? Number(job.nominalQtyTaken) : Number(job.qtyTaken);

    if (job.assignedPart && job.assignedPart !== 'Set') {
      const submittedNominal = jobSubs.reduce((sum, s) => sum + getSubmissionNominalQty(s), 0);
      const transferredOut = (job.transferredAtasan || 0) + (job.transferredBawahan || 0) + (job.transferredInner || 0) + (job.transferredOuter || 0) + (job.transferredSet || 0);
      const remAssigned = Math.max(0, nominalTarget - transferredOut - submittedNominal);
      return {
        pricing,
        isAssignedPartial: true,
        assignedPart: job.assignedPart,
        nominalTarget,
        remSet: 0,
        remInner: job.assignedPart.includes('Inner') ? remAssigned : 0,
        remOuter: job.assignedPart.includes('Outer') ? remAssigned : 0,
        remAtasan: job.assignedPart === 'Atasan' ? remAssigned : 0,
        remBawahan: job.assignedPart.includes('Bawahan') ? remAssigned : 0,
        remAssigned,
        summaryText: `Sisa ${job.assignedPart}: ${remAssigned} pcs`,
        maxForPart: (_pt: SubmissionPartType) => remAssigned,
        allDone: remAssigned <= 0
      };
    }

    const subSet = jobSubs.filter(s => !s.partType || s.partType === 'Set').reduce((a, s) => a + getSubmissionNominalQty(s), 0);
    const subInner = jobSubs.filter(s => s.partType === 'Inner' || s.partType === 'Inner & Outer' || s.partType === 'Inner & Bawahan').reduce((a, s) => a + getSubmissionNominalQty(s), 0) + subSet;
    const subOuter = jobSubs.filter(s => s.partType === 'Outer' || s.partType === 'Inner & Outer' || s.partType === 'Outer & Bawahan').reduce((a, s) => a + getSubmissionNominalQty(s), 0) + subSet;
    const subAtasan = jobSubs.filter(s => s.partType === 'Atasan').reduce((a, s) => a + getSubmissionNominalQty(s), 0) + subSet;
    const subBawahan = jobSubs.filter(s => s.partType === 'Bawahan' || s.partType === 'Inner & Bawahan' || s.partType === 'Outer & Bawahan').reduce((a, s) => a + getSubmissionNominalQty(s), 0) + subSet;

    const transSet = Number(job.transferredSet) || 0;
    const transInner = (Number(job.transferredInner) || 0) + transSet;
    const transOuter = (Number(job.transferredOuter) || 0) + transSet;
    const transAtasan = (Number(job.transferredAtasan) || 0) + transSet;
    const transBawahan = (Number(job.transferredBawahan) || 0) + transSet;

    const remInner = Math.max(0, nominalTarget - transInner - subInner);
    const remOuter = Math.max(0, nominalTarget - transOuter - subOuter);
    const remAtasan = Math.max(0, nominalTarget - transAtasan - subAtasan);
    const remBawahan = Math.max(0, nominalTarget - transBawahan - subBawahan);

    let remSet = 0;
    let summaryText = '';
    let allDone = false;

    if (pricing.setType === 'Inner & Outer') {
      remSet = Math.min(remInner, remOuter);
      summaryText = `Sisa (Inner: ${remInner}, Outer: ${remOuter})`;
      allDone = remInner <= 0 && remOuter <= 0;
    } else if (pricing.setType === 'Atasan & Bawahan') {
      remSet = Math.min(remAtasan, remBawahan);
      summaryText = `Sisa (Atasan: ${remAtasan}, Bawahan: ${remBawahan})`;
      allDone = remAtasan <= 0 && remBawahan <= 0;
    } else if (pricing.setType === 'Inner, Outer & Bawahan') {
      remSet = Math.min(remInner, remOuter, remBawahan);
      summaryText = `Sisa (Inner: ${remInner}, Outer: ${remOuter}, Bawahan: ${remBawahan})`;
      allDone = remInner <= 0 && remOuter <= 0 && remBawahan <= 0;
    } else {
      remSet = Math.max(0, nominalTarget - transSet - subSet);
      summaryText = `Sisa: ${remSet} Set`;
      allDone = remSet <= 0;
    }

    const maxForPart = (pt: SubmissionPartType) => {
      if (pt === 'Set') return remSet;
      if (pt === 'Inner') return remInner;
      if (pt === 'Outer') return remOuter;
      if (pt === 'Atasan') return remAtasan;
      if (pt === 'Bawahan') return remBawahan;
      if (pt === 'Inner & Outer') return Math.min(remInner, remOuter);
      if (pt === 'Inner & Bawahan') return Math.min(remInner, remBawahan);
      if (pt === 'Outer & Bawahan') return Math.min(remOuter, remBawahan);
      return remSet;
    };

    return {
      pricing,
      isAssignedPartial: false,
      assignedPart: undefined,
      nominalTarget,
      remSet,
      remInner,
      remOuter,
      remAtasan,
      remBawahan,
      remAssigned: 0,
      summaryText,
      maxForPart,
      allDone
    };
  }

  async function handleSaveTailor(e: React.FormEvent) {
    e.preventDefault();
    if (!tailorForm.name || isBusy) return;
    setSubmittingAction('saveTailor');
    try {
      const prodNum = (tailorForm.productionNumber || '').trim();
      if (editTailorId) {
        await db.tailors.update(editTailorId, {
          name: tailorForm.name,
          productionNumber: prodNum,
          partnerName: tailorForm.partnerName || '',
          partnerCount: Number(tailorForm.partnerCount) || 0,
          phone: tailorForm.phone || '',
          address: tailorForm.address || '',
          updatedBy: currentUsername
        });

        // Sinkronisasi nama & nomor produksi terbaru ke pekerjaan penjahit ini agar tetap terhubung
        const relatedJobs = jobs.filter(j => j.tailorId === editTailorId);
        if (relatedJobs.length > 0) {
          await db.sewingJobs.bulkUpdate(
            relatedJobs.map(j => ({
              key: j.id!,
              changes: {
                tailorName: tailorForm.name,
                productionNumber: j.assignedPart && j.productionNumber?.includes('Limpahan')
                  ? j.productionNumber
                  : (prodNum || j.productionNumber || '')
              }
            }))
          );
        }
      } else {
        await db.tailors.add({
          name: tailorForm.name,
          productionNumber: prodNum,
          partnerName: tailorForm.partnerName || '',
          partnerCount: Number(tailorForm.partnerCount) || 0,
          phone: tailorForm.phone || '',
          address: tailorForm.address || '',
          createdBy: currentUsername
        } as Tailor);
      }
      setIsTailorFormOpen(false);
      setEditTailorId(null);
      setTailorForm({ name: '', productionNumber: '', partnerName: '', partnerCount: 0, phone: '', address: '' });
    } catch (error) {
      setModalAlert({
        title: 'Gagal Menyimpan Data',
        message: 'Terjadi kesalahan saat menyimpan data penjahit ke database.',
        type: 'error'
      });
    } finally {
      setSubmittingAction(null);
    }
  }

  function editTailor(t: Tailor) {
     setEditTailorId(t.id!);
     setTailorForm({
       name: t.name,
       productionNumber: t.productionNumber || '',
       partnerName: t.partnerName || '',
       partnerCount: t.partnerCount || 0,
       phone: t.phone || '',
       address: t.address || ''
     });
     setIsTailorFormOpen(true);
  }

  async function deleteTailor(id: number, e: React.MouseEvent) {
     if (e) e.stopPropagation();
     const tailor = tailors.find(t => t.id === id);
     if (tailor) setTailorToDelete(tailor);
  }

  async function confirmDeleteTailor() {
     if (!tailorToDelete || isBusy) return;
     setSubmittingAction('deleteTailor');
     try {
       const deletedName = tailorToDelete.name;
       await db.archiveTailors.add({
          originalId: tailorToDelete.id!,
          data: tailorToDelete,
          archivedAt: new Date().toISOString(),
          archivedBy: currentUsername || 'System'
       });
       await db.tailors.update(tailorToDelete.id!, { status: 'Dihapus' });
       if(activeTailor === tailorToDelete.id!) setActiveTailor(null);
       setTailorToDelete(null);
       setModalAlert({
         title: 'Penjahit Dinonaktifkan',
         message: `Penjahit ${deletedName} telah dinonaktifkan dan dipindahkan ke arsip histori.`,
         type: 'success',
         showHistoryBtn: true
       });
     } catch (error) {
       console.error(error);
       setModalAlert({
         title: 'Gagal Menghapus',
         message: 'Terjadi kesalahan saat menonaktifkan penjahit.',
         type: 'error'
       });
     } finally {
       setSubmittingAction(null);
     }
  }

  async function handleTakeJob(e: React.FormEvent) {
    e.preventDefault();
    if(!activeTailor || isBusy) return;
    if(!takeJobForm.poItemId) {
      return setModalAlert({
        title: 'Pilih Item PO',
        message: 'Silakan pilih item PO (Sisa Bahan) terlebih dahulu.',
        type: 'info'
      });
    }
    if(takeJobForm.qtyTaken <= 0) {
      return setModalAlert({
        title: 'Kuantitas Tidak Valid',
        message: 'Kuantitas ambil harus lebih dari 0.',
        type: 'info'
      });
    }
    
    const poItem = poItems.find(i => i.id === takeJobForm.poItemId);
    const po = pos.find(p => p.id === poItem?.poId);
    const existingJobsForItem = jobs.filter(j => j.poItemId === takeJobForm.poItemId);
    const totalTaken = existingJobsForItem.reduce((sum, j) => sum + (Number(j.qtyTaken) || 0), 0);
    
    if (poItem && (totalTaken + takeJobForm.qtyTaken > poItem.qty)) {
       const remaining = Math.max(0, poItem.qty - totalTaken);
       return setModalAlert({
         title: 'Stok Tidak Mencukupi',
         message: `Total PO: ${poItem.qty} pcs • Sudah diambil: ${totalTaken} pcs • Tersisa: ${remaining} pcs.`,
         type: 'error'
       });
    }

    setSubmittingAction('takeJob');
    try {
      const pricing = getPOItemPricing(po, poItem);
      await db.sewingJobs.add({
         tailorId: activeTailor,
         tailorName: selectedTailor?.name,
         poItemId: takeJobForm.poItemId,
         qtyTaken: takeJobForm.qtyTaken,
         nominalQtyTaken: takeJobForm.qtyTaken,
         qtySubmitted: 0,
         wagePerPcs: pricing.totalFullWage,
         tabunganPerPcs: pricing.tabunganPerPcs,
         setType: pricing.setType,
         wageSet: pricing.wageSet,
         wageInner: pricing.wageInner,
         wageOuter: pricing.wageOuter,
         wageAtasan: pricing.wageAtasan,
         wageBawahan: pricing.wageBawahan,
         dateTaken: new Date().toISOString(),
         productionNumber: selectedTailor?.productionNumber || '',
         status: 'Proses',
         createdBy: currentUsername
      });
      setIsTakeJobOpen(false);
      setTakeJobForm({ poItemId: 0, qtyTaken: 0 });
    } catch (err) {
      setModalAlert({
        title: 'Gagal Menyimpan Pekerjaan',
        message: 'Terjadi kesalahan saat menyimpan pengambilan jahitan ke database.',
        type: 'error'
      });
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleSubmitJob(e: React.FormEvent) {
    e.preventDefault();
    if(!submitJobForm.jobId || submitJobForm.qtySubmitted <= 0 || isBusy) return;
    
    const job = jobs.find(j => j.id === submitJobForm.jobId);
    if(!job) return;

    const remInfo = getJobRemainingInfo(job);
    const maxAllowed = remInfo.maxForPart(submitJobForm.partType);

    if (submitJobForm.qtySubmitted > maxAllowed) {
       return setModalAlert({
         isOpen: true,
         title: 'Jumlah Melebihi Sisa',
         message: `Jumlah setor ${submitJobForm.partType} (${submitJobForm.qtySubmitted} pcs) melebihi sisa yang tersedia (${maxAllowed} pcs). ${remInfo.summaryText}`,
         type: 'error'
       });
    }

    setSubmittingAction('submitJob');
    try {
      const nominalQty = Number(submitJobForm.qtySubmitted);
      const multiplier = submitJobForm.partType === 'Set' ? 1 : 0.5;
      const effectiveQty = nominalQty * multiplier;
      const partWage = getWageForPart(submitJobForm.partType, remInfo.pricing);
      const wageTotal = nominalQty * partWage;
      const tabunganTotal = nominalQty * multiplier * remInfo.pricing.tabunganPerPcs;

      await db.sewingSubmissions.add({
         jobId: job.id!,
         tailorId: job.tailorId,
         tailorName: selectedTailor?.name,
         qtySubmitted: effectiveQty,
         nominalQty: nominalQty,
         partType: submitJobForm.partType,
         wageTotal: wageTotal,
         tabunganTotal: tabunganTotal,
         dateSubmitted: new Date().toISOString(),
         isPaid: false,
         createdBy: currentUsername
      });

      const newQty = Math.min(job.qtyTaken, job.qtySubmitted + effectiveQty);
      
      // Calculate whether all parts are truly finished after this submission
      let willBeDone = false;
      if (remInfo.isAssignedPartial) {
        willBeDone = (remInfo.remAssigned - nominalQty) <= 0;
      } else if (remInfo.pricing.setType === 'Inner & Outer') {
        const afterInner = remInfo.remInner - (submitJobForm.partType === 'Inner' || submitJobForm.partType === 'Set' ? nominalQty : 0);
        const afterOuter = remInfo.remOuter - (submitJobForm.partType === 'Outer' || submitJobForm.partType === 'Set' ? nominalQty : 0);
        willBeDone = afterInner <= 0 && afterOuter <= 0;
      } else if (remInfo.pricing.setType === 'Atasan & Bawahan') {
        const afterAtasan = remInfo.remAtasan - (submitJobForm.partType === 'Atasan' || submitJobForm.partType === 'Set' ? nominalQty : 0);
        const afterBawahan = remInfo.remBawahan - (submitJobForm.partType === 'Bawahan' || submitJobForm.partType === 'Set' ? nominalQty : 0);
        willBeDone = afterAtasan <= 0 && afterBawahan <= 0;
      } else if (remInfo.pricing.setType === 'Inner, Outer & Bawahan') {
        const afterInner = remInfo.remInner - (submitJobForm.partType === 'Inner' || submitJobForm.partType === 'Set' ? nominalQty : 0);
        const afterOuter = remInfo.remOuter - (submitJobForm.partType === 'Outer' || submitJobForm.partType === 'Set' ? nominalQty : 0);
        const afterBawahan = remInfo.remBawahan - (submitJobForm.partType === 'Bawahan' || submitJobForm.partType === 'Set' ? nominalQty : 0);
        willBeDone = afterInner <= 0 && afterOuter <= 0 && afterBawahan <= 0;
      } else {
        willBeDone = (remInfo.remSet - nominalQty) <= 0;
      }
      
      await db.sewingJobs.update(job.id!, {
         qtySubmitted: newQty,
         status: willBeDone ? 'Selesai' : 'Proses',
         updatedBy: currentUsername
      });

      setIsSubmitJobOpen(false);
      setSubmitJobForm({ jobId: 0, qtySubmitted: 0, partType: 'Set' });
      setModalAlert({
        isOpen: true,
        type: 'success',
        title: 'Setoran Berhasil Disimpan',
        message: `Setoran ${nominalQty} pcs (${submitJobForm.partType}) berhasil dicatat. Upah: Rp ${wageTotal.toLocaleString('id-ID')}, Tabungan: Rp ${tabunganTotal.toLocaleString('id-ID')}.`,
        showCheckHistory: true
      });
    } catch (err) {
      setModalAlert({
        isOpen: true,
        title: 'Gagal Menyimpan Setoran',
        message: 'Terjadi kesalahan saat menyimpan data setoran ke database.',
        type: 'error'
      });
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleTransferJob(e: React.FormEvent) {
    e.preventDefault();
    if(!transferJobForm.jobId || transferJobForm.targetTailorId === '' || transferJobForm.qtyToTransfer <= 0 || isBusy) return;
    
    const targetTailorIdNum = Number(transferJobForm.targetTailorId);
    const job = jobs.find(j => j.id === transferJobForm.jobId);
    const targetTailor = tailors.find(t => t.id === targetTailorIdNum);
    if(!job || !targetTailor) return;

    const remInfo = getJobRemainingInfo(job);
    const maxTransferable = remInfo.maxForPart(transferJobForm.partType);

    if (transferJobForm.qtyToTransfer > maxTransferable) {
       return setModalAlert({
         isOpen: true,
         title: 'Jumlah Melebihi Sisa',
         message: `Jumlah yang dilimpahkan (${transferJobForm.qtyToTransfer} pcs) melebihi sisa untuk bagian ${transferJobForm.partType} (${maxTransferable} pcs).`,
         type: 'error'
       });
    }

    setSubmittingAction('transferJob');
    try {
      const multiplier = transferJobForm.partType === 'Set' ? 1 : 0.5;
      const deductSet = transferJobForm.qtyToTransfer * multiplier;

      // Calculate remaining after transfer
      let isOldJobNowDone = false;
      if (remInfo.isAssignedPartial) {
        isOldJobNowDone = (remInfo.remAssigned - transferJobForm.qtyToTransfer) <= 0;
      } else if (remInfo.pricing.setType === 'Inner & Outer') {
        const afterInner = remInfo.remInner - (transferJobForm.partType === 'Inner' || transferJobForm.partType === 'Set' ? transferJobForm.qtyToTransfer : 0);
        const afterOuter = remInfo.remOuter - (transferJobForm.partType === 'Outer' || transferJobForm.partType === 'Set' ? transferJobForm.qtyToTransfer : 0);
        isOldJobNowDone = afterInner <= 0 && afterOuter <= 0;
      } else if (remInfo.pricing.setType === 'Atasan & Bawahan') {
        const afterAtasan = remInfo.remAtasan - (transferJobForm.partType === 'Atasan' || transferJobForm.partType === 'Set' ? transferJobForm.qtyToTransfer : 0);
        const afterBawahan = remInfo.remBawahan - (transferJobForm.partType === 'Bawahan' || transferJobForm.partType === 'Set' ? transferJobForm.qtyToTransfer : 0);
        isOldJobNowDone = afterAtasan <= 0 && afterBawahan <= 0;
      } else if (remInfo.pricing.setType === 'Inner, Outer & Bawahan') {
        const afterInner = remInfo.remInner - (transferJobForm.partType === 'Inner' || transferJobForm.partType === 'Set' ? transferJobForm.qtyToTransfer : 0);
        const afterOuter = remInfo.remOuter - (transferJobForm.partType === 'Outer' || transferJobForm.partType === 'Set' ? transferJobForm.qtyToTransfer : 0);
        const afterBawahan = remInfo.remBawahan - (transferJobForm.partType === 'Bawahan' || transferJobForm.partType === 'Set' ? transferJobForm.qtyToTransfer : 0);
        isOldJobNowDone = afterInner <= 0 && afterOuter <= 0 && afterBawahan <= 0;
      } else {
        isOldJobNowDone = (remInfo.remSet - transferJobForm.qtyToTransfer) <= 0;
      }
      
      const updateData: any = {
         status: isOldJobNowDone ? 'Selesai' : 'Proses',
         updatedBy: currentUsername
      };

      if (transferJobForm.partType === 'Set') {
         updateData.transferredSet = (job.transferredSet || 0) + transferJobForm.qtyToTransfer;
      } else if (transferJobForm.partType === 'Inner') {
         updateData.transferredInner = (job.transferredInner || 0) + transferJobForm.qtyToTransfer;
      } else if (transferJobForm.partType === 'Outer') {
         updateData.transferredOuter = (job.transferredOuter || 0) + transferJobForm.qtyToTransfer;
      } else if (transferJobForm.partType === 'Atasan') {
         updateData.transferredAtasan = (job.transferredAtasan || 0) + transferJobForm.qtyToTransfer;
      } else if (transferJobForm.partType === 'Bawahan') {
         updateData.transferredBawahan = (job.transferredBawahan || 0) + transferJobForm.qtyToTransfer;
      }

      await db.sewingJobs.update(job.id!, updateData);

      const partWage = getWageForPart(transferJobForm.partType, remInfo.pricing);
      const baseProdNum = targetTailor.productionNumber || job.productionNumber || '';
      const prodNum = baseProdNum
        ? `${baseProdNum} (Limpahan ${transferJobForm.partType} dari ${selectedTailor?.name})`
        : `Limpahan ${transferJobForm.partType} dari ${selectedTailor?.name}`;
      
      await db.sewingJobs.add({
         tailorId: targetTailorIdNum,
         tailorName: targetTailor.name,
         poItemId: job.poItemId,
         qtyTaken: deductSet,
         nominalQtyTaken: transferJobForm.qtyToTransfer,
         assignedPart: transferJobForm.partType,
         qtySubmitted: 0,
         wagePerPcs: partWage,
         tabunganPerPcs: remInfo.pricing.tabunganPerPcs,
         setType: remInfo.pricing.setType,
         wageSet: remInfo.pricing.wageSet,
         wageInner: remInfo.pricing.wageInner,
         wageOuter: remInfo.pricing.wageOuter,
         wageAtasan: remInfo.pricing.wageAtasan,
         wageBawahan: remInfo.pricing.wageBawahan,
         dateTaken: new Date().toISOString(),
         productionNumber: prodNum,
         status: 'Proses',
         createdBy: currentUsername
      });

      const transferredQty = transferJobForm.qtyToTransfer;
      const transferredPart = transferJobForm.partType;
      const targetName = targetTailor.name;

      setIsTransferJobOpen(false);
      setTransferJobForm({ jobId: 0, targetTailorId: '', qtyToTransfer: 0, partType: 'Outer' });
      setModalAlert({
        isOpen: true,
        type: 'success',
        title: 'Jahitan Berhasil Diberikan',
        message: `${transferredQty} pcs (${transferredPart}) berhasil dialihkan kepada ${targetName}. Hak upah dan tabungan otomatis berpindah ke penjahit baru.`,
        showCheckHistory: true
      });
    } catch (err) {
      setModalAlert({
        isOpen: true,
        type: 'error',
        title: 'Gagal Mengalihkan Pekerjaan',
        message: 'Terjadi kesalahan sistem saat mengalihkan pekerjaan.'
      });
    } finally {
      setSubmittingAction(null);
    }
  }

  async function handleAddKasbon(e: React.FormEvent) {
     e.preventDefault();
     if(!activeTailor || kasbonForm.amount <= 0 || isBusy) return;
     setSubmittingAction('addKasbon');
     try {
       await db.kasbons.add({
          tailorId: activeTailor,
          tailorName: selectedTailor?.name,
          amount: kasbonForm.amount,
          notes: kasbonForm.notes,
          date: new Date().toISOString(),
          isPaid: false,
          createdBy: currentUsername
       });
       const savedAmt = kasbonForm.amount;
       setIsKasbonFormOpen(false);
       setKasbonForm({ amount: 0, notes: '' });
       setModalAlert({
         isOpen: true,
         type: 'success',
         title: 'Kasbon Berhasil Dicatat',
         message: `Pinjaman kasbon sebesar Rp ${savedAmt.toLocaleString('id-ID')} untuk ${selectedTailor?.name} berhasil dibukukan.`,
         showCheckHistory: true
       });
     } catch (err) {
       setModalAlert({
         isOpen: true,
         type: 'error',
         title: 'Gagal Menyimpan Kasbon',
         message: 'Terjadi kesalahan saat menyimpan data kasbon.'
       });
     } finally {
       setSubmittingAction(null);
     }
  }

  async function handleAddManualAdjustment(e: React.FormEvent) {
     e.preventDefault();
     if(!activeTailor || !manualAdjustmentForm.amount || isBusy) return;
     setSubmittingAction('manualAdjust');
     try {
       await db.manualAdjustments.add({
          tailorId: activeTailor,
          tailorName: selectedTailor?.name,
          amount: manualAdjustmentForm.amount,
          notes: manualAdjustmentForm.notes || '',
          date: new Date().toISOString(),
          isPaid: false,
          createdBy: currentUsername
       } as ManualAdjustment);
       const savedAmt = manualAdjustmentForm.amount;
       setIsManualAdjustmentOpen(false);
       setManualAdjustmentForm({ amount: 0, notes: '' });
       setModalAlert({
         isOpen: true,
         type: 'success',
         title: 'Penyesuaian Gaji Disimpan',
         message: `Penyesuaian gaji sebesar ${savedAmt > 0 ? '+' : ''}Rp ${savedAmt.toLocaleString('id-ID')} untuk ${selectedTailor?.name} berhasil disimpan.`,
         showCheckHistory: true
       });
     } catch (err) {
       setModalAlert({
         isOpen: true,
         type: 'error',
         title: 'Gagal Menyimpan Penyesuaian',
         message: 'Terjadi kesalahan saat menyimpan penyesuaian gaji.'
       });
     } finally {
       setSubmittingAction(null);
     }
  }

  const handleExportJobsCSV = () => {
    if (!selectedTailor || tailorJobs.length === 0) return;
    
    const headers = ['Tanggal Ambil', 'No Produksi', 'PO / Barang', 'Qty Ambil', 'Qty Setor', 'Upah/Pcs', 'Tabungan/Pcs', 'Status'];
    const rows = tailorJobs.map(j => [
      new Date(j.dateTaken).toLocaleDateString('id-ID'),
      selectedTailor.productionNumber || j.productionNumber || '-',
      getPoItemLabel(j.poItemId),
      j.qtyTaken,
      j.qtySubmitted,
      j.wagePerPcs,
      j.tabunganPerPcs,
      j.status
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Pekerjaan_${selectedTailor.name}_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const selectedTailor = tailors.find(t => t.id === activeTailor);
  const tailorJobs = jobs.filter(j => j.tailorId === activeTailor && isWithinDateRange(j.dateTaken));
  const filteredTailors = tailors.filter(t => 
    t.status !== 'Dihapus' && (
      (t.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (t.partnerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.productionNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  function getPoItemLabel(poItemId: number) {
     const item = poItems.find(i => i.id === poItemId);
     if(!item) return 'Unknown';
     const po = pos.find(p => p.id === item.poId);
     return `${po?.poNumber || '?'} - ${item.itemName} (${item.color}, ${item.size})`;
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 lg:gap-6 h-full min-h-full max-h-full relative overflow-hidden">
       {/* Kiri: Daftar Penjahit (Hidden on mobile when a tailor is selected) */}
       <div className={`${activeTailor ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col h-full overflow-y-auto shrink-0 transition-all custom-scrollbar pr-2 pb-24`}>
          <div className="mb-6">
             <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">SDM Penjahit</h2>
                <button 
                  onClick={() => { setEditTailorId(null); setTailorForm({ name: '', productionNumber: '', partnerName: '', partnerCount: 0, phone: '', address: '' }); setIsTailorFormOpen(true); }} 
                  className="bg-slate-900 text-white p-2.5 rounded-xl shadow-lg shadow-slate-900/10 hover:bg-indigo-600 transition-all active:scale-95"
                >
                   <UserPlus size={20}/>
                </button>
             </div>
             
             <div className="relative group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Cari nama atau no. produksi..." 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
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
                   <span className="text-xs font-black text-indigo-900 uppercase tracking-widest">{editTailorId ? 'MODIFIKASI DATA' : 'PENJAHIT BARU'}</span>
                   <button type="button" disabled={isBusy} onClick={() => setIsTailorFormOpen(false)} className="text-indigo-400 hover:text-indigo-900 disabled:opacity-50"><X size={18}/></button>
                </div>
                <form onSubmit={handleSaveTailor} className="space-y-3">
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Nama Lengkap</label>
                      <input type="text" value={tailorForm.name} onChange={e => setTailorForm({...tailorForm, name: e.target.value})} className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" required/>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Nomor Produksi</label>
                      <input type="text" value={tailorForm.productionNumber || ''} onChange={e => setTailorForm({...tailorForm, productionNumber: e.target.value})} placeholder="Contoh: PRD-001" className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all" required/>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Nama Partner</label>
                      <input type="text" value={tailorForm.partnerName || ''} onChange={e => setTailorForm({...tailorForm, partnerName: e.target.value})} placeholder="Opsional" className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"/>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Jumlah Partner</label>
                      <input type="number" min="0" value={tailorForm.partnerCount || 0} onChange={e => setTailorForm({...tailorForm, partnerCount: Number(e.target.value)})} placeholder="0 if none" className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"/>
                      <p className="text-[9px] text-slate-400">Total orang = 1 (sendiri) + jumlah partner</p>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">WhatsApp / HP</label>
                      <input type="text" value={tailorForm.phone} onChange={e => setTailorForm({...tailorForm, phone: e.target.value})} className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"/>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Alamat / Lokasi</label>
                      <input type="text" value={tailorForm.address || ''} onChange={e => setTailorForm({...tailorForm, address: e.target.value})} placeholder="Opsional" className="w-full bg-white border border-indigo-100 rounded-xl px-4 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all"/>
                   </div>
                   <button type="submit" disabled={isBusy} className="w-full bg-indigo-600 text-white text-xs font-black uppercase tracking-widest py-3 rounded-xl hover:bg-slate-900 transition-all shadow-lg active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {submittingAction === 'saveTailor' ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Menyimpan...
                        </>
                      ) : (
                        'Simpan Data'
                      )}
                   </button>
                </form>
             </motion.div>
          )}
          </AnimatePresence>

          <div className="flex-1 overflow-visible w-full pr-2 space-y-3">
             {filteredTailors.length === 0 && (
                <div className="text-center py-12 opacity-40">
                   <User size={48} className="mx-auto mb-2" />
                   <p className="text-xs font-bold uppercase tracking-widest">Kosong</p>
                </div>
             )}
             {filteredTailors.map(t => (
                <motion.div 
                   layout
                   key={t.id}
                   onClick={() => setActiveTailor(t.id!)}
                   className={`group relative p-5 rounded-[2rem] border transition-all cursor-pointer ${activeTailor === t.id ? 'bg-slate-900 border-slate-900 shadow-xl shadow-slate-900/20' : 'bg-white border-slate-100 hover:border-indigo-100'}`}
                >
                   <div className="flex justify-between items-start">
                      <div className="flex-1">
                         <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className={`font-black tracking-tight ${activeTailor === t.id ? 'text-white' : 'text-slate-900'}`}>{t.name}</p>
                            {t.partnerName && <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${activeTailor === t.id ? 'bg-white/10 text-white/60' : 'bg-slate-100 text-slate-400'}`}>& {t.partnerName}</span>}
                            {t.productionNumber && (
                               <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${activeTailor === t.id ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                  {t.productionNumber}
                               </span>
                            )}
                         </div>
                         <p className={`text-xs font-bold flex items-center justify-between gap-1.5 ${activeTailor === t.id ? 'text-white/60' : 'text-slate-400'}`}>
                           <span className="flex items-center gap-1.5"><Phone size={12}/> {t.phone || 'No Phone'}</span>
                           {(t.createdBy || t.updatedBy) && (
                             <span className="text-[8px] font-black italic uppercase">By: {t.updatedBy || t.createdBy}</span>
                           )}
                         </p>
                      </div>
                      <div className="flex gap-1 transition-opacity">
                         <button type="button" onClick={(e) => { e.stopPropagation(); editTailor(t); }} className={`p-2 rounded-xl transition-all ${activeTailor === t.id ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}>
                            <Edit2 size={14} className="pointer-events-none"/>
                         </button>
                         <button type="button" onClick={(e) => deleteTailor(t.id!, e)} className={`p-2 rounded-xl transition-all ${activeTailor === t.id ? 'text-white/40 hover:text-white' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}>
                            <Trash2 size={14} className="pointer-events-none"/>
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
       <div className={`${activeTailor ? 'flex' : 'hidden md:flex'} flex-1 bg-white border border-slate-200 rounded-[3rem] shadow-sm flex-col h-full overflow-y-auto relative custom-scrollbar pb-24`}>
          {!activeTailor ? (
             <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-300">
                   <Scissors size={48}/>
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Kelola Aktivitas Jahit</h3>
                <p className="text-slate-500 font-medium mt-2 max-w-xs">Silakan pilih nama penjahit untuk mencatat pengambilan barang, setoran, atau kasbon.</p>
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
                         <button onClick={() => setActiveTailor(null)} className="md:hidden p-2 bg-slate-100 rounded-xl">
                            <ArrowLeft size={20}/>
                         </button>
                         <div>
                            <div className="flex flex-wrap items-center gap-3">
                               <h2 className="text-3xl font-black tracking-tighter text-slate-900 leading-none">
                                  {selectedTailor?.name}
                                  {selectedTailor?.partnerName && <span className="text-slate-400 font-bold text-lg ml-3">& {selectedTailor.partnerName}</span>}
                               </h2>
                               {selectedTailor?.productionNumber && (
                                  <span className="bg-indigo-600 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm">
                                     No. Prod: {selectedTailor.productionNumber}
                                  </span>
                               )}
                            </div>
                            <div className="flex flex-wrap items-center gap-4 mt-3">
                               <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                  <Phone size={14} className="text-indigo-400"/> {selectedTailor?.phone || '-'}
                               </span>
                               <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400">
                                  <MapPin size={14} className="text-indigo-400"/> {selectedTailor?.address || 'Lokasi Belum Atur'}
                               </span>
                               {(selectedTailor?.createdBy || selectedTailor?.updatedBy) && (
                                 <span className="text-[10px] font-black text-slate-300 italic uppercase">
                                    Operator: {selectedTailor?.updatedBy || selectedTailor?.createdBy}
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
                           <Download size={16}/> Cetak Laporan
                         </button>
                         <button 
                           type="button"
                           onClick={(e) => deleteTailor(selectedTailor!.id!, e)}
                           className="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white p-2 md:px-4 md:py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm border border-rose-100"
                           title="Hapus Penjahit"
                         >
                            <Trash2 size={16}/> <span className="hidden md:inline">Hapus</span>
                         </button>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex gap-3">
                      <button onClick={() => setIsTakeJobOpen(true)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-sm font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 active:scale-95 flex-1 lg:flex-none">
                         <FilePlus2 size={18}/> Ambil Jahitan
                      </button>
                      <button onClick={() => setIsKasbonFormOpen(true)} className="bg-amber-100 text-amber-700 border border-amber-200 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-amber-200 transition-all flex items-center justify-center gap-2 flex-1 lg:flex-none">
                         <Banknote size={18}/> Kasbon
                      </button>
                      <button onClick={() => setIsManualAdjustmentOpen(true)} className="bg-purple-100 text-purple-700 border border-purple-200 px-6 py-3 rounded-2xl text-sm font-bold hover:bg-purple-200 transition-all flex items-center justify-center gap-2 flex-1 lg:flex-none">
                         <Calculator size={18}/> Edit Gaji
                      </button>
                      
                      <div className="lg:ml-auto flex items-center gap-2 bg-slate-50 border border-slate-200 p-2 rounded-2xl shadow-inner w-full lg:w-auto">
                         <Calendar size={16} className="text-slate-400 ml-2"/>
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
                           <button onClick={() => { setFromDate(''); setToDate(''); }} className="text-rose-500 p-1.5 hover:bg-rose-50 rounded-xl transition-colors">
                             <X size={16}/>
                           </button>
                         )}
                      </div>
                   </div>
                </div>

                <div className="flex-1 overflow-visible bg-slate-50/30 relative">
                   {tailorJobs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-400 opacity-60">
                         <Activity size={48} className="mb-4" />
                         <p className="text-xs font-black uppercase tracking-widest">Belum Ada Aktivitas Pekerjaan</p>
                      </div>
                   ) : (
                      <div className="p-8">
                         <div className="grid grid-cols-1 gap-4">
                            {tailorJobs.slice(0, showAllJobsHistory ? undefined : 5).map(j => {
                               const progress = j.qtyTaken > 0 ? Math.min(100, Math.round((j.qtySubmitted / j.qtyTaken) * 100)) : 0;
                               const jobSubs = submissions.filter(s => s.jobId === j.id);
                               const remInfo = getJobRemainingInfo(j);
                               const totallyPaid = jobSubs.length > 0 && jobSubs.every(s => s.isPaid);
                               const partiallyPaid = !totallyPaid && jobSubs.some(s => s.isPaid);

                               let paidBadge = null;
                               if (totallyPaid) {
                                  paidBadge = <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">Gaji Lunas</span>;
                               } else if (partiallyPaid) {
                                  paidBadge = <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-sky-100 text-sky-700 border border-sky-200">Gaji Sebagian</span>;
                               } else if (jobSubs.length > 0) {
                                  paidBadge = <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">Belum Dibayar</span>;
                               } else {
                                  paidBadge = <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 border border-slate-200">Belum Ada Setoran</span>;
                               }

                               const openSubmitForJob = () => {
                                  let defaultPart: SubmissionPartType = 'Set';
                                  if (remInfo.isAssignedPartial && remInfo.assignedPart) {
                                     defaultPart = remInfo.assignedPart;
                                  } else if (remInfo.remSet > 0) {
                                     defaultPart = 'Set';
                                  } else {
                                     const opts = getPartOptionsForSetType(remInfo.pricing.setType);
                                     const avail = opts.find(o => remInfo.maxForPart(o.value) > 0);
                                     if (avail) defaultPart = avail.value;
                                  }
                                  setSubmitJobForm({
                                     jobId: j.id!,
                                     partType: defaultPart,
                                     qtySubmitted: remInfo.maxForPart(defaultPart) || 1
                                  });
                                  setIsSubmitJobOpen(true);
                               };

                               const openTransferForJob = (e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  let defaultPart: SubmissionPartType = 'Set';
                                  if (remInfo.isAssignedPartial && remInfo.assignedPart) {
                                     defaultPart = remInfo.assignedPart;
                                  } else {
                                     const opts = getPartOptionsForSetType(remInfo.pricing.setType);
                                     const nonSetAvail = opts.find(o => o.value !== 'Set' && remInfo.maxForPart(o.value) > 0);
                                     const anyAvail = opts.find(o => remInfo.maxForPart(o.value) > 0);
                                     if (remInfo.remSet === 0 && nonSetAvail) {
                                        defaultPart = nonSetAvail.value;
                                     } else if (anyAvail) {
                                        defaultPart = anyAvail.value;
                                     }
                                  }
                                  setTransferJobForm({
                                     jobId: j.id!,
                                     targetTailorId: '',
                                     qtyToTransfer: remInfo.maxForPart(defaultPart) || 1,
                                     partType: defaultPart
                                  });
                                  setIsSubmitJobOpen(false);
                                  setIsTransferJobOpen(true);
                               };
                               
                               const isJobCompleted = remInfo.allDone;

                               return (
                                  <motion.div 
                                    layout
                                    key={j.id} 
                                    onClick={() => {
                                      if (!isJobCompleted) {
                                        openSubmitForJob();
                                      }
                                    }}
                                    className={`bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-md transition-all group ${!isJobCompleted ? 'cursor-pointer hover:border-emerald-200 hover:ring-2 hover:ring-emerald-500/20' : ''}`}
                                  >
                                     <div className="flex flex-col lg:flex-row justify-between gap-6">
                                        <div className="flex-1">
                                           <div className="flex flex-wrap items-center gap-2.5 mb-2">
                                              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                                                 {new Date(j.dateTaken).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                                              </span>
                                              {j.createdBy && (
                                                 <span className="text-[9px] font-bold italic text-slate-300 uppercase">By: {j.createdBy}</span>
                                              )}
                                              {paidBadge}
                                              <span className="px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                 {j.assignedPart ? `Bagian: ${j.assignedPart}` : remInfo.pricing.setType}
                                              </span>
                                              <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-colors ${isJobCompleted ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                 {isJobCompleted ? 'Selesai' : 'Proses'}
                                              </span>
                                           </div>
                                           <h4 className="text-lg font-extrabold text-slate-900 tracking-tight leading-tight mb-2 group-hover:text-indigo-600 transition-colors">
                                              {getPoItemLabel(j.poItemId)}
                                           </h4>
                                           {j.productionNumber && (
                                              <div className="flex items-center gap-2 mb-3">
                                                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Produksi:</span>
                                                 <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{j.productionNumber}</span>
                                              </div>
                                           )}
                                           <div className="flex flex-wrap gap-2 items-center mb-3">
                                              <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100">
                                                 <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Upah PO</span>
                                                 <span className="text-xs font-black text-indigo-700">
                                                    {j.assignedPart
                                                       ? `${j.assignedPart}: Rp ${getWageForPart(j.assignedPart, remInfo.pricing).toLocaleString('id-ID')}`
                                                       : remInfo.pricing.wageSummaryText}
                                                 </span>
                                              </div>
                                              {remInfo.pricing.tabunganPerPcs > 0 && (
                                                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
                                                   <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Tbg/Set</span>
                                                   <span className="text-xs font-black text-emerald-700">Rp {remInfo.pricing.tabunganPerPcs.toLocaleString('id-ID')}</span>
                                                </div>
                                              )}
                                           </div>

                                           {/* Riwayat Setoran Parsial / Lengkap pada Job ini */}
                                           {jobSubs.length > 0 && (
                                              <div className="flex flex-wrap gap-1.5 mt-2">
                                                 {jobSubs.map(s => (
                                                    <span key={s.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold">
                                                       Setor {getSubmissionNominalQty(s)} pcs ({s.partType || 'Set'}) = {s.qtySubmitted} Set • Rp {(s.wageTotal || 0).toLocaleString('id-ID')}
                                                    </span>
                                                 ))}
                                              </div>
                                           )}
                                        </div>

                                        <div className="w-full lg:w-72 flex flex-col justify-between gap-3">
                                           <div>
                                              <div className="flex justify-between items-end mb-1">
                                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realisasi Kerja</p>
                                                 <p className="text-sm font-black text-slate-900">
                                                    <span className="text-lg">{j.qtySubmitted}</span> / {j.qtyTaken} <span className="text-[10px] text-slate-400 font-bold ml-1">SET</span>
                                                 </p>
                                              </div>
                                              <p className="text-[10px] font-bold text-amber-600 mb-2">{remInfo.summaryText}</p>
                                              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-200/50">
                                                 <motion.div 
                                                   initial={{ width: 0 }}
                                                   animate={{ width: `${progress}%` }}
                                                   className={`h-full rounded-full transition-all duration-1000 ${isJobCompleted ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`}
                                                 />
                                              </div>
                                           </div>

                                           {!isJobCompleted && (
                                              <div className="flex gap-2 pt-1">
                                                 <button
                                                    type="button"
                                                    onClick={(e) => { e.stopPropagation(); openSubmitForJob(); }}
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest py-2.5 px-3 rounded-xl transition-all shadow-sm"
                                                 >
                                                    Setor Jahitan
                                                 </button>
                                                 <button
                                                    type="button"
                                                    onClick={openTransferForJob}
                                                    className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-black uppercase tracking-widest py-2.5 px-3 rounded-xl transition-all"
                                                 >
                                                    Berikan Ke Penjahit Lain
                                                 </button>
                                              </div>
                                           )}
                                        </div>
                                     </div>
                                  </motion.div>
                               );
                            })}
                         </div>
                         {tailorJobs.length > 5 && (
                           <div className="mt-6 flex justify-center">
                             <button
                               onClick={() => setShowAllJobsHistory(!showAllJobsHistory)}
                               className="bg-white border-2 border-slate-100 text-slate-500 hover:text-indigo-600 hover:border-indigo-100 px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm"
                             >
                               {showAllJobsHistory ? 'Sembunyikan' : 'Lihat Semua History'}
                             </button>
                           </div>
                         )}
                      </div>
                   )}
                </div>

                {/* Overlays for forms */}
                <AnimatePresence>
                {(isTakeJobOpen || isSubmitJobOpen || isTransferJobOpen || isKasbonFormOpen || isManualAdjustmentOpen) && (
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
                               {isTakeJobOpen && 'Ambil Jahitan'}
                               {isSubmitJobOpen && 'Setor Jahitan'}
                               {isTransferJobOpen && 'Berikan Ke Penjahit Lain'}
                               {isKasbonFormOpen && 'Catat Kasbon'}
                               {isManualAdjustmentOpen && 'Edit Manual Gaji'}
                            </h3>
                            <button 
                              onClick={() => {
                                setIsTakeJobOpen(false); setIsSubmitJobOpen(false); setIsTransferJobOpen(false); setIsKasbonFormOpen(false); setIsManualAdjustmentOpen(false);
                              }} 
                              className="text-slate-400 hover:text-slate-900 bg-white p-2 rounded-xl border border-slate-100 shadow-sm"
                            >
                               <X size={20}/>
                            </button>
                         </div>

                         <div className="p-8 overflow-y-auto custom-scrollbar">
                            {isTakeJobOpen && (
                               <form onSubmit={handleTakeJob} className="space-y-6">
                                  <div className="space-y-3">
                                     <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Pilih Item PO (Sisa Bahan)</label>
                                     <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                                        {poItems.map(item => {
                                           const po = pos.find(p => p.id === item.poId);
                                           if (!po || po.status === 'Dihapus') return null;
                                           const taken = jobs.filter(j => j.poItemId === item.id).reduce((sum, j) => sum + j.qtyTaken, 0);
                                           const remaining = item.qty - taken;
                                           if (remaining <= 0) return null;
                                           
                                           const isSelected = takeJobForm.poItemId === item.id;
                                           const itemPricing = getPOItemPricing(item, po);
                                           
                                           return (
                                              <motion.div 
                                                whileHover={{ scale: 1.01 }}
                                                whileTap={{ scale: 0.99 }}
                                                key={item.id} 
                                                onClick={() => setTakeJobForm({...takeJobForm, poItemId: item.id!})}
                                                className={`flex items-center gap-4 p-4 rounded-3xl border-2 transition-all cursor-pointer ${isSelected ? 'bg-indigo-50 border-indigo-500 ring-4 ring-indigo-50' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}`}
                                              >
                                                 <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{po.poNumber}</p>
                                                       <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-md text-[8px] font-black uppercase">{itemPricing.setType}</span>
                                                    </div>
                                                    <h4 className="text-base font-black text-slate-900 truncate tracking-tight">{item.itemName}</h4>
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                       <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-500 uppercase">{item.color}</span>
                                                       <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[9px] font-bold text-slate-500 uppercase">{item.size}</span>
                                                       <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-md text-[9px] font-black text-emerald-700">
                                                          Upah: Rp {itemPricing.totalFullWage.toLocaleString('id-ID')}
                                                       </span>
                                                    </div>
                                                 </div>
                                                 <div className="text-right shrink-0">
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none mb-1">Sisa</p>
                                                    <p className="text-xl font-black text-slate-900 leading-none">{remaining} <span className="text-[10px] text-slate-400">pcs</span></p>
                                                 </div>
                                              </motion.div>
                                           );
                                        })}
                                     </div>
                                  </div>

                                  {/* Info Upah & Tabungan Otomatis dari PO */}
                                  {takeJobForm.poItemId > 0 && (() => {
                                     const selItem = poItems.find(i => i.id === takeJobForm.poItemId);
                                     const selPo = pos.find(p => p.id === selItem?.poId);
                                     const pr = getPOItemPricing(selItem, selPo);
                                     return (
                                        <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-1.5">
                                           <div className="flex justify-between items-center">
                                              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Tipe & Upah dari PO</span>
                                              <span className="text-[10px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-full uppercase">{pr.setType}</span>
                                           </div>
                                           <p className="text-xs font-black text-slate-800">{pr.wageSummaryText}</p>
                                           <p className="text-[11px] font-bold text-emerald-700">
                                              Tabungan / Set: Rp {pr.tabunganPerPcs.toLocaleString('id-ID')} <span className="text-[10px] text-slate-400 font-semibold">(Setor parsial dihitung 1/2)</span>
                                           </p>
                                        </div>
                                     );
                                  })()}

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <div className="space-y-2">
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Kuantitas Ambil (Set)</label>
                                        <input type="number" min="1" value={takeJobForm.qtyTaken || ''} onChange={e => setTakeJobForm({...takeJobForm, qtyTaken: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-indigo-500 focus:outline-none" required/>
                                     </div>
                                     <div className="space-y-2">
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">No Produksi Penjahit</label>
                                        <div className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl px-4 py-3 text-xs font-black text-slate-700 flex items-center justify-between">
                                           <span>{selectedTailor?.productionNumber || 'Belum Diisi'}</span>
                                           <span className="text-[9px] font-bold uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">Otomatis</span>
                                        </div>
                                     </div>
                                  </div>
                                  <button
                                    type="submit"
                                    disabled={isBusy}
                                    className="w-full bg-slate-900 text-white font-black py-4 rounded-3xl hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 active:scale-95 uppercase tracking-widest text-xs mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {submittingAction === 'takeJob' ? (
                                      <><Loader2 size={16} className="animate-spin" /> Menyimpan Pekerjaan...</>
                                    ) : (
                                      'Simpan Pekerjaan'
                                    )}
                                  </button>
                               </form>
                            )}

                            {isSubmitJobOpen && (() => {
                               const j = tailorJobs.find(x => x.id === submitJobForm.jobId);
                               if (!j) return null;
                               const remInfo = getJobRemainingInfo(j);
                               const partOptions = remInfo.isAssignedPartial && remInfo.assignedPart
                                  ? [{ value: remInfo.assignedPart, label: `${remInfo.assignedPart} (Limpahan - 1/2 Set)` }]
                                  : getPartOptionsForSetType(remInfo.pricing.setType);

                               const currentNominal = Number(submitJobForm.qtySubmitted) || 0;
                               const mult = submitJobForm.partType === 'Set' ? 1 : 0.5;
                               const previewEffectiveSet = currentNominal * mult;
                               const previewPartWage = getWageForPart(submitJobForm.partType, remInfo.pricing);
                               const previewWageTotal = currentNominal * previewPartWage;
                               const previewTabunganTotal = currentNominal * mult * remInfo.pricing.tabunganPerPcs;

                               return (
                                  <form onSubmit={handleSubmitJob} className="space-y-5">
                                     <div className="space-y-2">
                                        <div className="flex justify-between items-center gap-2">
                                           <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Job yang Disetor</label>
                                           <button 
                                             type="button" 
                                             disabled={isBusy}
                                             onClick={() => {
                                                let defaultPart: SubmissionPartType = submitJobForm.partType;
                                                const opts = getPartOptionsForSetType(remInfo.pricing.setType);
                                                const nonSetAvail = opts.find(o => o.value !== 'Set' && remInfo.maxForPart(o.value) > 0);
                                                if (remInfo.remSet === 0 && nonSetAvail) {
                                                   defaultPart = nonSetAvail.value;
                                                }
                                                setTransferJobForm({
                                                   jobId: j.id!,
                                                   targetTailorId: '',
                                                   qtyToTransfer: remInfo.maxForPart(defaultPart) || 1,
                                                   partType: defaultPart
                                                });
                                                setIsSubmitJobOpen(false);
                                                setIsTransferJobOpen(true);
                                             }}
                                             className="text-[10px] font-black text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-xl transition-all uppercase tracking-widest border border-amber-300 bg-amber-50 shadow-sm disabled:opacity-50"
                                           >
                                              Berikan Ke Penjahit Lain →
                                           </button>
                                        </div>
                                        <div className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 space-y-1">
                                           <p className="font-black text-slate-900 text-sm">{getPoItemLabel(j.poItemId)}</p>
                                           <p className="text-amber-600 font-black">{remInfo.summaryText}</p>
                                           <p className="text-[11px] text-slate-500">{remInfo.pricing.wageSummaryText}</p>
                                        </div>
                                     </div>

                                     <div className="space-y-2">
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Bagian yang Disetor</label>
                                        <select
                                          value={submitJobForm.partType}
                                          onChange={e => {
                                             const newPt = e.target.value as SubmissionPartType;
                                             const maxAllowed = remInfo.maxForPart(newPt);
                                             setSubmitJobForm({
                                                ...submitJobForm,
                                                partType: newPt,
                                                qtySubmitted: maxAllowed > 0 ? (submitJobForm.qtySubmitted > maxAllowed ? maxAllowed : (submitJobForm.qtySubmitted || maxAllowed)) : 0
                                             });
                                          }}
                                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-black focus:bg-white focus:border-emerald-500 focus:outline-none"
                                        >
                                           {partOptions.map(opt => {
                                              const maxVal = remInfo.maxForPart(opt.value);
                                              return (
                                                 <option key={opt.value} value={opt.value} disabled={maxVal <= 0}>
                                                    {opt.label} — Sisa: {maxVal} pcs (Rp {getWageForPart(opt.value, remInfo.pricing).toLocaleString('id-ID')}/pcs) {maxVal <= 0 ? '(Sudah Lengkap)' : ''}
                                                 </option>
                                              );
                                           })}
                                        </select>
                                     </div>

                                     <div className="space-y-2">
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                           Jumlah Pcs Disetor (Maks: {remInfo.maxForPart(submitJobForm.partType)} pcs)
                                        </label>
                                        <input
                                          type="number"
                                          min="1"
                                          max={remInfo.maxForPart(submitJobForm.partType) || undefined}
                                          step="any"
                                          value={submitJobForm.qtySubmitted || ''}
                                          onChange={e => setSubmitJobForm({...submitJobForm, qtySubmitted: Number(e.target.value)})}
                                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-emerald-500 focus:outline-none"
                                          placeholder="Berapa pcs?"
                                          required
                                        />
                                     </div>

                                     {/* Preview Kalkulasi Setoran & Tabungan */}
                                     <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-1.5">
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                           <span>Dihitung Setoran Penjahit:</span>
                                           <span className="font-black text-slate-900">
                                              {previewEffectiveSet} Set {mult === 0.5 ? `(${currentNominal} pcs × 1/2)` : `(${currentNominal} Set)`}
                                           </span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                           <span>Upah Jahit ({submitJobForm.partType}):</span>
                                           <span className="font-black text-indigo-700">Rp {previewWageTotal.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                           <span>Tabungan Masuk {mult === 0.5 ? '(Dihitung 1/2)' : ''}:</span>
                                           <span className="font-black text-emerald-700">Rp {previewTabunganTotal.toLocaleString('id-ID')}</span>
                                        </div>
                                     </div>

                                     <button
                                       type="submit"
                                       disabled={isBusy}
                                       className="w-full bg-emerald-600 text-white font-black py-4 rounded-3xl hover:bg-slate-900 transition-all shadow-xl shadow-emerald-500/10 active:scale-95 uppercase tracking-widest text-xs mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                     >
                                       {submittingAction === 'submitJob' ? (
                                         <><Loader2 size={16} className="animate-spin" /> Memproses Setoran...</>
                                       ) : (
                                         'Konfirmasi Setoran'
                                       )}
                                     </button>
                                  </form>
                               );
                            })()}

                            {isTransferJobOpen && (() => {
                               const j = tailorJobs.find(x => x.id === transferJobForm.jobId);
                               if (!j) return null;
                               const remInfo = getJobRemainingInfo(j);
                               const partOptions = remInfo.isAssignedPartial && remInfo.assignedPart
                                  ? [{ value: remInfo.assignedPart, label: `${remInfo.assignedPart} (1/2 Set)` }]
                                  : getPartOptionsForSetType(remInfo.pricing.setType);

                               const currentQty = Number(transferJobForm.qtyToTransfer) || 0;
                               const mult = transferJobForm.partType === 'Set' ? 1 : 0.5;
                               const transferredSet = currentQty * mult;
                               const newTailorPartWage = getWageForPart(transferJobForm.partType, remInfo.pricing);
                               const newTailorTabunganPerPcs = remInfo.pricing.tabunganPerPcs * mult;

                               return (
                                  <form onSubmit={handleTransferJob} className="space-y-5">
                                     <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
                                        <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Ambil Alih / Berikan Jahitan</p>
                                        <p className="text-xs font-black text-slate-900">{getPoItemLabel(j.poItemId)}</p>
                                        <p className="text-xs font-bold text-amber-700">{remInfo.summaryText}</p>
                                     </div>

                                     <div className="space-y-2">
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Berikan Kepada Penjahit</label>
                                        <select
                                          value={transferJobForm.targetTailorId}
                                          onChange={e => setTransferJobForm({...transferJobForm, targetTailorId: e.target.value === '' ? '' : Number(e.target.value)})}
                                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-amber-500 focus:outline-none"
                                          required
                                        >
                                           <option value="" disabled>-- Pilih Penjahit Penerima --</option>
                                           {tailors.filter(t => t.id !== activeTailor && t.status !== 'Dihapus').map(t => (
                                              <option key={t.id} value={t.id}>{t.name} {t.productionNumber ? `[${t.productionNumber}]` : ''} {t.partnerName ? `(& ${t.partnerName})` : ''}</option>
                                           ))}
                                        </select>
                                     </div>

                                     <div className="space-y-2">
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Bagian yang Diberikan</label>
                                        <select
                                          value={transferJobForm.partType}
                                          onChange={e => {
                                             const newPt = e.target.value as SubmissionPartType;
                                             setTransferJobForm({
                                                ...transferJobForm,
                                                partType: newPt,
                                                qtyToTransfer: remInfo.maxForPart(newPt) || transferJobForm.qtyToTransfer
                                             });
                                          }}
                                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 text-sm font-black focus:bg-white focus:border-amber-500 focus:outline-none"
                                        >
                                           {partOptions.map(opt => (
                                              <option key={opt.value} value={opt.value}>
                                                 {opt.label} — Sisa: {remInfo.maxForPart(opt.value)} pcs
                                              </option>
                                           ))}
                                        </select>
                                     </div>

                                     <div className="space-y-2">
                                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">
                                           Jumlah Pcs yang Diberikan (Maks: {remInfo.maxForPart(transferJobForm.partType)} pcs)
                                        </label>
                                        <input
                                          type="number"
                                          min="1"
                                          max={remInfo.maxForPart(transferJobForm.partType) || undefined}
                                          step="any"
                                          value={transferJobForm.qtyToTransfer || ''}
                                          onChange={e => setTransferJobForm({...transferJobForm, qtyToTransfer: Number(e.target.value)})}
                                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-black focus:bg-white focus:border-amber-500 focus:outline-none"
                                          placeholder="Berapa pcs?"
                                          required
                                        />
                                     </div>

                                     {/* Ringkasan Perpindahan Upah & Tabungan ke Penjahit Baru */}
                                     <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Otomatis Pindah ke Penjahit Baru</p>
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                           <span>Beban Kerja Pindah:</span>
                                           <span className="font-black text-slate-900">{transferredSet} Set ({currentQty} pcs {transferJobForm.partType})</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                           <span>Upah ({transferJobForm.partType}):</span>
                                           <span className="font-black text-indigo-700">Rp {newTailorPartWage.toLocaleString('id-ID')} / pcs (Total Rp {(currentQty * newTailorPartWage).toLocaleString('id-ID')})</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold text-slate-600">
                                           <span>Tabungan Pindah:</span>
                                           <span className="font-black text-emerald-700">Rp {newTailorTabunganPerPcs.toLocaleString('id-ID')} / pcs (Total Rp {(currentQty * newTailorTabunganPerPcs).toLocaleString('id-ID')})</span>
                                        </div>
                                     </div>

                                     <button
                                       type="submit"
                                       disabled={isBusy}
                                       className="w-full bg-amber-600 text-white font-black py-4 rounded-3xl hover:bg-slate-900 transition-all shadow-xl shadow-amber-500/10 active:scale-95 uppercase tracking-widest text-xs mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                     >
                                       {submittingAction === 'transferJob' ? (
                                         <><Loader2 size={16} className="animate-spin" /> Memproses Perpindahan...</>
                                       ) : (
                                         'Konfirmasi Berikan Ke Penjahit Lain'
                                       )}
                                     </button>
                                     <button
                                       type="button"
                                       disabled={isBusy}
                                       onClick={() => { setIsTransferJobOpen(false); setIsSubmitJobOpen(true); }}
                                       className="w-full bg-white text-slate-500 font-bold py-3 rounded-3xl hover:bg-slate-100 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                                     >
                                        ← Kembali ke Setor Jahitan
                                     </button>
                                  </form>
                               );
                            })()}

                            {isKasbonFormOpen && (
                               <form onSubmit={handleAddKasbon} className="space-y-6">
                                  <div className="space-y-2">
                                     <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Pinjaman (Rp)</label>
                                     <input type="number" min="1" value={kasbonForm.amount || ''} onChange={e => setKasbonForm({...kasbonForm, amount: Number(e.target.value)})} className="w-full bg-amber-50 border-2 border-amber-100 rounded-2xl px-5 py-3 text-xl font-black text-amber-900 focus:bg-white focus:border-amber-500 focus:outline-none transition-all" required/>
                                  </div>
                                  <div className="space-y-2">
                                     <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Tujuan / Catatan</label>
                                     <input type="text" value={kasbonForm.notes} onChange={e => setKasbonForm({...kasbonForm, notes: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white focus:border-amber-500 focus:outline-none" placeholder="Misal: Kebutuhan keluarga"/>
                                  </div>
                                  <button
                                    type="submit"
                                    disabled={isBusy}
                                    className="w-full bg-amber-500 text-white font-black py-4 rounded-3xl hover:bg-slate-900 transition-all shadow-xl shadow-amber-500/10 active:scale-95 uppercase tracking-widest text-xs mt-4 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {submittingAction === 'addKasbon' ? (
                                      <><Loader2 size={16} className="animate-spin" /> Menyimpan Kasbon...</>
                                    ) : (
                                      'Bukukan Kasbon'
                                    )}
                                  </button>
                               </form>
                            )}

                            {isManualAdjustmentOpen && (
                               <form onSubmit={handleAddManualAdjustment} className="space-y-6">
                                  <div className="space-y-2">
                                     <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Nominal Penyesuaian (Rp)</label>
                                     <input type="number" value={manualAdjustmentForm.amount || ''} onChange={e => setManualAdjustmentForm({...manualAdjustmentForm, amount: Number(e.target.value)})} className="w-full bg-purple-50 border-2 border-purple-100 rounded-2xl px-5 py-3 text-xl font-black text-purple-900 focus:bg-white focus:border-purple-500 focus:outline-none" required placeholder="Gunakan minus (-) untuk memotong"/>
                                  </div>
                                  <div className="space-y-2">
                                     <label className="block text-[11px] font-black text-slate-400 uppercase tracking-widest">Penjelasan</label>
                                     <input type="text" value={manualAdjustmentForm.notes} onChange={e => setManualAdjustmentForm({...manualAdjustmentForm, notes: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-sm font-bold focus:bg-white focus:border-purple-500 focus:outline-none" placeholder="Alasan edit manual..." required/>
                                  </div>
                                  <button
                                    type="submit"
                                    disabled={isBusy}
                                    className="w-full bg-purple-600 text-white font-black py-4 rounded-3xl hover:bg-slate-900 transition-all shadow-xl shadow-purple-600/10 active:scale-95 uppercase tracking-widest text-xs mt-4 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                  >
                                    {submittingAction === 'manualAdjust' ? (
                                      <><Loader2 size={16} className="animate-spin" /> Menyimpan Perubahan...</>
                                    ) : (
                                      'Simpan Perubahan'
                                    )}
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
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-2">Hapus Penjahit?</h3>
                <p className="text-sm font-medium text-slate-500 mb-8">Apakah Anda yakin ingin menghapus penjahit <span className="font-bold text-slate-900">{tailorToDelete.name}</span>? Semua data pekerjaan yang terkait di database mungkin akan terpengaruh.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => !isBusy && setTailorToDelete(null)} 
                    disabled={isBusy}
                    className="flex-1 px-4 py-3.5 rounded-2xl text-slate-500 font-bold bg-slate-50 hover:bg-slate-100 transition-colors active:scale-95 text-sm disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button 
                    onClick={confirmDeleteTailor} 
                    disabled={isBusy}
                    className="flex-1 px-4 py-3.5 rounded-2xl text-white font-bold bg-rose-600 hover:bg-rose-700 transition-colors shadow-lg shadow-rose-600/30 active:scale-95 text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submittingAction === 'deleteTailor' ? (
                      <><Loader2 size={16} className="animate-spin" /> Menghapus...</>
                    ) : (
                      'Ya, Yakin'
                    )}
                  </button>
                </div>
             </motion.div>
          </div>
       )}
       </AnimatePresence>

       {/* Custom Confirmation & Notification Modal */}
       <AnimatePresence>
       {modalAlert.isOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
             <motion.div
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-8 text-center"
             >
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mx-auto mb-5 ${
                  modalAlert.type === 'error'
                    ? 'bg-rose-50 text-rose-600'
                    : modalAlert.type === 'confirm'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {modalAlert.type === 'error' && <AlertCircle size={32} />}
                  {modalAlert.type === 'confirm' && <AlertCircle size={32} />}
                  {modalAlert.type === 'success' && <CheckCircle2 size={32} />}
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight mb-2">{modalAlert.title}</h3>
                <p className="text-sm font-medium text-slate-500 mb-7 leading-relaxed">{modalAlert.message}</p>

                {modalAlert.type === 'confirm' ? (
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setModalAlert(prev => ({ ...prev, isOpen: false }))}
                      className="flex-1 px-4 py-3.5 rounded-2xl text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 transition-colors active:scale-95 text-xs uppercase tracking-widest disabled:opacity-50"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => modalAlert.onConfirm && modalAlert.onConfirm()}
                      className="flex-1 px-4 py-3.5 rounded-2xl text-white font-black bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/25 active:scale-95 text-xs uppercase tracking-widest disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isBusy ? (
                        <><Loader2 size={16} className="animate-spin" /> Memproses...</>
                      ) : (
                        modalAlert.confirmLabel || 'Ya, Lanjutkan'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    {modalAlert.showCheckHistory && onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalAlert(prev => ({ ...prev, isOpen: false }));
                          onNavigate('history');
                        }}
                        className="flex-1 px-4 py-3.5 rounded-2xl text-indigo-700 font-black bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-1.5"
                      >
                        <History size={15} /> Cek History
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setModalAlert(prev => ({ ...prev, isOpen: false }))}
                      className="flex-1 px-4 py-3.5 rounded-2xl text-white font-black bg-slate-900 hover:bg-slate-800 transition-colors active:scale-95 text-xs uppercase tracking-widest"
                    >
                      Tutup
                    </button>
                  </div>
                )}
             </motion.div>
          </div>
       )}
       </AnimatePresence>
    </div>
  )
}
