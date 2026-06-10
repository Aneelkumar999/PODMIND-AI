import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, AreaChart, Area, LineChart, Line
} from 'recharts';
import { motion } from 'framer-motion';
import { Activity as ActivityIcon, Database, Network, ServerCog, ShieldAlert, Search, Filter } from 'lucide-react';

interface MetricsDashboardProps {
  metrics: any;
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  namespaceFilter: string;
  setNamespaceFilter: (v: string) => void;
  riskFilter: string;
  setRiskFilter: (v: string) => void;
}

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ 
  metrics, 
  searchTerm, setSearchTerm, 
  namespaceFilter, setNamespaceFilter, 
  riskFilter, setRiskFilter 
}) => {
  const namespaces = useMemo(() => {
    // We want to show all possible namespaces even if one is selected
    // So we use a hardcoded list for simulation or extract from full metrics if possible
    // But since fetchMetrics now filters on the backend, we might need a separate call for namespaces
    // For now, let's keep it simple: if simulation, use the known namespaces.
    if (metrics?.is_simulated) return ['production', 'data'];
    
    if (!metrics || !metrics.pods) return [];
    const set = new Set(metrics.pods.map((p: any) => p.namespace || 'default'));
    return Array.from(set);
  }, [metrics]);

  const filteredPods = useMemo(() => {
    if (!metrics || !metrics.pods) return [];
    return metrics.pods.filter((pod: any) => {
      const matchesSearch = pod.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (pod.labels?.app || '').toLowerCase().includes(searchTerm.toLowerCase());
      // Backend already filters by namespace if selected, but we keep it here for safety
      const matchesNamespace = namespaceFilter === 'all' || (pod.namespace || 'default') === namespaceFilter;
      const matchesRisk = riskFilter === 'all' || pod.risk_level === riskFilter;
      return matchesSearch && matchesNamespace && matchesRisk;
    });
  }, [metrics, searchTerm, namespaceFilter, riskFilter]);


  if (!metrics || !metrics.pods) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="font-bold tracking-widest uppercase text-xs">Establishing Data Stream...</p>
      </div>
    );
  }

  const podData = filteredPods.map((p: any) => ({
    name: p.name.split('-').slice(0, 2).join('-'),
    namespace: p.namespace,
    cpu: p.cpu_millicores,
    memory: p.memory_mib,
    disk: Number(((p.disk_read_kbps || 0) + (p.disk_write_kbps || 0)).toFixed(2)),
    network: Number(((p.network_rx_kbps || 0) + (p.network_tx_kbps || 0)).toFixed(2)),
    risk: p.risk_score || 0,
    riskLevel: p.risk_level || 'healthy',
    restarts: p.restarts,
    status: p.status
  }));


  const totalCpu = podData.reduce((sum: number, pod: any) => sum + pod.cpu, 0);
  const totalMemory = podData.reduce((sum: number, pod: any) => sum + pod.memory, 0);
  const totalDisk = podData.reduce((sum: number, pod: any) => sum + pod.disk, 0);
  const totalNetwork = podData.reduce((sum: number, pod: any) => sum + pod.network, 0);
  const riskiestPod = [...filteredPods].sort((a: any, b: any) => (b.risk_score || 0) - (a.risk_score || 0))[0];
  const COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa'];
  const riskClass = (level: string) => {
    if (level === 'critical') return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
    if (level === 'warning') return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  };
  const riskBar = (level: string) => {
    if (level === 'critical') return 'bg-rose-500';
    if (level === 'warning') return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="flex flex-col gap-8 h-full overflow-y-auto pr-4 custom-scrollbar">
      {/* Filtering Section */}
      <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input 
            type="text" 
            placeholder="Search workloads..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-slate-500" />
          <select 
            value={namespaceFilter}
            onChange={(e) => setNamespaceFilter(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          >
            <option value="all">All Namespaces</option>
            {(namespaces as string[]).map((ns) => (
  <option key={ns} value={ns}>
    {ns}
  </option>
))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <ShieldAlert size={14} className="text-slate-500" />
          <select 
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-xl py-2 px-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          >
            <option value="all">All Risk Levels</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-auto">
          Showing {filteredPods.length} / {metrics.pods.length} Workloads
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">

        {[
          { label: 'CPU', value: `${totalCpu.toFixed(0)}m`, icon: ServerCog, color: 'text-sky-400' },
          { label: 'Memory', value: `${totalMemory.toFixed(0)}Mi`, icon: ActivityIcon, color: 'text-emerald-400' },
          { label: 'Disk I/O', value: `${totalDisk.toFixed(0)} KB/s`, icon: Database, color: 'text-amber-400' },
          { label: 'Network', value: `${totalNetwork.toFixed(0)} KB/s`, icon: Network, color: 'text-rose-400' },
          { label: 'Top Risk', value: `${riskiestPod?.risk_score || 0}/100`, icon: ShieldAlert, color: riskiestPod?.risk_level === 'critical' ? 'text-rose-400' : riskiestPod?.risk_level === 'warning' ? 'text-amber-400' : 'text-emerald-400' },
        ].map((item) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/5 rounded-2xl p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{item.label}</span>
              <item.icon size={18} className={item.color} />
            </div>
            <div className="mt-4 text-2xl font-black text-slate-100">{item.value}</div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* CPU Usage Card */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white/5 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-32 h-32 bg-indigo-500 blur-3xl rounded-full"></div>
          </div>
          
          <div className="relative z-10">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-indigo-400 mb-8 flex items-center gap-3">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
              CPU Distribution
            </h3>
            
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={podData}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCpu)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
            <div className="w-32 h-32 bg-purple-500 blur-3xl rounded-full"></div>
          </div>

          <div className="relative z-10">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-purple-400 mb-8 flex items-center gap-3">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
              Memory Footprint (MiB)
            </h3>
            
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={podData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} width={80} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}
                    itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="memory" radius={[0, 8, 8, 0]} barSize={20}>
                    {podData.map((_entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="bg-white/5 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden"
        >
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-400 mb-8 flex items-center gap-3">
            <Database size={16} />
            Disk and PVC Activity
          </h3>
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={podData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
                <Line type="monotone" dataKey="disk" stroke="#f59e0b" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="restarts" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {metrics.pvcs?.map((pvc: any) => (
              <div key={`${pvc.namespace}-${pvc.name}`} className="rounded-xl border border-white/5 bg-black/10 p-4">
                <div className="text-xs font-bold text-slate-200">{pvc.name}</div>
                <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-500">
                  {pvc.namespace} · {pvc.capacity} · {pvc.estimated_iops || 0} IOPS · {pvc.estimated_latency_ms || 0}ms
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 p-8 rounded-[2rem] border border-white/5 relative overflow-hidden"
        >
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-rose-400 mb-8 flex items-center gap-3">
            <Network size={16} />
            Network Flow
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={podData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px' }} />
                <Bar dataKey="network" radius={[8, 8, 0, 0]} barSize={28}>
                  {podData.map((_entry: any, index: number) => (
                    <Cell key={`network-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white/5 rounded-[2rem] border border-white/5 overflow-hidden"
      >
        <table className="w-full text-left">
          <thead>
            <tr className="bg-white/5 border-b border-white/5">
              <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Instance Identity</th>
              <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Namespace</th>
              <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Stability</th>
              <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Compute</th>
              <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Memory</th>
              <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">I/O</th>
              <th className="px-10 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-500 text-right">Risk Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredPods.map((pod: any, idx: number) => (
              <motion.tr 
                key={pod.name}

                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + (idx * 0.05) }}
                className="hover:bg-white/5 transition-colors group cursor-default"
              >
                <td className="px-10 py-6">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-200 group-hover:text-indigo-400 transition-colors">{pod.name}</span>
                    <span className="text-[10px] text-slate-600 font-mono mt-0.5">{pod.labels?.app || 'unlabeled'}</span>
                  </div>
                </td>
                <td className="px-10 py-6 font-mono text-xs text-slate-500">{pod.namespace || 'default'}</td>
                <td className="px-10 py-6">
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                    pod.status === 'Running' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 
                    'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    <div className={`w-1 h-1 rounded-full ${pod.status === 'Running' ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`}></div>
                    {pod.status}
                  </div>
                </td>
                <td className="px-10 py-6 font-mono text-sm text-slate-400">{pod.cpu_millicores}m</td>
                <td className="px-10 py-6 font-mono text-sm text-slate-400">{pod.memory_mib}Mi</td>
                <td className="px-10 py-6 font-mono text-xs text-slate-400">
                  {(pod.disk_read_kbps || 0) + (pod.disk_write_kbps || 0)} KB/s
                </td>
                <td className="px-10 py-6 text-right">
                   <div className="flex items-center justify-end gap-3">
                      <div className="w-24 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, pod.risk_score || 0)}%` }}
                          className={`h-full ${riskBar(pod.risk_level || 'healthy')}`}
                        />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-bold text-slate-300">{pod.risk_score || 0}/100</span>
                        <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black uppercase tracking-widest ${riskClass(pod.risk_level || 'healthy')}`}>
                          {pod.risk_level || 'healthy'}
                        </span>
                        <span className="max-w-40 text-[10px] text-slate-500 truncate">
                          {(pod.risk_reasons || ['within thresholds']).join(', ')}
                        </span>
                      </div>
                   </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </div>
  );
};

export default MetricsDashboard;
