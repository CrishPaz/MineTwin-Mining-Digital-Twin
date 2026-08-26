import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Box, Crosshair, Layers, Maximize2 } from 'lucide-react';
import { ComponentHealthInfo, HealthSemanticState } from '../types';
import { buildMachine, EquipmentKind, MachineBuild } from '../three/machines';
import { HEALTH_COLOR, ViewMode } from '../three/materials';

interface Equipment3DViewerProps {
  components: Record<string, ComponentHealthInfo>;
  /** Define qué gemelo geométrico se instancia (pala de orugas o cargador de ruedas). */
  equipmentType: EquipmentKind;
  /** Modelo comercial: determina la librea del fabricante. */
  modelName: string;
  selectedNodeId: string | null;
  onSelectComponent: (nodeId: string) => void;
  isSimulatingWhatIf?: boolean;
  simulatedHealthMultiplier?: number;
}

/** Umbrales de la leyenda semántica CBM. */
const stateFromHealth = (h: number): HealthSemanticState =>
  h < 40 ? 'RED' : h < 60 ? 'ORANGE' : h < 80 ? 'YELLOW' : 'GREEN';

/** PRNG determinista: el apilamiento de mineral no debe cambiar entre re-renders. */
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/** Textura radial suave usada por las volutas de escape. */
function createSmokeTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

interface SmokePuff {
  sprite: THREE.Sprite;
  port: THREE.Object3D;
  age: number;
  life: number;
  drift: THREE.Vector2;
}

export const Equipment3DViewer: React.FC<Equipment3DViewerProps> = ({
  components,
  equipmentType,
  modelName,
  selectedNodeId,
  onSelectComponent,
  isSimulatingWhatIf = false,
  simulatedHealthMultiplier = 1.0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const machineRef = useRef<MachineBuild | null>(null);
  const cageRef = useRef<THREE.LineSegments | null>(null);
  const pulseRef = useRef<Array<{ mat: THREE.MeshStandardMaterial; base: number }>>([]);
  const smokeRef = useRef<SmokePuff[]>([]);
  const digRef = useRef(0);
  const selectedRef = useRef<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const homeRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('HEALTH');
  const [machineVersion, setMachineVersion] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Espejos de props para que el bucle de render lea siempre el valor vigente
  // sin tener que reconstruir la escena en cada cambio.
  const viewModeRef = useRef(viewMode);
  const isSimRef = useRef(isSimulatingWhatIf);
  const onSelectRef = useRef(onSelectComponent);
  selectedRef.current = selectedNodeId;
  viewModeRef.current = viewMode;
  isSimRef.current = isSimulatingWhatIf;
  onSelectRef.current = onSelectComponent;

  /* ------------------------------------------------------------------ *
   *  1. Escena, cámara, iluminación y terreno (se monta una sola vez)
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 900;
    const height = container.clientHeight || 560;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.Fog(0x0b1220, 55, 130);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 400);
    camera.position.set(22, 16, 26);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Entorno PMREM: da reflejos creíbles al acero, al cromado y al vidrio.
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    scene.environmentIntensity = 0.5;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 9;
    controls.maxDistance = 90;
    controls.maxPolarAngle = Math.PI / 2.05; // no pasar por debajo del banco
    controls.target.set(0, 4, 0);
    controlsRef.current = controls;

    /* --- Iluminación de faena --- */
    scene.add(new THREE.HemisphereLight(0xbcd7ff, 0x1d2530, 0.55));

    const sun = new THREE.DirectionalLight(0xfff2dd, 2.1);
    sun.position.set(26, 34, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 110;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);

    const rim = new THREE.DirectionalLight(0x4aa8ff, 0.8);
    rim.position.set(-24, 12, -22);
    scene.add(rim);

    /* --- Banco de mina --- */
    const groundGeo = new THREE.CircleGeometry(70, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a222e, roughness: 0.97, metalness: 0.02 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(120, 60, 0x2f6f9e, 0x1b2836);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.32;
    grid.position.y = 0.02;
    scene.add(grid);

    /* --- Bucle de render --- */
    const clock = new THREE.Clock();
    const cageBox = new THREE.Box3();
    const cageSize = new THREE.Vector3();
    const cageCenter = new THREE.Vector3();

    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();

      // Suavizado de la intensidad del ciclo de excavación
      const target = isSimRef.current ? 1 : 0;
      digRef.current += (target - digRef.current) * Math.min(1, dt * 2.5);

      const build = machineRef.current;
      if (build) build.update(t, digRef.current);

      smokeRef.current.forEach((p) => {
        p.age += dt;
        if (p.age > p.life) p.age = 0;
        const k = p.age / p.life;
        p.port.getWorldPosition(p.sprite.position);
        p.sprite.position.y += k * 5.5;
        p.sprite.position.x += p.drift.x * k * 4;
        p.sprite.position.z += p.drift.y * k * 4;
        const s = 0.7 + k * 3.4;
        p.sprite.scale.set(s, s, 1);
        (p.sprite.material as THREE.SpriteMaterial).opacity = (1 - k) * 0.3 * (0.35 + digRef.current * 0.65);
      });

      // Latido del realce en componentes en alerta o falla inminente
      const pulse = 0.72 + Math.sin(t * 3.4) * 0.28;
      pulseRef.current.forEach(({ mat, base }) => {
        mat.emissiveIntensity = base * pulse;
      });

      // Jaula de selección siguiendo al componente aunque esté animado
      const cage = cageRef.current;
      if (cage && build && selectedRef.current) {
        const node = build.registry.nodes.get(selectedRef.current);
        if (node && node.meshes.length) {
          cageBox.makeEmpty();
          node.meshes.forEach((m) => cageBox.expandByObject(m));
          if (!cageBox.isEmpty()) {
            cageBox.getSize(cageSize);
            cageBox.getCenter(cageCenter);
            cage.position.copy(cageCenter);
            cage.scale.set(cageSize.x + 0.25, cageSize.y + 0.25, cageSize.z + 0.25);
            cage.visible = true;
          }
        }
      } else if (cage) {
        cage.visible = false;
      }

      controls.update();
      renderer.render(scene, camera);
    });

    /* --- Selección por raycast, distinguiendo clic de arrastre --- */
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;

    const pick = (event: PointerEvent): string | null => {
      const build = machineRef.current;
      if (!build) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(build.root, true);
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData?.nodeId) obj = obj.parent;
        if (obj?.userData?.nodeId) return obj.userData.nodeId as string;
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 5) return; // fue un arrastre de órbita, no una selección
      const nodeId = pick(e);
      if (nodeId) onSelectRef.current(nodeId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const nodeId = pick(e);
      const tip = tooltipRef.current;
      if (tip && nodeId) {
        const rect = renderer.domElement.getBoundingClientRect();
        tip.style.left = `${e.clientX - rect.left}px`;
        tip.style.top = `${e.clientY - rect.top}px`;
      }
      // Solo se re-renderiza cuando cambia el componente apuntado, no en cada pixel.
      if (nodeId !== hoveredRef.current) {
        hoveredRef.current = nodeId;
        setHoveredId(nodeId);
      }
    };

    const onPointerLeave = () => {
      hoveredRef.current = null;
      setHoveredId(null);
    };

    const dom = renderer.domElement;
    dom.addEventListener('pointerdown', onPointerDown);
    dom.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('pointermove', onPointerMove);
    dom.addEventListener('pointerleave', onPointerLeave);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      renderer.setAnimationLoop(null);
      resizeObserver.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('pointerleave', onPointerLeave);
      controls.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      envRT.texture.dispose();
      pmrem.dispose();
      renderer.dispose();
      container.innerHTML = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------------ *
   *  2. Gemelo geométrico: se reconstruye al cambiar de equipo
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!scene || !camera || !controls) return;

    const build = buildMachine(equipmentType, modelName);
    build.setViewMode(viewModeRef.current);
    scene.add(build.root);
    machineRef.current = build;

    // Encuadre inicial acorde al gálibo de la máquina
    const dir = new THREE.Vector3(0.72, 0.5, 0.86).normalize();
    const position = build.cameraTarget.clone().addScaledVector(dir, build.cameraRadius);
    camera.position.copy(position);
    controls.target.copy(build.cameraTarget);
    controls.update();
    homeRef.current = { position: position.clone(), target: build.cameraTarget.clone() };

    /* --- Apilamiento de mineral y bolonería del banco --- */
    const rand = seededRandom(1337);
    const pileGroup = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4238, roughness: 0.95, metalness: 0.04 });
    const { position: pilePos, radius: pileR } = build.muckPile;

    const moundGeo = new THREE.ConeGeometry(pileR, pileR * 0.72, 22, 3);
    const mound = new THREE.Mesh(moundGeo, rockMat);
    mound.position.copy(pilePos).setY(pileR * 0.34);
    mound.receiveShadow = true;
    mound.castShadow = true;
    pileGroup.add(mound);

    const rockGeos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 26; i++) {
      const r = 0.35 + rand() * 0.95;
      const geo = new THREE.IcosahedronGeometry(r, 0);
      const pos = geo.attributes.position as THREE.BufferAttribute;
      for (let v = 0; v < pos.count; v++) {
        const k = 0.75 + rand() * 0.5;
        pos.setXYZ(v, pos.getX(v) * k, pos.getY(v) * k, pos.getZ(v) * k);
      }
      geo.computeVertexNormals();
      rockGeos.push(geo);

      const rock = new THREE.Mesh(geo, rockMat);
      const ang = rand() * Math.PI * 2;
      const dist = pileR * (0.55 + rand() * 0.95);
      rock.position.set(pilePos.x + Math.cos(ang) * dist, r * 0.6, pilePos.z + Math.sin(ang) * dist * 0.7);
      rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      pileGroup.add(rock);
    }
    scene.add(pileGroup);

    /* --- Volutas de escape sobre las chimeneas --- */
    const smokeTex = createSmokeTexture();
    const puffs: SmokePuff[] = [];
    build.exhaustPorts.forEach((port) => {
      for (let i = 0; i < 8; i++) {
        const mat = new THREE.SpriteMaterial({
          map: smokeTex,
          color: 0x8f9bab,
          transparent: true,
          depthWrite: false,
          opacity: 0,
        });
        const sprite = new THREE.Sprite(mat);
        sprite.renderOrder = 3;
        scene.add(sprite);
        puffs.push({
          sprite,
          port,
          age: (i / 8) * 2.6,
          life: 2.6,
          drift: new THREE.Vector2(0.35 + rand() * 0.3, -0.1 + rand() * 0.2),
        });
      }
    });
    smokeRef.current = puffs;

    /* --- Jaula de selección --- */
    const cageGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const cageMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
    const cage = new THREE.LineSegments(cageGeo, cageMat);
    cage.visible = false;
    scene.add(cage);
    cageRef.current = cage;

    setMachineVersion((v) => v + 1);

    return () => {
      scene.remove(build.root, pileGroup, cage);
      puffs.forEach((p) => {
        scene.remove(p.sprite);
        (p.sprite.material as THREE.SpriteMaterial).dispose();
      });
      smokeRef.current = [];
      smokeTex.dispose();
      moundGeo.dispose();
      rockGeos.forEach((g) => g.dispose());
      rockMat.dispose();
      cageGeo.dispose();
      cageMat.dispose();
      cageRef.current = null;
      pulseRef.current = [];
      machineRef.current = null;
      build.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentType, modelName]);

  /* ------------------------------------------------------------------ *
   *  3. Sombreado semántico por estado de salud CBM
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const build = machineRef.current;
    if (!build) return;

    build.setViewMode(viewMode);
    const pulsing: Array<{ mat: THREE.MeshStandardMaterial; base: number }> = [];

    build.registry.nodes.forEach((node, nodeId) => {
      const comp = components[nodeId];
      const effectiveHealth = comp
        ? isSimulatingWhatIf
          ? comp.healthScore * simulatedHealthMultiplier
          : comp.healthScore
        : 100;
      const state: HealthSemanticState = comp
        ? isSimulatingWhatIf
          ? stateFromHealth(effectiveHealth)
          : comp.semanticState
        : 'GREEN';

      const hex = HEALTH_COLOR[state];
      const severe = state === 'RED' || state === 'ORANGE';
      const isSelected = selectedNodeId === nodeId;
      const isHovered = hoveredId === nodeId;

      node.materials.forEach((mat) => {
        if (viewMode === 'HEALTH') {
          // El acero metálico bajo el env map desatura el color semántico hasta
          // volverlo pastel: en modo salud se pasa a mate para que el naranja
          // y el rojo se lean como los define la leyenda.
          mat.color.setHex(hex);
          mat.metalness = 0.12;
          mat.roughness = 0.58;
          mat.emissive.setHex(hex);
          mat.emissiveIntensity = 0.14;
        } else {
          mat.color.setHex(mat.userData.baseColor ?? 0xffffff);
          mat.metalness = mat.userData.baseMetalness ?? mat.metalness;
          mat.roughness = mat.userData.baseRoughness ?? mat.roughness;
          mat.emissive.setHex(severe ? hex : 0x000000);
          mat.emissiveIntensity = severe ? 0.22 : 0;
        }

        if (isSelected) {
          mat.emissive.setHex(0x38bdf8);
          mat.emissiveIntensity = 0.6;
        } else if (isHovered) {
          mat.emissive.setHex(0x38bdf8);
          mat.emissiveIntensity = 0.26;
        }

        if (severe && !isSelected) pulsing.push({ mat, base: mat.emissiveIntensity });
      });
    });

    pulseRef.current = pulsing;
  }, [components, selectedNodeId, hoveredId, viewMode, isSimulatingWhatIf, simulatedHealthMultiplier, machineVersion]);

  const resetView = useCallback(() => {
    const home = homeRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!home || !camera || !controls) return;
    camera.position.copy(home.position);
    controls.target.copy(home.target);
    controls.update();
  }, []);

  const hoveredComp = hoveredId ? components[hoveredId] : undefined;

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      <div
        ref={mountRef}
        className={hoveredId ? 'w-full h-full cursor-pointer' : 'w-full h-full cursor-grab active:cursor-grabbing'}
      />

      {/* Estado del motor de render */}
      <div className="absolute top-4 left-4 pointer-events-none bg-slate-900/80 backdrop-blur-md px-3.5 py-2.5 rounded-lg border border-slate-700/60 shadow-lg max-w-[19rem]">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
            WebGL 3D Digital Twin Engine (Active)
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1 leading-snug">
          Gálibo paramétrico de <span className="text-slate-200 font-medium">{modelName}</span> · Click sobre cualquier
          componente para telemetría CBM · Arrastre para rotar · Scroll para zoom
        </p>
      </div>

      {/* Selector de sombreado y encuadre */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <div className="flex bg-slate-900/85 backdrop-blur-md rounded-lg border border-slate-700/60 shadow-lg overflow-hidden">
          <button
            onClick={() => setViewMode('HEALTH')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold cursor-pointer transition-colors ${
              viewMode === 'HEALTH' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Salud CBM
          </button>
          <button
            onClick={() => setViewMode('REALISTIC')}
            className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold cursor-pointer transition-colors ${
              viewMode === 'REALISTIC' ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            Realista
          </button>
        </div>
        <button
          onClick={resetView}
          title="Restablecer encuadre"
          className="bg-slate-900/85 backdrop-blur-md text-slate-300 hover:text-white hover:bg-slate-800 p-2 rounded-lg border border-slate-700/60 shadow-lg cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Etiqueta flotante del componente bajo el cursor. El nodo permanece
          montado y se reposiciona por DOM para no re-renderizar en cada pixel. */}
      <div
        ref={tooltipRef}
        className={`absolute pointer-events-none z-10 bg-slate-900/95 border border-sky-500/60 rounded-md px-2.5 py-1.5 shadow-xl -translate-x-1/2 -translate-y-[140%] ${
          hoveredComp ? '' : 'hidden'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <Crosshair className="w-3 h-3 text-sky-400" />
          <span className="text-[11px] font-semibold text-slate-100 whitespace-nowrap">{hoveredComp?.name}</span>
        </div>
        <span className="text-[10px] text-slate-400 whitespace-nowrap">
          Salud {hoveredComp?.healthScore.toFixed(1)}% · RUL {hoveredComp?.estimatedRulHours} h
        </span>
      </div>

      {/* Leyenda semántica de salud */}
      <div className="absolute bottom-4 left-4 bg-slate-900/85 backdrop-blur-md px-4 py-2.5 rounded-lg border border-slate-700/70 shadow-lg flex items-center gap-4 text-xs font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="text-slate-300">Normal (&gt;80%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-yellow-500 shadow-sm shadow-yellow-500/50" />
          <span className="text-slate-300">Degradación (60-80%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-orange-500 shadow-sm shadow-orange-500/50" />
          <span className="text-slate-300">Alerta CBM (40-60%)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-rose-500 shadow-sm shadow-rose-500/50" />
          <span className="text-slate-300">Falla Inminente (&lt;40%)</span>
        </div>
      </div>
    </div>
  );
};
