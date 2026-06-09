import React, { useMemo } from 'react';
import { ReactFlow, Background, Controls, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface DependencyGraphProps {
  metrics: any;
  analysis: any;
  namespaceFilter: string;
  riskFilter: string;
}

const DependencyGraph: React.FC<DependencyGraphProps> = ({ metrics, analysis, namespaceFilter, riskFilter }) => {
  const { nodes, edges } = useMemo(() => {
    if (!metrics || !metrics.pods) return { nodes: [], edges: [] };
    const rootCausePod = analysis?.root_cause?.pod;

    // Filter pods based on the same logic as the dashboard
    const filteredPodsData = metrics.pods.filter((pod: any) => {
      const matchesNamespace = namespaceFilter === 'all' || (pod.namespace || 'default') === namespaceFilter;
      const matchesRisk = riskFilter === 'all' || pod.risk_level === riskFilter;
      return matchesNamespace && matchesRisk;
    });

    const filteredPodNames = new Set(filteredPodsData.map((p: any) => p.name));

    const podNodes: Node[] = filteredPodsData.map((pod: any, index: number) => {
      const riskLevel = String(pod.risk_level || 'healthy');
      const riskStyles: Record<string, { background: string; border: string }> = {
        healthy: { background: '#10251c', border: '1px solid #22c55e' },
        warning: { background: '#30240d', border: '1px solid #f59e0b' },
        critical: { background: '#3f1d1d', border: '1px solid #ef4444' },
      };
      const riskStyle = riskStyles[riskLevel] || { background: '#1e293b', border: '1px solid #38bdf8' };
      const isRootCause = pod.name === rootCausePod;

      const blastRadius = analysis?.root_cause?.blast_radius || { direct: [], indirect: [] };
      const isDirectlyImpacted = blastRadius.direct.includes(pod.name);
      const isIndirectlyImpacted = blastRadius.indirect.includes(pod.name);

      let borderStyle = isRootCause ? '2px solid #f97316' : riskStyle.border;
      let boxShadow = isRootCause ? '0 0 0 4px rgba(249, 115, 22, 0.18)' : undefined;

      if (isDirectlyImpacted && !isRootCause) {
        borderStyle = '2px solid #f43f5e';
        boxShadow = '0 0 15px rgba(244, 63, 94, 0.4)';
      } else if (isIndirectlyImpacted && !isRootCause) {
        borderStyle = '2px dashed #f59e0b';
        boxShadow = '0 0 10px rgba(245, 158, 11, 0.2)';
      }

      return {
      id: pod.name,
      data: { 
        label: `${pod.name.split('-').slice(0, 2).join('-')}${isRootCause ? ' · RCA' : isDirectlyImpacted ? ' · IMPACT' : ''}\n${pod.namespace || 'default'} · risk ${pod.risk_score || 0}` 
      },
      position: { x: index % 2 === 0 ? 120 : 430, y: Math.floor(index / 2) * 140 },
      style: { 
        background: riskStyle.background,
        color: '#f8fafc', 
        border: borderStyle,
        boxShadow: boxShadow,
        borderRadius: '8px',
        padding: '10px',
        fontSize: '12px',
        width: 170,
        textAlign: 'center',
        whiteSpace: 'pre-line'
      },
    }});

    const pvcNodes: Node[] = (metrics.pvcs || []).map((pvc: any, index: number) => ({
      id: pvc.name,
      data: { label: `${pvc.name}\n${pvc.capacity || 'unknown'}` },
      position: { x: 760, y: index * 160 + 70 },
      style: {
        background: '#2f230b',
        color: '#f8fafc',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '12px',
        width: 170,
        textAlign: 'center',
        whiteSpace: 'pre-line'
      },
    }));

    const initialNodes = [...podNodes, ...pvcNodes];

    const initialEdges: Edge[] = [];
    if (analysis && analysis.dependency_map) {
      analysis.dependency_map.forEach((dep: any, index: number) => {
        // Only show edges if both source and target are in the filtered set (or if target is a PVC)
        const targetIsPvc = (metrics.pvcs || []).some((pvc: any) => pvc.name === dep.target);
        if (filteredPodNames.has(dep.source) && (filteredPodNames.has(dep.target) || targetIsPvc)) {
          initialEdges.push({
            id: `e-${index}`,
            source: dep.source,
            target: dep.target,
            label: dep.confidence ? `${dep.type} ${Math.round(dep.confidence * 100)}%` : dep.type,
            animated: true,
            style: { stroke: dep.type === 'pvc-mount' ? '#f59e0b' : '#38bdf8' },
            labelStyle: { fill: '#94a3b8', fontSize: 10 }
          });
        }
      });
    }

    return { nodes: initialNodes, edges: initialEdges };
  }, [metrics, analysis, namespaceFilter, riskFilter]);


  if (!metrics) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        Waiting for telemetry data...
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-900 rounded-xl border border-slate-700 shadow-xl overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10">
        <div className="bg-slate-900/80 backdrop-blur-md p-3 rounded-lg border border-slate-700 text-xs">
          <p className="font-semibold text-sky-400 mb-1">Topology Legend</p>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 bg-emerald-700 rounded"></div>
            <span>Healthy Pod</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 bg-amber-700 rounded"></div>
            <span>Warning Pod</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 bg-amber-600 rounded"></div>
            <span>PVC</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 bg-red-800 rounded"></div>
            <span>Anomaly Pressure</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 border-2 border-rose-500 rounded"></div>
            <span>Direct Impact</span>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 border-2 border-dashed border-amber-500 rounded"></div>
            <span>Indirect Impact</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-sky-500"></div>
            <span>Inferred Dependency</span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <div className="w-3 h-3 border-2 border-orange-500 rounded"></div>
            <span>Root Cause</span>
          </div>
        </div>
      </div>
      
      <ReactFlow 
        nodes={nodes} 
        edges={edges}
        fitView
      >
        <Background color="#334155" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
};

export default DependencyGraph;
