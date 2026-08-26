import * as THREE from 'three';

export type MachineBrand = 'CAT' | 'KOMATSU' | 'GENERIC';

/** Modo de sombreado del gemelo: librea real del fabricante o mapa semántico de salud CBM. */
export type ViewMode = 'REALISTIC' | 'HEALTH';

/** Colores semánticos CBM, compartidos con la leyenda del visor. */
export const HEALTH_COLOR: Record<string, number> = {
  GREEN: 0x22c55e,
  YELLOW: 0xeab308,
  ORANGE: 0xf97316,
  RED: 0xef4444,
};

/** Deduce el fabricante desde el modelo comercial declarado en la ficha del activo. */
export const detectBrand = (modelName: string): MachineBrand => {
  const m = modelName.toLowerCase();
  if (m.includes('komatsu')) return 'KOMATSU';
  if (m.includes('caterpillar') || m.startsWith('cat ')) return 'CAT';
  return 'GENERIC';
};

// Librea de referencia por fabricante: aproximación visual, no color corporativo certificado.
const LIVERY: Record<MachineBrand, number> = {
  CAT: 0xffcd11,
  KOMATSU: 0xe9a11c,
  GENERIC: 0xf0b429,
};

export interface MachineMaterials {
  livery: THREE.MeshStandardMaterial;
  liveryPanel: THREE.MeshStandardMaterial;
  structure: THREE.MeshStandardMaterial;
  structureDark: THREE.MeshStandardMaterial;
  chrome: THREE.MeshStandardMaterial;
  wearSteel: THREE.MeshStandardMaterial;
  rubber: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  grille: THREE.MeshStandardMaterial;
  catwalk: THREE.MeshStandardMaterial;
  hose: THREE.MeshStandardMaterial;
  /** Atenúa la estructura no instrumentada para que resalten los componentes CBM. */
  setViewMode: (mode: ViewMode) => void;
  dispose: () => void;
}

// Gris pizarra al que converge la estructura cuando se activa el mapa de salud.
const NEUTRAL = new THREE.Color(0x64748b);

export function createMachineMaterials(brand: MachineBrand): MachineMaterials {
  const livery = new THREE.MeshStandardMaterial({ color: LIVERY[brand], metalness: 0.32, roughness: 0.46 });
  const liveryPanel = new THREE.MeshStandardMaterial({ color: LIVERY[brand], metalness: 0.2, roughness: 0.62 });
  const structure = new THREE.MeshStandardMaterial({ color: 0x3c444d, metalness: 0.72, roughness: 0.44 });
  const structureDark = new THREE.MeshStandardMaterial({ color: 0x242a31, metalness: 0.68, roughness: 0.52 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdde3e9, metalness: 1.0, roughness: 0.09 });
  const wearSteel = new THREE.MeshStandardMaterial({ color: 0x8d959e, metalness: 0.92, roughness: 0.34 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x14171b, metalness: 0.05, roughness: 0.94 });
  const grille = new THREE.MeshStandardMaterial({ color: 0x15191e, metalness: 0.55, roughness: 0.7 });
  const catwalk = new THREE.MeshStandardMaterial({ color: 0x596574, metalness: 0.6, roughness: 0.66 });
  const hose = new THREE.MeshStandardMaterial({ color: 0x1c2126, metalness: 0.25, roughness: 0.78 });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x9ad5ff,
    metalness: 0.0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.34,
    envMapIntensity: 2.2,
    side: THREE.DoubleSide,
  });

  const tintable: THREE.MeshStandardMaterial[] = [
    livery, liveryPanel, structure, structureDark, wearSteel, catwalk, grille,
  ];
  // Se guarda la librea original para poder alternar entre ambos modos sin recargar la escena.
  const baseColors = tintable.map((m) => m.color.clone());
  const baseRoughness = tintable.map((m) => m.roughness);

  const all: THREE.Material[] = [...tintable, chrome, rubber, hose, glass];

  return {
    livery, liveryPanel, structure, structureDark, chrome, wearSteel,
    rubber, glass, grille, catwalk, hose,

    setViewMode(mode: ViewMode) {
      const health = mode === 'HEALTH';
      tintable.forEach((m, i) => {
        m.color.copy(baseColors[i]);
        if (health) m.color.lerp(NEUTRAL, 0.86);
        m.roughness = health ? Math.min(1, baseRoughness[i] + 0.18) : baseRoughness[i];
      });
      glass.opacity = health ? 0.18 : 0.34;
    },

    dispose() {
      all.forEach((m) => m.dispose());
    },
  };
}
