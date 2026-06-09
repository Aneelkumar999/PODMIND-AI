import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, BrainCircuit, CheckCircle2, Crosshair, LineChart, ListChecks, Target, TimerReset, Zap, Share2 } from 'lucide-react';

interface AIInsightsProps {
  analysis: any;
}

const AIInsights: React.FC<AIInsightsProps> = ({ analysis }) => {
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse"></div>
          <BrainCircuit size={64} className="relative text-indigo-400" />
        </div>
        <div className="text-center max-w-sm">
          <p className="text-lg font-bold text-slate-300 mb-2">Cognitive Core Offline</p>
          <p className="text-xs text-slate-500 uppercase tracking-widest leading-relaxed">
            Trigger the Multi-Agent workflow to synthesize cluster telemetry and generate strategic insights.
          </p>
        </div>
      </div>
    );
  }

  const rootCause = analysis.root_cause || {};
  const rootCauseTone = rootCause.severity === 'critical'
    ? 'from-rose-600 to-red-700 border-rose-400/30'
    : rootCause.severity === 'warning'
      ? 'from-amber-600 to-orange-700 border-amber-400/30'
      : 'from-emerald-600 to-teal-700 border-emerald-400/30';
  const severityClass = (severity: string) => {
    if (severity === 'critical') return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    if (severity === 'warning') return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (severity === 'healthy') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full overflow-y-auto pr-4 custom-scrollbar pb-12">
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="lg:col-span-7 bg-white/5 p-10 rounded-[2.5rem] border border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent"></div>
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-emerald-500/10 rounded-2xl">
            <LineChart size={28} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-xl font-black tracking-tight">Telemetry Synthesis</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/50">Resource Expert Agent</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(analysis.agent_findings || { resource: analysis.resource_analysis }).map(([agent, finding]: [string, any]) => (
            <div key={agent} className="text-slate-300 leading-relaxed text-xs whitespace-pre-wrap bg-white/5 p-5 rounded-2xl border border-white/5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-3">{agent.replace('_', ' ')} Agent</div>
              {finding}
            </div>
          ))}
        </div>
      </motion.div>

      <div className="lg:col-span-5 flex flex-col gap-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className={`bg-gradient-to-br ${rootCauseTone} p-8 rounded-[2.5rem] border shadow-2xl relative overflow-hidden`}
        >
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                  <Crosshair size={26} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight text-white">Root Cause</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                    RCA Engine
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-white">{rootCause.confidence || 0}%</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Confidence</div>
              </div>
            </div>

            <div className="rounded-2xl bg-black/15 border border-white/10 p-5">
              <div className="text-sm font-black text-white">{rootCause.app || 'No dominant cause'}</div>
              <div className="mt-1 text-[10px] font-mono uppercase tracking-widest text-white/50">
                {rootCause.namespace || 'unknown'} · {rootCause.pod || 'none'} · {rootCause.severity || 'healthy'}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/90">{rootCause.summary}</p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {Object.entries(rootCause.contributing_metrics || {}).map(([key, value]: [string, any]) => (
                <div key={key} className="rounded-xl bg-black/15 border border-white/10 p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-white/50">{key.replace('_', ' ')}</div>
                  <div className="mt-1 text-sm font-black text-white">{String(value)}</div>
                </div>
              ))}
            </div>

            <div className="mt-5">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-3">Evidence</div>
              <div className="flex flex-col gap-2">
                {(rootCause.evidence || []).map((item: string, index: number) => (
                  <div key={`${item}-${index}`} className="flex gap-2 text-xs leading-relaxed text-white/90">
                    <CheckCircle2 size={14} className="shrink-0 mt-0.5 text-white" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {rootCause.business_impact && (
              <div className="mt-5 p-4 rounded-2xl bg-white/10 border border-white/10">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2">Business Impact</div>
                <p className="text-xs leading-relaxed text-white font-medium">{rootCause.business_impact}</p>
              </div>
            )}

            {rootCause.blast_radius && (rootCause.blast_radius.all || []).length > 0 && (
              <div className="mt-5">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-3">Blast Radius Mapping</div>
                
                {rootCause.blast_radius.direct.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                      Direct Impact
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rootCause.blast_radius.direct.map((pod: string) => (
                        <span key={pod} className="rounded-full bg-rose-500/20 border border-rose-400/30 px-3 py-1 text-[10px] font-bold text-white">
                          {pod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {rootCause.blast_radius.indirect.length > 0 && (
                  <div>
                    <div className="text-[9px] font-bold uppercase tracking-widest text-white/40 mb-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>
                      Indirect Impact
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {rootCause.blast_radius.indirect.map((pod: string) => (
                        <span key={pod} className="rounded-full bg-amber-500/20 border border-amber-400/30 px-3 py-1 text-[10px] font-bold text-white">
                          {pod}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>


        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-indigo-600 to-purple-700 p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-500/20 relative overflow-hidden group"
        >
          <div className="absolute top-[-20%] right-[-20%] w-64 h-64 bg-white/10 blur-[80px] rounded-full group-hover:scale-110 transition-transform duration-700"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-8">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                <Target size={28} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight text-white">Strategic Directive</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">Orchestrator Node</p>
              </div>
            </div>
            
            <div className="text-indigo-50 leading-relaxed text-sm font-medium">
              {analysis.insights}
            </div>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-sky-500/20 rounded-xl">
              <ListChecks size={20} className="text-sky-400" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-sky-400">Recommendations</h3>
          </div>
          <div className="flex flex-col gap-3">
            {(analysis.recommendations || []).map((item: string, index: number) => (
              <div key={`${item}-${index}`} className="flex gap-3 text-xs leading-relaxed text-slate-300">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.22 }}
          className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-2 bg-emerald-500/20 rounded-xl">
              <Zap size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-emerald-400">Strategic Remediation Plan</h3>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 mt-1">Automated recovery suggestions</p>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            {(analysis.remediation || []).length === 0 && (
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                No dominant failures requiring immediate YAML patching in this window.
              </p>
            )}
            {(analysis.remediation || []).map((rem: any, index: number) => (
              <div key={`${rem.action}-${index}`} className="flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-black text-emerald-400 border border-emerald-500/20">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-200">{rem.action}</div>
                    <p className="text-xs text-slate-500 mt-1">{rem.reason}</p>
                  </div>
                </div>
                <div className="relative group">
                  <pre className="bg-black/40 border border-white/5 p-4 rounded-2xl text-[10px] font-mono text-emerald-400/80 overflow-x-auto custom-scrollbar">
                    {rem.patch}
                  </pre>
                  <button 
                    onClick={() => navigator.clipboard.writeText(rem.patch)}
                    className="absolute top-3 right-3 p-2 bg-white/5 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all border border-white/10"
                    title="Copy Patch"
                  >
                    <Share2 size={12} className="text-slate-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.22 }}
          className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <BrainCircuit size={20} className="text-indigo-400" />
            </div>

            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400">Predictive Forecasting</h3>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 mt-1">Short-horizon anomaly projection</p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {(analysis.forecasting || []).length === 0 && (
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                No immediate high-probability failures projected in the current analysis window.
              </p>
            )}
            {(analysis.forecasting || []).map((forecast: any, index: number) => (
              <div key={`${forecast.pod}-${index}`} className="p-4 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden group">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${forecast.probability === 'Critical' ? 'bg-rose-500' : forecast.probability === 'High' ? 'bg-orange-500' : 'bg-amber-500'}`}></span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">{forecast.type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-400 font-bold">{forecast.time_horizon}</span>
                </div>
                <div className="text-xs font-bold text-slate-300">{forecast.app}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{forecast.description}</p>
                <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className={`text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${forecast.probability === 'Critical' ? 'bg-rose-500/20 text-rose-400' : 'bg-orange-500/20 text-orange-400'}`}>
                    {forecast.probability} Probability
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.22 }}
          className="bg-white/5 border border-white/5 p-8 rounded-[2.5rem] relative overflow-hidden"
        >

          <div className="flex items-center gap-4 mb-6">
            <div className="p-2 bg-cyan-500/20 rounded-xl">
              <TimerReset size={20} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">Incident Timeline</h3>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 mt-1">Discovery to response path</p>
            </div>
          </div>
          <div className="relative flex flex-col gap-5">
            {(analysis.incident_timeline || []).map((event: any, index: number) => (
              <div key={`${event.offset}-${event.title}-${index}`} className="relative pl-9">
                <div className="absolute left-0 top-1.5 h-full w-px bg-white/10"></div>
                <div className={`absolute left-[-6px] top-1 h-3 w-3 rounded-full border ${severityClass(event.severity || 'info')}`}></div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="font-mono text-[10px] font-black text-slate-500">{event.offset}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${severityClass(event.severity || 'info')}`}>
                    {event.phase || event.severity || 'event'}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-200">{event.title}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-400">{event.description}</div>
                {event.pod && <div className="mt-1 text-[10px] font-mono text-slate-600">{event.pod}</div>}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.28 }}
          className="bg-amber-500/10 border border-amber-500/20 p-8 rounded-[2.5rem] relative overflow-hidden"
        >
          <div className="flex items-center gap-4 mb-5">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <AlertTriangle size={20} className="text-amber-500" />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-amber-500">Anomaly Timeline</h3>
          </div>
          <div className="flex flex-col gap-4">
            {(analysis.anomaly_timeline || []).length === 0 && (
              <p className="text-slate-400 text-xs leading-relaxed font-medium">
                No threshold-breaking anomalies detected in the current analysis window.
              </p>
            )}
            {(analysis.anomaly_timeline || []).map((event: any, index: number) => (
              <div key={`${event.pod}-${index}`} className="border-l border-amber-500/40 pl-4">
                <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${event.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>
                  {event.severity || 'info'}
                </div>
                <div className="mt-1 text-xs text-slate-300 leading-relaxed">{event.message}</div>
                {event.pod && <div className="mt-1 text-[10px] font-mono text-slate-500">{event.pod}</div>}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default AIInsights;
