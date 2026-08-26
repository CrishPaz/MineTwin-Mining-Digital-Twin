import * as THREE from 'three';
import { MachineMaterials } from './materials';

/* ------------------------------------------------------------------ *
 *  Registro de partes: posee los recursos y marca los componentes CBM
 * ------------------------------------------------------------------ */

export interface TaggedNode {
  meshes: THREE.Mesh[];
  materials: THREE.MeshStandardMaterial[];
}

/**
 * Acumula geometrias/materiales creados por los builders para liberarlos al
 * desmontar, y asocia mallas a un `nodeId` de componente CBM. Cada nodeId recibe
 * su propia instancia de material para poder tenirlo sin afectar al resto.
 */
export class PartRegistry {
  readonly nodes = new Map<string, TaggedNode>();
  private owned: Array<THREE.BufferGeometry | THREE.Material | THREE.Texture> = [];
  private tintCache = new Map<string, THREE.MeshStandardMaterial>();

  own<T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(res: T): T {
    this.owned.push(res);
    return res;
  }

  /** Crea una malla con sombras activadas y toma posesion de su geometria. */
  mesh(geo: THREE.BufferGeometry, mat: THREE.Material, receive = true): THREE.Mesh {
    this.own(geo);
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = receive;
    return m;
  }

  /** Declara la malla como parte del componente CBM `nodeId` (clicable y tenible). */
  tag<T extends THREE.Mesh>(mesh: T, nodeId: string): T {
    const source = mesh.material as THREE.MeshStandardMaterial;
    const key = nodeId + ':' + source.uuid;
    let mat = this.tintCache.get(key);

    if (!mat) {
      mat = source.clone();
      mat.userData.baseColor = mat.color.getHex();
      mat.userData.baseMetalness = mat.metalness;
      mat.userData.baseRoughness = mat.roughness;
      this.tintCache.set(key, mat);
      this.own(mat);
      const node = this.nodes.get(nodeId) ?? { meshes: [], materials: [] };
      node.materials.push(mat);
      this.nodes.set(nodeId, node);
    }

    mesh.material = mat;
    mesh.userData.nodeId = nodeId;
    this.nodes.get(nodeId)!.meshes.push(mesh);
    return mesh;
  }

  /** Hace la malla seleccionable sin darle material propio: no se tine por salud. */
  tagPick<T extends THREE.Mesh>(mesh: T, nodeId: string): T {
    mesh.userData.nodeId = nodeId;
    const node = this.nodes.get(nodeId) ?? { meshes: [], materials: [] };
    node.meshes.push(mesh);
    this.nodes.set(nodeId, node);
    return mesh;
  }

  dispose() {
    this.owned.forEach((r) => r.dispose());
    this.owned = [];
    this.nodes.clear();
    this.tintCache.clear();
  }
}

/* ------------------------------------------------------------------ *
 *  Geometria base
 * ------------------------------------------------------------------ */

/** Caja con aristas achaflanadas: lee como chapa gruesa mecanizada, no como cubo plano. */
export function roundedBoxGeometry(w: number, h: number, d: number, radius = 0.08): THREE.ExtrudeGeometry {
  const r = Math.max(0.005, Math.min(radius, w / 2 - 0.002, h / 2 - 0.002));
  const bevel = Math.max(0.004, Math.min(r * 0.6, d / 4 - 0.001));

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.01, d - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 3,
  });
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

/** Viga de seccion cajon que se estrecha hacia el extremo: perfil tipico de pluma y balancin. */
export function taperedBeamGeometry(
  len: number,
  wRoot: number,
  hRoot: number,
  wTip: number,
  hTip: number,
): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, len, 4, 1);
  geo.rotateY(Math.PI / 4); // aristas alineadas con los ejes
  geo.rotateX(Math.PI / 2); // eje longitudinal sobre +Z
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const half = len / 2;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const t = THREE.MathUtils.clamp((z + half) / len, 0, 1); // 0 raiz, 1 punta
    // Los vertices del prisma base estan a 0.3536 del eje: el factor los lleva
    // a la semianchura/semialtura pedida en cada estacion.
    pos.setX(i, pos.getX(i) * 2.8284 * THREE.MathUtils.lerp(wRoot, wTip, t));
    pos.setY(i, pos.getY(i) * 2.8284 * THREE.MathUtils.lerp(hRoot, hTip, t));
  }
  pos.needsUpdate = true;
  geo.translate(0, 0, half); // raiz en el origen, crece hacia +Z
  geo.computeVertexNormals();
  return geo;
}

/** Casquete de chapa curvada: guardabarros que envuelve la parte alta del neumatico. */
export function arcShellGeometry(
  radius: number,
  thickness: number,
  width: number,
  from: number,
  to: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius + thickness, from, to, false);
  shape.absarc(0, 0, radius, to, from, true);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 28 });
  geo.translate(0, 0, -width / 2);
  geo.rotateY(Math.PI / 2); // el arco pasa al plano ZY y el ancho queda sobre X
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ *
 *  Cilindros hidraulicos
 * ------------------------------------------------------------------ */

export interface CylinderLink {
  group: THREE.Group;
  barrelLength: number;
  setExtension: (ext: number) => void;
  from: THREE.Object3D;
  to: THREE.Object3D;
}

/**
 * Cilindro hidraulico construido sobre +Y: camisa fija mas vastago cromado
 * telescopico. Los anclajes `from`/`to` viven en los grupos que se articulan,
 * de modo que el cilindro sigue la cinematica real al animar la pluma.
 */
export function buildHydraulicCylinder(
  reg: PartRegistry,
  mats: MachineMaterials,
  opts: {
    barrelLength: number;
    barrelRadius: number;
    rodRadius: number;
    from: THREE.Object3D;
    to: THREE.Object3D;
  },
): CylinderLink {
  const { barrelLength, barrelRadius, rodRadius } = opts;
  const group = new THREE.Group();

  const clevisGeo = new THREE.CylinderGeometry(barrelRadius * 0.95, barrelRadius * 0.95, barrelRadius * 1.6, 16);
  clevisGeo.rotateZ(Math.PI / 2);

  const base = reg.mesh(clevisGeo.clone(), mats.structureDark);
  group.add(base);

  const barrel = reg.mesh(new THREE.CylinderGeometry(barrelRadius, barrelRadius, barrelLength, 24), mats.structure);
  barrel.position.y = barrelLength / 2;
  group.add(barrel);

  // Anillos de refuerzo de la camisa
  const ringGeo = new THREE.TorusGeometry(barrelRadius * 1.08, barrelRadius * 0.12, 8, 20);
  ringGeo.rotateX(Math.PI / 2);
  [0.14, 0.86].forEach((t) => {
    const ring = reg.mesh(ringGeo.clone(), mats.structureDark);
    ring.position.y = barrelLength * t;
    group.add(ring);
  });
  ringGeo.dispose();

  // Vastago: cilindro unitario que se escala segun la carrera requerida
  const rod = reg.mesh(new THREE.CylinderGeometry(rodRadius, rodRadius, 1, 18), mats.chrome);
  group.add(rod);

  const head = reg.mesh(clevisGeo.clone(), mats.structureDark);
  head.scale.setScalar(0.85);
  group.add(head);
  clevisGeo.dispose();

  const link: CylinderLink = {
    group,
    barrelLength,
    from: opts.from,
    to: opts.to,
    setExtension(ext: number) {
      const e = Math.max(0.08, ext);
      rod.scale.y = e;
      rod.position.y = barrelLength - 0.06 + e / 2;
      head.position.y = barrelLength - 0.06 + e;
    },
  };
  link.setExtension(barrelLength * 0.4);
  return link;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();

/** Reorienta y estira el cilindro para que una sus dos anclajes en la pose actual. */
export function updateCylinderLink(link: CylinderLink) {
  link.from.getWorldPosition(_a);
  link.to.getWorldPosition(_b);

  const parent = link.group.parent;
  if (parent) {
    parent.worldToLocal(_a);
    parent.worldToLocal(_b);
  }

  link.group.position.copy(_a);
  _dir.subVectors(_b, _a);
  const dist = _dir.length();
  if (dist < 1e-4) return;

  _quat.setFromUnitVectors(_up, _dir.divideScalar(dist));
  link.group.quaternion.copy(_quat);
  link.setExtension(dist - link.barrelLength);
}

/** Anclaje invisible: define donde se pina un cilindro dentro de un subconjunto articulado. */
export function anchor(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Object3D {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}

/* ------------------------------------------------------------------ *
 *  Tren de rodado de orugas
 * ------------------------------------------------------------------ */

/** Recorre el perimetro estadio de la cadena y devuelve pose y normal saliente. */
function beltPoint(s: number, straight: number, R: number) {
  const arc = Math.PI * R;
  const perim = 2 * straight + 2 * arc;
  let t = ((s % perim) + perim) % perim;

  if (t < straight) return { y: 0, z: -straight / 2 + t, rotX: Math.PI };
  t -= straight;

  if (t < arc) {
    const u = (t / arc) * Math.PI;
    const nz = Math.sin(u);
    const ny = -Math.cos(u);
    return { y: R + R * ny, z: straight / 2 + R * nz, rotX: Math.atan2(nz, ny) };
  }
  t -= arc;

  if (t < straight) return { y: 2 * R, z: straight / 2 - t, rotX: 0 };
  t -= straight;

  const u = (t / arc) * Math.PI;
  const nz = -Math.sin(u);
  const ny = Math.cos(u);
  return { y: R + R * ny, z: -straight / 2 + R * nz, rotX: Math.atan2(nz, ny) };
}

/**
 * Carro de orugas: bastidor, rueda tensora, rueda motriz dentada, rodillos
 * inferiores y cadena de zapatas con garras (grousers) sobre el perimetro real.
 * Todo el conjunto se marca como el componente `nodeId` indicado.
 */
export function buildCrawlerTrack(
  reg: PartRegistry,
  mats: MachineMaterials,
  opts: { length: number; height: number; width: number; shoes: number; nodeId: string },
): THREE.Group {
  const { length, height, width, shoes, nodeId } = opts;
  const R = height / 2;
  const straight = Math.max(0.2, length - 2 * R);
  const perim = 2 * straight + 2 * Math.PI * R;
  const group = new THREE.Group();

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);

  // Bastidor estructural interior
  const frame = reg.mesh(roundedBoxGeometry(width * 0.62, height * 0.72, straight + R * 1.2, 0.12), mats.structure);
  frame.position.y = R;
  group.add(frame);
  reg.tag(frame, nodeId);

  // Rueda tensora (delantera) y motriz (trasera)
  const wheelGeo = new THREE.CylinderGeometry(R * 0.82, R * 0.82, width * 0.7, 26);
  wheelGeo.rotateZ(Math.PI / 2);
  [straight / 2, -straight / 2].forEach((z, i) => {
    const wheel = reg.mesh(wheelGeo.clone(), i === 0 ? mats.structureDark : mats.structure);
    wheel.position.set(0, R, z);
    group.add(wheel);
    reg.tag(wheel, nodeId);
  });
  wheelGeo.dispose();

  // Dientes de la rueda motriz
  const sprocketToothGeo = reg.own(roundedBoxGeometry(width * 0.72, 0.24, 0.32, 0.05));
  const teeth = new THREE.InstancedMesh(sprocketToothGeo, mats.structureDark, 14);
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * Math.PI * 2;
    q.setFromEuler(new THREE.Euler(ang, 0, 0));
    m4.compose(
      new THREE.Vector3(0, R + Math.cos(ang) * R * 0.9, -straight / 2 + Math.sin(ang) * R * 0.9),
      q,
      one,
    );
    teeth.setMatrixAt(i, m4);
  }
  teeth.instanceMatrix.needsUpdate = true;
  teeth.castShadow = true;
  group.add(teeth);
  reg.tag(teeth, nodeId);

  // Rodillos inferiores de apoyo
  const rollerGeo = reg.own(new THREE.CylinderGeometry(R * 0.34, R * 0.34, width * 0.58, 16));
  rollerGeo.rotateZ(Math.PI / 2);
  const rollers = new THREE.InstancedMesh(rollerGeo, mats.structureDark, 7);
  for (let i = 0; i < 7; i++) {
    m4.compose(
      new THREE.Vector3(0, R * 0.42, -straight / 2 + (straight * (i + 0.5)) / 7),
      new THREE.Quaternion(),
      one,
    );
    rollers.setMatrixAt(i, m4);
  }
  rollers.instanceMatrix.needsUpdate = true;
  rollers.castShadow = true;
  group.add(rollers);
  reg.tag(rollers, nodeId);

  // Cadena de zapatas: una instancia por eslabon sobre el perimetro
  const pitch = perim / shoes;
  const shoeThk = 0.17;
  const shoeGeo = reg.own(roundedBoxGeometry(width, shoeThk, pitch * 0.9, 0.03));
  const shoeMesh = new THREE.InstancedMesh(shoeGeo, mats.structureDark, shoes);
  const grouserGeo = reg.own(roundedBoxGeometry(width * 0.86, 0.15, pitch * 0.24, 0.02));
  const grouserMesh = new THREE.InstancedMesh(grouserGeo, mats.wearSteel, shoes);

  for (let i = 0; i < shoes; i++) {
    const p = beltPoint((i + 0.5) * pitch, straight, R);
    const ny = Math.cos(p.rotX);
    const nz = Math.sin(p.rotX);
    q.setFromEuler(new THREE.Euler(p.rotX, 0, 0));

    m4.compose(new THREE.Vector3(0, p.y + (ny * shoeThk) / 2, p.z + (nz * shoeThk) / 2), q, one);
    shoeMesh.setMatrixAt(i, m4);

    const go = shoeThk + 0.07;
    m4.compose(new THREE.Vector3(0, p.y + ny * go, p.z + nz * go), q, one);
    grouserMesh.setMatrixAt(i, m4);
  }
  shoeMesh.instanceMatrix.needsUpdate = true;
  grouserMesh.instanceMatrix.needsUpdate = true;
  shoeMesh.castShadow = true;
  shoeMesh.receiveShadow = true;
  grouserMesh.castShadow = true;
  group.add(shoeMesh, grouserMesh);
  reg.tag(shoeMesh, nodeId);
  reg.tag(grouserMesh, nodeId);

  return group;
}

/* ------------------------------------------------------------------ *
 *  Neumatico minero (serie 57 pulgadas, cargador frontal)
 * ------------------------------------------------------------------ */

export function buildMiningTire(
  reg: PartRegistry,
  mats: MachineMaterials,
  opts: { radius: number; width: number; nodeId: string },
): THREE.Group {
  const { radius, width, nodeId } = opts;
  const group = new THREE.Group();

  // Banda de rodadura y flancos
  const tread = reg.mesh(new THREE.CylinderGeometry(radius, radius, width * 0.74, 40), mats.rubber);
  tread.rotation.z = Math.PI / 2;
  group.add(tread);

  const sidewall = reg.mesh(new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, width, 40), mats.rubber);
  sidewall.rotation.z = Math.PI / 2;
  group.add(sidewall);

  // Tacos en espiga alrededor de la banda de rodadura
  const lugCount = 22;
  const lugGeo = reg.own(roundedBoxGeometry(width * 0.7, 0.14, radius * 0.34, 0.04));
  const lugs = new THREE.InstancedMesh(lugGeo, mats.rubber, lugCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < lugCount; i++) {
    const ang = (i / lugCount) * Math.PI * 2;
    q.setFromEuler(new THREE.Euler(ang, i % 2 ? 0.22 : -0.22, 0));
    m4.compose(new THREE.Vector3(0, Math.cos(ang) * radius, Math.sin(ang) * radius), q, one);
    lugs.setMatrixAt(i, m4);
  }
  lugs.instanceMatrix.needsUpdate = true;
  lugs.castShadow = true;
  group.add(lugs);

  // Llanta y cubo con corona de pernos
  const rim = reg.mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width * 1.02, 30), mats.livery);
  rim.rotation.z = Math.PI / 2;
  group.add(rim);

  const hub = reg.mesh(new THREE.CylinderGeometry(radius * 0.26, radius * 0.26, width * 1.14, 22), mats.structure);
  hub.rotation.z = Math.PI / 2;
  group.add(hub);

  const boltGeo = reg.own(new THREE.CylinderGeometry(0.07, 0.07, width * 1.22, 8));
  boltGeo.rotateZ(Math.PI / 2);
  const bolts = new THREE.InstancedMesh(boltGeo, mats.structureDark, 12);
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    m4.compose(
      new THREE.Vector3(0, Math.cos(ang) * radius * 0.4, Math.sin(ang) * radius * 0.4),
      new THREE.Quaternion(),
      one,
    );
    bolts.setMatrixAt(i, m4);
  }
  bolts.instanceMatrix.needsUpdate = true;
  group.add(bolts);

  // La llanta y el cubo llevan el color semantico; el caucho solo es clicable,
  // porque un neumatico tenido de rojo destruye la lectura realista.
  [rim, hub, bolts].forEach((m) => reg.tag(m as THREE.Mesh, nodeId));
  [tread, sidewall, lugs].forEach((m) => reg.tagPick(m as THREE.Mesh, nodeId));
  return group;
}

/* ------------------------------------------------------------------ *
 *  Cucharon con elementos de desgaste (GET)
 * ------------------------------------------------------------------ */

/**
 * Cucharon construido como cascara real: perfil en C (piso + pared trasera +
 * labio) extruido a lo ancho, mas paredes laterales solidas, labio de acero
 * antidesgaste y dientes GET. Origen en el fondo trasero, boca hacia +X.
 */
export function buildBucket(
  reg: PartRegistry,
  mats: MachineMaterials,
  opts: {
    width: number;
    depth: number;
    height: number;
    teeth: number;
    nodeId: string;
    scooped?: boolean;
    spillGuard?: boolean;
  },
): THREE.Group {
  const { width, depth, height, teeth, nodeId, scooped = false, spillGuard = false } = opts;
  const group = new THREE.Group();
  const t = 0.16;
  const floorRise = scooped ? 0.5 : 0.3;
  const lipTop = floorRise + 0.34;

  // Perfil en C de la cascara (piso, trasera, labio)
  const shell = new THREE.Shape();
  shell.moveTo(0, height);
  shell.lineTo(0, 0);
  if (scooped) shell.quadraticCurveTo(depth * 0.55, -0.16, depth, floorRise);
  else shell.lineTo(depth, floorRise);
  shell.lineTo(depth, lipTop);
  if (scooped) shell.quadraticCurveTo(depth * 0.55, t * 0.6, t * 1.6, t + 0.06);
  else shell.lineTo(t * 1.6, t + 0.06);
  shell.lineTo(t * 1.6, height);
  shell.closePath();

  const shellGeo = new THREE.ExtrudeGeometry(shell, {
    depth: width - t * 2,
    bevelEnabled: false,
    curveSegments: 8,
  });
  shellGeo.translate(0, 0, -(width - t * 2) / 2);
  shellGeo.computeVertexNormals();
  const shellMesh = reg.mesh(shellGeo, mats.livery);
  group.add(shellMesh);
  reg.tag(shellMesh, nodeId);

  // Silueta lateral solida (dos paredes)
  const side = new THREE.Shape();
  side.moveTo(0, 0);
  if (scooped) side.quadraticCurveTo(depth * 0.55, -0.16, depth, floorRise);
  else side.lineTo(depth, floorRise);
  side.lineTo(depth, lipTop);
  side.lineTo(depth * 0.7, height);
  side.lineTo(0, height);
  side.closePath();

  const sideGeo = new THREE.ExtrudeGeometry(side, { depth: t, bevelEnabled: false, curveSegments: 8 });
  sideGeo.computeVertexNormals();
  reg.own(sideGeo);
  [-width / 2, width / 2 - t].forEach((z) => {
    const wall = new THREE.Mesh(sideGeo, mats.livery);
    wall.position.z = z;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    reg.tag(wall, nodeId);
  });

  // Labio de acero antidesgaste
  const lip = reg.mesh(roundedBoxGeometry(0.46, lipTop - floorRise + 0.14, width * 1.01, 0.05), mats.wearSteel);
  lip.position.set(depth - 0.1, (floorRise + lipTop) / 2, 0);
  group.add(lip);
  reg.tag(lip, nodeId);

  // Dientes GET: piramide truncada de base cuadrada, mas ancha que alta. El paso
  // entre dientes dimensiona la pieza, acotada al rango real de un GET minero.
  const pitch = width / teeth;
  const toothLen = THREE.MathUtils.clamp(pitch * 0.55, 0.35, 0.8);
  const toothR = THREE.MathUtils.clamp(pitch * 0.26, 0.16, 0.3);
  const toothGeo = reg.own(new THREE.CylinderGeometry(toothR * 0.28, toothR, toothLen, 4, 1));
  toothGeo.rotateZ(-Math.PI / 2);
  const adapterGeo = reg.own(roundedBoxGeometry(0.34, toothR * 2.1, Math.min(pitch * 0.5, 0.6), 0.04));

  for (let i = 0; i < teeth; i++) {
    const z = -width / 2 + (width * (i + 0.5)) / teeth;
    const y = (floorRise + lipTop) / 2;

    const adapter = new THREE.Mesh(adapterGeo, mats.structureDark);
    adapter.position.set(depth + 0.1, y, z);
    adapter.castShadow = true;
    group.add(adapter);
    reg.tag(adapter, nodeId);

    const tooth = new THREE.Mesh(toothGeo, mats.wearSteel);
    tooth.position.set(depth + 0.14 + toothLen / 2, y - 0.05, z);
    tooth.scale.set(1, 0.9, 1.35);
    tooth.castShadow = true;
    group.add(tooth);
    reg.tag(tooth, nodeId);
  }

  // Cortadores laterales
  const cutterGeo = reg.own(roundedBoxGeometry(0.5, 0.5, 0.14, 0.04));
  [-width / 2 - 0.02, width / 2 + 0.02].forEach((z) => {
    const cutter = new THREE.Mesh(cutterGeo, mats.wearSteel);
    cutter.position.set(depth + 0.08, floorRise + 0.3, z);
    cutter.castShadow = true;
    group.add(cutter);
    reg.tag(cutter, nodeId);
  });

  // Visera antiderrame para cucharon de cargador
  if (spillGuard) {
    const guard = reg.mesh(roundedBoxGeometry(0.6, 0.14, width, 0.05), mats.livery);
    guard.position.set(depth * 0.42, height + 0.05, 0);
    guard.rotation.z = -0.22;
    group.add(guard);
    reg.tag(guard, nodeId);
  }

  // Nervios de refuerzo en la espalda
  const ribGeo = reg.own(roundedBoxGeometry(0.18, height * 0.9, 0.22, 0.03));
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(ribGeo, mats.structure);
    rib.position.set(-0.1, height / 2, -width * 0.36 + (width * 0.72 * i) / 3);
    rib.castShadow = true;
    group.add(rib);
    reg.tag(rib, nodeId);
  }

  return group;
}

/* ------------------------------------------------------------------ *
 *  Detalle de planta: barandas, escaleras, rejillas, mangueras
 * ------------------------------------------------------------------ */

/** Baranda de seguridad: pasamanos superior, travesano intermedio y montantes. */
export function buildHandrail(
  reg: PartRegistry,
  mats: MachineMaterials,
  points: THREE.Vector3[],
  height = 1.05,
): THREE.Group {
  const group = new THREE.Group();
  if (points.length < 2) return group;

  const postGeo = reg.own(new THREE.CylinderGeometry(0.045, 0.045, height, 8));

  [height, height * 0.55].forEach((h) => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(p.x, p.y + h, p.z)),
      false,
      'catmullrom',
      0.02,
    );
    const rail = reg.mesh(new THREE.TubeGeometry(curve, points.length * 6, 0.04, 6, false), mats.catwalk, false);
    group.add(rail);
  });

  const spacing = 1.6;
  for (let i = 0; i < points.length - 1; i++) {
    const seg = points[i + 1].clone().sub(points[i]);
    const n = Math.max(1, Math.round(seg.length() / spacing));
    for (let k = 0; k <= n; k++) {
      if (i > 0 && k === 0) continue;
      const p = points[i].clone().addScaledVector(seg, k / n);
      const post = new THREE.Mesh(postGeo, mats.catwalk);
      post.position.set(p.x, p.y + height / 2, p.z);
      post.castShadow = true;
      group.add(post);
    }
  }
  return group;
}

/** Escalera de acceso a plataforma. */
export function buildLadder(reg: PartRegistry, mats: MachineMaterials, height: number, width = 0.8): THREE.Group {
  const group = new THREE.Group();
  const stringerGeo = reg.own(roundedBoxGeometry(0.09, height, 0.2, 0.02));
  [-width / 2, width / 2].forEach((x) => {
    const s = new THREE.Mesh(stringerGeo, mats.catwalk);
    s.position.set(x, height / 2, 0);
    s.castShadow = true;
    group.add(s);
  });

  const rungs = Math.max(2, Math.round(height / 0.32));
  const rungGeo = reg.own(new THREE.CylinderGeometry(0.035, 0.035, width, 8));
  rungGeo.rotateZ(Math.PI / 2);
  const rungMesh = new THREE.InstancedMesh(rungGeo, mats.catwalk, rungs);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < rungs; i++) {
    m4.setPosition(0, (height * (i + 0.5)) / rungs, 0);
    rungMesh.setMatrixAt(i, m4);
  }
  rungMesh.instanceMatrix.needsUpdate = true;
  rungMesh.castShadow = true;
  group.add(rungMesh);
  return group;
}

/** Rejilla de radiador: marco mas lamas horizontales. */
export function buildGrille(
  reg: PartRegistry,
  mats: MachineMaterials,
  w: number,
  h: number,
  slats = 9,
): THREE.Group {
  const group = new THREE.Group();
  const back = reg.mesh(roundedBoxGeometry(w, h, 0.08, 0.03), mats.grille, false);
  group.add(back);

  const slatGeo = reg.own(roundedBoxGeometry(w * 0.94, h / slats / 2.2, 0.1, 0.01));
  const slatMesh = new THREE.InstancedMesh(slatGeo, mats.structure, slats);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < slats; i++) {
    m4.setPosition(0, -h / 2 + (h * (i + 0.5)) / slats, 0.06);
    slatMesh.setMatrixAt(i, m4);
  }
  slatMesh.instanceMatrix.needsUpdate = true;
  group.add(slatMesh);
  return group;
}

/** Manguera hidraulica de alta presion trazada como spline entre dos puntos. */
export function buildHose(
  reg: PartRegistry,
  mats: MachineMaterials,
  from: THREE.Vector3,
  to: THREE.Vector3,
  sag = 0.35,
  radius = 0.07,
): THREE.Mesh {
  const mid = from.clone().lerp(to, 0.5);
  mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  return reg.mesh(new THREE.TubeGeometry(curve, 20, radius, 8, false), mats.hose, false);
}

/** Chimenea de escape con guardacalor. */
export function buildExhaustStack(reg: PartRegistry, mats: MachineMaterials, height: number): THREE.Group {
  const group = new THREE.Group();
  const pipe = reg.mesh(new THREE.CylinderGeometry(0.19, 0.22, height, 16), mats.structureDark);
  pipe.position.y = height / 2;
  group.add(pipe);

  const shield = reg.mesh(new THREE.CylinderGeometry(0.28, 0.28, height * 0.45, 16, 1, true), mats.chrome, false);
  shield.position.y = height * 0.3;
  group.add(shield);

  const cap = reg.mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.16, 16), mats.structureDark);
  cap.position.y = height + 0.05;
  group.add(cap);
  return group;
}
