import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Bot, Play, Eye, Loader2, Timer, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../utils/api';
import { timeAgo } from '../utils/helpers';

const fmtH = (h) => {
  if (h === null || h === undefined) return '—';
  return h >= 48 ? `${(h / 24).toFixed(1)} d` : `${h} h`;
};

function Stat({ icon: Icon, label, value, tone = 'text-gray-500' }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <Icon size={20} className={tone} />
      <div>
        <p className="text-lg font-bold text-gray-900 dark:text-white leading-none">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

/**
 * Department performance + response time.
 *  mode='admin'      all departments in the admin's scope + SLA agent controls
 *  mode='department' the logged-in department's own numbers
 */
export default function PerformancePanel({ mode = 'admin' }) {
  const isAdmin = mode === 'admin';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState([]);
  const [running, setRunning] = useState('');
  const [runResult, setRunResult] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data: d } = await api.get(isAdmin ? '/admin/performance' : '/department/performance');
      setData(d);
      if (isAdmin) {
        const a = await api.get('/admin/agent/actions');
        setActions(a.data.actions || []);
      }
    } catch (e) {
      toast.error('Could not load performance data');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const runAgent = async (dryRun) => {
    setRunning(dryRun ? 'dry' : 'run');
    try {
      const { data: r } = await api.post('/admin/agent/run', { dryRun });
      setRunResult(r);
      if (!dryRun) {
        toast.success(r.filed.length ? `Agent filed ${r.filed.length} escalation complaint(s)` : 'No SLA breaches to escalate');
        load();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Agent run failed');
    } finally {
      setRunning('');
    }
  };

  if (loading) return <div className="card p-10 text-center text-gray-400"><Loader2 className="animate-spin inline mr-2" size={16} />Loading performance…</div>;
  if (!data) return null;

  const { rows, summary, slaHours } = data;
  const chart = rows.map((r) => ({ name: r.name.length > 16 ? `${r.name.slice(0, 15)}…` : r.name, Response: r.avgResponseHours || 0, Resolution: r.avgResolutionHours || 0 }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isAdmin && <Stat icon={Building2} label="Departments" value={summary.departments} tone="text-indigo-500" />}
        <Stat icon={Timer} label="Avg response time" value={fmtH(summary.avgResponseHours)} tone="text-blue-500" />
        <Stat icon={CheckCircle2} label="Avg resolution time" value={fmtH(summary.avgResolutionHours)} tone="text-green-600" />
        <Stat icon={AlertTriangle} label="SLA breaches" value={summary.slaBreaches} tone="text-red-500" />
      </div>

      <p className="text-xs text-gray-400">
        Response time = assignment → first action (In Progress). Resolution time = assignment → resolved. SLA limits:{' '}
        {Object.entries(slaHours).map(([k, v]) => `${k} ${v}h`).join(' · ')}.
      </p>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">No department activity to measure yet.</div>
      ) : (
        <>
          {isAdmin && rows.length > 0 && (
            <div className="card p-4">
              <p className="font-semibold text-gray-800 dark:text-white mb-3 text-sm">Average response &amp; resolution time (hours)</p>
              <div style={{ height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Response" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Resolution" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500 bg-gray-50 dark:bg-gray-800">
                <tr>
                  {['Department', 'Total', 'Open', 'Resolved', 'Resolution %', 'Avg response', 'Avg resolution', 'SLA breaches', 'On-time %', 'Rating'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((r) => (
                  <tr key={r.departmentId}>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900 dark:text-white">{r.name}</p>
                      <p className="text-xs text-gray-400">{[r.category, r.district].filter(Boolean).join(' · ')}</p>
                    </td>
                    <td className="px-3 py-2">{r.total}</td>
                    <td className="px-3 py-2">{r.open}</td>
                    <td className="px-3 py-2">{r.resolved}</td>
                    <td className="px-3 py-2">{r.resolutionRate}%</td>
                    <td className="px-3 py-2">{fmtH(r.avgResponseHours)}</td>
                    <td className="px-3 py-2">{fmtH(r.avgResolutionHours)}</td>
                    <td className="px-3 py-2">
                      <span className={r.slaBreaches ? 'text-red-600 font-semibold' : 'text-gray-500'}>{r.slaBreaches}</span>
                    </td>
                    <td className="px-3 py-2">{r.onTimeRate}%</td>
                    <td className="px-3 py-2">{r.avgRating ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!isAdmin && (
        <p className="text-xs text-gray-400">
          Complaints that stay open past their SLA are escalated automatically to your district admin.
        </p>
      )}

      {isAdmin && (
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 font-semibold text-gray-800 dark:text-white">
              <Bot size={18} className="text-primary-600" /> SLA agent
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${data.agentEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {data.agentEnabled ? 'Active — checks automatically' : 'Disabled (AGENT_SLA_ENABLED=false)'}
            </span>
            <div className="ml-auto flex gap-2">
              <button onClick={() => runAgent(true)} disabled={!!running} className="btn-secondary text-sm inline-flex items-center gap-1.5">
                {running === 'dry' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} Preview
              </button>
              <button onClick={() => runAgent(false)} disabled={!!running} className="btn-primary text-sm inline-flex items-center gap-1.5">
                {running === 'run' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Run now
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            When a complaint stays open longer than its SLA, the agent automatically files a Critical escalation
            complaint to the district admin, notifies the department, and never files the same breach twice.
          </p>

          {runResult && (
            <div className="text-sm rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
              <p className="font-medium">
                {runResult.dryRun ? 'Preview (nothing was filed): ' : 'Run complete: '}
                {runResult.breachesFound} breach(es) found, {runResult.filed.length} {runResult.dryRun ? 'would be filed' : 'filed'}
                {runResult.skipped.length ? `, ${runResult.skipped.length} skipped` : ''}.
              </p>
              {runResult.filed.map((f) => (
                <p key={f.originalTrackingId} className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                  {f.originalTrackingId} · {f.title} — {f.department}, open {f.ageHours}h (limit {f.slaHours}h)
                  {f.escalationTrackingId ? ` → ${f.escalationTrackingId}` : ''}
                </p>
              ))}
              {runResult.skipped.map((s) => (
                <p key={s.originalTrackingId} className="text-xs text-amber-600 mt-1">{s.originalTrackingId}: {s.reason}</p>
              ))}
              {runResult.note && <p className="text-xs text-gray-400 mt-1">{runResult.note}</p>}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">Complaints filed by the agent</p>
            {actions.length === 0 ? (
              <p className="text-xs text-gray-400">None yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {actions.map((a) => (
                  <li key={a._id} className="py-2 text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">{a.title}</p>
                    <p className="text-xs text-gray-400">{a.trackingId} · {a.status} · {timeAgo(a.createdAt)}{a.relatedComplaint?.trackingId ? ` · re: ${a.relatedComplaint.trackingId}` : ''}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}