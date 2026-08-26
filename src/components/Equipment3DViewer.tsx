import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ComponentHealthInfo } from '../types';

interface Equipment3DViewerProps {
  components: Record<string, ComponentHealthInfo>;
  selectedNodeId: string | null;
  onSelectComponent: (nodeId: string) => void;
  isSimulatingWhatIf?: boolean;
  simulatedHealthMultiplier?: number;
}

export const Equipment3DViewer: React.FC<Equipment3DViewerProps> = ({
  components,
  selectedNodeId,
  onSelectComponent,
  isSimulatingWhatIf = false,
  simulatedHealthMultiplier = 1.0,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshMapRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Helper para color semántico PBR
  const getSemanticColor = (state: string, simulatedHealth: number) => {
    // Si está en simulación, ajustar color según multiplicador
    if (isSimulatingWhatIf && simulatedHealth < 40) return 0xef4444; // RED
    if (isSimulatingWhatIf && simulatedHealth < 60) return 0xf97316; // ORANGE
    if (isSimulatingWhatIf && simulatedHealth < 80) return 0xeab308; // YELLOW

    switch (state) {
      case 'RED':
        return 0xef4444;
      case 'ORANGE':
        return 0xf97316;
      case 'YELLOW':
        return 0xeab308;
      case 'GREEN':
      default:
        return 0x22c55e;
    }
  };

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 550;

    // 1. Scene & Camera Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Slate-900 oscuro industrial
    scene.fog = new THREE.FogExp2(0x0f172a, 0.025);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(12, 9, 14);
    camera.lookAt(0, 2, 0);
    cameraRef.current = camera;

    // 2. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 3. Luces de Estudio Minero
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff5e6, 1.4);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    scene.add(dirLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6); // Cyan rim industrial
    rimLight.position.set(-15, 10, -15);
    scene.add(rimLight);

    // 4. Piso de Banco de Mina con Rejilla
    const grid = new THREE.GridHelper(30, 30, 0x38bdf8, 0x1e293b);
    grid.position.y = -0.01;
    scene.add(grid);

    // 5. Construcción Jerárquica del Gemelo Digital (Pala Minera Hidráulica)
    const machineGroup = new THREE.Group();
    machineGroup.position.set(0, 0, 0);
    scene.add(machineGroup);

    const meshMap = new Map<string, THREE.Mesh>();

    // A. Tren de Rodado / Orugas (undercarriage_tracks)
    const tracksMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.3,
    });
    const trackLeftGeo = new THREE.BoxGeometry(1.6, 1.4, 7.5);
    const trackLeft = new THREE.Mesh(trackLeftGeo, tracksMat);
    trackLeft.position.set(-2.4, 0.7, 0);
    trackLeft.castShadow = true;
    trackLeft.receiveShadow = true;
    trackLeft.userData = { nodeId: 'undercarriage_tracks' };
    machineGroup.add(trackLeft);

    const trackRight = trackLeft.clone();
    trackRight.position.set(2.4, 0.7, 0);
    trackRight.userData = { nodeId: 'undercarriage_tracks' };
    machineGroup.add(trackRight);
    meshMap.set('undercarriage_tracks', trackLeft);

    // B. Chasis Central y Reductor de Giro (swing_drive)
    const swingMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
    const swingGeo = new THREE.CylinderGeometry(2.2, 2.2, 0.9, 32);
    const swingMesh = new THREE.Mesh(swingGeo, swingMat);
    swingMesh.position.set(0, 1.5, 0);
    swingMesh.castShadow = true;
    swingMesh.userData = { nodeId: 'swing_drive' };
    machineGroup.add(swingMesh);
    meshMap.set('swing_drive', swingMesh);

    // C. Carrocería Superior / Casa de Máquinas
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 });
    const bodyGeo = new THREE.BoxGeometry(4.6, 2.4, 5.8);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, 3.1, -0.6);
    bodyMesh.castShadow = true;
    machineGroup.add(bodyMesh);

    // D. Motor Diésel Twin (diesel_engine)
    const engineMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.3, metalness: 0.6 });
    const engineGeo = new THREE.BoxGeometry(3.6, 1.6, 2.2);
    const engineMesh = new THREE.Mesh(engineGeo, engineMat);
    engineMesh.position.set(0, 3.8, -2.0);
    engineMesh.castShadow = true;
    engineMesh.userData = { nodeId: 'diesel_engine' };
    machineGroup.add(engineMesh);
    meshMap.set('diesel_engine', engineMesh);

    // E. Bomba Principal Hidráulica (hydraulic_pump_primary)
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.2, metalness: 0.7 });
    const pumpGeo = new THREE.CylinderGeometry(0.65, 0.65, 1.8, 24);
    pumpGeo.rotateZ(Math.PI / 2);
    const pumpMesh = new THREE.Mesh(pumpGeo, pumpMat);
    pumpMesh.position.set(1.4, 2.8, 0.4);
    pumpMesh.castShadow = true;
    pumpMesh.userData = { nodeId: 'hydraulic_pump_primary' };
    machineGroup.add(pumpMesh);
    meshMap.set('hydraulic_pump_primary', pumpMesh);

    // F. Cabina de Operación (operator_cabin)
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, transparent: true, opacity: 0.85, roughness: 0.1 });
    const cabinGeo = new THREE.BoxGeometry(1.6, 1.8, 1.8);
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(-2.0, 4.4, 1.4);
    cabinMesh.castShadow = true;
    cabinMesh.userData = { nodeId: 'operator_cabin' };
    machineGroup.add(cabinMesh);
    meshMap.set('operator_cabin', cabinMesh);

    // G. Pluma y Cilindros de Pluma (boom_cylinders)
    const boomGroup = new THREE.Group();
    boomGroup.position.set(0, 2.8, 2.0);
    machineGroup.add(boomGroup);

    const boomMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.4, roughness: 0.3 });
    const boomGeo = new THREE.BoxGeometry(1.4, 1.2, 7.0);
    boomGeo.translate(0, 0.6, 3.5);
    const boomMesh = new THREE.Mesh(boomGeo, boomMat);
    boomMesh.rotation.x = -Math.PI / 4.5;
    boomMesh.castShadow = true;
    boomGroup.add(boomMesh);

    const cylMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, metalness: 0.8, roughness: 0.1 });
    const cylGeo = new THREE.CylinderGeometry(0.28, 0.28, 4.2, 16);
    cylGeo.rotateX(Math.PI / 3);
    const cylLeft = new THREE.Mesh(cylGeo, cylMat);
    cylLeft.position.set(-1.1, 2.2, 1.8);
    cylLeft.userData = { nodeId: 'boom_cylinders' };
    boomGroup.add(cylLeft);

    const cylRight = cylLeft.clone();
    cylRight.position.set(1.1, 2.2, 1.8);
    cylRight.userData = { nodeId: 'boom_cylinders' };
    boomGroup.add(cylRight);
    meshMap.set('boom_cylinders', cylLeft);

    // H. Cucharón / Balde Minero (bucket_assembly)
    const bucketMat = new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.6, roughness: 0.4 });
    const bucketGeo = new THREE.BoxGeometry(3.6, 2.2, 2.6);
    const bucketMesh = new THREE.Mesh(bucketGeo, bucketMat);
    bucketMesh.position.set(0, 2.2, 7.8);
    bucketMesh.rotation.x = Math.PI / 6;
    bucketMesh.castShadow = true;
    bucketMesh.userData = { nodeId: 'bucket_assembly' };
    machineGroup.add(bucketMesh);
    meshMap.set('bucket_assembly', bucketMesh);

    meshMapRef.current = meshMap;

    // 6. Raycasting y Selección Interactiva con Cursor
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(machineGroup.children, true);

      if (intersects.length > 0) {
        let currentObj: THREE.Object3D | null = intersects[0].object;
        while (currentObj && !currentObj.userData?.nodeId) {
          currentObj = currentObj.parent;
        }
        if (currentObj && currentObj.userData?.nodeId) {
          onSelectComponent(currentObj.userData.nodeId);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // 7. Orbit Control Simplificado (Mouse Drag)
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let cameraAngle = { theta: Math.PI / 4, phi: Math.PI / 6, radius: 22 };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouse.x;
      const deltaY = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      cameraAngle.theta -= deltaX * 0.008;
      cameraAngle.phi = Math.max(0.1, Math.min(Math.PI / 2.2, cameraAngle.phi + deltaY * 0.008));

      camera.position.x = cameraAngle.radius * Math.sin(cameraAngle.phi) * Math.sin(cameraAngle.theta);
      camera.position.y = cameraAngle.radius * Math.cos(cameraAngle.phi);
      camera.position.z = cameraAngle.radius * Math.sin(cameraAngle.phi) * Math.cos(cameraAngle.theta);
      camera.lookAt(0, 2.5, 0);
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraAngle.radius = Math.max(8, Math.min(35, cameraAngle.radius + e.deltaY * 0.02));
      camera.position.x = cameraAngle.radius * Math.sin(cameraAngle.phi) * Math.sin(cameraAngle.theta);
      camera.position.y = cameraAngle.radius * Math.cos(cameraAngle.phi);
      camera.position.z = cameraAngle.radius * Math.sin(cameraAngle.phi) * Math.cos(cameraAngle.theta);
      camera.lookAt(0, 2.5, 0);
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    domElem.addEventListener('wheel', handleWheel, { passive: false });

    // 8. Render Loop con Animación Suave
    let clock = new THREE.Clock();
    const animate = () => {
      animationFrameId.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Ligera rotación de excavación/cucharon cuando se simula
      if (isSimulatingWhatIf) {
        bucketMesh.position.y = 2.2 + Math.sin(elapsedTime * 3) * 0.4;
      }

      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width: newW, height: newH } = entry.contentRect;
        if (newW > 0 && newH > 0 && camera && renderer) {
          camera.aspect = newW / newH;
          camera.updateProjectionMatrix();
          renderer.setSize(newW, newH);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      domElem.removeEventListener('pointerdown', handlePointerDown);
      domElem.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      domElem.removeEventListener('wheel', handleWheel);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      renderer.dispose();
    };
  }, []);

  // Actualización dinámica de colores semánticos en base al estado de salud
  useEffect(() => {
    meshMapRef.current.forEach((mesh, nodeId) => {
      const comp = components[nodeId];
      if (comp && mesh.material instanceof THREE.MeshStandardMaterial) {
        const effectiveHealth = isSimulatingWhatIf ? comp.healthScore * simulatedHealthMultiplier : comp.healthScore;
        const colorHex = getSemanticColor(comp.semanticState, effectiveHealth);

        mesh.material.color.setHex(colorHex);

        // Si está seleccionado, resaltar con pulso o emisivo
        if (selectedNodeId === nodeId) {
          mesh.material.emissive.setHex(0x38bdf8);
          mesh.material.emissiveIntensity = 0.45;
        } else {
          mesh.material.emissive.setHex(0x000000);
          mesh.material.emissiveIntensity = 0.0;
        }
      }
    });
  }, [components, selectedNodeId, isSimulatingWhatIf, simulatedHealthMultiplier]);

  return (
    <div className="relative w-full h-full min-h-[460px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Overlay de Guía 3D */}
      <div className="absolute top-4 left-4 pointer-events-none bg-slate-900/80 backdrop-blur-md px-3.5 py-2.5 rounded-lg border border-slate-700/60 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
            WebGL 3D Digital Twin Engine (Active)
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          Click sobre cualquier componente para telemetría CBM · Arrastre para rotar 360° · Scroll para zoom
        </p>
      </div>

      {/* Leyenda Semántica de Salud */}
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
