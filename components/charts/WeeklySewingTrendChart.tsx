'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Users,
  Scissors,
  Award,
  Layers,
  BarChart3,
  Sparkles,
  ChevronDown,
  ArrowUpRight,
} from 'lucide-react';
import { SewingSubmission, SewingJob, Tailor } from '@/lib/db';

interface WeeklySewingTrendChartProps {
  submissions: SewingSubmission[];
  jobs: SewingJob[];
  tailors: Tailor[];
  onNavigateToTailor?: () => void;
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const MONTH_NAMES_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const TAILOR_PALETTE = [
  { stroke: '#6366f1', fill: '#6366f1', name: 'indigo' },
  { stroke: '#10b981', fill: '#10b981', name: 'emerald' },
  { stroke: '#f59e0b', fill: '#f59e0b', name: 'amber' },
  { stroke: '#8b5cf6', fill: '#8b5cf6', name: 'violet' },
  { stroke: '#06b6d4', fill: '#06b6d4', name: 'cyan' },
  { stroke: '#f43f5e', fill: '#f43f5e', name: 'rose' },
  { stroke: '#3b82f6', fill: '#3b82f6', name: 'blue' },
  { stroke: '#ec4899', fill: '#ec4899', name: 'pink' },
  { stroke: '#14b8a6', fill: '#14b8a6', name: 'teal' },
  { stroke: '#f97316', fill: '#f97316', name: 'orange' },
];

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatShortDate(d: Date): string {
  return `${d.getDate()} ${MONTH_NAMES_SHORT[d.getMonth()]}`;
}

export default function WeeklySewingTrendChart({
  submissions,
  jobs,
  tailors,
  onNavigateToTailor,
}: WeeklySewingTrendChartProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [timeframe, setTimeframe] = useState<'4' | '8' | '12' | 'all'>('8');
  const [chartType, setChartType] = useState<'area' | 'bar' | 'tailors'>('area');
  const [selectedTailorId, setSelectedTailorId] = useState<string>('all');

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Map jobs to tailor for quick resolution
  const jobTailorMap = useMemo(() => {
    const map = new Map<number, number>();
    jobs.forEach(j => {
      if (j.id && j.tailorId) map.set(j.id, j.tailorId);
    });
    return map;
  }, [jobs]);

  // Tailor dictionary
  const tailorMap = useMemo(() => {
    const map = new Map<number, Tailor>();
    tailors.forEach(t => {
      if (t.id) map.set(t.id, t);
    });
    return map;
  }, [tailors]);

  // Active tailors list (excluding deleted)
  const activeTailors = useMemo(() => {
    return tailors.filter(t => t.status !== 'Dihapus');
  }, [tailors]);

  // Aggregate weekly data
  const { chartData, topTailorKeys, summary } = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return {
        chartData: [],
        topTailorKeys: [],
        summary: {
          currentWeekTotal: 0,
          previousWeekTotal: 0,
          growthPercent: 0,
          weeklyAverage: 0,
          peakWeekTotal: 0,
          peakWeekLabel: '-',
          totalInPeriod: 0,
          topTailorName: '-',
          topTailorQty: 0,
        },
      };
    }

    // Determine timeline boundaries
    let maxDate = new Date();
    let minDate = new Date();

    const validSubmissionDates = submissions
      .map(s => new Date(s.dateSubmitted))
      .filter(d => !isNaN(d.getTime()));

    if (validSubmissionDates.length > 0) {
      const timestamps = validSubmissionDates.map(d => d.getTime());
      const maxSubTime = Math.max(...timestamps);
      const minSubTime = Math.min(...timestamps);
      
      // If latest submission is newer than today, use that, else use today
      maxDate = new Date(Math.max(Date.now(), maxSubTime));
      minDate = new Date(minSubTime);
    }

    const latestMonday = getMonday(maxDate);

    // Calculate how many weeks to show
    let weeksCount = 8;
    if (timeframe === '4') weeksCount = 4;
    else if (timeframe === '8') weeksCount = 8;
    else if (timeframe === '12') weeksCount = 12;
    else if (timeframe === 'all') {
      const earliestMonday = getMonday(minDate);
      const diffWeeks = Math.ceil(
        (latestMonday.getTime() - earliestMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
      );
      weeksCount = Math.max(6, Math.min(diffWeeks + 1, 52));
    }

    // Generate chronological weeks (oldest to newest)
    const weeks: {
      weekIndex: number;
      weekStart: Date;
      weekEnd: Date;
      weekKey: string;
      label: string;
      fullLabel: string;
      total: number;
      tailorBreakdown: Record<number, { name: string; qty: number }>;
      [key: string]: any;
    }[] = [];

    for (let i = weeksCount - 1; i >= 0; i--) {
      const wStart = new Date(latestMonday);
      wStart.setDate(latestMonday.getDate() - i * 7);
      wStart.setHours(0, 0, 0, 0);

      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);

      const weekKey = `${wStart.getFullYear()}-${String(wStart.getMonth() + 1).padStart(2, '0')}-${String(wStart.getDate()).padStart(2, '0')}`;
      const label = `${formatShortDate(wStart)} - ${formatShortDate(wEnd)}`;
      const fullLabel = `${wStart.getDate()} ${MONTH_NAMES_FULL[wStart.getMonth()]} - ${wEnd.getDate()} ${MONTH_NAMES_FULL[wEnd.getMonth()]} ${wEnd.getFullYear()}`;

      weeks.push({
        weekIndex: weeksCount - 1 - i,
        weekStart: wStart,
        weekEnd: wEnd,
        weekKey,
        label,
        fullLabel,
        total: 0,
        tailorBreakdown: {},
      });
    }

    // Accumulate each submission into the matching week
    const tailorTotalInPeriod: Record<number, number> = {};

    submissions.forEach(sub => {
      const subDate = new Date(sub.dateSubmitted);
      if (isNaN(subDate.getTime())) return;

      const subTime = subDate.getTime();
      const targetWeek = weeks.find(w => subTime >= w.weekStart.getTime() && subTime <= w.weekEnd.getTime());
      if (!targetWeek) return;

      const tId = sub.tailorId || jobTailorMap.get(sub.jobId) || 0;
      const tailorObj = tailorMap.get(tId);
      const tailorName = tailorObj?.name || sub.tailorName || `Penjahit #${tId || '?'}`;
      const qty = Number(sub.qtySubmitted) || Number(sub.nominalQty) || 0;

      // If a specific tailor is filtered, only count that tailor
      if (selectedTailorId !== 'all' && String(tId) !== selectedTailorId) {
        return;
      }

      targetWeek.total += qty;

      if (!targetWeek.tailorBreakdown[tId]) {
        targetWeek.tailorBreakdown[tId] = { name: tailorName, qty: 0 };
      }
      targetWeek.tailorBreakdown[tId].qty += qty;

      // Track overall tailor totals in this timeframe
      tailorTotalInPeriod[tId] = (tailorTotalInPeriod[tId] || 0) + qty;
    });

    // Identify top 5 tailors for multi-tailor breakdown chart
    const sortedTailors = Object.entries(tailorTotalInPeriod)
      .map(([idStr, qty]) => {
        const id = Number(idStr);
        return {
          id,
          name: tailorMap.get(id)?.name || `Penjahit #${id}`,
          qty,
        };
      })
      .sort((a, b) => b.qty - a.qty);

    const top5Tailors = sortedTailors.slice(0, 5);

    // Format data for Recharts
    const formattedChartData = weeks.map(w => {
      const row: any = {
        name: w.label,
        fullLabel: w.fullLabel,
        total: w.total,
        rawBreakdown: w.tailorBreakdown,
      };

      // Add dynamic fields for top tailors
      top5Tailors.forEach(t => {
        const key = `tailor_${t.id}`;
        row[key] = w.tailorBreakdown[t.id]?.qty || 0;
      });

      return row;
    });

    // Calculate executive KPIs
    const currentWeek = weeks[weeks.length - 1];
    const previousWeek = weeks.length >= 2 ? weeks[weeks.length - 2] : null;

    const currentWeekTotal = currentWeek ? currentWeek.total : 0;
    const previousWeekTotal = previousWeek ? previousWeek.total : 0;

    let growthPercent = 0;
    if (previousWeekTotal > 0) {
      growthPercent = Math.round(((currentWeekTotal - previousWeekTotal) / previousWeekTotal) * 100);
    } else if (currentWeekTotal > 0) {
      growthPercent = 100;
    }

    const totalInPeriod = weeks.reduce((sum, w) => sum + w.total, 0);
    const weeklyAverage = Math.round(totalInPeriod / weeks.length);

    let peakWeekTotal = 0;
    let peakWeekLabel = '-';
    weeks.forEach(w => {
      if (w.total > peakWeekTotal) {
        peakWeekTotal = w.total;
        peakWeekLabel = w.label;
      }
    });

    // Top tailor in current week
    let topTailorName = '-';
    let topTailorQty = 0;
    if (currentWeek) {
      Object.values(currentWeek.tailorBreakdown).forEach(item => {
        if (item.qty > topTailorQty) {
          topTailorQty = item.qty;
          topTailorName = item.name;
        }
      });
    }

    // Fallback top tailor to whole period if current week has none
    if (topTailorQty === 0 && sortedTailors.length > 0) {
      topTailorName = sortedTailors[0].name;
      topTailorQty = sortedTailors[0].qty;
    }

    return {
      chartData: formattedChartData,
      topTailorKeys: top5Tailors,
      summary: {
        currentWeekTotal,
        previousWeekTotal,
        growthPercent,
        weeklyAverage,
        peakWeekTotal,
        peakWeekLabel,
        totalInPeriod,
        topTailorName,
        topTailorQty,
      },
    };
  }, [submissions, timeframe, selectedTailorId, jobTailorMap, tailorMap]);

  // Custom sleek tooltip
  const renderCustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;

    const dataItem = payload[0]?.payload;
    const fullDateRange = dataItem?.fullLabel || label;
    const totalQty = dataItem?.total || 0;
    const rawBreakdown: Record<number, { name: string; qty: number }> = dataItem?.rawBreakdown || {};

    const breakdownList = Object.values(rawBreakdown).sort((a, b) => b.qty - a.qty);

    return (
      <div className="bg-slate-900/95 text-white backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-slate-700/80 min-w-[240px] text-xs space-y-3 z-50">
        <div className="border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] uppercase tracking-wider">
            <Calendar size={12} className="text-indigo-400" />
            <span>Periode Mingguan</span>
          </div>
          <p className="font-extrabold text-sm text-slate-100 mt-0.5">{fullDateRange}</p>
        </div>

        <div className="flex items-baseline justify-between bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/50">
          <span className="text-slate-300 font-bold">Total Selesai:</span>
          <span className="text-base font-black text-indigo-400 tabular-nums">
            {totalQty.toLocaleString('id-ID')} <span className="text-xs text-slate-400 font-normal">pcs</span>
          </span>
        </div>

        {breakdownList.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Kontribusi Penjahit ({breakdownList.length})
            </p>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {breakdownList.map((item, idx) => {
                const colorObj = TAILOR_PALETTE[idx % TAILOR_PALETTE.length];
                const pct = totalQty > 0 ? Math.round((item.qty / totalQty) * 100) : 0;
                return (
                  <div key={idx} className="flex items-center justify-between gap-3 text-[11px] py-0.5">
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorObj.stroke }}
                      />
                      <span className="truncate text-slate-200 font-medium">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-100 tabular-nums">{item.qty} pcs</span>
                      <span className="text-[10px] text-slate-400 font-mono w-8 text-right">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const selectedTailorObj = useMemo(() => {
    if (selectedTailorId === 'all') return null;
    return tailors.find(t => String(t.id) === selectedTailorId) || null;
  }, [selectedTailorId, tailors]);

  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-5 sm:p-7 md:p-8 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
      {/* Background Accent Watermark */}
      <div className="absolute -right-6 -bottom-6 opacity-5 text-indigo-600 pointer-events-none group-hover:scale-105 transition-transform duration-500">
        <TrendingUp size={240} />
      </div>

      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100 relative z-10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Tren Jahitan Selesai Mingguan
                </h3>
                <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Recharts
                </span>
              </div>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                Pantau kecepatan dan konsistensi produktivitas penjahit per minggu
              </p>
            </div>
          </div>
        </div>

        {/* Controls: Timeframe, Chart Style, Tailor Filter */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Filter Penjahit Dropdown */}
          <div className="relative">
            <select
              value={selectedTailorId}
              onChange={e => setSelectedTailorId(e.target.value)}
              className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2 pr-8 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
            >
              <option value="all">Semua Penjahit (Total)</option>
              {activeTailors.map(t => (
                <option key={t.id} value={String(t.id)}>
                  {t.name} {t.partnerName ? `& ${t.partnerName}` : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Timeframe Selector */}
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setTimeframe('4')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === '4' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              4 Mgg
            </button>
            <button
              onClick={() => setTimeframe('8')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === '8' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              8 Mgg
            </button>
            <button
              onClick={() => setTimeframe('12')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === '12' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              12 Mgg
            </button>
            <button
              onClick={() => setTimeframe('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                timeframe === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Semua
            </button>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setChartType('area')}
              title="Grafik Area & Garis Tren"
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                chartType === 'area' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TrendingUp size={14} />
              <span className="hidden sm:inline">Kurva</span>
            </button>
            <button
              onClick={() => setChartType('bar')}
              title="Diagram Batang Total"
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                chartType === 'bar' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 size={14} />
              <span className="hidden sm:inline">Batang</span>
            </button>
            {selectedTailorId === 'all' && (
              <button
                onClick={() => setChartType('tailors')}
                title="Bandingkan Penjahit Terbanyak"
                className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  chartType === 'tailors' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers size={14} />
                <span className="hidden sm:inline">Top Penjahit</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 py-5 border-b border-slate-100 relative z-10">
        {/* Metric 1: Output Minggu Ini */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Output Minggu Ini
            </span>
            {summary.growthPercent >= 0 ? (
              <span className="inline-flex items-center text-[10px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                <TrendingUp size={11} className="mr-0.5" /> +{summary.growthPercent}%
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-extrabold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md">
                <TrendingDown size={11} className="mr-0.5" /> {summary.growthPercent}%
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-slate-900 tabular-nums">
              {summary.currentWeekTotal.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold text-slate-400">pcs</span>
          </div>
          <p className="text-[10px] font-medium text-slate-500 mt-1">
            vs mgg lalu: {summary.previousWeekTotal.toLocaleString('id-ID')} pcs
          </p>
        </div>

        {/* Metric 2: Rata-Rata Mingguan */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3.5 sm:p-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
            Rata-rata Mingguan
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-indigo-600 tabular-nums">
              {summary.weeklyAverage.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold text-slate-400">pcs / mgg</span>
          </div>
          <p className="text-[10px] font-medium text-slate-500 mt-1">
            Total {summary.totalInPeriod.toLocaleString('id-ID')} pcs di periode ini
          </p>
        </div>

        {/* Metric 3: Puncak Produksi */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3.5 sm:p-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
            Puncak Output Tertinggi
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-600 tabular-nums">
              {summary.peakWeekTotal.toLocaleString('id-ID')}
            </span>
            <span className="text-xs font-bold text-slate-400">pcs</span>
          </div>
          <p className="text-[10px] font-medium text-slate-500 mt-1 truncate" title={summary.peakWeekLabel}>
            Minggu: {summary.peakWeekLabel}
          </p>
        </div>

        {/* Metric 4: Penjahit Terproduktif */}
        <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-3.5 sm:p-4">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
            <span>{selectedTailorId === 'all' ? 'Top Penjahit' : 'Penjahit Terpilih'}</span>
            <Award size={13} className="text-amber-500" />
          </span>
          <div className="flex items-baseline gap-1.5 truncate">
            <span className="text-base sm:text-lg font-black text-slate-900 truncate" title={selectedTailorObj?.name || summary.topTailorName}>
              {selectedTailorObj?.name || summary.topTailorName}
            </span>
          </div>
          <p className="text-[10px] font-bold text-indigo-600 mt-1">
            {summary.topTailorQty.toLocaleString('id-ID')} pcs selesai
          </p>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="pt-6 relative z-10">
        {!isMounted ? (
          <div className="h-72 w-full flex items-center justify-center bg-slate-50/50 rounded-2xl border border-slate-100">
            <span className="text-xs font-bold text-slate-400">Memuat visualisasi grafik...</span>
          </div>
        ) : chartData.length === 0 || summary.totalInPeriod === 0 ? (
          /* Empty state */
          <div className="h-72 w-full flex flex-col items-center justify-center bg-slate-50/60 rounded-3xl border border-slate-100 p-8 text-center">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mb-3">
              <Scissors size={28} />
            </div>
            <h4 className="text-base font-extrabold text-slate-900">Belum Ada Riwayat Jahitan Selesai</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
              Data grafik tren mingguan akan otomatis muncul begitu penjahit melakukan setoran jahitan ("Setor Jahitan") di menu Penjahit.
            </p>
            {onNavigateToTailor && (
              <button
                onClick={onNavigateToTailor}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
              >
                Ke Menu Penjahit <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        ) : (
          <div className="w-full">
            {/* Chart Legends for Top Tailors Mode */}
            {chartType === 'tailors' && selectedTailorId === 'all' && topTailorKeys.length > 0 && (
              <div className="flex flex-wrap items-center justify-end gap-3 mb-4 text-xs">
                {topTailorKeys.map((tailor, idx) => {
                  const color = TAILOR_PALETTE[idx % TAILOR_PALETTE.length].stroke;
                  return (
                    <div key={tailor.id} className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-bold text-slate-700">{tailor.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' ? (
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sewingTrendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      dy={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val))}
                    />
                    <Tooltip content={renderCustomTooltip} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="Total Jahitan"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#sewingTrendGradient)"
                      activeDot={{ r: 6, fill: '#4f46e5', stroke: '#ffffff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                ) : chartType === 'bar' ? (
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      dy={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val))}
                    />
                    <Tooltip content={renderCustomTooltip} />
                    <Bar
                      dataKey="total"
                      name="Total Jahitan"
                      fill="#6366f1"
                      radius={[8, 8, 0, 0]}
                      maxBarSize={48}
                    />
                  </BarChart>
                ) : (
                  /* Stacked / Multi-tailor comparison */
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={{ stroke: '#e2e8f0' }}
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                      dy={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 600 }}
                      tickFormatter={(val: number) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val))}
                    />
                    <Tooltip content={renderCustomTooltip} />
                    {topTailorKeys.map((tailor, idx) => {
                      const color = TAILOR_PALETTE[idx % TAILOR_PALETTE.length].stroke;
                      return (
                        <Bar
                          key={tailor.id}
                          dataKey={`tailor_${tailor.id}`}
                          name={tailor.name}
                          stackId="a"
                          fill={color}
                          radius={idx === topTailorKeys.length - 1 ? [8, 8, 0, 0] : [0, 0, 0, 0]}
                          maxBarSize={48}
                        />
                      );
                    })}
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info & Hint */}
      <div className="pt-4 mt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500 font-medium">
        <div className="flex items-center gap-1.5 text-slate-500">
          <Sparkles size={13} className="text-indigo-500" />
          <span>
            {selectedTailorId === 'all'
              ? 'Data menampilkan akumulasi seluruh jahitan yang telah diserahkan oleh semua penjahit.'
              : `Menampilkan tren produksi khusus untuk penjahit ${selectedTailorObj?.name || 'terpilih'}.`}
          </span>
        </div>
        <div className="text-slate-400">
          Minggu berjalan diperbarui secara real-time
        </div>
      </div>
    </div>
  );
}
