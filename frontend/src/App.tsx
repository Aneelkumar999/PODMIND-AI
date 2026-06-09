import { useState, useEffect } from 'react';
import { Activity, Share2, Lightbulb, Cpu, Database, AlertCircle, CheckCircle, Zap, FileText, Download, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import MetricsDashboard from './components/MetricsDashboard';
import DependencyGraph from './components/DependencyGraph';
import AIInsights from './components/AIInsights';
import Auth from './components/Auth';
import AIChatbot from './components/AIChatbot';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8001/api/v1';

function App() {
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('podmind_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'metrics' | 'topology' | 'insights'>('metrics');
  const [metrics, setMetrics] = useState<any>(null);
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scenario, setScenario] = useState('healthy');
  const [searchTerm, setSearchTerm] = useState('');
  const [namespaceFilter, setNamespaceFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const generateReport = () => {
    if (!analysis) return;

    const report = `
# PodMind AI - Incident Report
Generated at: ${new Date().toLocaleString()}
Scenario: ${scenario}

## 1. Cluster Health Summary
${analysis.insights}

## 2. Root Cause Analysis
- **Pod:** ${analysis.root_cause?.pod || 'None'}
- **App:** ${analysis.root_cause?.app || 'None'}
- **Confidence:** ${analysis.root_cause?.confidence || 0}%
- **Severity:** ${analysis.root_cause?.severity || 'healthy'}
- **Summary:** ${analysis.root_cause?.summary || ''}

### Business Impact
${analysis.root_cause?.business_impact || 'No significant business impact detected.'}

### Evidence
${(analysis.root_cause?.evidence || []).map((e: string) => `- ${e}`).join('\n')}

## 3. Blast Radius Mapping
- **Directly Impacted:** ${(analysis.root_cause?.blast_radius?.direct || []).join(', ') || 'None'}
- **Indirectly Impacted:** ${(analysis.root_cause?.blast_radius?.indirect || []).join(', ') || 'None'}

## 4. Predictive Forecasting
${(analysis.forecasting || []).map((f: any) => `### ${f.type} (${f.probability} Probability)
- **Pod:** ${f.pod}
- **Horizon:** ${f.time_horizon}
- **Description:** ${f.description}`).join('\n\n')}

## 5. Recommended Actions
${(analysis.recommendations || []).map((r: string) => `- ${r}`).join('\n')}

## 6. Incident Timeline
${(analysis.incident_timeline || []).map((e: any) => `- [${e.offset}] **${e.phase}**: ${e.title} - ${e.description}`).join('\n')}
    `;

    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `podmind-report-${new Date().getTime()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/metrics`, {
        params: { namespace: namespaceFilter }
      });
      setMetrics(res.data);
    } catch (err) {
      console.error("Failed to fetch metrics", err);
    }
    setLoading(false);
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await axios.post(`${API_BASE}/analyze`, { namespace: namespaceFilter });
      setAnalysis(res.data);
      setActiveTab('insights');
    } catch (err) {
      console.error("Analysis failed", err);
    }
    setAnalyzing(false);
  };

  const handleScenarioChange = async (newScenario: string) => {
    setScenario(newScenario);
    try {
      await axios.post(`${API_BASE}/scenario`, { scenario: newScenario });
      fetchMetrics();
    } catch (err) {
      console.error("Failed to update scenario", err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [namespaceFilter]);

  const handleLogout = () => {
    localStorage.removeItem('podmind_user');
    setUser(null);
  };

  if (!user) {
    return <Auth onAuthSuccess={setUser} API_BASE={API_BASE} />;
  }

  return (
    <div className="flex h-screen text-slate-100 selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="w-72 glass border-r border-white/5 p-8 flex flex-col z-20">
        <div className="flex items-center gap-4 mb-12">
          <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-lg opacity-40 animate-pulse"></div>
            <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-2xl shadow-lg">
              <Cpu size={28} className="text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              PodMind AI
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">System Live</span>
            </div>
          </div>
        </div>

        <nav className="flex flex-col gap-3">
          {[
            { id: 'metrics', label: 'Telemetry', icon: Activity },
            { id: 'topology', label: 'Dependency', icon: Share2 },
            { id: 'insights', label: 'AI Analytics', icon: Lightbulb },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`group flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                activeTab === item.id 
                ? 'bg-white/10 text-white shadow-inner' 
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {activeTab === item.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
                />
              )}
              <item.icon size={20} className={activeTab === item.id ? 'text-indigo-400' : 'group-hover:scale-110 transition-transform'} />
              <span className="font-semibold tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-12">
          <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-[0.2em] mb-6 px-5">Simulation Lab</h3>
          <div className="flex flex-col gap-2">
            {[
              { id: 'healthy', label: 'Baseline State', icon: CheckCircle, color: 'text-emerald-400' },
              { id: 'db_stress', label: 'Database Stress', icon: Database, color: 'text-amber-400' },
              { id: 'leak', label: 'Memory Leak', icon: AlertCircle, color: 'text-rose-400' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => handleScenarioChange(s.id)}
                className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-200 group ${
                  scenario === s.id 
                  ? 'bg-white/5 border border-white/10 shadow-lg' 
                  : 'opacity-40 hover:opacity-100 hover:bg-white/5'
                }`}
              >
                <s.icon size={16} className={scenario === s.id ? s.color : 'text-slate-400'} />
                <span className={`text-sm font-medium ${scenario === s.id ? 'text-slate-200' : 'text-slate-500'}`}>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-8 flex flex-col gap-6">
          <div className="px-5 py-4 bg-white/5 rounded-2xl border border-white/5 flex items-center gap-3 group hover:border-indigo-500/30 transition-colors">
              <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-black text-xs text-white shadow-lg shadow-indigo-500/20">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</span>
              <span className="text-xs font-bold text-slate-300 group-hover:text-indigo-400 transition-colors">{user.full_name || user.username}</span>
            </div>
          </div>
          
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="w-full relative group"
          >
            <div className="absolute inset-0 bg-indigo-600 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
            <div className="relative bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-50 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-indigo-500/20 active:scale-95">
              <Zap size={18} className={analyzing ? "animate-pulse" : "group-hover:rotate-12 transition-transform"} />
              <span>{analyzing ? "Synthesizing..." : "Analyze Cluster"}</span>
            </div>
          </button>

          <button 
            onClick={handleLogout}
            className="w-full mt-2 bg-white/5 hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/20 text-slate-500 hover:text-rose-400 font-bold py-3 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 text-[10px] uppercase tracking-widest"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <header className="px-12 py-10 flex justify-between items-start z-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] rounded-md border border-indigo-500/20">
                ABB Accelerator 2026
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Presented by <span className="text-slate-300 font-black italic">Team Seekers</span>
              </span>
            </div>
            <motion.h2 
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-4xl font-black tracking-tight"
            >
              {activeTab === 'metrics' && "Resource Telemetry"}
              {activeTab === 'topology' && "System Topology"}
              {activeTab === 'insights' && "AI Knowledge Base"}
            </motion.h2>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400"></div>
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest">
                  Scope: {namespaceFilter === 'all' ? 'all namespaces' : namespaceFilter}
                </span>
              </div>
              {riskFilter !== 'all' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/10 rounded-full border border-rose-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                  <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
                    Level: {riskFilter}
                  </span>
                </div>
              )}

              {metrics?.is_simulated && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full border border-amber-500/20">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Simulation Active</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <AnimatePresence>
              {analysis && (
                <motion.button
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={generateReport}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all group active:scale-95"
                >
                  <FileText size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold text-slate-300">Generate Report</span>
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {loading && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl"
                >
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="w-1 h-1 bg-indigo-400 rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Polling Data</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        <section className="flex-1 px-12 pb-12 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: "circOut" }}
              className="h-full"
            >
              <div className="h-full glass rounded-[2.5rem] p-8 shadow-2xl border-white/5 overflow-hidden">
                {activeTab === 'metrics' && (
                  <MetricsDashboard 
                    metrics={metrics} 
                    searchTerm={searchTerm} setSearchTerm={setSearchTerm}
                    namespaceFilter={namespaceFilter} setNamespaceFilter={setNamespaceFilter}
                    riskFilter={riskFilter} setRiskFilter={setRiskFilter}
                  />
                )}
                {activeTab === 'topology' && (
                  <DependencyGraph 
                    metrics={metrics} 
                    analysis={analysis}
                    namespaceFilter={namespaceFilter}
                    riskFilter={riskFilter}
                  />
                )}
                {activeTab === 'insights' && <AIInsights analysis={analysis} />}
              </div>
            </motion.div>
          </AnimatePresence>
        </section>

      </main>

      <AIChatbot API_BASE={API_BASE} clusterContext={metrics} />
    </div>
  );
}

export default App;
