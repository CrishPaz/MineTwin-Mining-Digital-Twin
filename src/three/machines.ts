import * as THREE from 'three';
import { createMachineMaterials, detectBrand, MachineMaterials, ViewMode } from './materials';
import {
  anchor,
  buildBucket,
  buildCrawlerTrack,
  buildExhaustStack,
  buildGrille,
  buildHandrail,
  buildHose,
  buildLadder,
  buildMiningTire,
  arcShellGeometry,
  buildHydraulicCylinder,
  CylinderLink,
  PartRegistry,
  roundedBoxGeometry,
  taperedBeamGeometry,
  updateCylinderLink,
} from './primitives';

export type EquipmentKind = 'HYDRAULIC_SHOVEL' | 'ELECTRIC_ROPE_SHOVEL' | 'WHEEL_LOADER' | 'EXCAVATOR';

export interface MachineBuild {
  root: THREE.Group;
  registry: PartRegistry;
  materials: MachineMaterials;
  /** Encuadre sugerido de la camara para este gabarito. */
  cameraTarget: THREE.Vector3;
  cameraRadius: number;
  /** Centro y radio del apilamiento de mineral que acompana a la maquina. */
  muckPile: { position: THREE.Vector3; radius: number };
  /** Bocas de escape, usadas por el sistema de humo del visor. */
  exhaustPorts: THREE.Object3D[];
  /** Aplica la cinematica del ciclo de excavacion y realinea los cilindros. */
  update: (elapsed: number, digIntensity: number) => void;
  setViewMode: (mode: ViewMode) => void;
  dispose: () => void;
}

/* ------------------------------------------------------------------ *
 *  Cabina FOPS/ROPS reutilizable
 * ------------------------------------------------------------------ */

function buildCab(
  reg: PartRegistry,
  mats: MachineMaterials,
  opts: { w: number; h: number; d: number; nodeId: string },
): THREE.Group {
  const { w, h, d, nodeId } = opts;
  const group = new THREE.Group();
  const post = 0.14;

  // Piso y techo
  const floor = reg.mesh(roundedBoxGeometry(w, 0.16, d, 0.04), mats.structure);
  floor.position.y = 0.08;
  group.add(floor);
  reg.tag(floor, nodeId);

  const roof = reg.mesh(roundedBoxGeometry(w + 0.12, 0.18, d + 0.12, 0.05), mats.livery);
  roof.position.y = h;
  group.add(roof);
  reg.tag(roof, nodeId);

  // Montantes de esquina
  const postGeo = reg.own(roundedBoxGeometry(post, h, post, 0.03));
  [
    [-w / 2 + post / 2, -d / 2 + post / 2],
    [w / 2 - post / 2, -d / 2 + post / 2],
    [-w / 2 + post / 2, d / 2 - post / 2],
    [w / 2 - post / 2, d / 2 - post / 2],
  ].forEach(([x, z]) => {
    const p = new THREE.Mesh(postGeo, mats.structure);
    p.position.set(x, h / 2, z);
    p.castShadow = true;
    group.add(p);
    reg.tag(p, nodeId);
  });

  // Acristalamiento: frontal, laterales y trasero
  const glassPanels: Array<[number, number, number, number, number, number]> = [
    [w - post, h - 0.5, 0.05, 0, h / 2 + 0.1, d / 2],
    [w - post, h - 0.9, 0.05, 0, h / 2 + 0.2, -d / 2],
    [0.05, h - 0.7, d - post, -w / 2, h / 2 + 0.15, 0],
    [0.05, h - 0.7, d - post, w / 2, h / 2 + 0.15, 0],
  ];
  const glassGeos = glassPanels.map(([gw, gh, gd]) => reg.own(new THREE.BoxGeometry(gw, gh, gd)));
  glassPanels.forEach(([, , , x, y, z], i) => {
    const pane = new THREE.Mesh(glassGeos[i], mats.glass);
    pane.position.set(x, y, z);
    group.add(pane);
    pane.userData.nodeId = nodeId;
    reg.nodes.get(nodeId)?.meshes.push(pane);
  });

  // Visera solar y jaula FOPS sobre el techo
  const visor = reg.mesh(roundedBoxGeometry(w + 0.2, 0.1, 0.5, 0.03), mats.structureDark);
  visor.position.set(0, h + 0.16, d / 2 + 0.22);
  visor.rotation.x = 0.22;
  group.add(visor);
  reg.tag(visor, nodeId);

  const fopsGeo = reg.own(new THREE.CylinderGeometry(0.06, 0.06, w + 0.1, 8));
  fopsGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < 4; i++) {
    const bar = new THREE.Mesh(fopsGeo, mats.catwalk);
    bar.position.set(0, h + 0.3, -d / 2 + (d * (i + 0.5)) / 4);
    bar.castShadow = true;
    group.add(bar);
    reg.tag(bar, nodeId);
  }

  return group;
}

/** Modulo de bombas hidraulicas principales, con colector y latiguillos de alta presion. */
function buildPumpModule(
  reg: PartRegistry,
  mats: MachineMaterials,
  opts: { pumps: number; nodeId: string; hoseTo: THREE.Vector3 },
): THREE.Group {
  const group = new THREE.Group();

  const manifold = reg.mesh(roundedBoxGeometry(1.4, 1.2, 2.2, 0.1), mats.structure);
  manifold.position.set(0, 0.6, 0);
  group.add(manifold);
  reg.tag(manifold, opts.nodeId);

  const bodyGeo = reg.own(new THREE.CylinderGeometry(0.4, 0.34, 1.3, 20));
  bodyGeo.rotateZ(Math.PI / 2);
  const flangeGeo = reg.own(new THREE.CylinderGeometry(0.46, 0.46, 0.16, 20));
  flangeGeo.rotateZ(Math.PI / 2);

  for (let i = 0; i < opts.pumps; i++) {
    const z = -0.7 + (1.4 * i) / Math.max(1, opts.pumps - 1);
    const body = new THREE.Mesh(bodyGeo, mats.structureDark);
    body.position.set(1.2, 0.62, z);
    body.castShadow = true;
    group.add(body);
    reg.tag(body, opts.nodeId);

    const flange = new THREE.Mesh(flangeGeo, mats.structure);
    flange.position.set(0.78, 0.62, z);
    flange.castShadow = true;
    group.add(flange);
    reg.tag(flange, opts.nodeId);

    const hose = buildHose(
      reg,
      mats,
      new THREE.Vector3(1.7, 0.62, z),
      opts.hoseTo.clone().add(new THREE.Vector3(0, 0, z * 0.4)),
      0.5,
      0.075,
    );
    group.add(hose);
  }
  return group;
}

/* ------------------------------------------------------------------ *
 *  Pala hidraulica frontal (gabarito clase Cat 6060 / Komatsu PC8000)
 * ------------------------------------------------------------------ */

function buildHydraulicMiningShovel(reg: PartRegistry, mats: MachineMaterials): Omit<MachineBuild, 'registry' | 'materials' | 'setViewMode' | 'dispose'> {
  const root = new THREE.Group();
  const cylinders: CylinderLink[] = [];
  const exhaustPorts: THREE.Object3D[] = [];

  /* --- A. Tren de rodado: dos carros de oruga y carro central --- */
  const TRACK_LEN = 9.4;
  const TRACK_H = 2.0;
  const GAUGE = 2.75;

  [-GAUGE, GAUGE].forEach((x) => {
    const track = buildCrawlerTrack(reg, mats, {
      length: TRACK_LEN,
      height: TRACK_H,
      width: 1.5,
      shoes: 34,
      nodeId: 'undercarriage_tracks',
    });
    track.position.x = x;
    root.add(track);
  });

  const carBody = reg.mesh(roundedBoxGeometry(3.5, 1.4, 6.2, 0.14), mats.structure);
  carBody.position.set(0, 1.05, 0);
  root.add(carBody);
  reg.tag(carBody, 'undercarriage_tracks');

  /* --- B. Corona y reductores de giro --- */
  const swingRing = reg.mesh(new THREE.CylinderGeometry(2.7, 2.85, 0.55, 40), mats.structureDark);
  swingRing.position.set(0, 2.05, 0);
  root.add(swingRing);
  reg.tag(swingRing, 'swing_drive');

  const swingGearGeo = reg.own(new THREE.CylinderGeometry(0.42, 0.5, 1.1, 18));
  [-1.5, 1.5].forEach((x) => {
    const gear = new THREE.Mesh(swingGearGeo, mats.structure);
    gear.position.set(x, 2.6, -1.4);
    gear.castShadow = true;
    root.add(gear);
    reg.tag(gear, 'swing_drive');
  });

  /* --- C. Superestructura giratoria --- */
  const house = new THREE.Group();
  house.position.y = 2.33;
  root.add(house);

  const deck = reg.mesh(roundedBoxGeometry(7.2, 0.34, 10.4, 0.1), mats.catwalk);
  deck.position.set(0, 0.17, -2.0);
  house.add(deck);

  // Modulo de potencia: motor diesel con rejillas de radiador y chimeneas
  const engine = reg.mesh(roundedBoxGeometry(3.4, 2.4, 4.2, 0.16), mats.livery);
  engine.position.set(0.5, 1.54, -3.7);
  house.add(engine);
  reg.tag(engine, 'diesel_engine');

  [-1, 1].forEach((side) => {
    const grille = buildGrille(reg, mats, 3.4, 1.6, 10);
    grille.position.set(0.5 + side * 1.74, 1.6, -3.7);
    grille.rotation.y = (side * Math.PI) / 2;
    house.add(grille);
  });

  [-0.7, 0.7].forEach((dx) => {
    const stack = buildExhaustStack(reg, mats, 1.7);
    stack.position.set(0.5 + dx, 2.74, -4.6);
    house.add(stack);
    exhaustPorts.push(anchor(stack, 0, 1.85, 0));
  });

  // Modulo de bombas principales sobre el costado de servicio
  const pumps = buildPumpModule(reg, mats, {
    pumps: 3,
    nodeId: 'hydraulic_pump_primary',
    hoseTo: new THREE.Vector3(-1.9, 0.66, 2.8),
  });
  pumps.position.set(1.9, 0.34, -0.6);
  house.add(pumps);

  // Casa de maquinas: cierra el costado izquierdo de la plataforma de servicio
  const houseShell = reg.mesh(roundedBoxGeometry(2.6, 2.5, 5.4, 0.18), mats.liveryPanel);
  houseShell.position.set(-2.3, 1.59, -2.4);
  house.add(houseShell);

  const houseVent = buildGrille(reg, mats, 4.4, 1.2, 8);
  houseVent.position.set(-3.62, 1.8, -2.4);
  houseVent.rotation.y = -Math.PI / 2;
  house.add(houseVent);

  // Estanque hidraulico y estanque de combustible
  const oilTank = reg.mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.2, 24), mats.livery);
  oilTank.position.set(2.0, 1.45, -3.0);
  house.add(oilTank);

  const fuelTank = reg.mesh(roundedBoxGeometry(1.6, 1.5, 2.4, 0.14), mats.liveryPanel);
  fuelTank.position.set(2.1, 1.1, -5.4);
  house.add(fuelTank);

  // Contrapeso trasero
  const counterweight = reg.mesh(roundedBoxGeometry(6.6, 2.0, 1.7, 0.12), mats.structureDark);
  counterweight.position.set(0, 1.3, -6.5);
  house.add(counterweight);

  // Cabina del operador sobre plataforma delantera izquierda
  const cab = buildCab(reg, mats, { w: 2.0, h: 2.4, d: 2.5, nodeId: 'operator_cabin' });
  cab.position.set(-2.35, 0.34, 1.3);
  house.add(cab);

  const cabDeck = reg.mesh(roundedBoxGeometry(2.6, 0.14, 3.4, 0.05), mats.catwalk);
  cabDeck.position.set(-2.35, 0.4, 1.1);
  house.add(cabDeck);

  const stair = buildLadder(reg, mats, 2.6, 0.9);
  stair.position.set(-3.3, -2.3, -3.4);
  house.add(stair);

  // Barandas perimetrales de la plataforma de servicio
  const rail = buildHandrail(reg, mats, [
    new THREE.Vector3(-3.5, 0.34, 2.6),
    new THREE.Vector3(-3.5, 0.34, -7.0),
    new THREE.Vector3(3.5, 0.34, -7.0),
    new THREE.Vector3(3.5, 0.34, 2.6),
  ]);
  house.add(rail);

  /* --- D. Pluma, balancin y cucharon --- */
  const BOOM_LEN = 7.8;
  const STICK_LEN = 5.2;

  const boom = new THREE.Group();
  boom.position.set(0, 0.85, 2.2);
  house.add(boom);

  const boomPinGeo = reg.own(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 20));
  boomPinGeo.rotateZ(Math.PI / 2);
  const boomPin = new THREE.Mesh(boomPinGeo, mats.structureDark);
  boomPin.castShadow = true;
  boom.add(boomPin);

  const boomBeam = reg.mesh(taperedBeamGeometry(BOOM_LEN, 0.52, 0.48, 0.36, 0.36), mats.livery);
  boom.add(boomBeam);

  const stick = new THREE.Group();
  stick.position.set(0, 0, BOOM_LEN);
  boom.add(stick);

  const stickBeam = reg.mesh(taperedBeamGeometry(STICK_LEN, 0.4, 0.4, 0.34, 0.36), mats.livery);
  stick.add(stickBeam);

  const bucketJoint = new THREE.Group();
  bucketJoint.position.set(0, 0, STICK_LEN);
  stick.add(bucketJoint);

  const bucketOrient = new THREE.Group();
  bucketOrient.rotation.y = -Math.PI / 2; // la boca del cucharon mira hacia +Z de la maquina
  bucketJoint.add(bucketOrient);

  const BUCKET_H = 3.1;
  const bucket = buildBucket(reg, mats, {
    width: 4.4,
    depth: 3.6,
    height: BUCKET_H,
    teeth: 6,
    nodeId: 'bucket_assembly',
  });
  bucket.position.set(-0.35, -BUCKET_H, 0);
  bucketOrient.add(bucket);

  /* --- E. Cilindros hidraulicos con cinematica real --- */
  [-1.75, 1.75].forEach((x) => {
    cylinders.push(
      buildHydraulicCylinder(reg, mats, {
        barrelLength: 2.9,
        barrelRadius: 0.3,
        rodRadius: 0.2,
        from: anchor(house, x, 0.65, -0.5),
        to: anchor(boom, x * 0.55, 0.62, BOOM_LEN * 0.52),
      }),
    );
  });

  [-0.7, 0.7].forEach((x) => {
    cylinders.push(
      buildHydraulicCylinder(reg, mats, {
        barrelLength: 2.2,
        barrelRadius: 0.26,
        rodRadius: 0.18,
        from: anchor(boom, x, 0.62, BOOM_LEN * 0.66),
        to: anchor(stick, x, 0.5, STICK_LEN * 0.3),
      }),
    );
  });

  cylinders.push(
    buildHydraulicCylinder(reg, mats, {
      barrelLength: 1.9,
      barrelRadius: 0.26,
      rodRadius: 0.18,
      from: anchor(stick, 0, 0.62, STICK_LEN * 0.22),
      to: anchor(bucketOrient, -0.2, -0.55, 0),
    }),
  );

  cylinders.forEach((c) => {
    house.add(c.group);
    reg.tag(c.group.children[1] as THREE.Mesh, 'boom_cylinders');
    reg.tag(c.group.children[0] as THREE.Mesh, 'boom_cylinders');
  });

  /* --- F. Pose de reposo y ciclo de excavacion --- */
  const BASE = { boom: -0.62, stick: 1.32, bucket: -0.5 };

  const update = (elapsed: number, dig: number) => {
    const p = elapsed * 0.9;
    boom.rotation.x = BASE.boom + Math.sin(p) * 0.2 * dig;
    stick.rotation.x = BASE.stick + Math.sin(p + 1.2) * 0.32 * dig;
    bucketJoint.rotation.x = BASE.bucket + Math.sin(p + 2.3) * 0.45 * dig;
    // Vibracion de bancada perceptible solo cuando la maquina esta operando
    engine.position.y = 1.54 + Math.sin(elapsed * 26) * 0.006 * (0.35 + dig);

    root.updateMatrixWorld(true);
    cylinders.forEach(updateCylinderLink);
  };
  update(0, 0);

  return {
    root,
    cameraTarget: new THREE.Vector3(0, 4.6, 2.5),
    cameraRadius: 30,
    muckPile: { position: new THREE.Vector3(0, 0, 13.5), radius: 6.5 },
    exhaustPorts,
    update,
  };
}

/* ------------------------------------------------------------------ *
 *  Cargador frontal articulado (gabarito clase Cat 994K High Lift)
 * ------------------------------------------------------------------ */

function buildWheelLoader(reg: PartRegistry, mats: MachineMaterials): Omit<MachineBuild, 'registry' | 'materials' | 'setViewMode' | 'dispose'> {
  const root = new THREE.Group();
  const cylinders: CylinderLink[] = [];
  const exhaustPorts: THREE.Object3D[] = [];

  const TIRE_R = 2.05;
  const TIRE_W = 1.5;
  const HALF_TRACK = 2.5;
  const AXLE_Y = TIRE_R;

  /* --- A. Chasis trasero: motor, cabina, contrapeso --- */
  const rear = new THREE.Group();
  root.add(rear);

  [-HALF_TRACK, HALF_TRACK].forEach((x) => {
    const tire = buildMiningTire(reg, mats, { radius: TIRE_R, width: TIRE_W, nodeId: 'undercarriage_tracks' });
    tire.position.set(x, AXLE_Y, -3.2);
    rear.add(tire);
  });

  const rearFrame = reg.mesh(roundedBoxGeometry(2.9, 1.6, 6.2, 0.14), mats.structure);
  rearFrame.position.set(0, 2.1, -3.2);
  rear.add(rearFrame);

  // Eje trasero y transmision powershift
  const axleGeo = reg.own(new THREE.CylinderGeometry(0.5, 0.5, HALF_TRACK * 2 - 0.4, 20));
  axleGeo.rotateZ(Math.PI / 2);
  const rearAxle = new THREE.Mesh(axleGeo, mats.structureDark);
  rearAxle.position.set(0, AXLE_Y, -3.2);
  rearAxle.castShadow = true;
  rear.add(rearAxle);
  reg.tag(rearAxle, 'swing_drive');

  const transfer = reg.mesh(roundedBoxGeometry(1.5, 1.3, 2.0, 0.1), mats.structureDark);
  transfer.position.set(0, 1.65, -1.4);
  rear.add(transfer);
  reg.tag(transfer, 'swing_drive');

  const shaftGeo = reg.own(new THREE.CylinderGeometry(0.19, 0.19, 3.0, 14));
  shaftGeo.rotateX(Math.PI / 2);
  const driveShaft = new THREE.Mesh(shaftGeo, mats.chrome);
  driveShaft.position.set(0, 1.6, 0.4);
  driveShaft.castShadow = true;
  rear.add(driveShaft);
  reg.tag(driveShaft, 'swing_drive');

  // Capot del motor con rejilla de radiador y chimeneas
  const hood = reg.mesh(roundedBoxGeometry(3.1, 2.3, 3.9, 0.18), mats.livery);
  hood.position.set(0, 4.0, -4.2);
  rear.add(hood);
  reg.tag(hood, 'diesel_engine');

  const radiator = buildGrille(reg, mats, 2.8, 1.8, 11);
  radiator.position.set(0, 4.0, -6.18);
  radiator.rotation.y = Math.PI;
  rear.add(radiator);

  [-0.85, 0.85].forEach((dx) => {
    const stack = buildExhaustStack(reg, mats, 1.5);
    stack.position.set(dx, 5.14, -3.4);
    rear.add(stack);
    exhaustPorts.push(anchor(stack, 0, 1.65, 0));
  });

  const counterweight = reg.mesh(roundedBoxGeometry(3.3, 1.8, 1.0, 0.12), mats.structureDark);
  counterweight.position.set(0, 2.9, -6.6);
  rear.add(counterweight);

  // Cabina presurizada sobre el chasis trasero
  const cab = buildCab(reg, mats, { w: 2.2, h: 2.4, d: 2.4, nodeId: 'operator_cabin' });
  cab.position.set(0, 2.9, -1.5);
  rear.add(cab);

  const cabStair = buildLadder(reg, mats, 2.9, 0.8);
  cabStair.position.set(-1.6, 0.0, -1.5);
  rear.add(cabStair);

  // Modulo de bombas de implementos y direccion
  const pumps = buildPumpModule(reg, mats, {
    pumps: 2,
    nodeId: 'hydraulic_pump_primary',
    hoseTo: new THREE.Vector3(-1.47, 1.15, 1.67),
  });
  pumps.position.set(1.15, 2.1, -0.9);
  pumps.scale.setScalar(0.78);
  rear.add(pumps);

  // Guardabarros curvos que envuelven la parte alta de cada neumatico
  const fenderGeo = reg.own(
    arcShellGeometry(TIRE_R + 0.22, 0.14, TIRE_W + 0.44, Math.PI * 0.12, Math.PI * 0.88),
  );
  [-HALF_TRACK, HALF_TRACK].forEach((x) => {
    const fender = new THREE.Mesh(fenderGeo, mats.liveryPanel);
    fender.position.set(x, AXLE_Y, -3.2);
    fender.castShadow = true;
    rear.add(fender);
  });

  /* --- B. Chasis delantero articulado --- */
  const front = new THREE.Group();
  root.add(front);

  [-HALF_TRACK, HALF_TRACK].forEach((x) => {
    const tire = buildMiningTire(reg, mats, { radius: TIRE_R, width: TIRE_W, nodeId: 'undercarriage_tracks' });
    tire.position.set(x, AXLE_Y, 3.2);
    front.add(tire);
  });

  const frontFrame = reg.mesh(roundedBoxGeometry(2.2, 1.5, 4.4, 0.14), mats.structure);
  frontFrame.position.set(0, 2.05, 2.1);
  front.add(frontFrame);

  [-HALF_TRACK, HALF_TRACK].forEach((x) => {
    const fender = new THREE.Mesh(fenderGeo, mats.liveryPanel);
    fender.position.set(x, AXLE_Y, 3.2);
    fender.castShadow = true;
    front.add(fender);
  });

  const frontAxle = new THREE.Mesh(axleGeo, mats.structureDark);
  frontAxle.position.set(0, AXLE_Y, 3.2);
  frontAxle.castShadow = true;
  front.add(frontAxle);
  reg.tag(frontAxle, 'swing_drive');

  // Junta de articulacion central
  const hitchGeo = reg.own(new THREE.CylinderGeometry(0.38, 0.38, 2.2, 18));
  const hitch = new THREE.Mesh(hitchGeo, mats.structureDark);
  hitch.position.set(0, 2.2, 0.1);
  hitch.castShadow = true;
  front.add(hitch);
  reg.tag(hitch, 'swing_drive');

  // Torres de levante: van por fuera del bastidor para que los brazos se lean
  // como piezas independientes y no como una prolongacion del chasis.
  const ARM_X = 1.62;
  const towerGeo = reg.own(roundedBoxGeometry(0.42, 3.0, 1.1, 0.08));
  [-ARM_X, ARM_X].forEach((x) => {
    const tower = new THREE.Mesh(towerGeo, mats.livery);
    tower.position.set(x, 3.1, 0.9);
    tower.castShadow = true;
    front.add(tower);
  });

  // Traviesa que amarra ambas torres por detras
  const towerTie = reg.mesh(roundedBoxGeometry(ARM_X * 2, 0.4, 0.4, 0.06), mats.structure);
  towerTie.position.set(0, 4.4, 0.9);
  front.add(towerTie);

  const pivotGeo = reg.own(new THREE.CylinderGeometry(0.3, 0.3, ARM_X * 2 + 0.5, 18));
  pivotGeo.rotateZ(Math.PI / 2);
  const armPivot = new THREE.Mesh(pivotGeo, mats.structureDark);
  armPivot.position.set(0, 3.95, 0.95);
  armPivot.castShadow = true;
  front.add(armPivot);

  /* --- C. Brazos de levante, biela de volteo y cucharon --- */
  const ARM_LEN = 6.0;
  const boom = new THREE.Group();
  boom.position.set(0, 3.95, 0.95);
  front.add(boom);

  [-ARM_X, ARM_X].forEach((x) => {
    const arm = reg.mesh(taperedBeamGeometry(ARM_LEN, 0.28, 0.46, 0.22, 0.34), mats.livery);
    arm.position.x = x;
    boom.add(arm);
  });

  const crossGeo = reg.own(new THREE.CylinderGeometry(0.26, 0.26, ARM_X * 2, 16));
  crossGeo.rotateZ(Math.PI / 2);
  const crossTube = new THREE.Mesh(crossGeo, mats.structure);
  crossTube.position.set(0, 0, ARM_LEN * 0.35);
  crossTube.castShadow = true;
  boom.add(crossTube);

  // Biela acodada del sistema Z-bar
  const bell = new THREE.Group();
  bell.position.set(0, 0.5, ARM_LEN * 0.42);
  boom.add(bell);

  const bellPlate = reg.mesh(roundedBoxGeometry(0.7, 2.2, 0.34, 0.08), mats.structure);
  bellPlate.position.y = 0.7;
  bell.add(bellPlate);

  const bucketJoint = new THREE.Group();
  bucketJoint.position.set(0, 0, ARM_LEN);
  boom.add(bucketJoint);

  const bucketOrient = new THREE.Group();
  bucketOrient.rotation.y = -Math.PI / 2;
  bucketJoint.add(bucketOrient);

  const BUCKET_H = 2.5;
  const bucket = buildBucket(reg, mats, {
    width: 5.8,
    depth: 3.2,
    height: BUCKET_H,
    teeth: 5,
    nodeId: 'bucket_assembly',
    scooped: true,
    spillGuard: true,
  });
  bucket.position.set(-0.3, -BUCKET_H * 0.72, 0);
  bucketOrient.add(bucket);

  // Cilindros de levante (chasis -> brazo) y de volteo (chasis -> biela)
  [-ARM_X, ARM_X].forEach((x) => {
    cylinders.push(
      buildHydraulicCylinder(reg, mats, {
        barrelLength: 1.9,
        barrelRadius: 0.26,
        rodRadius: 0.18,
        from: anchor(front, x, 1.65, 2.5),
        to: anchor(boom, x, -0.4, ARM_LEN * 0.44),
      }),
    );
  });

  cylinders.push(
    buildHydraulicCylinder(reg, mats, {
      barrelLength: 1.8,
      barrelRadius: 0.24,
      rodRadius: 0.17,
      from: anchor(front, 0, 3.0, 0.35),
      to: anchor(bell, 0, 1.5, 0),
    }),
  );

  // Tirante de la biela al cucharon
  cylinders.push(
    buildHydraulicCylinder(reg, mats, {
      barrelLength: 1.4,
      barrelRadius: 0.19,
      rodRadius: 0.14,
      from: anchor(bell, 0, -0.2, 0),
      to: anchor(bucketOrient, -0.15, 0.55, 0),
    }),
  );

  cylinders.forEach((c) => {
    front.add(c.group);
    reg.tag(c.group.children[1] as THREE.Mesh, 'boom_cylinders');
    reg.tag(c.group.children[0] as THREE.Mesh, 'boom_cylinders');
  });

  /* --- D. Pose de reposo y ciclo de carguio --- */
  // En reposo el cucharon apoya en el piso: el brazo baja (rotacion +X) desde el
  // pivote y el ciclo lo levanta hacia la posicion de descarga.
  const BASE = { boom: 0.36, bell: 0.0, bucket: -0.5 };

  const update = (elapsed: number, dig: number) => {
    const p = elapsed * 0.85;
    boom.rotation.x = BASE.boom - (Math.sin(p) * 0.5 + 0.5) * 0.9 * dig;
    bell.rotation.x = BASE.bell + Math.sin(p + 1.4) * 0.22 * dig;
    bucketJoint.rotation.x = BASE.bucket + Math.sin(p + 2.2) * 0.3 * dig;
    // Balanceo de articulacion: la maquina "cuadra" contra el stockpile
    front.rotation.y = Math.sin(elapsed * 0.55) * 0.045 * dig;
    hood.position.y = 4.0 + Math.sin(elapsed * 24) * 0.007 * (0.35 + dig);

    root.updateMatrixWorld(true);
    cylinders.forEach(updateCylinderLink);
  };
  update(0, 0);

  return {
    root,
    cameraTarget: new THREE.Vector3(0, 3.2, 0.5),
    cameraRadius: 24,
    muckPile: { position: new THREE.Vector3(0, 0, 11.0), radius: 5.5 },
    exhaustPorts,
    update,
  };
}

/* ------------------------------------------------------------------ *
 *  Fabrica publica
 * ------------------------------------------------------------------ */

/**
 * Construye el gemelo geometrico que corresponde al tipo de equipo de la ficha.
 * Las proporciones se aproximan a las de las maquinas comerciales declaradas en
 * el maestro de activos; no reemplazan al CAD del fabricante.
 */
export function buildMachine(kind: EquipmentKind, modelName: string): MachineBuild {
  const materials = createMachineMaterials(detectBrand(modelName));
  const registry = new PartRegistry();

  const core =
    kind === 'WHEEL_LOADER'
      ? buildWheelLoader(registry, materials)
      : buildHydraulicMiningShovel(registry, materials);

  return {
    ...core,
    registry,
    materials,
    setViewMode: (mode: ViewMode) => materials.setViewMode(mode),
    dispose: () => {
      registry.dispose();
      materials.dispose();
    },
  };
}
