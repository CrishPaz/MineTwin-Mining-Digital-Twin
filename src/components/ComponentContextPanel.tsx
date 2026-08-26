import React from 'react';
import { ComponentHealthInfo } from '../types';
import { Activity, Thermometer, Gauge, AlertCircle, Wrench, ShieldAlert, Cpu } from 'lucide-react';

interface ComponentContextPanelProps {
  component: ComponentHealthInfo | null;
  onClose: () => void;
  onCreateWorkOrder: (component: ComponentHealthInfo) => void;
}

export const ComponentContextPanel: React.FC<ComponentContextPanelProps> = ({
  component,
  onClose,
  onCreateWorkOrder,
}) => {
  if (!component) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center text-slate-400 h-full flex flex-col items-center justify-center">
        <Cpu className="w-10 h-10 text-slate-600 mb-3" />
        <h4 className="text-slate-200 font-medium mb-1">Diagnóstico CBM Contextual</h4>
        <p className="text-xs max-w-xs">
          Seleccione cualquier componente en el Gemelo Digital 3D para ver telemetría de sensores, espectro de vibración y RUL estimada.
        </p>
      </div>
    );
  }

  const getBadgeColor = (state: string) => {
    switch (state) {
      case 'RED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'ORANGE':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'YELLOW':
        return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
      case 'GREEN':
      default:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl flex flex-col justify-between h-full">
      <div>
        {/* Encabezado del Componente */}
        <div className="flex items-start justify-between pb-3 border-b border-slate-800 mb-4">
          <div>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-sky-400 block mb-0.5">
              {component.systemCategory.replace('_', ' ')}
            </span>
            <h3 className="font-bold text-slate-100 text-base">{component.name}</h3>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${getBadgeColor(component.semanticState)}`}>
            {component.semanticState === 'GREEN'
              ? 'NORMAL'
              : component.semanticState === 'YELLOW'
              ? 'DEGRADACIÓN'
              : component.semanticState === 'ORANGE'
              ? 'ALERTA CBM'
              : 'CRÍTICO'}
          </span>
        </div>

        {/* Métricas Principales de Salud y RUL */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              Health Score (Salud)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-slate-100">{component.healthScore}%</span>
              <span className="text-[10px] text-slate-400">/ 100</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${
                  component.healthScore < 50 ? 'bg-rose-500' : component.healthScore < 75 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${component.healthScore}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
              <Gauge className="w-3.5 h-3.5 text-sky-400" />
              RUL Remanente (IA)
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-sky-300">{component.estimatedRulHours}</span>
              <span className="text-[10px] text-slate-400">horas operativas</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1.5">Confianza XGBoost: 94.2%</span>
          </div>
        </div>

        {/* Sensores y Telemetría en Vivo */}
        <div className="space-y-2.5 mb-4">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Sensores Asociados (IIoT)</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950 p-2 rounded border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-purple-400" /> Vib. RMS:
              </span>
              <span className={`font-bold ${component.vibrationRmsMms > 6.0 ? 'text-rose-400' : 'text-slate-200'}`}>
                {component.vibrationRmsMms} mm/s
              </span>
            </div>
            <div className="bg-slate-950 p-2 rounded border border-slate-800/80 flex items-center justify-between">
              <span className="text-slate-400 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-amber-400" /> Temp:
              </span>
              <span className={`font-bold ${component.temperatureC > 90 ? 'text-rose-400' : 'text-slate-200'}`}>
                {component.temperatureC} °C
              </span>
            </div>
            {component.pressureBar && (
              <div className="bg-slate-950 p-2 rounded border border-slate-800/80 flex items-center justify-between col-span-2">
                <span className="text-slate-400 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-sky-400" /> Presión de Línea:
                </span>
                <span className="font-bold text-slate-200">{component.pressureBar} bar</span>
              </div>
            )}
          </div>
        </div>

        {/* Clasificación ISO 14224 si existe */}
        {component.failureModeIso14224 && (
          <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg text-xs mb-4">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
              <ShieldAlert className="w-4 h-4" />
              Diagnóstico ISO 14224
            </div>
            <p className="text-rose-200/90 text-[11px] leading-relaxed">{component.failureModeIso14224}</p>
          </div>
        )}

        {/* Alarmas Activas */}
        {component.activeAlarms.length > 0 && (
          <div className="space-y-1.5 mb-4">
            <h4 className="text-xs font-semibold text-slate-300">Alarmas Activas ({component.activeAlarms.length})</h4>
            {component.activeAlarms.map((alarm, idx) => (
              <div
                key={idx}
                className="bg-amber-950/20 border border-amber-500/30 text-amber-300 text-[11px] p-2 rounded flex items-center gap-2"
              >
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{alarm}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Botón de Emisión de Orden de Trabajo */}
      <div className="pt-3 border-t border-slate-800 flex gap-2">
        <button
          onClick={() => onCreateWorkOrder(component)}
          className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium py-2 px-3 rounded-lg text-xs transition-colors cursor-pointer"
        >
          <Wrench className="w-3.5 h-3.5" />
          Emitir OT CBM en SAP PM
        </button>
        <button
          onClick={onClose}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
};
