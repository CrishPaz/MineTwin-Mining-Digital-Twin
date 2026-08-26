import React, { useState } from 'react';
import { WhatIfScenarioParams, WhatIfSimulationResult } from '../types';
import { Play, RotateCcw, AlertTriangle, DollarSign, Activity, Layers } from 'lucide-react';

interface WhatIfSimulatorPanelProps {
  onSimulate: (params: WhatIfScenarioParams, result: WhatIfSimulationResult) => void;
  onReset: () => void;
}

export const WhatIfSimulatorPanel: React.FC<WhatIfSimulatorPanelProps> = ({ onSimulate, onReset }) => {
  const [params, setParams] = useState<WhatIfScenarioParams>({
    rockAbrasiveness: 1.2,
    bucketOverloadPct: 5,
    postponeHours: 150,
    operatingHoursPerDay: 20,
  });

  const [activeResult, setActiveResult] = useState<WhatIfSimulationResult | null>(null);

  const handleRunSimulation = () => {
    // Cálculo basado en física de fatiga y desgaste minero
    const wearMultiplier = (params.rockAbrasiveness * 0.7) + (1.0 + (params.bucketOverloadPct / 100.0) * 0.9);
    const healthDrop = (params.postponeHours / 100.0) * wearMultiplier * 11.5;
    const simulatedHealth = Math.max(8.0, 78.4 - healthDrop);
    const projectedRul = Math.max(0, 320 - params.postponeHours * wearMultiplier * 1.6);
    const failureRisk = Math.min(99.0, ((100.0 - simulatedHealth) / 100.0) * 100.0 * (1.0 + params.postponeHours / 300.0));
    
    // Lucro cesante estimado en pala minera (~14,500 USD/h parada de tajo)
    const financialRisk = (failureRisk / 100.0) * 185000 + (params.bucketOverloadPct * 1200);

    let recommendation = 'CONDICIÓN SEGURA: Proceder con el plan estándar de 250 horas.';
    if (failureRisk > 70) {
      recommendation = 'CRÍTICO: NO postergar. Alta probabilidad de cavitación catastrófica en bomba y fisura en labio de balde.';
    } else if (failureRisk > 40) {
      recommendation = 'ADVERTENCIA: Reducir factor de llenado al 95% y programar inspección de termografía en 48 horas.';
    }

    const result: WhatIfSimulationResult = {
      wearMultiplier: Number(wearMultiplier.toFixed(2)),
      projectedRulHours: Number(projectedRul.toFixed(1)),
      simulatedHealthScore: Number(simulatedHealth.toFixed(1)),
      failureRiskPct: Number(failureRisk.toFixed(1)),
      estimatedFinancialRiskUsd: Number(financialRisk.toFixed(0)),
      recommendation,
    };

    setActiveResult(result);
    onSimulate(params, result);
  };

  const handleReset = () => {
    setParams({
      rockAbrasiveness: 1.0,
      bucketOverloadPct: 0,
      postponeHours: 0,
      operatingHoursPerDay: 20,
    });
    setActiveResult(null);
    onReset();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl text-slate-100">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Layers className="w-5 h-5 text-amber-400" />
          <h3 className="font-bold text-base text-slate-100">Simulador CBM "What-If" Proyectivo</h3>
        </div>
        <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2.5 py-1 rounded-full font-medium">
          Motor Físico Activo
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        {/* Factor de Abrasividad de Roca */}
        <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Abrasividad del Mineral (SPI/BWi)</span>
            <span className="text-amber-400 font-bold">{params.rockAbrasiveness.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min="1.0"
            max="2.5"
            step="0.1"
            value={params.rockAbrasiveness}
            onChange={(e) => setParams({ ...params, rockAbrasiveness: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>1.0x (Caliza/Blando)</span>
            <span>2.5x (Cuarzo/Abrasivo)</span>
          </div>
        </div>

        {/* Sobrecarga del Balde */}
        <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Sobrecarga Cucharón (Payload %)</span>
            <span className="text-amber-400 font-bold">+{params.bucketOverloadPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="25"
            step="1"
            value={params.bucketOverloadPct}
            onChange={(e) => setParams({ ...params, bucketOverloadPct: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0% (61 Tn Nominal)</span>
            <span>+25% (76.2 Tn Extremo)</span>
          </div>
        </div>

        {/* Postergación de Mantenimiento */}
        <div className="space-y-2 bg-slate-950/60 p-3.5 rounded-lg border border-slate-800/80">
          <div className="flex justify-between text-xs">
            <span className="text-slate-300 font-medium">Postergación Mant. Preventivo (h)</span>
            <span className="text-rose-400 font-bold">+{params.postponeHours} hrs</span>
          </div>
          <input
            type="range"
            min="0"
            max="500"
            step="25"
            value={params.postponeHours}
            onChange={(e) => setParams({ ...params, postponeHours: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>0 h (Inmediato)</span>
            <span>+500 h (Riesgo Crítico)</span>
          </div>
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleRunSimulation}
          className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-4 py-2.5 rounded-lg shadow-lg shadow-amber-500/20 transition-all text-sm cursor-pointer"
        >
          <Play className="w-4 h-4 fill-slate-950" />
          Ejecutar Simulación Digital Twin
        </button>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-lg border border-slate-700 transition-colors text-sm cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Restablecer
        </button>
      </div>

      {/* Resultados de la Simulación */}
      {activeResult && (
        <div className="bg-slate-950 rounded-lg p-4 border border-amber-500/40 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Salud Proyectada</span>
              <span className={`text-lg font-bold ${activeResult.simulatedHealthScore < 50 ? 'text-rose-400' : 'text-amber-400'}`}>
                {activeResult.simulatedHealthScore}%
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">RUL Proyectada</span>
              <span className="text-lg font-bold text-sky-400">
                {activeResult.projectedRulHours} hrs
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Riesgo Falla Mayor</span>
              <span className={`text-lg font-bold ${activeResult.failureRiskPct > 60 ? 'text-rose-400' : 'text-amber-400'}`}>
                {activeResult.failureRiskPct}%
              </span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800">
              <span className="text-[11px] text-slate-400 block mb-1">Riesgo Financiero</span>
              <span className="text-lg font-bold text-emerald-400">
                ${(activeResult.estimatedFinancialRiskUsd / 1000).toFixed(1)}k USD
              </span>
            </div>
          </div>

          <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded text-xs flex items-start gap-2.5 text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Dictamen Prescriptivo de IA: </span>
              {activeResult.recommendation}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
