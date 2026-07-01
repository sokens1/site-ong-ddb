import React, { useMemo, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Users, Mail, TrendingUp, Calendar, Clock, Target, Award, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Registration {
  id: number;
  fullname?: string;
  email?: string;
  phone?: string;
  created_at?: string;
  custom_data?: Record<string, any>;
}

interface FormField {
  id: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
}

interface EventStatsTabProps {
  registrations: Registration[];
  formFields: FormField[];
  maxSlots?: number | null;
  eventDate?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#16a34a', '#22c55e', '#4ade80', '#86efac', '#34d399',
  '#2dd4bf', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c',
];

const VISITOR_EMAIL = 'visiteur@ong-ddb.org';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateLabel = (key: string) =>
  new Date(key).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// ─── TextResponseCard ─────────────────────────────────────────────────────────
// Compact scrollable display for text/textarea fields

const TextResponseCard: React.FC<{
  field: FormField;
  responses: { id: number; value: string }[];
}> = ({ field, responses }) => {
  const [expanded, setExpanded] = useState(false);

  // Group identical answers
  const grouped = useMemo(() => {
    const map: Record<string, number> = {};
    responses.forEach(r => {
      const v = r.value.trim();
      if (v) map[v] = (map[v] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [responses]);

  const isLong = field.type === 'textarea';
  const PREVIEW_COUNT = 5;
  const visible = expanded ? grouped : grouped.slice(0, PREVIEW_COUNT);
  const hiddenCount = grouped.length - PREVIEW_COUNT;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-bold text-gray-700">{field.label}</p>
        </div>
        <span className="flex-shrink-0 text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
          {responses.length} réponse{responses.length > 1 ? 's' : ''}
        </span>
      </div>

      {isLong ? (
        // Textarea: vertical list with truncated rows
        <div className="space-y-2">
          {visible.map(([text, count], i) => (
            <div key={i} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 mt-2" />
              <p className="text-sm text-gray-600 flex-1 leading-relaxed line-clamp-2">{text}</p>
              {count > 1 && (
                <span className="flex-shrink-0 text-xs font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  ×{count}
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        // Short text: chips/tags layout
        <div className="flex flex-wrap gap-2">
          {visible.map(([text, count], i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-100 text-sm text-gray-700"
              title={text}
            >
              <span className="max-w-[180px] truncate">{text}</span>
              {count > 1 && (
                <span className="text-xs font-black text-green-600 bg-green-50 px-1.5 rounded-full">
                  ×{count}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {grouped.length > PREVIEW_COUNT && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-3 flex items-center gap-1 text-xs font-bold text-green-600 hover:text-green-800 transition-colors"
        >
          {expanded ? (
            <><ChevronUp size={13} /> Réduire</>
          ) : (
            <><ChevronDown size={13} /> {hiddenCount} réponse{hiddenCount > 1 ? 's' : ''} de plus</>
          )}
        </button>
      )}
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

const EventStatsTab: React.FC<EventStatsTabProps> = ({
  registrations,
  formFields,
  maxSlots,
  eventDate,
}) => {
  // ── KPI calculations ───────────────────────────────────────────────────────

  const total = registrations.length;
  const fillRate = maxSlots && maxSlots > 0 ? Math.round((total / maxSlots) * 100) : null;
  const remaining = maxSlots ? Math.max(0, maxSlots - total) : null;

  const emailCount = useMemo(
    () => registrations.filter(r => r.email && r.email !== VISITOR_EMAIL).length,
    [registrations],
  );

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const thisWeekCount = useMemo(
    () =>
      registrations.filter(r => {
        if (!r.created_at) return false;
        const d = new Date(r.created_at);
        return d >= weekAgo && d <= now;
      }).length,
    [registrations],
  );

  const todayCount = useMemo(
    () => registrations.filter(r => r.created_at?.startsWith(todayStr)).length,
    [registrations, todayStr],
  );

  // ── Timeline data (daily + cumulative) ────────────────────────────────────

  const timelineData = useMemo(() => {
    if (registrations.length === 0) return [];

    const byDay: Record<string, number> = {};
    registrations.forEach(r => {
      if (r.created_at) {
        const day = r.created_at.split('T')[0];
        byDay[day] = (byDay[day] || 0) + 1;
      }
    });

    const keys = Object.keys(byDay).sort();
    if (keys.length === 0) return [];

    const startDate = new Date(keys[0]);
    const endDate = new Date(keys[keys.length - 1]);
    const filled: { date: string; count: number; cumulative: number }[] = [];
    let cumulative = 0;

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split('T')[0];
      const count = byDay[key] || 0;
      cumulative += count;
      filled.push({ date: formatDateLabel(key), count, cumulative });
    }

    return filled;
  }, [registrations]);

  // ── Hourly distribution ───────────────────────────────────────────────────

  const hourlyData = useMemo(() => {
    const counts: Record<number, number> = {};
    registrations.forEach(r => {
      if (r.created_at) {
        const h = new Date(r.created_at).getHours();
        counts[h] = (counts[h] || 0) + 1;
      }
    });
    return Array.from({ length: 18 }, (_, i) => {
      const h = i + 6;
      return { hour: `${h}h`, count: counts[h] || 0 };
    });
  }, [registrations]);

  // ── Form field distributions (select / radio / checkbox only) ─────────────
  // Only counts values that match the field's current options → filters out
  // stale answers from registrations made before the form was changed.

  const fieldCharts = useMemo(() => {
    const chartableTypes = ['select', 'radio', 'checkbox'];
    return formFields
      .filter(f => chartableTypes.includes(f.type))
      .map(field => {
        const validOptions = field.options && field.options.length > 0
          ? new Set(field.options.map(o => o.trim()))
          : null; // null = no options defined, accept all

        const valueCounts: Record<string, number> = {};
        registrations.forEach(reg => {
          const val = reg.custom_data?.[field.id];
          if (val === undefined || val === null || val === '') return;
          const values = Array.isArray(val) ? val : [String(val)];
          values.forEach(v => {
            const trimmed = v.trim();
            if (!trimmed) return;
            // Skip values that are not in the current options (corrupted / stale)
            if (validOptions && !validOptions.has(trimmed)) return;
            valueCounts[trimmed] = (valueCounts[trimmed] || 0) + 1;
          });
        });

        const entries = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]);
        if (entries.length === 0) return null;
        return { field, entries };
      })
      .filter(Boolean) as { field: FormField; entries: [string, number][] }[];
  }, [registrations, formFields]);

  // ── Text field responses ───────────────────────────────────────────────────

  const textFieldsDisplay = useMemo(() => {
    return formFields
      .filter(f => f.type === 'text' || f.type === 'textarea')
      .map(field => {
        const responses = registrations
          .map(r => ({ id: r.id, value: String(r.custom_data?.[field.id] ?? '').trim() }))
          .filter(r => r.value !== '');
        return { field, responses };
      })
      .filter(r => r.responses.length > 0);
  }, [registrations, formFields]);

  // ── Last registration ─────────────────────────────────────────────────────

  const lastReg = useMemo(() => {
    if (registrations.length === 0) return null;
    return [...registrations].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
    )[0];
  }, [registrations]);

  // ── Empty state ───────────────────────────────────────────────────────────

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <TrendingUp size={28} className="text-gray-300" />
        </div>
        <p className="text-lg font-bold text-gray-500">Aucune donnée à afficher</p>
        <p className="text-sm text-gray-400 mt-1 text-center">
          Les statistiques apparaîtront dès qu'il y aura des inscriptions.
        </p>
      </div>
    );
  }

  // ── Progress bar color ────────────────────────────────────────────────────

  const progressColor =
    fillRate === null
      ? 'bg-green-500'
      : fillRate >= 90
      ? 'bg-red-500'
      : fillRate >= 70
      ? 'bg-orange-500'
      : 'bg-green-500';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="px-6 sm:px-10 py-8 space-y-8">

      {/* ── KPI Cards ── */}
      <div>
        <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Vue d'ensemble</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center">
                <Users size={16} className="text-green-700" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Inscrits</span>
            </div>
            <p className="text-3xl font-black text-green-700">{total}</p>
            <p className="text-xs text-gray-400 mt-1">participant{total > 1 ? 's' : ''}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${maxSlots ? 'bg-orange-100' : 'bg-violet-100'}`}>
                <Target size={16} className={maxSlots ? 'text-orange-600' : 'text-violet-600'} />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Capacité</span>
            </div>
            {maxSlots ? (
              <>
                <p className={`text-3xl font-black ${fillRate !== null && fillRate >= 80 ? 'text-orange-600' : 'text-blue-600'}`}>
                  {fillRate}%
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {remaining} place{remaining !== 1 ? 's' : ''} restante{remaining !== 1 ? 's' : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-black text-violet-600">Libre</p>
                <p className="text-xs text-gray-400 mt-1">entrée sans limite</p>
              </>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center">
                <Mail size={16} className="text-teal-700" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Emails</span>
            </div>
            <p className="text-3xl font-black text-teal-700">{emailCount}</p>
            <p className="text-xs text-gray-400 mt-1">contacts collectés</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Calendar size={16} className="text-indigo-700" />
              </div>
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Récents</span>
            </div>
            <p className="text-3xl font-black text-indigo-700">{thisWeekCount}</p>
            <p className="text-xs text-gray-400 mt-1">
              cette semaine
              {todayCount > 0 && (
                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[10px]">
                  +{todayCount} auj.
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {maxSlots && fillRate !== null && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <Award size={16} className="text-gray-500" />
              <span className="text-sm font-bold text-gray-700">Remplissage de la salle</span>
            </div>
            <span className="text-sm font-bold text-gray-500">
              {total} / {maxSlots} places
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all duration-700 ${progressColor}`}
              style={{ width: `${Math.min(100, fillRate)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-gray-400">0</span>
            <span className={`text-xs font-bold ${fillRate >= 90 ? 'text-red-500' : fillRate >= 70 ? 'text-orange-500' : 'text-green-600'}`}>
              {fillRate}%
            </span>
            <span className="text-xs text-gray-400">{maxSlots}</span>
          </div>
        </div>
      )}

      {/* ── Timeline : cumulative ── */}
      {timelineData.length > 1 && (
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Évolution cumulative</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timelineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                  labelStyle={{ fontWeight: 700, color: '#374151' }}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  stroke="#16a34a"
                  strokeWidth={2.5}
                  fill="url(#gradGreen)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#16a34a' }}
                  name="Cumulatif"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Inscriptions par jour ── */}
      {timelineData.length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Inscriptions par jour</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={timelineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                  labelStyle={{ fontWeight: 700, color: '#374151' }}
                />
                <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} name="Inscriptions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Distribution horaire ── */}
      {registrations.some(r => r.created_at) && (
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Distribution horaire</p>
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={hourlyData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                  labelStyle={{ fontWeight: 700, color: '#374151' }}
                />
                <Bar dataKey="count" fill="#4ade80" radius={[3, 3, 0, 0]} name="Inscriptions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Form field distributions (select / radio / checkbox) ── */}
      {fieldCharts.length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Réponses au formulaire</p>
          <div className="space-y-5">
            {fieldCharts.map(({ field, entries }) => {
              const data = entries.map(([name, value]) => ({ name, value }));
              const isDonut = data.length <= 6;

              return (
                <div key={field.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <p className="text-sm font-bold text-gray-700 mb-4">{field.label}</p>

                  {isDonut ? (
                    <div className="flex items-center gap-6 flex-wrap">
                      <ResponsiveContainer width={150} height={150}>
                        <PieChart>
                          <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            dataKey="value"
                            paddingAngle={2}
                          >
                            {data.map((_, i) => (
                              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-2">
                        {data.map((item, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                            <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                            <span className="text-xs text-gray-400 font-bold ml-auto pl-3">{item.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
                      <BarChart
                        data={data}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 8, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#374151' }}
                          tickLine={false}
                          axisLine={false}
                          width={120}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} name="Réponses">
                          {data.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Text field responses ── */}
      {textFieldsDisplay.length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Réponses texte</p>
          <div className="space-y-5">
            {textFieldsDisplay.map(({ field, responses }) => (
              <TextResponseCard key={field.id} field={field} responses={responses} />
            ))}
          </div>
        </div>
      )}

      {/* ── Dernière inscription ── */}
      {lastReg && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Clock size={18} className="text-gray-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Dernière inscription</p>
            <p className="text-sm font-bold text-gray-800">
              {lastReg.fullname || 'Anonyme'}
            </p>
            {lastReg.created_at && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(lastReg.created_at).toLocaleString('fr-FR', {
                  day: '2-digit', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default EventStatsTab;
