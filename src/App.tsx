import React, { useState, useEffect } from 'react';
import { INITIAL_FLEET_DATA } from './data/fleetData';
import { Equipment3DViewer } from './components/Equipment3DViewer';
import { WhatIfSimulatorPanel } from './components/WhatIfSimulatorPanel';
import { ComponentContextPanel } from './components/ComponentContextPanel';
import {
  MiningRole,
  UserProfile,
  EquipmentTwinData,
  ComponentHealthInfo,
  WhatIfScenarioParams,
  WhatIfSimulationResult,
} from './types';
import {
  Activity,
  Layers,
  Shield,
  Gauge,
  Clock,
  DollarSign,
  AlertTriangle,
  FileText,
  Users,
  Settings,
  Radio,
  Sliders,
  ChevronRight,
  TrendingUp,
  Download,
  Calendar,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

const ROLES_INFO: Record<MiningRole, { label: string; desc: string }> = {
  ADMIN: { label: 'Administrador TI / Mina', desc: 'Control total de plataforma, usuarios y arquitecturas' },
  MAINTENANCE_MANAGER: { label: 'Jefe de Mantenimiento', desc: 'Control de KPIs, costos, aprobación de OTs y reportes' },
  PLANNER: { label: 'Planificador', desc: 'Programación de OTs, control de pañol y repuestos' },
  SUPERVISOR: { label: 'Supervisor de Turno', desc: 'Asignación de cuadrillas e inspecciones en terreno' },
  TECHNICIAN: { label: 'Técnico Especialista', desc: 'Ejecución de OTs y lectura de telemetría de campo' },
  RELIABILITY_ANALYST: { label: 'Ingeniero Confiabilidad CBM', desc: 'Modelado predictivo, RUL, análisis de vibraciones e IA' },
  VIEWER: { label: 'Visualizador Operaciones', desc: 'Monitoreo de estado de flota y disponibilidad' },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'TWIN_3D' | 'DASHBOARD' | 'REPORTS' | 'USERS'>('TWIN_3D');
  const [selectedRole, setSelectedRole] = useState<MiningRole>('MAINTENANCE_MANAGER');
  const [fleet] = useState<EquipmentTwinData[]>(INITIAL_FLEET_DATA);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('eq-001');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('hydraulic_pump_primary');
  
  // Time-slider histórico
  const [historySliderValue, setHistorySliderValue] = useState<number>(100);
  const [isPlayingHistory, setIsPlayingHistory] = useState<boolean>(false);

  // Estados de Simulación What-If
  const [isSimulatingWhatIf, setIsSimulatingWhatIf] = useState<boolean>(false);
  const [simulatedHealthMultiplier, setSimulatedHealthMultiplier] = useState<number>(1.0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Reportes y Filtros
  const [reportFormat, setReportFormat] = useState<'PDF' | 'EXCEL' | 'WORD'>('PDF');
  const [reportDateRange, setReportDateRange] = useState<string>('Últimos 30 días');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const currentEquipment = fleet.find((e) => e.id === selectedEquipmentId) || fleet[0];
  const selectedComponent = selectedNodeId ? currentEquipment.components[selectedNodeId] : null;

  // Manejo de Simulación What-If
  const handleSimulateWhatIf = (params: WhatIfScenarioParams, result: WhatIfSimulationResult) => {
    setIsSimulatingWhatIf(true);
    setSimulatedHealthMultiplier(result.simulatedHealthScore / 78.4);
    showToast(`Simulación ejecutada: Riesgo de falla al ${result.failureRiskPct}%`);
  };

  const handleResetWhatIf = () => {
    setIsSimulatingWhatIf(false);
    setSimulatedHealthMultiplier(1.0);
    showToast('Simulación restablecida a telemetría en vivo');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Time Slider Playback
  useEffect(() => {
    let interval: any;
    if (isPlayingHistory) {
      interval = setInterval(() => {
        setHistorySliderValue((prev) => {
          if (prev >= 100) {
            setIsPlayingHistory(false);
            return 100;
          }
          return prev + 5;
        });
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isPlayingHistory]);

  const handleExportReport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      showToast(`Reporte CBM exportado exitosamente en formato ${reportFormat}`);
    }, 1500);
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans overflow-hidden">
      {/* 1. SIDEBAR INDUSTRIAL DE NAVEGACIÓN */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Marca */}
          <div className="p-4 border-b border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 font-black text-slate-950 text-lg">
              MT
            </div>
            <div>
              <h1 className="font-bold text-sm text-slate-100 leading-tight">MineTwin 3D</h1>
              <span className="text-[10px] text-amber-400 font-medium tracking-wide uppercase">
                Mining Digital Twin CBM
              </span>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="p-3 space-y-1.5">
            <button
              onClick={() => setActiveTab('TWIN_3D')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'TWIN_3D'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Layers className="w-4 h-4" />
              Gemelo Digital 3D
            </button>

            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'DASHBOARD'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Dashboard Ejecutivo KPIs
            </button>

            <button
              onClick={() => setActiveTab('REPORTS')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'REPORTS'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FileText className="w-4 h-4" />
              Reportes (PDF/Word/Excel)
            </button>

            <button
              onClick={() => setActiveTab('USERS')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'USERS'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="w-4 h-4" />
              Gestión de Usuarios & RBAC
            </button>
          </nav>

          {/* Selector de Equipo de Flota */}
          <div className="p-3 pt-2">
            <label className="text-[11px] uppercase tracking-wider font-bold text-slate-400 block px-2 mb-2">
              Flota de Carguío en Mina
            </label>
            <div className="space-y-1">
              {fleet.map((eq) => (
                <button
                  key={eq.id}
                  onClick={() => {
                    setSelectedEquipmentId(eq.id);
                    setSelectedNodeId('hydraulic_pump_primary');
                  }}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                    selectedEquipmentId === eq.id
                      ? 'bg-slate-800 border-amber-500/50 text-slate-100 shadow-md'
                      : 'border-transparent text-slate-400 hover:bg-slate-800/40 hover:text-slate-300'
                  }`}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="font-bold text-xs">{eq.tagCode}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        eq.status === 'OPERATIONAL'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : eq.status === 'DEGRADED'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {eq.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 block truncate">{eq.modelName}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Perfil & Conmutador de Roles RBAC */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70">
          <div className="mb-2">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Perfil y Rol Activo (RBAC)
            </span>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as MiningRole)}
              className="w-full bg-slate-900 border border-slate-700 text-xs text-amber-300 rounded p-1.5 font-medium cursor-pointer focus:outline-none focus:border-amber-500"
            >
              {Object.entries(ROLES_INFO).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-[10px] text-slate-400 leading-tight">
            {ROLES_INFO[selectedRole].desc}
          </div>
        </div>
      </aside>

      {/* 2. CONTENEDOR PRINCIPAL */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Topbar Operativo */}
        <header className="h-14 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-slate-200">Enlace Telemetría 5G Mina: Conectado</span>
            </div>
            <span className="text-slate-700">|</span>
            <span className="text-xs text-slate-400">
              Equipo: <strong className="text-slate-200">{currentEquipment.name} ({currentEquipment.tagCode})</strong>
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800 text-slate-300">
              Horómetro: <strong className="text-amber-400">{currentEquipment.hourMeter} hrs</strong>
            </div>
            <div className="bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800 text-slate-300">
              Salud Global: <strong className="text-emerald-400">{currentEquipment.overallHealthScore}%</strong>
            </div>
          </div>
        </header>

        {/* Toast Notificación */}
        {toastMessage && (
          <div className="fixed top-16 right-6 z-50 bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 px-4 py-2.5 rounded-lg shadow-xl text-xs flex items-center gap-2 animate-bounce">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {toastMessage}
          </div>
        )}

        {/* CONTENIDO SEGÚN PESTAÑA */}
        <div className="p-6 flex-1">
          {/* VISTA 1: GEMELO DIGITAL 3D */}
          {activeTab === 'TWIN_3D' && (
            <div className="space-y-5">
              {/* Barra de Control de Tiempo Histórico (Time-Slider) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <Clock className="w-4 h-4 text-sky-400" />
                  <span>Time-Slider Histórico CBM:</span>
                </div>
                <div className="flex-1 flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">Hace 30 días</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={historySliderValue}
                    onChange={(e) => setHistorySliderValue(parseInt(e.target.value))}
                    className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                  <span className="text-[11px] text-emerald-400 font-bold">
                    {historySliderValue === 100 ? 'Tiempo Real (Live)' : `T - ${100 - historySliderValue} hrs`}
                  </span>
                </div>
                <button
                  onClick={() => setIsPlayingHistory(!isPlayingHistory)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer border border-slate-700 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isPlayingHistory ? 'animate-spin' : ''}`} />
                  {isPlayingHistory ? 'Pausar' : 'Reproducir Historia'}
                </button>
              </div>

              {/* Layout 3D y Panel Contextual */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 min-h-[500px]">
                <div className="lg:col-span-2 h-[520px]">
                  <Equipment3DViewer
                    components={currentEquipment.components}
                    selectedNodeId={selectedNodeId}
                    onSelectComponent={(nodeId) => setSelectedNodeId(nodeId)}
                    isSimulatingWhatIf={isSimulatingWhatIf}
                    simulatedHealthMultiplier={simulatedHealthMultiplier}
                  />
                </div>
                <div className="h-[520px]">
                  <ComponentContextPanel
                    component={selectedComponent}
                    onClose={() => setSelectedNodeId(null)}
                    onCreateWorkOrder={(comp) => {
                      showToast(`OT CBM creada para ${comp.name} en SAP PM`);
                    }}
                  />
                </div>
              </div>

              {/* Panel de Simulación What-If */}
              <WhatIfSimulatorPanel onSimulate={handleSimulateWhatIf} onReset={handleResetWhatIf} />
            </div>
          )}

          {/* VISTA 2: DASHBOARD EJECUTIVO KPIS */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-6">
              {/* Tarjetas de Métricas Ejecutivas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-1">DISPONIBILIDAD MECÁNICA</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-emerald-400">89.4%</span>
                    <span className="text-[11px] text-emerald-500 font-bold">+1.2% vs target</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded mt-3">
                    <div className="bg-emerald-500 h-1 rounded" style={{ width: '89.4%' }} />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-1">UTILIZACIÓN EFECTIVA</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-sky-400">78.2%</span>
                    <span className="text-[11px] text-sky-500 font-bold">18.7 hrs/día</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded mt-3">
                    <div className="bg-sky-500 h-1 rounded" style={{ width: '78.2%' }} />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-1">MTBF (TIEMPO MEDIO ENTRE FALLAS)</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-amber-400">142.5 hrs</span>
                    <span className="text-[11px] text-amber-500 font-bold">+14 hrs (CBM)</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded mt-3">
                    <div className="bg-amber-500 h-1 rounded" style={{ width: '75%' }} />
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                  <span className="text-[11px] text-slate-400 font-semibold block mb-1">COSTO / HORA OPERATIVA</span>
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-slate-100">$132.80</span>
                    <span className="text-[11px] text-emerald-400 font-bold">-8.4% de ahorro</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1 rounded mt-3">
                    <div className="bg-emerald-400 h-1 rounded" style={{ width: '85%' }} />
                  </div>
                </div>
              </div>

              {/* Matriz de Criticidad de Equipos */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
                <h3 className="font-bold text-sm text-slate-100 mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Estado de Criticidad de Flota y Alertas CBM Activas
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-800">
                        <th className="pb-3 font-semibold">TAG / EQUIPO</th>
                        <th className="pb-3 font-semibold">UBICACIÓN MINA</th>
                        <th className="pb-3 font-semibold">SALUD GLOBAL</th>
                        <th className="pb-3 font-semibold">COMPONENTE CRÍTICO</th>
                        <th className="pb-3 font-semibold">RUL MIN</th>
                        <th className="pb-3 font-semibold">ACCIÓN RECOMENDADA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {fleet.map((eq) => (
                        <tr key={eq.id} className="hover:bg-slate-800/40">
                          <td className="py-3 font-bold text-slate-100">
                            {eq.tagCode} - {eq.modelName}
                          </td>
                          <td className="py-3 text-slate-400">{eq.miningZone}</td>
                          <td className="py-3">
                            <span
                              className={`font-bold ${
                                eq.overallHealthScore < 50
                                  ? 'text-rose-400'
                                  : eq.overallHealthScore < 80
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {eq.overallHealthScore}%
                            </span>
                          </td>
                          <td className="py-3 font-medium">Bomba Principal Hidráulica</td>
                          <td className="py-3 font-bold text-sky-400">320 hrs</td>
                          <td className="py-3">
                            <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[11px]">
                              Inspección Termográfica en 48h
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VISTA 3: MÓDULO DE REPORTES */}
          {activeTab === 'REPORTS' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl max-w-3xl space-y-6">
              <div>
                <h3 className="font-bold text-base text-slate-100 mb-1 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Generador Corporativo de Reportes CBM Mineros
                </h3>
                <p className="text-xs text-slate-400">
                  Exporta reportes de condición de activos, cumplimiento de RUL y análisis de causas raíz según ISO 14224.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Formato de Salida</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['PDF', 'EXCEL', 'WORD'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setReportFormat(fmt)}
                        className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          reportFormat === fmt
                            ? 'bg-amber-500 text-slate-950 border-amber-400'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">Rango Temporal</label>
                  <select
                    value={reportDateRange}
                    onChange={(e) => setReportDateRange(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs text-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option>Últimos 7 días (Semanal)</option>
                    <option>Últimos 30 días (Mensual Ejecutivo)</option>
                    <option>Trimestre Q3 2026</option>
                    <option>Año Fiscal 2026 a la fecha</option>
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs space-y-2 text-slate-400">
                <span className="font-bold text-slate-200 block">Contenido Incluido en la Plantilla Corporativa:</span>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Carátula oficial Mina Austral con logotipo y firma de autorización de Jefe de Turno.</li>
                  <li>Resumen ejecutivo de Disponibilidad Mecánica, MTBF y MTTR por pala.</li>
                  <li>Gráficos embebidos de degradación de vibración espectral (ISO 10816-3).</li>
                  <li>Catálogo de OTs ejecutadas vs. OTs predictivas CBM pendientes en SAP PM.</li>
                </ul>
              </div>

              <button
                onClick={handleExportReport}
                disabled={isExporting}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold py-3 rounded-lg shadow-lg shadow-amber-500/20 text-sm cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Generando Reporte Corporativo...' : `Exportar Reporte en ${reportFormat}`}
              </button>
            </div>
          )}

          {/* VISTA 4: USUARIOS Y RBAC */}
          {activeTab === 'USERS' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
              <div>
                <h3 className="font-bold text-base text-slate-100 mb-1 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400" />
                  Control de Acceso Basado en Roles (RBAC) & Usuarios Mineros
                </h3>
                <p className="text-xs text-slate-400">
                  Matriz de permisos granulares para cuadrillas de mantenimiento, analistas CBM y gerencia de operaciones.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(ROLES_INFO).map(([key, info]) => (
                  <div key={key} className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-2">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-xs text-amber-400">{key}</span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Activo</span>
                    </div>
                    <h4 className="font-bold text-sm text-slate-200">{info.label}</h4>
                    <p className="text-[11px] text-slate-400">{info.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
