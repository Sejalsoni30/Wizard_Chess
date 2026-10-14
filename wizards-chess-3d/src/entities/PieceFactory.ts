import * as THREE from 'three';
import StoneMaterials from './StoneMaterials';

export class PieceFactory {
  /**
   * Constructs a high-fidelity procedural 3D chess piece.
   */
  public static createPieceMesh(
    type: 'p' | 'r' | 'n' | 'b' | 'q' | 'k',
    color: 'w' | 'b'
  ): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = color === 'w' ? StoneMaterials.getMarbleMaterial() : StoneMaterials.getObsidianMaterial();
    const goldMat = StoneMaterials.getGoldMaterial();

    // 1. Base Pedestal
    const baseGroup = this.createBasePedestal(stoneMat);
    group.add(baseGroup);

    // 2. Glowing Arcane Rune Ring (rotates in idle)
    const runeRing = this.createBaseRuneRing(color);
    group.add(runeRing);
    group.userData.runeRing = runeRing;

    // 3. Piece-Specific Procedural Silhouette
    let pieceBody: THREE.Object3D;
    switch (type) {
      case 'p':
        pieceBody = this.createPawnBody(stoneMat);
        break;
      case 'r':
        pieceBody = this.createRookBody(stoneMat, goldMat);
        break;
      case 'n':
        pieceBody = this.createKnightBody(stoneMat, color);
        break;
      case 'b':
        pieceBody = this.createBishopBody(stoneMat, goldMat);
        break;
      case 'q':
        pieceBody = this.createQueenBody(stoneMat, goldMat);
        break;
      case 'k':
        pieceBody = this.createKingBody(stoneMat, goldMat);
        break;
    }

    group.add(pieceBody);

    // Enable shadows across all mesh parts
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    return group;
  }

  private static createBasePedestal(stoneMat: THREE.Material): THREE.Group {
    const base = new THREE.Group();

    // Bottom tier disc
    const disc1Geo = new THREE.CylinderGeometry(0.68, 0.74, 0.16, 24);
    const disc1 = new THREE.Mesh(disc1Geo, stoneMat);
    disc1.position.y = 0.08;
    base.add(disc1);

    // Beveled torus rim
    const torusGeo = new THREE.TorusGeometry(0.62, 0.06, 12, 24);
    const torus = new THREE.Mesh(torusGeo, stoneMat);
    torus.rotation.x = Math.PI / 2;
    torus.position.y = 0.16;
    base.add(torus);

    // Upper stepped disc
    const disc2Geo = new THREE.CylinderGeometry(0.56, 0.62, 0.14, 24);
    const disc2 = new THREE.Mesh(disc2Geo, stoneMat);
    disc2.position.y = 0.23;
    base.add(disc2);

    return base;
  }

  private static createBaseRuneRing(color: 'w' | 'b'): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(1.65, 1.65);
    const mat = StoneMaterials.getRuneRingMaterial(color);
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.015;
    return ring;
  }

  private static createPawnBody(stoneMat: THREE.Material): THREE.Group {
    const pawn = new THREE.Group();

    // Waisted pedestal
    const waistGeo = new THREE.CylinderGeometry(0.32, 0.48, 0.8, 16);
    const waist = new THREE.Mesh(waistGeo, stoneMat);
    waist.position.y = 0.65;
    pawn.add(waist);

    // Collar ring
    const collarGeo = new THREE.TorusGeometry(0.34, 0.05, 8, 16);
    const collar = new THREE.Mesh(collarGeo, stoneMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.05;
    pawn.add(collar);

    // Spherical head
    const headGeo = new THREE.SphereGeometry(0.35, 20, 20);
    const head = new THREE.Mesh(headGeo, stoneMat);
    head.position.y = 1.35;
    pawn.add(head);

    return pawn;
  }

  private static createRookBody(stoneMat: THREE.Material, goldMat: THREE.Material): THREE.Group {
    const rook = new THREE.Group();

    // Fluted tower shaft
    const shaftGeo = new THREE.CylinderGeometry(0.44, 0.52, 1.15, 16);
    const shaft = new THREE.Mesh(shaftGeo, stoneMat);
    shaft.position.y = 0.85;
    rook.add(shaft);

    // Machicolation flare
    const flareGeo = new THREE.CylinderGeometry(0.58, 0.44, 0.35, 16);
    const flare = new THREE.Mesh(flareGeo, stoneMat);
    flare.position.y = 1.55;
    rook.add(flare);

    // Gold trim band
    const trimGeo = new THREE.TorusGeometry(0.53, 0.035, 8, 20);
    const trim = new THREE.Mesh(trimGeo, goldMat);
    trim.rotation.x = Math.PI / 2;
    trim.position.y = 1.4;
    rook.add(trim);

    // 4 Crenellations / Battlements
    const battlementCount = 4;
    for (let i = 0; i < battlementCount; i++) {
      const angle = (i / battlementCount) * Math.PI * 2;
      const bGeo = new THREE.BoxGeometry(0.24, 0.3, 0.16);
      const bMesh = new THREE.Mesh(bGeo, stoneMat);
      bMesh.position.set(Math.cos(angle) * 0.44, 1.82, Math.sin(angle) * 0.44);
      bMesh.rotation.y = -angle;
      rook.add(bMesh);
    }

    return rook;
  }

  private static createKnightBody(stoneMat: THREE.Material, color: 'w' | 'b'): THREE.Group {
    const knight = new THREE.Group();

    // Torso / Neck base
    const neckGeo = new THREE.CylinderGeometry(0.38, 0.5, 0.7, 16);
    const neck = new THREE.Mesh(neckGeo, stoneMat);
    neck.position.set(0, 0.65, -0.05);
    knight.add(neck);

    // Arched Crest
    const crestGeo = new THREE.BoxGeometry(0.36, 0.85, 0.55);
    const crest = new THREE.Mesh(crestGeo, stoneMat);
    crest.position.set(0, 1.25, 0.05);
    crest.rotation.x = 0.35; // Leaning forward
    knight.add(crest);

    // Snout / Muzzle
    const snoutGeo = new THREE.BoxGeometry(0.32, 0.36, 0.5);
    const snout = new THREE.Mesh(snoutGeo, stoneMat);
    snout.position.set(0, 1.35, 0.38);
    snout.rotation.x = 0.1;
    knight.add(snout);

    // Pointed Horse Ears
    const earGeo = new THREE.ConeGeometry(0.08, 0.28, 4);
    const leftEar = new THREE.Mesh(earGeo, stoneMat);
    leftEar.position.set(-0.12, 1.72, -0.05);
    leftEar.rotation.z = -0.15;
    knight.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, stoneMat);
    rightEar.position.set(0.12, 1.72, -0.05);
    rightEar.rotation.z = 0.15;
    knight.add(rightEar);

    // Knight faces forward towards the enemy
    // White faces -Z (toward Rank 8), Black faces +Z (toward Rank 1)
    if (color === 'w') {
      knight.rotation.y = Math.PI;
    }

    return knight;
  }

  private static createBishopBody(stoneMat: THREE.Material, goldMat: THREE.Material): THREE.Group {
    const bishop = new THREE.Group();

    // Slender tapered waist
    const waistGeo = new THREE.CylinderGeometry(0.34, 0.5, 1.25, 16);
    const waist = new THREE.Mesh(waistGeo, stoneMat);
    waist.position.y = 0.9;
    bishop.add(waist);

    // Double Collar rings
    const c1Geo = new THREE.TorusGeometry(0.36, 0.04, 8, 16);
    const c1 = new THREE.Mesh(c1Geo, stoneMat);
    c1.rotation.x = Math.PI / 2;
    c1.position.y = 1.48;
    bishop.add(c1);

    const c2Geo = new THREE.TorusGeometry(0.34, 0.03, 8, 16);
    const c2 = new THREE.Mesh(c2Geo, goldMat);
    c2.rotation.x = Math.PI / 2;
    c2.position.y = 1.58;
    bishop.add(c2);

    // Bishop Mitre (oval droplet)
    const mitreGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const mitre = new THREE.Mesh(mitreGeo, stoneMat);
    mitre.scale.set(0.9, 1.4, 0.9);
    mitre.position.y = 2.05;
    bishop.add(mitre);

    // Diagonal cleft accent
    const slitGeo = new THREE.BoxGeometry(0.08, 0.5, 0.45);
    const slit = new THREE.Mesh(slitGeo, goldMat);
    slit.position.set(0.12, 2.1, 0.12);
    slit.rotation.z = 0.45;
    bishop.add(slit);

    // Top Golden Finial
    const finialGeo = new THREE.SphereGeometry(0.1, 12, 12);
    const finial = new THREE.Mesh(finialGeo, goldMat);
    finial.position.y = 2.65;
    bishop.add(finial);

    return bishop;
  }

  private static createQueenBody(stoneMat: THREE.Material, goldMat: THREE.Material): THREE.Group {
    const queen = new THREE.Group();

    // Elegant flared gown
    const gownGeo = new THREE.CylinderGeometry(0.36, 0.52, 1.5, 20);
    const gown = new THREE.Mesh(gownGeo, stoneMat);
    gown.position.y = 1.05;
    queen.add(gown);

    // Royal waist belt
    const beltGeo = new THREE.TorusGeometry(0.38, 0.04, 8, 20);
    const belt = new THREE.Mesh(beltGeo, goldMat);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 1.78;
    queen.add(belt);

    // Crown base cup
    const cupGeo = new THREE.CylinderGeometry(0.48, 0.32, 0.55, 16);
    const cup = new THREE.Mesh(cupGeo, stoneMat);
    cup.position.y = 2.15;
    queen.add(cup);

    // 8-Pointed Coronet Spikes
    const spikeCount = 8;
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const spikeGeo = new THREE.ConeGeometry(0.07, 0.28, 5);
      const spike = new THREE.Mesh(spikeGeo, goldMat);
      spike.position.set(Math.cos(angle) * 0.46, 2.5, Math.sin(angle) * 0.46);
      queen.add(spike);
    }

    // Queen Crown Orb
    const orbGeo = new THREE.SphereGeometry(0.16, 16, 16);
    const orb = new THREE.Mesh(orbGeo, goldMat);
    orb.position.y = 2.52;
    queen.add(orb);

    return queen;
  }

  private static createKingBody(stoneMat: THREE.Material, goldMat: THREE.Material): THREE.Group {
    const king = new THREE.Group();

    // Imposing stepped torso
    const mantleGeo = new THREE.CylinderGeometry(0.44, 0.56, 1.7, 20);
    const mantle = new THREE.Mesh(mantleGeo, stoneMat);
    mantle.position.y = 1.15;
    king.add(mantle);

    // Regal collar
    const collarGeo = new THREE.TorusGeometry(0.46, 0.06, 8, 20);
    const collar = new THREE.Mesh(collarGeo, goldMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 1.95;
    king.add(collar);

    // Imperial Arch Crown
    const crownGeo = new THREE.CylinderGeometry(0.52, 0.42, 0.65, 16);
    const crown = new THREE.Mesh(crownGeo, stoneMat);
    crown.position.y = 2.35;
    king.add(crown);

    // Imperial Latin Cross in Polished Gold
    const crossGroup = new THREE.Group();
    crossGroup.position.y = 2.85;

    const vBeamGeo = new THREE.BoxGeometry(0.09, 0.45, 0.09);
    const vBeam = new THREE.Mesh(vBeamGeo, goldMat);
    crossGroup.add(vBeam);

    const hBeamGeo = new THREE.BoxGeometry(0.32, 0.09, 0.09);
    const hBeam = new THREE.Mesh(hBeamGeo, goldMat);
    hBeam.position.y = 0.06;
    crossGroup.add(hBeam);

    king.add(crossGroup);

    return king;
  }
}

export default PieceFactory;
