// @ts-nocheck
import * as THREE from 'three';
import { CAMERA_OFFSET, CAMERA_YAW, ROOM, PLAYER, PALETTE } from './constants';
import { screenToWorld, facingFromDirection, dampAngle } from './movement';
import { resolveMovement, isColliding } from './collision';
import { AGENTS, BOSS } from '../data/agents';
import { wibMinutesNow, phaseFromMinutes, skyPaletteFor } from './skyEngine';

/**
 * Modern Architectural Low-Poly 3D Virtual AI Office
 * Features:
 * - Isometric Orthographic Camera with smooth mouse drag-pan & zoom
 * - Screen-relative anti-inverted WASD movement with Obstacle Collision & Wall-sliding
 * - 9 AI Agent Workstations (6 engineering + 3 trading bots) with low-poly avatars, idle typing animation, and floating canvas status badges
 * - Boss character (Raffa) with walking animation, crown/accent, facing direction
 * - War-room holographic table with rotating rings and glowing core
 * - Indoor plants (monstera, snake plant) and architectural studio lights
 * - Focus camera on any agent desk during mission steps
 */
export class OfficeScene {
  constructor(container, onInteractPrompt, onDeskClicked) {
    this.container = container;
    this.onInteractPrompt = onInteractPrompt || (() => {});
    this.onDeskClicked = onDeskClicked || (() => {});

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.lastTime = performance.now();
    this.elapsedTime = 0;
    this.currentSkyPhase = 'auto';

    // Lighting references for dynamic WIB sky engine
    this.ambientLight = null;
    this.keyLight = null;
    this.fillLight = null;
    this.holoLight = null;
    this.violetLight = null;

    // Camera control & Drag-Pan (Centered at 0.5, 0, 3.5 for spacious breathing room)
    this.camTarget = new THREE.Vector3(0.5, 0, 3.5);
    this.camCurrentLook = new THREE.Vector3(0.5, 0, 3.5);
    this.userPanOffset = new THREE.Vector3(0, 0, 0);
    this.zoomLevel = 1.0;
    this.targetZoom = 1.0;
    this.focusingOnAgent = null;

    // Mouse drag for camera panning (WASD only for player move)
    this.isDraggingCamera = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragStartPan = new THREE.Vector3(0, 0, 0);
    this.totalDragDist = 0;

    // Boss Player
    this.player = null;
    this.playerPos = new THREE.Vector3(BOSS.spawn.x, 0, BOSS.spawn.z);
    this.playerFacing = 0;
    this.targetFacing = 0;
    this.isMoving = false;
    this.walkCycle = 0;
    this.playerParts = {};

    // Khansa Companion (Permaisuri & Corporate Secretary)
    this.khansa = null;
    this.khansaPos = new THREE.Vector3(BOSS.spawn.x + 2.2, 0, BOSS.spawn.z + 1.1);
    this.bossTagSprite = null;
    this.khansaTagSprite = null;
    this.khansaFacing = 0;
    this.khansaTargetFacing = 0;
    this.khansaIsMoving = false;
    this.khansaWalkCycle = 0;
    this.khansaParts = {};
    this.khansaStatus = 'Mendampingi Bos';

    // Destination ring indicator
    this.destRing = null;

    // AI Agents
    this.agentMeshes = new Map(); // id -> { group, avatar, arms, badgeSprite, canvas, ctx, texture, deskPos }

    // Hologram table
    this.holoElements = [];

    // Interaction raycasting
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactiveMeshes = []; // for desk clicks
    this.floorPlane = null;

    // Animation frame
    this.animId = null;
    this.disposed = false;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;

    // 1. Scene & Dynamic WIB Sky
    const wibMins = wibMinutesNow();
    const phase = phaseFromMinutes(wibMins);
    const palette = skyPaletteFor(phase);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(palette.background);
    this.scene.fog = new THREE.FogExp2(palette.background, palette.fogDensity || 0.015);

    // 2. Isometric Orthographic Camera (d = 12.2 gives balanced breathing room)
    const d = 12.2;
    this.camera = new THREE.OrthographicCamera(
      -d * aspect,
      d * aspect,
      d,
      -d,
      0.1,
      300
    );
    this.camera.position.set(CAMERA_OFFSET.x + 0.5, CAMERA_OFFSET.y, CAMERA_OFFSET.z + 3.5);
    this.camera.lookAt(0.5, 0, 3.5);

    // 3. Renderer (Opaque, crisp, high-performance)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting - Architectural Warm Studio
    this.setupLighting();

    // 5. Environment & Floor
    this.setupArchitecture();

    // 5b. Pantry Break Area
    this.setupPantry();

    // 6. Workstations & AI Agents
    this.setupWorkstations();

    // 7. War-Room Holographic Table
    this.setupHolotable();

    // 8. Player: Raffa (The Boss)
    this.setupPlayer();

    // 8b. Companion: Khansa (Permaisuri & Corporate Secretary)
    this.setupKhansaCompanion();

    // 9. Destination Click Ring
    this.setupDestRing();

    // 10. Plants & Props
    this.setupProps();

    // 11. Event Listeners
    this.setupEvents();

    // 12. Start Loop
    this.animate = this.animate.bind(this);
    this.animId = requestAnimationFrame(this.animate);
  }

  setupLighting() {
    // Initial dynamic sky phase
    const wibMins = wibMinutesNow();
    const phase = phaseFromMinutes(wibMins);
    const palette = skyPaletteFor(phase);

    // Soft ambient
    this.ambientLight = new THREE.AmbientLight(palette.ambientColor, palette.ambientIntensity);
    this.scene.add(this.ambientLight);

    // Main Studio Key Light (directional)
    this.keyLight = new THREE.DirectionalLight(palette.keyColor, palette.keyIntensity);
    this.keyLight.position.set(...palette.keyPosition);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 70;
    const shadowD = 22;
    this.keyLight.shadow.camera.left = -shadowD;
    this.keyLight.shadow.camera.right = shadowD;
    this.keyLight.shadow.camera.top = shadowD;
    this.keyLight.shadow.camera.bottom = -shadowD;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    // Warm Fill Light (opposite side)
    this.fillLight = new THREE.DirectionalLight('#93c5fd', 0.6);
    this.fillLight.position.set(-18, 14, -14);
    this.scene.add(this.fillLight);

    // Holotable teal/emerald accent light
    this.holoLight = new THREE.PointLight('#10b981', 2.0, 10);
    this.holoLight.position.set(8.5, 2.5, 0);
    this.scene.add(this.holoLight);

    // Violet accent wash for Executive Suite
    this.violetLight = new THREE.PointLight('#8b5cf6', 1.5, 12);
    this.violetLight.position.set(-11.0, 3, -6.5);
    this.scene.add(this.violetLight);

    // Warm amber pendant light for Pantry Break Area
    const pantryLight = new THREE.PointLight('#f97316', 1.4, 9);
    pantryLight.position.set(8.5, 2.5, 8.5);
    this.scene.add(pantryLight);

    // Skyline Suite neon violet wash
    const skylineLight = new THREE.PointLight('#a855f7', 1.8, 12);
    skylineLight.position.set(13.8, 2.8, 0);
    this.scene.add(skylineLight);
  }

  setSkyPhase(phase) {
    this.currentSkyPhase = phase;
    const effectivePhase = phase === 'auto' ? phaseFromMinutes(wibMinutesNow()) : phase;
    const palette = skyPaletteFor(effectivePhase);

    if (this.scene) {
      this.scene.background = new THREE.Color(palette.background);
      this.scene.fog = new THREE.FogExp2(palette.background, palette.fogDensity || 0.015);
    }
    if (this.keyLight) {
      this.keyLight.color.set(palette.keyColor);
      this.keyLight.intensity = palette.keyIntensity;
      this.keyLight.position.set(...palette.keyPosition);
    }
    if (this.ambientLight) {
      this.ambientLight.color.set(palette.ambientColor);
      this.ambientLight.intensity = palette.ambientIntensity;
    }
    if (this.fillLight) {
      const fillColors = { morning: '#ffd7aa', day: '#93c5fd', sunset: '#c084fc', night: '#1e1b4b' };
      this.fillLight.color.set(fillColors[effectivePhase] || '#93c5fd');
      this.fillLight.intensity = effectivePhase === 'night' ? 0.35 : 0.6;
    }
  }

  setupArchitecture() {
    // 1. Expansive Studio Horizon Floor (fills the entire screen seamlessly)
    const outerFloorGeo = new THREE.PlaneGeometry(240, 240);
    const outerFloorMat = new THREE.MeshStandardMaterial({
      color: '#121216',
      roughness: 0.9,
      metalness: 0.05,
    });
    const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.y = -0.35;
    outerFloor.receiveShadow = true;
    this.scene.add(outerFloor);

    // Subtle outer architectural grid
    const outerGrid = new THREE.GridHelper(240, 60, '#26262e', '#18181f');
    outerGrid.position.y = -0.34;
    this.scene.add(outerGrid);

    // Floor Base Slab (supporting full penthouse interior + rooftop terrace)
    const slabW = ROOM.maxX * 2 + 1.2;
    const slabD = (ROOM.maxZ - ROOM.minZ) + 1.2;
    const slabCenterZ = (ROOM.minZ + ROOM.maxZ) / 2;
    const slabGeo = new THREE.BoxGeometry(slabW, 0.58, slabD);
    const slabMat = new THREE.MeshStandardMaterial({ color: PALETTE.slab, roughness: 0.9 });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(0, -0.31, slabCenterZ);
    slab.receiveShadow = true;
    this.scene.add(slab);

    // Full Walkable Raycast Floor Plane (enables click-to-move across interior and terrace)
    const clickFloorGeo = new THREE.PlaneGeometry(ROOM.maxX * 2, ROOM.maxZ - ROOM.minZ);
    const clickFloorMat = new THREE.MeshBasicMaterial({ visible: false });
    const clickFloor = new THREE.Mesh(clickFloorGeo, clickFloorMat);
    clickFloor.rotation.x = -Math.PI / 2;
    clickFloor.position.set(0, 0.005, slabCenterZ);
    this.scene.add(clickFloor);
    this.floorPlane = clickFloor;

    // 2. Interior Penthouse Floor (Graphite Slate / Smoked Oak from z = -12 to 12)
    const interiorD = 12 - ROOM.minZ; // 24m
    const interiorFloorGeo = new THREE.PlaneGeometry(ROOM.maxX * 2, interiorD);
    const interiorFloorMat = new THREE.MeshStandardMaterial({
      color: PALETTE.floor,
      roughness: 0.45,
      metalness: 0.15,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const interiorFloor = new THREE.Mesh(interiorFloorGeo, interiorFloorMat);
    interiorFloor.rotation.x = -Math.PI / 2;
    interiorFloor.position.set(0, 0.006, (ROOM.minZ + 12) / 2);
    interiorFloor.receiveShadow = true;
    this.scene.add(interiorFloor);

    // Architectural tile grid inside interior penthouse
    const gridHelper = new THREE.GridHelper(ROOM.maxX * 2, 28, '#2d3345', '#1c202d');
    gridHelper.position.set(0, 0.012, (ROOM.minZ + 12) / 2);
    if (gridHelper.material) {
      gridHelper.material.polygonOffset = true;
      gridHelper.material.polygonOffsetFactor = -2;
      gridHelper.material.polygonOffsetUnits = -2;
    }
    this.scene.add(gridHelper);

    const mullionMat = new THREE.MeshStandardMaterial({ color: '#18181f', roughness: 0.5, metalness: 0.6 });

    // Executive Suite Luxury Rug (for Bos Raffa & Khansaku's royal command suite)
    const rugGeo = new THREE.PlaneGeometry(8.4, 7.5);
    const rugMat = new THREE.MeshStandardMaterial({
      color: '#06281e',
      roughness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const rug = new THREE.Mesh(rugGeo, rugMat);
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-11.0, 0.018, -6.5);
    this.scene.add(rug);

    // Rug Gold Trim Border
    const rugBorder = new THREE.LineSegments(
      new THREE.EdgesGeometry(rugGeo),
      new THREE.LineBasicMaterial({ color: '#f59e0b', linewidth: 2 })
    );
    rugBorder.rotation.x = -Math.PI / 2;
    rugBorder.position.set(-11.0, 0.019, -6.5);
    this.scene.add(rugBorder);

    // Luxury Executive Desk for Bos Raffa (Walnut & Italian Black-Gold Marble)
    const textureLoader = new THREE.TextureLoader();
    const execDeskTex = textureLoader.load('/textures/props/boss_executive_desk.jpg');
    execDeskTex.colorSpace = THREE.SRGBColorSpace;

    const execDeskGroup = new THREE.Group();
    execDeskGroup.position.set(-11.0, 0, -6.8);

    // Marble desk surface with realistic texture
    const execTopMat = new THREE.MeshStandardMaterial({
      map: execDeskTex,
      roughness: 0.25,
      metalness: 0.2,
    });
    const execDeskMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.95, 1.8), execTopMat);
    execDeskMesh.position.y = 0.475;
    execDeskMesh.castShadow = true;
    execDeskMesh.receiveShadow = true;
    execDeskGroup.add(execDeskMesh);

    // Gold brass executive base trim
    const goldTrimMat = new THREE.MeshStandardMaterial({ color: '#f59e0b', metalness: 0.85, roughness: 0.2 });
    const goldTrim = new THREE.Mesh(new THREE.BoxGeometry(3.65, 0.05, 1.85), goldTrimMat);
    goldTrim.position.y = 0.025;
    execDeskGroup.add(goldTrim);

    // Curved ultra-wide financial command display on desk
    const curvedScreenGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.65, 32, 1, true, -Math.PI / 6, Math.PI / 3);
    const curvedScreenMat = new THREE.MeshBasicMaterial({ color: '#10b981', side: THREE.DoubleSide });
    const curvedScreen = new THREE.Mesh(curvedScreenGeo, curvedScreenMat);
    curvedScreen.position.set(0, 1.35, -0.2);
    curvedScreen.rotation.y = Math.PI;
    execDeskGroup.add(curvedScreen);

    // Photorealistic 2.5D Billboard Sprite for Boss Executive Desk Suite
    const execBillboardTex = textureLoader.load('/textures/props/boss_executive_desk.jpg');
    execBillboardTex.colorSpace = THREE.SRGBColorSpace;
    const execBillboardMat = new THREE.SpriteMaterial({
      map: execBillboardTex,
      transparent: true,
      opacity: 0.96,
    });
    const execBillboardSprite = new THREE.Sprite(execBillboardMat);
    execBillboardSprite.scale.set(3.4, 2.2, 1);
    execBillboardSprite.position.set(0, 1.35, 0.0);
    execDeskGroup.add(execBillboardSprite);

    this.scene.add(execDeskGroup);

    // Executive Suite Acoustic Glass Divider along x = -6.0 (z: -12 to -4.5)
    const execGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#0f291e',
      transparent: true,
      opacity: 0.28,
      roughness: 0.15,
      transmission: 0.7,
    });
    const execDivider = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 7.5), execGlassMat);
    execDivider.position.set(-6.0, 1.8, -8.25);
    this.scene.add(execDivider);

    const execFrame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 7.5), mullionMat);
    execFrame.position.set(-6.0, 3.6, -8.25);
    this.scene.add(execFrame);

    const execCol = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.8, 0.16), mullionMat);
    execCol.position.set(-6.0, 1.9, -4.5);
    this.scene.add(execCol);

    // War-Room Holographic Circle Inlay (under Holotable at x: 8.5, z: 0)
    const holoDiscGeo = new THREE.CircleGeometry(2.5, 36);
    const holoDiscMat = new THREE.MeshStandardMaterial({
      color: '#0b1322',
      roughness: 0.2,
      metalness: 0.8,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    const holoDisc = new THREE.Mesh(holoDiscGeo, holoDiscMat);
    holoDisc.rotation.x = -Math.PI / 2;
    holoDisc.position.set(8.5, 0.018, 0);
    this.scene.add(holoDisc);

    // The Skyline Glass Room Acoustic Enclosure (PRD §1.2 & §3.1 along x = 11.5)
    const skylineGlassMat = new THREE.MeshPhysicalMaterial({
      color: '#1e1b4b',
      transparent: true,
      opacity: 0.25,
      roughness: 0.06,
      transmission: 0.8,
      metalness: 0.1,
    });
    // North partition (z: -12 to -1.5)
    const skylineGlassN = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 10.5), skylineGlassMat);
    skylineGlassN.position.set(11.5, 1.8, -6.75);
    this.scene.add(skylineGlassN);

    // South partition (z: 1.5 to 11.8)
    const skylineGlassS = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 10.3), skylineGlassMat);
    skylineGlassS.position.set(11.5, 1.8, 6.65);
    this.scene.add(skylineGlassS);

    // Skyline Doorway Columns at z = -1.5 and z = 1.5 (Doorway 3m wide!)
    [-1.5, 1.5].forEach((cz) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3.8, 0.16), mullionMat);
      col.position.set(11.5, 1.9, cz);
      this.scene.add(col);
    });

    // Overhead Header Beam along x = 11.5
    const skylineHeader = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 23.8), mullionMat);
    skylineHeader.position.set(11.5, 3.6, -0.1);
    this.scene.add(skylineHeader);

    // Violet Neon Floor Threshold Strip across doorway
    const skylineThreshold = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3.0), new THREE.MeshBasicMaterial({ color: '#8b5cf6' }));
    skylineThreshold.rotation.x = -Math.PI / 2;
    skylineThreshold.position.set(11.5, 0.02, 0);
    this.scene.add(skylineThreshold);

    // Pantry Herringbone Floor Tile Accent (x: 6.0 to 11.2, z: 5.5 to 11.5)
    const pantryTileGeo = new THREE.PlaneGeometry(5.2, 5.8);
    const pantryTileMat = new THREE.MeshStandardMaterial({
      color: '#141824',
      roughness: 0.7,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const pantryTile = new THREE.Mesh(pantryTileGeo, pantryTileMat);
    pantryTile.rotation.x = -Math.PI / 2;
    pantryTile.position.set(8.5, 0.016, 8.5);
    this.scene.add(pantryTile);

    // 3. Penthouse Rooftop Sky Terrace (Teak Deck from z = 12 to 28)
    const terraceD = ROOM.maxZ - 12; // 16m
    const terraceCenterZ = (12 + ROOM.maxZ) / 2;
    const terraceGeo = new THREE.PlaneGeometry(ROOM.maxX * 2, terraceD);
    const terraceMat = new THREE.MeshStandardMaterial({
      color: PALETTE.floorTerrace,
      roughness: 0.65,
      metalness: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const terrace = new THREE.Mesh(terraceGeo, terraceMat);
    terrace.rotation.x = -Math.PI / 2;
    terrace.position.set(0, 0.007, terraceCenterZ);
    terrace.receiveShadow = true;
    this.scene.add(terrace);

    // Teak wood plank divider lines on terrace
    const deckGrid = new THREE.GridHelper(ROOM.maxX * 2, 32, '#502c14', '#784322');
    deckGrid.position.set(0, 0.014, terraceCenterZ);
    if (deckGrid.material) {
      deckGrid.material.polygonOffset = true;
      deckGrid.material.polygonOffsetFactor = -2;
      deckGrid.material.polygonOffsetUnits = -2;
    }
    this.scene.add(deckGrid);

    // Terrace Slate Perimeter Borders
    const borderMat = new THREE.MeshStandardMaterial({ color: '#181920', roughness: 0.8 });
    const borderS = new THREE.Mesh(new THREE.BoxGeometry(ROOM.maxX * 2, 0.1, 0.5), borderMat);
    borderS.position.set(0, 0.05, ROOM.maxZ - 0.25);
    this.scene.add(borderS);

    // 4. Acoustic Glass Sliding Partition (between Interior & Terrace at z = 12)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: '#a5f3fc',
      transparent: true,
      opacity: 0.22,
      roughness: 0.08,
      transmission: 0.75,
      metalness: 0.1,
    });

    // West Glass Partition (x: -16 to -3.2)
    const glassW = new THREE.Mesh(new THREE.BoxGeometry(12.8, 3.6, 0.08), glassMat);
    glassW.position.set(-9.6, 1.8, 12);
    this.scene.add(glassW);
    const frameW = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.12, 0.14), mullionMat);
    frameW.position.set(-9.6, 3.6, 12);
    this.scene.add(frameW);

    // East Glass Partition (x: 3.2 to 16)
    const glassE = new THREE.Mesh(new THREE.BoxGeometry(12.8, 3.6, 0.08), glassMat);
    glassE.position.set(9.6, 1.8, 12);
    this.scene.add(glassE);
    const frameE = new THREE.Mesh(new THREE.BoxGeometry(12.8, 0.12, 0.14), mullionMat);
    frameE.position.set(9.6, 3.6, 12);
    this.scene.add(frameE);

    // Central Sliding Door Frame Columns
    [-3.2, 3.2].forEach((colX) => {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.8, 0.18), mullionMat);
      col.position.set(colX, 1.9, 12);
      this.scene.add(col);
    });

    // Glowing Terrace Entryway Threshold Strip (emerald accent)
    const thresholdGeo = new THREE.PlaneGeometry(ROOM.maxX * 2, 0.2);
    const thresholdMat = new THREE.MeshBasicMaterial({ color: '#10b981' });
    const threshold = new THREE.Mesh(thresholdGeo, thresholdMat);
    threshold.rotation.x = -Math.PI / 2;
    threshold.position.set(0, 0.02, 12);
    this.scene.add(threshold);

    // 5. Frameless Tempered Glass Balustrade (Perimeter of Rooftop Terrace)
    const balustradeMat = new THREE.MeshPhysicalMaterial({
      color: '#c7e5ff',
      transparent: true,
      opacity: 0.28,
      roughness: 0.04,
      transmission: 0.85,
    });
    const railMat = new THREE.MeshStandardMaterial({ color: '#71717a', metalness: 0.9, roughness: 0.2 });

    // South Balustrade (Z = 28)
    const balustradeS = new THREE.Mesh(new THREE.BoxGeometry(ROOM.maxX * 2, 1.25, 0.06), balustradeMat);
    balustradeS.position.set(0, 0.625, ROOM.maxZ);
    this.scene.add(balustradeS);
    const railS = new THREE.Mesh(new THREE.BoxGeometry(ROOM.maxX * 2, 0.06, 0.1), railMat);
    railS.position.set(0, 1.25, ROOM.maxZ);
    this.scene.add(railS);

    // West Balustrade (X = minX on terrace, z = 12 to 28)
    const balustradeW = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.25, terraceD), balustradeMat);
    balustradeW.position.set(ROOM.minX, 0.625, terraceCenterZ);
    this.scene.add(balustradeW);
    const railW = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, terraceD), railMat);
    railW.position.set(ROOM.minX, 1.25, terraceCenterZ);
    this.scene.add(railW);

    // East Balustrade (X = maxX on terrace, z = 12 to 28)
    const balustradeE = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.25, terraceD), balustradeMat);
    balustradeE.position.set(ROOM.maxX, 0.625, terraceCenterZ);
    this.scene.add(balustradeE);
    const railE = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, terraceD), railMat);
    railE.position.set(ROOM.maxX, 1.25, terraceCenterZ);
    this.scene.add(railE);

    // Balustrade support posts every 4 meters
    for (let x = -14; x <= 14; x += 4) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.25), railMat);
      post.position.set(x, 0.625, ROOM.maxZ);
      this.scene.add(post);
    }

    // 6. North Wall (Panorama Floor-to-Ceiling Windows with Skyline View)
    const panoMat = new THREE.MeshPhysicalMaterial({
      color: '#08101e',
      transparent: true,
      opacity: 0.18,
      roughness: 0.05,
      transmission: 0.8,
    });
    const panoMesh = new THREE.Mesh(new THREE.BoxGeometry(ROOM.maxX * 2, ROOM.wallH, 0.08), panoMat);
    panoMesh.position.set(0, ROOM.wallH / 2, ROOM.minZ);
    this.scene.add(panoMesh);

    // Vertical Window Mullions
    for (let x = -16; x <= 16; x += 4) {
      const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.18, ROOM.wallH, 0.22), mullionMat);
      mullion.position.set(x, ROOM.wallH / 2, ROOM.minZ);
      this.scene.add(mullion);
    }

    // West Architectural Wall (X = minX inside interior)
    const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.4, ROOM.wallH, interiorD), new THREE.MeshStandardMaterial({ color: PALETTE.wall, roughness: 0.85 }));
    wallW.position.set(ROOM.minX, ROOM.wallH / 2, (ROOM.minZ + 12) / 2);
    wallW.receiveShadow = true;
    this.scene.add(wallW);

    // Build the 3D Metropolitan City Skyline outside the windows
    this.setupCitySkyline();

    // Penthouse Neon Architectural Branding
    this.setupWallBranding();
  }

  setupCitySkyline() {
    const skylineGroup = new THREE.Group();
    const colors = ['#f59e0b', '#38bdf8', '#8b5cf6', '#10b981', '#f43f5e'];

    // Deterministic skyscraper generation
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    // Skyscraper cluster outside North Panorama Windows (z < -14)
    for (let i = 0; i < 32; i++) {
      const w = 4 + rnd() * 8;
      const d = 4 + rnd() * 8;
      const h = 14 + rnd() * 38;
      const x = -55 + rnd() * 110;
      const z = -20 - rnd() * 55;

      const bGeo = new THREE.BoxGeometry(w, h, d);
      const bMat = new THREE.MeshStandardMaterial({
        color: '#0a0d14',
        roughness: 0.8,
        metalness: 0.2,
      });
      const tower = new THREE.Mesh(bGeo, bMat);
      tower.position.set(x, h / 2 - 0.4, z);
      skylineGroup.add(tower);

      // Lit office window bands
      const windowRows = Math.floor(h / 3);
      for (let r = 0; r < windowRows; r++) {
        if (rnd() > 0.4) {
          const winGeo = new THREE.PlaneGeometry(w * 0.8, 0.45);
          const winColor = colors[(i + r) % colors.length];
          const winMat = new THREE.MeshBasicMaterial({
            color: winColor,
            transparent: true,
            opacity: 0.45,
          });
          const winStrip = new THREE.Mesh(winGeo, winMat);
          winStrip.position.set(x, 2 + r * 2.8, z + d / 2 + 0.05);
          skylineGroup.add(winStrip);
        }
      }

      // Antenna beacon on tall buildings
      if (h > 35) {
        const spire = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.15, 6),
          new THREE.MeshStandardMaterial({ color: '#71717a' })
        );
        spire.position.set(x, h + 3, z);
        skylineGroup.add(spire);

        const beacon = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: '#ef4444' })
        );
        beacon.position.set(x, h + 6, z);
        skylineGroup.add(beacon);
      }
    }

    this.scene.add(skylineGroup);
  }

  setupWallBranding() {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f1118';
    ctx.fillRect(0, 0, 1200, 256);

    // Glowing border outline
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 1188, 244);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px "Inter", sans-serif';
    ctx.fillText('KANTOR RAFFA · PENTHOUSE SUITE', 50, 95);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 24px "JetBrains Mono", monospace';
    ctx.fillText('AUTONOMOUS AI MISSION CONTROL & ROOFTOP TERRACE · 9 AGENTS', 50, 155);

    // Gradient accent neon bar
    const grad = ctx.createLinearGradient(50, 185, 750, 185);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, '#38bdf8');
    grad.addColorStop(1, '#8b5cf6');
    ctx.fillStyle = grad;
    ctx.fillRect(50, 180, 680, 8);

    const tex = new THREE.CanvasTexture(canvas);
    const signMat = new THREE.MeshBasicMaterial({ map: tex });
    const signGeo = new THREE.PlaneGeometry(10.5, 2.2);
    const signMesh = new THREE.Mesh(signGeo, signMat);
    signMesh.position.set(-5.5, 3.1, ROOM.minZ + 0.22);
    this.scene.add(signMesh);
  }

  setupPantry() {
    const pantryGroup = new THREE.Group();
    pantryGroup.position.set(8.5, 0, 8.5);

    // 1. Kitchen Island Bar Counter (W = 3.4, D = 1.0, H = 1.05)
    const pantryTex = new THREE.TextureLoader().load('/textures/props/pantry_espresso_bar.jpg');
    pantryTex.colorSpace = THREE.SRGBColorSpace;

    const marbleMat = new THREE.MeshStandardMaterial({
      map: pantryTex,
      roughness: 0.25,
      metalness: 0.2,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: '#1a1816',
      roughness: 0.7,
    });

    // Base cabinet
    const cabinet = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.95, 0.95), woodMat);
    cabinet.position.y = 0.475;
    cabinet.castShadow = true;
    cabinet.receiveShadow = true;
    pantryGroup.add(cabinet);

    // Marble countertop with slight overhang
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.1, 1.1), marbleMat);
    top.position.y = 1.0;
    top.castShadow = true;
    pantryGroup.add(top);

    // Neon amber LED undercounter strip
    const ledMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });
    const underLed = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.02, 0.04), ledMat);
    underLed.position.set(0, 0.94, 0.52);
    pantryGroup.add(underLed);

    // 2. Commercial Dual-Group Espresso Machine
    const steelMat = new THREE.MeshStandardMaterial({ color: '#d4d4d8', metalness: 0.85, roughness: 0.2 });
    const machineBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.55), steelMat);
    machineBody.position.set(-0.9, 1.32, 0.0);
    pantryGroup.add(machineBody);

    // Drip Tray
    const dripTray = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.05, 0.2), steelMat);
    dripTray.position.set(-0.9, 1.07, 0.22);
    pantryGroup.add(dripTray);

    // Espresso Machine Indicator Light
    const indLight = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), new THREE.MeshBasicMaterial({ color: '#10b981' }));
    indLight.position.set(-0.6, 1.5, 0.28);
    pantryGroup.add(indLight);

    // 3. Water Cooler & Dispenser Tower
    const dispenserBody = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.3, 0.42), new THREE.MeshStandardMaterial({ color: '#f4f4f5', roughness: 0.4 }));
    dispenserBody.position.set(1.2, 0.65, 0.0);
    pantryGroup.add(dispenserBody);
    const waterJugMat = new THREE.MeshPhysicalMaterial({ color: '#38bdf8', transmission: 0.85, transparent: true, opacity: 0.6 });
    const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.45, 16), waterJugMat);
    jug.position.set(1.2, 1.48, 0.0);
    pantryGroup.add(jug);

    // 4. Ceramic Coffee Mugs & Tumblers
    const mColors = ['#f43f5e', '#38bdf8', '#10b981'];
    [-0.2, 0.1, 0.4].forEach((mx, idx) => {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.14, 12), new THREE.MeshStandardMaterial({ color: mColors[idx], roughness: 0.3 }));
      mug.position.set(mx, 1.12, 0.1);
      pantryGroup.add(mug);
    });

    // 5. Modern Barstools tucked along the south side of counter
    const stoolSeatMat = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.5 });
    const stoolLegMat = new THREE.MeshStandardMaterial({ color: '#18181b', metalness: 0.8 });
    [-0.8, 0.3].forEach((sx) => {
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 16), stoolSeatMat);
      seat.position.set(sx, 0.72, -0.65);
      pantryGroup.add(seat);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 12), stoolLegMat);
      post.position.set(sx, 0.35, -0.65);
      pantryGroup.add(post);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), stoolLegMat);
      base.position.set(sx, 0.02, -0.65);
      pantryGroup.add(base);
    });

    // Photorealistic 2.5D Billboard Sprite for Luxury Espresso Bar
    const pantryBillboardTex = new THREE.TextureLoader().load('/textures/props/pantry_espresso_bar.jpg');
    pantryBillboardTex.colorSpace = THREE.SRGBColorSpace;
    const pantryBillboardMat = new THREE.SpriteMaterial({
      map: pantryBillboardTex,
      transparent: true,
      opacity: 0.95,
    });
    const pantryBillboardSprite = new THREE.Sprite(pantryBillboardMat);
    pantryBillboardSprite.scale.set(3.2, 2.0, 1);
    pantryBillboardSprite.position.set(0, 1.85, 0.45);
    pantryGroup.add(pantryBillboardSprite);

    this.scene.add(pantryGroup);
  }

  setupWorkstations() {
    AGENTS.forEach((agent) => {
      const group = new THREE.Group();
      group.position.set(agent.desk.x, 0, agent.desk.z);
      group.rotation.y = agent.desk.rot;

      // Desk geometry
      const deskW = 2.4;
      const deskD = 1.3;
      const deskH = 0.9;
      const topThick = 0.08;

      // Tabletop (clean matte finish)
      const topGeo = new THREE.BoxGeometry(deskW, topThick, deskD);
      const topMat = new THREE.MeshStandardMaterial({ color: PALETTE.desk, roughness: 0.4, metalness: 0.05 });
      const top = new THREE.Mesh(topGeo, topMat);
      top.position.y = deskH - topThick / 2;
      top.castShadow = true;
      top.receiveShadow = true;
      group.add(top);

      // Desk legs (matte dark metal)
      const legGeo = new THREE.BoxGeometry(0.08, deskH - topThick, 0.08);
      const legMat = new THREE.MeshStandardMaterial({ color: PALETTE.deskLeg, roughness: 0.6, metalness: 0.8 });
      const legOffsets = [
        [-deskW / 2 + 0.12, (deskH - topThick) / 2, -deskD / 2 + 0.12],
        [deskW / 2 - 0.12, (deskH - topThick) / 2, -deskD / 2 + 0.12],
        [-deskW / 2 + 0.12, (deskH - topThick) / 2, deskD / 2 - 0.12],
        [deskW / 2 - 0.12, (deskH - topThick) / 2, deskD / 2 - 0.12],
      ];
      legOffsets.forEach(([lx, ly, lz]) => {
        const leg = new THREE.Mesh(legGeo, legMat);
        leg.position.set(lx, ly, lz);
        leg.castShadow = true;
        group.add(leg);
      });

      // Desk Mat / Mousepad
      const padGeo = new THREE.BoxGeometry(1.4, 0.01, 0.7);
      const padMat = new THREE.MeshStandardMaterial({ color: '#27272a', roughness: 0.9 });
      const pad = new THREE.Mesh(padGeo, padMat);
      pad.position.set(0, deskH + 0.005, 0.05);
      group.add(pad);

      // Keyboard
      const kbGeo = new THREE.BoxGeometry(0.55, 0.02, 0.2);
      const kbMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.5 });
      const kb = new THREE.Mesh(kbGeo, kbMat);
      kb.position.set(-0.05, deskH + 0.015, 0.12);
      group.add(kb);

      // Mouse
      const mouseGeo = new THREE.BoxGeometry(0.07, 0.02, 0.1);
      const mouseMat = new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.4 });
      const mouse = new THREE.Mesh(mouseGeo, mouseMat);
      mouse.position.set(0.35, deskH + 0.015, 0.12);
      group.add(mouse);

      // Dual Monitors
      const monW = 0.95;
      const monH = 0.58;
      const monD = 0.04;
      const monStandGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.35);
      const monStandMat = new THREE.MeshStandardMaterial({ color: '#27272a', metalness: 0.8 });

      // Left Monitor
      const leftMonGroup = new THREE.Group();
      leftMonGroup.position.set(-0.52, deskH + 0.45, -0.22);
      leftMonGroup.rotation.y = 0.15; // slightly angled toward worker

      const bezelMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.5 });
      const leftMonBezel = new THREE.Mesh(new THREE.BoxGeometry(monW, monH, monD), bezelMat);
      leftMonGroup.add(leftMonBezel);

      // Glowing screen with agent role color accent
      const screenMat1 = new THREE.MeshStandardMaterial({
        color: '#09090b',
        emissive: agent.color,
        emissiveIntensity: 0.4,
        roughness: 0.2,
      });
      const leftMonScreen = new THREE.Mesh(new THREE.PlaneGeometry(monW - 0.05, monH - 0.05), screenMat1);
      leftMonScreen.position.z = monD / 2 + 0.002;
      leftMonGroup.add(leftMonScreen);

      const standL = new THREE.Mesh(monStandGeo, monStandMat);
      standL.position.set(0, -0.25, -0.05);
      leftMonGroup.add(standL);
      group.add(leftMonGroup);

      // Right Monitor
      const rightMonGroup = new THREE.Group();
      rightMonGroup.position.set(0.52, deskH + 0.45, -0.22);
      rightMonGroup.rotation.y = -0.15;

      const rightMonBezel = new THREE.Mesh(new THREE.BoxGeometry(monW, monH, monD), bezelMat);
      rightMonGroup.add(rightMonBezel);

      const screenMat2 = new THREE.MeshStandardMaterial({
        color: '#09090b',
        emissive: '#38bdf8',
        emissiveIntensity: 0.35,
        roughness: 0.2,
      });
      const rightMonScreen = new THREE.Mesh(new THREE.PlaneGeometry(monW - 0.05, monH - 0.05), screenMat2);
      rightMonScreen.position.z = monD / 2 + 0.002;
      rightMonGroup.add(rightMonScreen);

      const standR = new THREE.Mesh(monStandGeo, monStandMat);
      standR.position.set(0, -0.25, -0.05);
      rightMonGroup.add(standR);
      group.add(rightMonGroup);

      // Ergonomic Chair
      const chairGroup = new THREE.Group();
      chairGroup.position.set(0, 0, 0.65);
      chairGroup.rotation.y = Math.PI; // facing desk

      const chairMat = new THREE.MeshStandardMaterial({ color: PALETTE.chair, roughness: 0.7 });
      // Seat
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.65), chairMat);
      seat.position.y = 0.55;
      chairGroup.add(seat);
      // Backrest
      const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.7, 0.08), chairMat);
      backrest.position.set(0, 0.95, -0.28);
      chairGroup.add(backrest);
      // Chair base & stem
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5), monStandMat);
      stem.position.y = 0.26;
      chairGroup.add(stem);
      // Wheels star
      const wheelBase = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 5), monStandMat);
      wheelBase.position.y = 0.05;
      chairGroup.add(wheelBase);
      group.add(chairGroup);

      // For Khansa ('tara'): Khansa is an autonomous companion roaming with Boss Raffa!
      // Her workstation acts as the Royal Executive Secretary Command Desk.
      if (agent.id === 'tara') {
        const signCanvas = document.createElement('canvas');
        signCanvas.width = 384;
        signCanvas.height = 80;
        const sCtx = signCanvas.getContext('2d');
        const grad = sCtx.createLinearGradient(0, 0, 384, 0);
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.95)');
        grad.addColorStop(1, 'rgba(251, 191, 36, 0.95)');
        sCtx.fillStyle = grad;
        sCtx.beginPath();
        sCtx.roundRect(8, 8, 368, 64, 14);
        sCtx.fill();
        sCtx.fillStyle = '#ffffff';
        sCtx.font = 'bold 22px "Inter", sans-serif';
        sCtx.textAlign = 'center';
        sCtx.fillText('👑 KONSUL PERMAISURI KHANSA', 192, 48);

        const signTex = new THREE.CanvasTexture(signCanvas);
        const signSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTex, transparent: true }));
        signSpr.scale.set(1.6, 0.36, 1);
        signSpr.position.set(0, 1.25, 0.2);
        group.add(signSpr);

        // Floating 3D Canvas Status Badge
        const badgeObj = this.createAgentBadge(agent);
        badgeObj.sprite.position.set(0, 1.95, 0.25);
        group.add(badgeObj.sprite);

        // Click hit target for desk interaction
        const hitBox = new THREE.Mesh(
          new THREE.BoxGeometry(deskW + 1.4, 2.8, deskD + 1.8),
          new THREE.MeshBasicMaterial({ visible: false })
        );
        hitBox.position.set(0, 1.2, 0.2);
        hitBox.userData = { agentId: agent.id, deskPos: new THREE.Vector3(agent.desk.x, 0, agent.desk.z) };
        group.add(hitBox);
        this.interactiveMeshes.push(hitBox);

        this.scene.add(group);

        this.agentMeshes.set(agent.id, {
          group,
          avatar: null,
          armL: null,
          armR: null,
          head: null,
          badgeSprite: badgeObj.sprite,
          canvas: badgeObj.canvas,
          ctx: badgeObj.ctx,
          texture: badgeObj.texture,
          agent,
          deskPos: new THREE.Vector3(agent.desk.x, 0, agent.desk.z),
          status: 'Idle',
        });
        return;
      }

      // Click hit target for desk interaction (generous bounds for easy clicking)
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(deskW + 1.4, 2.8, deskD + 1.8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.set(0, 1.2, 0.2);
      hitBox.userData = { agentId: agent.id, deskPos: new THREE.Vector3(agent.desk.x, 0, agent.desk.z) };
      group.add(hitBox);
      this.interactiveMeshes.push(hitBox);

      this.scene.add(group);

      // AI Worker Avatar (Independent world-space entity that can leave desk to pantry/terrace)
      const avatarGroup = new THREE.Group();
      // Desk seated world coordinate
      const deskChairLocal = new THREE.Vector3(0, 0, 0.58);
      deskChairLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), agent.desk.rot);
      const deskChairWorld = new THREE.Vector3(
        agent.desk.x + deskChairLocal.x,
        0,
        agent.desk.z + deskChairLocal.z
      );
      avatarGroup.position.copy(deskChairWorld);
      avatarGroup.rotation.y = agent.desk.rot + Math.PI;

      const skinMat = new THREE.MeshStandardMaterial({ color: agent.look.skin, roughness: 0.7 });
      const clothesMat = new THREE.MeshStandardMaterial({ color: agent.look.shirt, roughness: 0.8 });
      const pantsMat = new THREE.MeshStandardMaterial({ color: agent.look.pants, roughness: 0.85 });
      const hairMat = new THREE.MeshStandardMaterial({ color: agent.look.hair, roughness: 0.9 });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.52, 0.28), clothesMat);
      torso.position.y = 0.85;
      torso.castShadow = true;
      avatarGroup.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.28), skinMat);
      head.position.y = 1.30;
      head.castShadow = true;
      avatarGroup.add(head);

      // Hair
      const hair = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.32), hairMat);
      hair.position.set(0, 1.42, -0.02);
      avatarGroup.add(hair);

      // Role accessory (headphones, glasses, beanie, etc.)
      if (agent.look.accessory === 'headphones') {
        const hpMat = new THREE.MeshStandardMaterial({ color: '#10b981', metalness: 0.6 });
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 16, Math.PI), hpMat);
        band.position.set(0, 1.41, 0);
        band.rotation.x = Math.PI / 2;
        avatarGroup.add(band);
      } else if (agent.look.accessory === 'beanie') {
        const beanie = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.18, 0.3), clothesMat);
        beanie.position.set(0, 1.43, 0);
        avatarGroup.add(beanie);
      }

      // Left & Right Legs (pivot at hips)
      const workerLegGeo = new THREE.BoxGeometry(0.14, 0.52, 0.15);
      const legL = new THREE.Mesh(workerLegGeo, pantsMat);
      legL.position.set(-0.13, 0.26, 0);
      legL.castShadow = true;
      avatarGroup.add(legL);

      const legR = new THREE.Mesh(workerLegGeo, pantsMat);
      legR.position.set(0.13, 0.26, 0);
      legR.castShadow = true;
      avatarGroup.add(legR);

      // Left & Right Arms
      const armMat = clothesMat;
      const armGeo = new THREE.BoxGeometry(0.11, 0.48, 0.12);
      const armL = new THREE.Mesh(armGeo, armMat);
      armL.position.set(-0.28, 0.82, 0.08);
      armL.rotation.x = -Math.PI / 3;
      avatarGroup.add(armL);

      const armR = new THREE.Mesh(armGeo, armMat);
      armR.position.set(0.28, 0.82, 0.08);
      armR.rotation.x = -Math.PI / 3;
      avatarGroup.add(armR);

      // Floating 3D Canvas Status Badge above avatar
      const badgeObj = this.createAgentBadge(agent);
      badgeObj.sprite.position.set(0, 2.3, 0);
      avatarGroup.add(badgeObj.sprite);

      this.scene.add(avatarGroup);

      this.agentMeshes.set(agent.id, {
        group,
        avatar: avatarGroup,
        torso,
        legL,
        legR,
        armL,
        armR,
        head,
        badgeSprite: badgeObj.sprite,
        canvas: badgeObj.canvas,
        ctx: badgeObj.ctx,
        texture: badgeObj.texture,
        agent,
        deskPos: new THREE.Vector3(agent.desk.x, 0, agent.desk.z),
        chairPos: deskChairWorld.clone(),
        deskRot: agent.desk.rot + Math.PI,
        currentPos: deskChairWorld.clone(),
        targetPos: deskChairWorld.clone(),
        facing: agent.desk.rot + Math.PI,
        targetFacing: agent.desk.rot + Math.PI,
        isMoving: false,
        walkCycle: 0,
        bubble: null,
        status: 'working',
      });
    });
  }

  createAgentBadge(agent) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');

    this.renderBadgeCanvas(ctx, agent, 'Idle', agent.color);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.52, 1);

    return { sprite, canvas, ctx, texture };
  }

  renderBadgeCanvas(ctx, agent, statusText, statusColor, bubbleText, bubbleEmoji) {
    ctx.clearRect(0, 0, 512, 160);

    const hasBubble = Boolean(bubbleText);
    const strokeColor = statusColor || agent.color;

    if (hasBubble) {
      // Full card with speech bubble
      ctx.fillStyle = 'rgba(10, 12, 18, 0.94)';
      ctx.beginPath();
      ctx.roundRect(10, 10, 492, 140, 20);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.5;
      ctx.stroke();

      // Role avatar circle
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(46, 44, 16, 0, Math.PI * 2);
      ctx.fill();

      // Agent Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 26px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(agent.name, 74, 42);

      // Agent Role
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 16px "Inter", sans-serif';
      ctx.fillText(agent.role, 74, 66);

      // Status Pill with dedicated rounded pill background
      const dispStatus = (statusText || 'WORKING').toUpperCase();
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      const statusW = ctx.measureText(dispStatus).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(470 - statusW - 14, 24, statusW + 28, 28, 8);
      ctx.fill();
      ctx.fillStyle = strokeColor;
      ctx.fillText(dispStatus, 470 - statusW, 43);

      // Separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(20, 80);
      ctx.lineTo(492, 80);
      ctx.stroke();

      // Speech balloon background
      ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
      ctx.beginPath();
      ctx.roundRect(18, 90, 476, 50, 12);
      ctx.fill();

      // Emoji and Speech Text
      const emojiStr = bubbleEmoji || '💬';
      ctx.font = '22px "Inter", sans-serif';
      ctx.fillText(emojiStr, 30, 123);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 16px "Inter", sans-serif';
      let snippet = String(bubbleText);
      if (snippet.length > 40) snippet = snippet.substring(0, 38) + '...';
      ctx.fillText(`"${snippet}"`, 68, 122);
    } else {
      // Compact Nameplate (no speech bubble) — perfectly proportioned without empty space!
      ctx.fillStyle = 'rgba(10, 12, 18, 0.92)';
      ctx.beginPath();
      ctx.roundRect(10, 10, 492, 90, 20);
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Role avatar circle
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      ctx.arc(48, 55, 17, 0, Math.PI * 2);
      ctx.fill();

      // Agent Name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px "Inter", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(agent.name, 80, 50);

      // Agent Role
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 17px "Inter", sans-serif';
      ctx.fillText(agent.role, 80, 78);

      // Status Pill with dedicated rounded background
      const dispStatus = (statusText || 'WORKING').toUpperCase();
      ctx.font = 'bold 15px "JetBrains Mono", monospace';
      const statusW = ctx.measureText(dispStatus).width;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.roundRect(470 - statusW - 14, 34, statusW + 28, 32, 10);
      ctx.fill();
      ctx.fillStyle = strokeColor;
      ctx.fillText(dispStatus, 470 - statusW, 56);
    }
  }

  updateAgentStatus(agentId, statusText, color) {
    const item = this.agentMeshes.get(agentId);
    if (item) {
      item.status = statusText;
      this.renderBadgeCanvas(item.ctx, item.agent, statusText, color || item.agent.color);
      item.texture.needsUpdate = true;
    }
    if (agentId === 'tara') {
      this.updateKhansaBadge(statusText, color);
    }
  }

  setupHolotable() {
    // War-room holographic planning table in central war-room zone (X = 8.5, Z = 0)
    const holoGroup = new THREE.Group();
    holoGroup.position.set(8.5, 0, 0);

    // Matte dark pedestal
    const baseGeo = new THREE.CylinderGeometry(1.6, 2.0, 0.9, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.3, metalness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.45;
    base.castShadow = true;
    holoGroup.add(base);

    // Table rim glass glow
    const rimGeo = new THREE.TorusGeometry(1.65, 0.08, 12, 32);
    const rimMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#10b981',
      emissiveIntensity: 0.8,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.y = 0.92;
    rim.rotation.x = Math.PI / 2;
    holoGroup.add(rim);

    // Concentric holographic rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#34d399',
      wireframe: true,
      transparent: true,
      opacity: 0.7,
    });

    const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.3, 1.4, 24), ringMat);
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 1.15;
    holoGroup.add(ring1);
    this.holoElements.push({ mesh: ring1, rotSpeed: 0.015 });

    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.1, 16), ringMat);
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 1.35;
    holoGroup.add(ring2);
    this.holoElements.push({ mesh: ring2, rotSpeed: -0.02 });

    // Floating central holographic icosahedron
    const coreGeo = new THREE.IcosahedronGeometry(0.38, 1);
    const coreMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#059669',
      emissiveIntensity: 1.2,
      wireframe: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 1.6;
    holoGroup.add(core);
    this.holoElements.push({ mesh: core, rotSpeed: 0.03, float: true });

    this.scene.add(holoGroup);
  }

  setupPlayer() {
    // Raffa: The Boss
    const group = new THREE.Group();
    group.position.copy(this.playerPos);

    const skinMat = new THREE.MeshStandardMaterial({ color: BOSS.look.skin, roughness: 0.7 });
    const suitMat = new THREE.MeshStandardMaterial({ color: '#18181b', roughness: 0.6 });
    const shirtMat = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.5 });
    const hairMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.9 });
    const crownMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.9, roughness: 0.2 });

    // Torso (Dark sharp suit with emerald tie)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.65, 0.32), suitMat);
    torso.position.y = 0.85;
    torso.castShadow = true;
    group.add(torso);

    // Emerald lapel / tie stripe
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.02), shirtMat);
    tie.position.set(0, 0.86, 0.17);
    group.add(tie);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skinMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    // Hair
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.36), hairMat);
    hair.position.set(0, 1.52, -0.02);
    group.add(hair);

    // Golden Boss Crown
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.12, 5), crownMat);
    crown.position.set(0, 1.64, 0);
    group.add(crown);

    // Left & Right Legs (pivot at hips)
    const legGeo = new THREE.BoxGeometry(0.16, 0.55, 0.16);
    const legL = new THREE.Mesh(legGeo, suitMat);
    legL.position.set(-0.15, 0.28, 0);
    legL.castShadow = true;
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, suitMat);
    legR.position.set(0.15, 0.28, 0);
    legR.castShadow = true;
    group.add(legR);

    // Left & Right Arms
    const armGeo = new THREE.BoxGeometry(0.13, 0.55, 0.14);
    const armL = new THREE.Mesh(armGeo, suitMat);
    armL.position.set(-0.35, 0.82, 0);
    armL.castShadow = true;
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, suitMat);
    armR.position.set(0.35, 0.82, 0);
    armR.castShadow = true;
    group.add(armR);

    // Floating "Raffa (Boss)" nameplate
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 384;
    tagCanvas.height = 80;
    const tagCtx = tagCanvas.getContext('2d');
    tagCtx.fillStyle = 'rgba(10, 15, 20, 0.94)';
    tagCtx.beginPath();
    tagCtx.roundRect(8, 8, 368, 64, 18);
    tagCtx.fill();
    tagCtx.strokeStyle = '#10b981';
    tagCtx.lineWidth = 3;
    tagCtx.stroke();
    tagCtx.fillStyle = '#34d399';
    tagCtx.font = 'bold 24px "Inter", sans-serif';
    tagCtx.textAlign = 'center';
    tagCtx.fillText('👑 RAFFA (BOSS)', 192, 48);

    const tagTex = new THREE.CanvasTexture(tagCanvas);
    const tagSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, transparent: true }));
    tagSprite.scale.set(1.9, 0.45, 1);
    tagSprite.position.y = 2.3;
    group.add(tagSprite);
    this.bossTagSprite = tagSprite;

    this.scene.add(group);
    this.player = group;
    this.playerParts = { torso, head, legL, legR, armL, armR, crown };
  }

  setupKhansaCompanion() {
    // Khansa: Permaisuri & Corporate Secretary (Companion character following Raffa)
    const group = new THREE.Group();
    group.position.copy(this.khansaPos);

    // Regal royal palette: Rose/Ruby gown with golden accents & brunette flowing hair
    const skinMat = new THREE.MeshStandardMaterial({ color: '#f5cbb7', roughness: 0.6 });
    const dressMat = new THREE.MeshStandardMaterial({ color: '#e11d48', roughness: 0.45, metalness: 0.15 });
    const sashMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.3, metalness: 0.75 });
    const hairMat = new THREE.MeshStandardMaterial({ color: '#271710', roughness: 0.9 });
    const tiaraMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.95, roughness: 0.15 });
    const shoeMat = new THREE.MeshStandardMaterial({ color: '#9f1239', roughness: 0.5 });

    // Torso (Slim royal fitted gown)
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.56, 0.26), dressMat);
    torso.position.y = 0.84;
    torso.castShadow = true;
    group.add(torso);

    // Gold Royal Sash across chest
    const sash = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.58, 0.28), sashMat);
    sash.position.set(0.04, 0.84, 0.02);
    sash.rotation.z = -0.32;
    group.add(sash);

    // Flared Gown Skirt
    const skirtGeo = new THREE.CylinderGeometry(0.22, 0.38, 0.54, 8);
    const skirt = new THREE.Mesh(skirtGeo, dressMat);
    skirt.position.y = 0.38;
    skirt.castShadow = true;
    group.add(skirt);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.34, 0.28), skinMat);
    head.position.y = 1.32;
    head.castShadow = true;
    group.add(head);

    // Long Flowing Brunette Hair (Top + cascading back)
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.32), hairMat);
    hairTop.position.set(0, 1.48, -0.02);
    group.add(hairTop);

    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.56, 0.12), hairMat);
    hairBack.position.set(0, 1.15, -0.16);
    hairBack.castShadow = true;
    group.add(hairBack);

    // Golden Royal Tiara / Crown of the First Lady
    const tiara = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.09, 5), tiaraMat);
    tiara.position.set(0, 1.58, 0.02);
    group.add(tiara);

    // Ruby gem sparkling on tiara
    const gem = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshStandardMaterial({ color: '#be123c', roughness: 0.1, metalness: 0.9 })
    );
    gem.position.set(0, 1.60, 0.12);
    group.add(gem);

    // Legs / Shoes under skirt (pivot from hips)
    const legGeo = new THREE.BoxGeometry(0.13, 0.48, 0.14);
    const legL = new THREE.Mesh(legGeo, shoeMat);
    legL.position.set(-0.13, 0.24, 0);
    legL.castShadow = true;
    group.add(legL);

    const legR = new THREE.Mesh(legGeo, shoeMat);
    legR.position.set(0.13, 0.24, 0);
    legR.castShadow = true;
    group.add(legR);

    // Left & Right Arms (graceful posture)
    const armGeo = new THREE.BoxGeometry(0.10, 0.50, 0.11);
    const armL = new THREE.Mesh(armGeo, dressMat);
    armL.position.set(-0.29, 0.80, 0);
    armL.castShadow = true;
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, dressMat);
    armR.position.set(0.29, 0.80, 0);
    armR.castShadow = true;
    group.add(armR);

    // Floating Royal Nameplate & Dynamic Status
    const tagCanvas = document.createElement('canvas');
    tagCanvas.width = 440;
    tagCanvas.height = 80;
    const tagCtx = tagCanvas.getContext('2d');
    tagCtx.fillStyle = 'rgba(18, 10, 15, 0.94)';
    tagCtx.beginPath();
    tagCtx.roundRect(8, 8, 424, 64, 18);
    tagCtx.fill();
    tagCtx.strokeStyle = '#f43f5e';
    tagCtx.lineWidth = 3;
    tagCtx.stroke();
    tagCtx.fillStyle = '#fb7185';
    tagCtx.font = 'bold 22px "Inter", sans-serif';
    tagCtx.textAlign = 'center';
    tagCtx.fillText('💖 KHANSAKU (PERMAISURI)', 220, 48);

    const tagTex = new THREE.CanvasTexture(tagCanvas);
    const tagSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, transparent: true }));
    tagSprite.scale.set(2.1, 0.45, 1);
    tagSprite.position.y = 2.3;
    group.add(tagSprite);
    this.khansaTagSprite = tagSprite;

    // Click hitbox around Khansa (allows direct click on Khansa in 3D)
    const hitBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 2.5, 1.4),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hitBox.position.set(0, 1.0, 0);
    hitBox.userData = { agentId: 'tara' };
    group.add(hitBox);
    this.interactiveMeshes.push(hitBox);

    this.scene.add(group);
    this.khansa = group;
    this.khansaParts = {
      torso,
      skirt,
      head,
      hairBack,
      tiara,
      gem,
      legL,
      legR,
      armL,
      armR,
      tagSprite,
      tagCtx,
      tagTex,
      tagCanvas,
    };
  }

  setupDestRing() {
    // Pulse ring showing destination on click-to-move
    const ringGeo = new THREE.RingGeometry(0.35, 0.45, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#10b981',
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
    });
    this.destRing = new THREE.Mesh(ringGeo, ringMat);
    this.destRing.rotation.x = -Math.PI / 2;
    this.destRing.position.y = 0.02;
    this.scene.add(this.destRing);
  }

  setupProps() {
    // 1. Potted Tropical Plants (Office Corners & Terrace Corners)
    const plantLocations = [
      [-14.5, -10.5],
      [14.5, -10.5],
      [-14.5, 10.5],
      [14.5, 10.5],
      [-0.5, -10.8],
      [-5.5, -3.5],  // Executive entry divider plant
      [6.0, 6.0],    // Pantry divider plant
      [-14.5, 14.0], // Terrace NW
      [14.5, 14.0],  // Terrace NE
      [-14.5, 26.5], // Terrace SW
      [14.5, 26.5],  // Terrace SE
      [-7.0, 27.2],  // Terrace South Balustrade
      [7.0, 27.2],   // Terrace South Balustrade
    ];

    plantLocations.forEach(([px, pz]) => {
      const potGroup = new THREE.Group();
      potGroup.position.set(px, 0, pz);

      // Ceramic fluted pot with realistic monstera texture
      const plantTex = new THREE.TextureLoader().load('/textures/props/indoor_monstera_plant.jpg');
      plantTex.colorSpace = THREE.SRGBColorSpace;

      const potGeo = new THREE.CylinderGeometry(0.42, 0.32, 0.75, 14);
      const potMat = new THREE.MeshStandardMaterial({
        map: plantTex,
        roughness: 0.35,
        metalness: 0.1,
      });
      const pot = new THREE.Mesh(potGeo, potMat);
      pot.position.y = 0.375;
      pot.castShadow = true;
      potGroup.add(pot);

      // Lush tropical plant foliage
      const leafMat = new THREE.MeshStandardMaterial({ color: '#16a34a', roughness: 0.55 });
      for (let i = 0; i < 7; i++) {
        const leafGeo = new THREE.ConeGeometry(0.2, 0.9 + (i % 3) * 0.22, 5);
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        const angle = (i / 7) * Math.PI * 2;
        leaf.position.set(Math.cos(angle) * 0.16, 0.85 + (i % 2) * 0.12, Math.sin(angle) * 0.16);
        leaf.rotation.x = (Math.random() - 0.5) * 0.35;
        leaf.rotation.z = (Math.random() - 0.5) * 0.35;
        potGroup.add(leaf);
      }

      this.scene.add(potGroup);
    });

    // 2. Penthouse Sky Terrace Outdoor Lounge (L-Sofa & Coffee Table at x: -9.0, z: 18.0)
    const sofaGroup = new THREE.Group();
    sofaGroup.position.set(-9.0, 0, 18.0);

    const sofaTex = new THREE.TextureLoader().load('/textures/props/terrace_lounge_sofa.jpg');
    sofaTex.colorSpace = THREE.SRGBColorSpace;

    const sofaMat = new THREE.MeshStandardMaterial({
      map: sofaTex,
      roughness: 0.65,
      metalness: 0.15,
    });
    const cushionMat = new THREE.MeshStandardMaterial({ color: '#3f3f46', roughness: 0.7 });
    const pillowMat = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.6 });

    // Main sofa bench (W = 4.2, D = 1.2, H = 0.45)
    const sofaMain = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.45, 1.2), sofaMat);
    sofaMain.position.set(0, 0.225, 0);
    sofaMain.castShadow = true;
    sofaGroup.add(sofaMain);

    // Main sofa backrest
    const sofaBack = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.55, 0.3), sofaMat);
    sofaBack.position.set(0, 0.65, -0.45);
    sofaGroup.add(sofaBack);

    // L-chaise return (W = 1.2, D = 2.4, H = 0.45)
    const sofaL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 2.4), sofaMat);
    sofaL.position.set(-1.5, 0.225, 1.2);
    sofaGroup.add(sofaL);

    // L-chaise armrest
    const sofaArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.55, 2.4), sofaMat);
    sofaArm.position.set(-2.0, 0.65, 1.2);
    sofaGroup.add(sofaArm);

    // Cushions & Accent Pillows
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.15), pillowMat);
    p1.position.set(-1.2, 0.65, -0.3);
    sofaGroup.add(p1);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.15), new THREE.MeshStandardMaterial({ color: '#f59e0b' }));
    p2.position.set(1.4, 0.65, -0.3);
    sofaGroup.add(p2);

    // Beanbag Loungers
    const beanMat1 = new THREE.MeshStandardMaterial({ color: '#10b981', roughness: 0.85 });
    const beanbag1 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.45, 12), beanMat1);
    beanbag1.position.set(3.2, 0.22, 0.2);
    sofaGroup.add(beanbag1);

    const beanMat2 = new THREE.MeshStandardMaterial({ color: '#f59e0b', roughness: 0.85 });
    const beanbag2 = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.45, 12), beanMat2);
    beanbag2.position.set(3.4, 0.22, 1.8);
    sofaGroup.add(beanbag2);

    // Outdoor Modern Coffee Table
    const tableMat = new THREE.MeshStandardMaterial({ color: '#18181b', metalness: 0.6, roughness: 0.3 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.32, 1.0), tableMat);
    table.position.set(0.6, 0.16, 1.4);
    sofaGroup.add(table);

    // Coffee Mugs on table
    const mugMat = new THREE.MeshStandardMaterial({ color: '#e4e4e7', roughness: 0.2 });
    const mug1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16), mugMat);
    mug1.position.set(0.4, 0.4, 1.3);
    sofaGroup.add(mug1);
    const mug2 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16), new THREE.MeshStandardMaterial({ color: '#f43f5e' }));
    mug2.position.set(0.7, 0.4, 1.5);
    // Photorealistic 2.5D Billboard Sprite for Terrace Lounge Sofa
    const sofaBillboardTex = new THREE.TextureLoader().load('/textures/props/terrace_lounge_sofa.jpg');
    sofaBillboardTex.colorSpace = THREE.SRGBColorSpace;
    const sofaBillboardMat = new THREE.SpriteMaterial({
      map: sofaBillboardTex,
      transparent: true,
      opacity: 0.95,
    });
    const sofaBillboardSprite = new THREE.Sprite(sofaBillboardMat);
    sofaBillboardSprite.scale.set(4.2, 2.2, 1);
    sofaBillboardSprite.position.set(0, 1.4, -0.6);
    sofaGroup.add(sofaBillboardSprite);

    this.scene.add(sofaGroup);

    // 3. Chrome Observation Telescope on Tripod (at x: -12.5, z: 25.0)
    const teleGroup = new THREE.Group();
    teleGroup.position.set(-12.5, 0, 25.0);
    const steelMat = new THREE.MeshStandardMaterial({ color: '#e4e4e7', metalness: 0.9, roughness: 0.15 });

    // Tripod Legs
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4), steelMat);
      const angle = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(angle) * 0.45, 0.68, Math.sin(angle) * 0.45);
      leg.rotation.z = (Math.PI / 10) * Math.sin(angle);
      leg.rotation.x = -(Math.PI / 10) * Math.cos(angle);
      teleGroup.add(leg);
    }

    // Telescope Mount & Barrel
    const teleMount = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.25), steelMat);
    teleMount.position.y = 1.4;
    teleGroup.add(teleMount);

    const teleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.09, 1.1), steelMat);
    teleBarrel.position.set(0, 1.55, 0.2);
    teleBarrel.rotation.x = -Math.PI / 4; // aimed up at night sky/skyline
    teleBarrel.rotation.y = -Math.PI / 6;
    teleGroup.add(teleBarrel);

    this.scene.add(teleGroup);

    // 4. Retro Arcade Cabinet Machine (at x: 9.5, z: 17.5)
    const arcadeGroup = new THREE.Group();
    arcadeGroup.position.set(9.5, 0, 17.5);
    arcadeGroup.rotation.y = -Math.PI / 2; // facing toward terrace center

    const arcadeTex = new THREE.TextureLoader().load('/textures/props/retro_arcade_cabinet.jpg');
    arcadeTex.colorSpace = THREE.SRGBColorSpace;

    const cabMat = new THREE.MeshStandardMaterial({
      color: '#18181b',
      roughness: 0.5,
      metalness: 0.2,
    });
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.1, 1.1), cabMat);
    cab.position.y = 1.05;
    cab.castShadow = true;
    arcadeGroup.add(cab);

    // Illuminated Marquee ("CRYPTO SCALPER")
    const marqGeo = new THREE.BoxGeometry(0.9, 0.3, 0.05);
    const marqMat = new THREE.MeshBasicMaterial({ color: '#38bdf8' });
    const marq = new THREE.Mesh(marqGeo, marqMat);
    marq.position.set(0, 1.85, 0.56);
    arcadeGroup.add(marq);

    // Glowing CRT Game Screen with Crypto Scalper texture
    const screenGeo = new THREE.BoxGeometry(0.75, 0.6, 0.05);
    const screenMat = new THREE.MeshStandardMaterial({
      map: arcadeTex,
      roughness: 0.2,
      emissive: new THREE.Color('#38bdf8'),
      emissiveIntensity: 0.2,
    });
    const screen = new THREE.Mesh(screenGeo, screenMat);
    screen.position.set(0, 1.35, 0.48);
    screen.rotation.x = -0.2;
    arcadeGroup.add(screen);

    // Control panel with joystick
    const cPanel = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.45), cabMat);
    cPanel.position.set(0, 0.95, 0.6);
    arcadeGroup.add(cPanel);

    // Photorealistic 2.5D Billboard Sprite for Retro Arcade Cabinet
    const arcadeBillboardTex = new THREE.TextureLoader().load('/textures/props/retro_arcade_cabinet.jpg');
    arcadeBillboardTex.colorSpace = THREE.SRGBColorSpace;
    const arcadeBillboardMat = new THREE.SpriteMaterial({
      map: arcadeBillboardTex,
      transparent: true,
      opacity: 0.95,
    });
    const arcadeBillboardSprite = new THREE.Sprite(arcadeBillboardMat);
    arcadeBillboardSprite.scale.set(1.5, 2.3, 1);
    arcadeBillboardSprite.position.set(0, 1.35, 0.65);
    arcadeGroup.add(arcadeBillboardSprite);

    this.scene.add(arcadeGroup);

    // 5. Sky Darts Target Board Stand (at x: 12.0, z: 23.0)
    const dartsGroup = new THREE.Group();
    dartsGroup.position.set(12.0, 0, 23.0);
    dartsGroup.rotation.y = -Math.PI / 2; // facing toward terrace center

    // Slate architectural feature column
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.85 });
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.8, 0.35), pillarMat);
    pillar.position.y = 1.4;
    pillar.castShadow = true;
    dartsGroup.add(pillar);

    // Darts Target Board (Circle with concentric rings)
    const dartBoardGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.06, 32);
    const dartBoardMat = new THREE.MeshStandardMaterial({ color: '#09090b', roughness: 0.6 });
    const dartBoard = new THREE.Mesh(dartBoardGeo, dartBoardMat);
    dartBoard.rotation.x = Math.PI / 2;
    dartBoard.position.set(0, 1.7, 0.2);
    dartsGroup.add(dartBoard);

    // Outer double ring (green)
    const r1 = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 32), new THREE.MeshBasicMaterial({ color: '#10b981', side: THREE.DoubleSide }));
    r1.position.set(0, 1.7, 0.24);
    dartsGroup.add(r1);

    // Triple ring (red)
    const r2 = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.42, 32), new THREE.MeshBasicMaterial({ color: '#ef4444', side: THREE.DoubleSide }));
    r2.position.set(0, 1.7, 0.24);
    dartsGroup.add(r2);

    // Bullseye (gold)
    const bullseye = new THREE.Mesh(new THREE.CircleGeometry(0.12, 24), new THREE.MeshBasicMaterial({ color: '#f59e0b', side: THREE.DoubleSide }));
    bullseye.position.set(0, 1.7, 0.245);
    dartsGroup.add(bullseye);

    this.scene.add(dartsGroup);

    // 5b. Outdoor High-Top Cocktail Bar Table (at x: 4.5, z: 23.5)
    const cocktailTableGroup = new THREE.Group();
    cocktailTableGroup.position.set(4.5, 0, 23.5);

    const barTable = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 24), steelMat);
    barTable.position.y = 1.08;
    cocktailTableGroup.add(barTable);

    const barPost = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 1.05, 16), steelMat);
    barPost.position.y = 0.54;
    cocktailTableGroup.add(barPost);

    const barBase = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.03, 24), steelMat);
    barBase.position.y = 0.02;
    cocktailTableGroup.add(barBase);

    // 2 High Stools
    [-0.6, 0.6].forEach((hx) => {
      const hSeat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.6 }));
      hSeat.position.set(hx, 0.76, 0);
      cocktailTableGroup.add(hSeat);
      const hLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.74, 12), steelMat);
      hLeg.position.set(hx, 0.37, 0);
      cocktailTableGroup.add(hLeg);
    });

    this.scene.add(cocktailTableGroup);

    // 6. Recessed Terrace Floor Warm Amber Deck Lights
    const deckLightMat = new THREE.MeshBasicMaterial({ color: '#f59e0b' });
    for (let x = -13; x <= 13; x += 6.5) {
      const lightMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 12), deckLightMat);
      lightMesh.position.set(x, 0.02, 27.5);
      this.scene.add(lightMesh);
    }
  }

  setupEvents() {
    this.onPointerDown = this.handlePointerDown.bind(this);
    this.onPointerMove = this.handlePointerMove.bind(this);
    this.onPointerUp = this.handlePointerUp.bind(this);
    this.onDblClick = this.handleDblClick.bind(this);
    this.onWheel = this.handleWheel.bind(this);
    this.onResize = this.handleResize.bind(this);

    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('dblclick', this.onDblClick);
    this.renderer.domElement.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('resize', this.onResize);
  }

  handlePointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;

    // Clearing focusingOnAgent enables immediate free camera panning
    this.focusingOnAgent = null;
    this.isDraggingCamera = true;
    this.dragStart.x = event.clientX;
    this.dragStart.y = event.clientY;
    this.dragStartPan.copy(this.userPanOffset);
    this.totalDragDist = 0;
  }

  handlePointerMove(event) {
    if (!this.isDraggingCamera) return;

    const dx = event.clientX - this.dragStart.x;
    const dy = event.clientY - this.dragStart.y;
    this.totalDragDist = Math.hypot(dx, dy);

    // Pan camera across the isometric floor plane
    const containerH = this.container.clientHeight || window.innerHeight;
    const containerW = this.container.clientWidth || window.innerWidth;
    const viewHeight = 20 / (this.zoomLevel || 1.0);
    const viewWidth = viewHeight * (containerW / containerH);

    const worldDx = (dx / containerW) * viewWidth;
    const worldDy = (dy / containerH) * viewHeight;

    // Screen drag: dragging mouse right (dx > 0) pulls world right, so camera moves left
    // Using screenToWorld mapping matching the isometric camera angle
    const angle = -CAMERA_YAW;
    const panX = -(worldDx * Math.cos(angle) - worldDy * Math.sin(angle));
    const panZ = -(worldDx * Math.sin(angle) + worldDy * Math.cos(angle));

    this.userPanOffset.x = Math.max(ROOM.minX - 12, Math.min(ROOM.maxX + 12, this.dragStartPan.x + panX));
    this.userPanOffset.z = Math.max(ROOM.minZ - 12, Math.min(ROOM.maxZ + 12, this.dragStartPan.z + panZ));
  }

  handlePointerUp(event) {
    if (!this.isDraggingCamera) return;
    this.isDraggingCamera = false;

    // If mouse was clicked without dragging (< 6px), inspect clicked agent
    if (this.totalDragDist < 6 && event.button === 0) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);

      // Check if clicked an interactive desk or agent
      const deskIntersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);
      if (deskIntersects.length > 0) {
        const hit = deskIntersects[0];
        const agentId = hit.object.userData.agentId;
        if (agentId) {
          this.onDeskClicked(agentId);
        }
      }
    }
  }

  handleDblClick() {
    this.resetCamera();
  }

  handleWheel(event) {
    // Zoom camera in/out
    this.targetZoom = Math.max(0.6, Math.min(1.8, this.targetZoom + event.deltaY * -0.001));
  }

  handleResize() {
    if (this.disposed || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const aspect = width / height;

    const d = 12.2;
    this.camera.left = -d * aspect;
    this.camera.right = d * aspect;
    this.camera.top = d;
    this.camera.bottom = -d;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  /**
   * Focus camera smoothly on a specific agent or coordinate or return to Boss
   */
  focusOn(target) {
    if (!target) {
      this.focusingOnAgent = null;
      this.userPanOffset.set(0, 0, 0);
      return;
    }
    if (Array.isArray(target)) {
      this.focusingOnAgent = new THREE.Vector3(target[0], target[1] || 0, target[2]);
      this.userPanOffset.set(0, 0, 0);
      return;
    }
    if (target instanceof THREE.Vector3) {
      this.focusingOnAgent = target;
      this.userPanOffset.set(0, 0, 0);
      return;
    }
    if (target === 'raffa') {
      this.focusingOnAgent = this.playerPos;
      this.userPanOffset.set(0, 0, 0);
      return;
    }
    if (target === 'tara' || target === 'khansaku') {
      this.focusingOnAgent = this.khansaPos;
      this.userPanOffset.set(0, 0, 0);
      return;
    }
    const item = this.agentMeshes.get(target);
    if (item) {
      this.focusingOnAgent = item.deskPos;
      this.userPanOffset.set(0, 0, 0);
    }
  }

  focusOnZone(zone) {
    if (zone && zone.focus) {
      this.focusOn(zone.focus);
    }
  }

  resetCamera() {
    this.focusingOnAgent = null;
    this.userPanOffset.set(0, 0, 0);
    this.targetZoom = 1.0;
  }

  panTo(x, z) {
    this.focusingOnAgent = new THREE.Vector3(x, 0, z);
    this.userPanOffset.set(0, 0, 0);
  }

  /**
   * Read live coordinates for Radar Minimap tracking
   */
  getLiveBlips(employeeStates) {
    const list = [
      {
        id: 'raffa',
        x: this.playerPos.x,
        z: this.playerPos.z,
        facing: this.playerFacing,
        label: `${BOSS.name} (Bos Raffa)`,
        color: '#fbbf24',
      },
      {
        id: 'tara',
        x: this.khansaPos.x,
        z: this.khansaPos.z,
        facing: this.khansaFacing,
        label: 'Khansaku (First Lady)',
        color: '#f43f5e',
      },
    ];

    AGENTS.forEach((agent) => {
      if (agent.id === 'tara') return; // Khansaku is already added as the roaming royal companion!
      let x = agent.desk.x;
      let z = agent.desk.z;
      let facing = agent.desk.rot;
      const item = this.agentMeshes.get(agent.id);
      if (item && item.currentPos) {
        x = item.currentPos.x;
        z = item.currentPos.z;
        facing = item.facing;
      }
      list.push({
        id: agent.id,
        x,
        z,
        facing,
        label: `${agent.name} (${agent.employeeId})`,
        color: agent.color || '#38bdf8',
      });
    });

    return list;
  }

  /**
   * Main render loop
   */
  animate() {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.elapsedTime += dt;
    const elapsed = this.elapsedTime;

    // 1. Update Boss (WASD or Click-to-move)
    this.updatePlayerMovement(dt, elapsed);

    // 1b. Update Khansa Companion (Follows Boss Raffa)
    this.updateKhansa(dt, elapsed);

    // 2. Animate AI agents typing & idle bobbing
    this.updateAgents(dt, elapsed);

    // 3. Animate Holotable
    this.updateHolotable(elapsed);

    // 4. Update Destination Ring pulse
    this.updateDestRing(dt);

    // 5. Update Camera target & smooth position
    this.updateCamera(dt);

    // 6. Proximity check with nearest agent
    this.checkProximity();

    // 7. Render
    this.renderer.render(this.scene, this.camera);
  }

  updatePlayerMovement(dt, elapsed) {
    if (!this.player) return;

    // Smooth facing rotation
    this.playerFacing = dampAngle(this.playerFacing, this.targetFacing, 14, dt);
    this.player.rotation.y = this.playerFacing;
    this.player.position.set(this.playerPos.x, 0, this.playerPos.z);

    // Walk cycle animation
    if (this.isMoving) {
      // isMoving will be set to false if no WASD applied this frame
      this.isMoving = false; // reset for next frame check in applyWASD
      this.walkCycle += dt * 11;
      const swing = Math.sin(this.walkCycle) * 0.45;

      this.playerParts.legL.rotation.x = swing;
      this.playerParts.legR.rotation.x = -swing;
      this.playerParts.armL.rotation.x = -swing * 0.8;
      this.playerParts.armR.rotation.x = swing * 0.8;

      // Subtle head & body bob
      this.playerParts.torso.position.y = 0.85 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.04;
      this.playerParts.head.position.y = 1.35 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.04;
    } else {
      // Idle return to neutral
      this.playerParts.legL.rotation.x *= 0.8;
      this.playerParts.legR.rotation.x *= 0.8;
      this.playerParts.armL.rotation.x *= 0.8;
      this.playerParts.armR.rotation.x *= 0.8;
      this.playerParts.torso.position.y = 0.85 + Math.sin(elapsed * 2) * 0.01;
      this.playerParts.head.position.y = 1.35 + Math.sin(elapsed * 2) * 0.01;
    }
  }

  updateKhansa(dt, elapsed) {
    if (!this.khansa || !this.player) return;

    // Khansa accompanies Boss Raffa: generous 2.0-2.4 units separation
    const offsetSide = 2.1;
    const offsetBack = 0.9;
    const cosF = Math.cos(this.playerFacing);
    const sinF = Math.sin(this.playerFacing);

    // Desired position relative to Raffa's current orientation
    const targetX = this.playerPos.x + (cosF * offsetSide - sinF * offsetBack);
    const targetZ = this.playerPos.z + (-sinF * offsetSide - cosF * offsetBack);

    const dx = targetX - this.khansaPos.x;
    const dz = targetZ - this.khansaPos.z;
    const distToTarget = Math.hypot(dx, dz);
    const distToRaffa = Math.hypot(this.playerPos.x - this.khansaPos.x, this.playerPos.z - this.khansaPos.z);

    // If far away or catching up to Raffa
    const needsToMove = distToTarget > 0.45 || distToRaffa > 2.8;

    if (needsToMove) {
      this.khansaIsMoving = true;
      const moveDirX = dx / (distToTarget || 1);
      const moveDirZ = dz / (distToTarget || 1);

      // Dynamic catch-up speed
      const catchup = distToRaffa > 3.0 ? 1.45 : distToTarget > 1.2 ? 1.2 : 1.0;
      const spd = PLAYER.speed * catchup;

      const nextX = this.khansaPos.x + moveDirX * spd * dt;
      const nextZ = this.khansaPos.z + moveDirZ * spd * dt;

      // Obstacle collision avoidance for Khansa
      const resolved = resolveMovement(this.khansaPos.x, this.khansaPos.z, nextX, nextZ, 0.35);
      this.khansaPos.x = resolved.x;
      this.khansaPos.z = resolved.z;

      this.khansaTargetFacing = facingFromDirection(moveDirX, moveDirZ);
      this.khansaFacing = dampAngle(this.khansaFacing, this.khansaTargetFacing, 12, dt);

      // Graceful royal walking animation
      this.khansaWalkCycle += dt * 11;
      const swing = Math.sin(this.khansaWalkCycle) * 0.4;
      this.khansaParts.legL.rotation.x = swing;
      this.khansaParts.legR.rotation.x = -swing;
      this.khansaParts.armL.rotation.x = -swing * 0.7;
      this.khansaParts.armR.rotation.x = swing * 0.7;
      this.khansaParts.torso.position.y = 0.84 + Math.abs(Math.sin(this.khansaWalkCycle * 2)) * 0.035;
      this.khansaParts.head.position.y = 1.32 + Math.abs(Math.sin(this.khansaWalkCycle * 2)) * 0.035;
      this.khansaParts.skirt.rotation.z = Math.sin(this.khansaWalkCycle) * 0.05;
    } else {
      this.khansaIsMoving = false;
      // When idle, face toward Raffa
      const faceRaffa = Math.atan2(this.playerPos.x - this.khansaPos.x, this.playerPos.z - this.khansaPos.z);
      this.khansaFacing = dampAngle(this.khansaFacing, faceRaffa, 6, dt);

      this.khansaParts.legL.rotation.x *= 0.8;
      this.khansaParts.legR.rotation.x *= 0.8;
      this.khansaParts.armL.rotation.x *= 0.8;
      this.khansaParts.armR.rotation.x *= 0.8;
      this.khansaParts.torso.position.y = 0.84 + Math.sin(elapsed * 2.2) * 0.015;
      this.khansaParts.head.position.y = 1.32 + Math.sin(elapsed * 2.2) * 0.015;
      this.khansaParts.tiara.rotation.y = Math.sin(elapsed * 1.5) * 0.05;
      this.khansaParts.tagSprite.position.y = 2.15 + Math.sin(elapsed * 2.5) * 0.05;
    }

    this.khansa.position.set(this.khansaPos.x, 0, this.khansaPos.z);
    this.khansa.rotation.y = this.khansaFacing;
  }

  updateKhansaBadge(statusText, color) {
    if (!this.khansaParts || !this.khansaParts.tagCtx) return;
    const ctx = this.khansaParts.tagCtx;
    const grad = ctx.createLinearGradient(0, 0, 384, 0);
    grad.addColorStop(0, color || 'rgba(244, 63, 94, 0.95)');
    grad.addColorStop(1, 'rgba(251, 191, 36, 0.95)');
    ctx.clearRect(0, 0, 384, 72);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(8, 8, 368, 56, 14);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px "Inter", sans-serif';
    ctx.textAlign = 'center';
    const text = statusText && statusText !== 'Idle' ? `💖 KHANSA · ${statusText}` : '💖 KHANSA (PERMAISURI)';
    ctx.fillText(text, 192, 43);
    this.khansaParts.tagTex.needsUpdate = true;
  }

  /**
   * Called by external keyboard handler for WASD input
   */
  applyWASD(screenMoveX, screenMoveZ, isSprint, dt) {
    if (this.disposed || !this.player) return;

    if (Math.abs(screenMoveX) > 0.01 || Math.abs(screenMoveZ) > 0.01) {
      // Clear locked zone / agent camera focus so camera smoothly tracks Raffa as he walks
      this.focusingOnAgent = null;

      // Convert screen-relative WASD to world coordinates
      const world = screenToWorld(screenMoveX, screenMoveZ, CAMERA_YAW);

      const spd = PLAYER.speed * (isSprint ? PLAYER.sprint : 1.0);
      const nextX = this.playerPos.x + world.x * spd * dt;
      const nextZ = this.playerPos.z + world.z * spd * dt;

      // Obstacle collision detection with wall-sliding (desks, holotable, plants, walls)
      const resolved = resolveMovement(this.playerPos.x, this.playerPos.z, nextX, nextZ, PLAYER.radius);
      this.playerPos.x = resolved.x;
      this.playerPos.z = resolved.z;

      this.targetFacing = facingFromDirection(world.x, world.z);
      this.isMoving = true;

      // Walk cycle animation
      this.walkCycle += dt * (isSprint ? 16 : 11);
      const swing = Math.sin(this.walkCycle) * 0.45;
      this.playerParts.legL.rotation.x = swing;
      this.playerParts.legR.rotation.x = -swing;
      this.playerParts.armL.rotation.x = -swing * 0.8;
      this.playerParts.armR.rotation.x = swing * 0.8;
      this.playerParts.torso.position.y = 0.85 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.04;
      this.playerParts.head.position.y = 1.35 + Math.abs(Math.sin(this.walkCycle * 2)) * 0.04;
    }
  }

  /**
   * Sync social states and active speech bubbles from the social engine
   */
  /**
   * Choose a standing slot for a social agent that keeps at least MIN_SEP world
   * units from every other agent's target. Candidates spiral outward from the zone
   * centre; the first candidate that is clear of other agents and of collision
   * obstacles wins. Deterministic: the same agent order yields the same layout.
   */
  pickSeparatedSlot(agentId, zone, item) {
    const MIN_SEP = 1.9;
    const centre = zone === 'pantry' ? { x: 8.5, z: 7.4 } : { x: -6.0, z: 19.4 };
    const others = [];
    this.agentMeshes.forEach((other, otherId) => {
      if (otherId === agentId || otherId === 'tara') return;
      if (other.targetPos) others.push(other.targetPos);
    });
    for (let ring = 0; ring < 6; ring++) {
      const radius = ring * MIN_SEP * 0.5;
      const steps = ring === 0 ? 1 : 6 + ring * 2;
      for (let k = 0; k < steps; k++) {
        const ang = (k / steps) * Math.PI * 2 + ring * 0.37;
        const x = centre.x + Math.cos(ang) * radius;
        const z = centre.z + Math.sin(ang) * radius;
        const clear = others.every((p) => Math.hypot(p.x - x, p.z - z) >= MIN_SEP);
        if (clear && !isColliding(x, z, 0.4)) return { x, z };
      }
    }
    return { x: centre.x, z: centre.z };
  }

  setEmployeeSocial(states, bubbles) {
    if (!states) return;
    const now = Date.now();
    this.agentMeshes.forEach((item, id) => {
      if (id === 'tara') return;
      const state = states[id] || 'working';
      const prevStatus = item.status;
      item.status = state;

      // Find active bubble for this agent
      const activeBubble = bubbles ? bubbles.find((b) => b.agentId === id && b.expiresAt > now) : null;
      const prevBubbleText = item.bubble?.text;
      item.bubble = activeBubble;

      // Assign target waypoint based on autonomous state
      if (state === 'working' || state === 'walking-back') {
        item.targetPos.copy(item.chairPos);
        item.targetFacing = item.deskRot;
      } else if (state === 'pantry' || state === 'walking-pantry') {
        const spot = this.pickSeparatedSlot(id, 'pantry', item);
        item.targetPos.set(spot.x, 0, spot.z);
        item.targetFacing = 0; // face south toward lounge/office
      } else if (state === 'terrace' || state === 'walking-terrace') {
        const spot = this.pickSeparatedSlot(id, 'terrace', item);
        item.targetPos.set(spot.x, 0, spot.z);
        item.targetFacing = 0; // face scenic south skyline
      } else if (state === 'chatting') {
        // Face peers in either pantry or terrace
        const isTerrace = item.currentPos.z > 14;
        const spot = this.pickSeparatedSlot(id, isTerrace ? 'terrace' : 'pantry', item);
        item.targetPos.set(spot.x, 0, spot.z);
        const charCode = id.charCodeAt(0) || 0;
        item.targetFacing = (charCode % 2 === 0) ? Math.PI * 0.25 : -Math.PI * 0.75;
      } else if (state === 'shelter') {
        item.targetPos.copy(item.chairPos);
        item.targetFacing = item.deskRot;
      }

      // If status or speech bubble changed, update badge scale and redraw
      if (item.badgeSprite) {
        if (activeBubble) {
          item.badgeSprite.scale.set(2.5, 0.82, 1);
        } else {
          item.badgeSprite.scale.set(2.4, 0.52, 1);
        }
      }
      if (prevStatus !== state || prevBubbleText !== activeBubble?.text) {
        let statusLabel = state.toUpperCase();
        let statusColor = item.agent.color;
        if (state === 'pantry') {
          statusLabel = '☕ PANTRY';
          statusColor = '#f59e0b';
        } else if (state === 'terrace') {
          statusLabel = '🌿 SKY TERAS';
          statusColor = '#10b981';
        } else if (state === 'chatting') {
          statusLabel = activeBubble?.kind === 'ghibah-savage' ? '🔥 GHIBAH BOS' : '🗣️ NGOBROL';
          statusColor = '#ec4899';
        } else if (state.startsWith('walking-')) {
          statusLabel = '🚶 JALAN';
          statusColor = '#38bdf8';
        } else if (state === 'shelter') {
          statusLabel = '☔ BERTEDUH';
          statusColor = '#64748b';
        }

        this.renderBadgeCanvas(
          item.ctx,
          item.agent,
          statusLabel,
          statusColor,
          activeBubble?.text,
          activeBubble?.emoji
        );
        item.texture.needsUpdate = true;
      }

    });
  }

  updateAgents(dt, elapsed) {
    this.agentMeshes.forEach((item, id) => {
      if (id === 'tara' || !item.avatar || !item.armL) return;

      const typingOffset = id.charCodeAt(0) * 0.5;
      const distToTarget = item.currentPos.distanceTo(item.targetPos);

      if (distToTarget > 0.12) {
        // 1. Walking Locomotion to destination (Pantry, Terrace, or Desk)
        item.isMoving = true;
        const moveDir = new THREE.Vector3().subVectors(item.targetPos, item.currentPos).normalize();
        const walkSpeed = 2.4;
        item.currentPos.x += moveDir.x * walkSpeed * dt;
        item.currentPos.z += moveDir.z * walkSpeed * dt;

        // Face travel direction
        const targetAngle = Math.atan2(moveDir.x, moveDir.z);
        item.facing = dampAngle(item.facing, targetAngle, 12, dt);

        // Walking cycle
        item.walkCycle += dt * 11;
        const swing = Math.sin(item.walkCycle) * 0.42;
        if (item.legL && item.legR) {
          item.legL.rotation.x = swing;
          item.legR.rotation.x = -swing;
        }
        item.armL.rotation.x = -swing * 0.7;
        item.armR.rotation.x = swing * 0.7;
        if (item.torso) {
          item.torso.position.y = 0.85 + Math.abs(Math.sin(item.walkCycle * 2)) * 0.035;
        }
        if (item.head) {
          item.head.position.y = 1.30 + Math.abs(Math.sin(item.walkCycle * 2)) * 0.035;
          item.head.rotation.y = 0;
        }
      } else {
        // 2. Stationary / Idle / Typing / Socializing at spot
        item.isMoving = false;
        item.facing = dampAngle(item.facing, item.targetFacing, 6, dt);

        // Reset legs to neutral standing/sitting
        if (item.legL && item.legR) {
          item.legL.rotation.x *= 0.8;
          item.legR.rotation.x *= 0.8;
        }

        const isAtDesk = item.status === 'working' || item.status === 'shelter' || (!item.status && distToTarget <= 0.15);

        if (isAtDesk) {
          // Seated at workstation: typing animation
          const speed = item.status !== 'Idle' ? 14 : 4;
          const armSwing = Math.sin(elapsed * speed + typingOffset) * (item.status !== 'Idle' ? 0.22 : 0.08);
          item.armL.rotation.x = -Math.PI / 3 + armSwing;
          item.armR.rotation.x = -Math.PI / 3 - armSwing;
          if (item.head) {
            item.head.rotation.y = Math.sin(elapsed * 1.5 + typingOffset) * 0.12;
            item.head.position.y = 1.30;
          }
          if (item.torso) item.torso.position.y = 0.85;
        } else {
          // Relaxing at Pantry or Terrace: standing, sipping, or gesturing
          const isChatting = item.status === 'chatting';
          const gestureRate = isChatting ? 5.5 : 2.0;
          const armGest = Math.sin(elapsed * gestureRate + typingOffset) * (isChatting ? 0.35 : 0.12);
          item.armL.rotation.x = -0.3 + armGest;
          item.armR.rotation.x = -0.4 - armGest;
          if (item.head) {
            item.head.rotation.y = Math.sin(elapsed * 2.2 + typingOffset) * (isChatting ? 0.25 : 0.1);
            item.head.position.y = 1.30 + Math.sin(elapsed * 2.5) * 0.015;
          }
          if (item.torso) {
            item.torso.position.y = 0.85 + Math.sin(elapsed * 2.0) * 0.01;
          }
        }
      }

      // Update avatar world transform
      item.avatar.position.set(item.currentPos.x, 0, item.currentPos.z);
      item.avatar.rotation.y = item.facing;

      // Floating status badge gentle floating bob above avatar
      if (item.badgeSprite) {
        item.badgeSprite.position.y = 2.3 + Math.sin(elapsed * 2.5 + typingOffset) * 0.06;
      }
    });
    this.stackBadgesInScreenSpace();
  }

  /**
   * 2D label collision avoidance: badges whose projected screen rects overlap are
   * pushed apart vertically with a clear pixel gap, so status cards never stack on
   * top of each other. Runs in screen space using the live orthographic projection.
   */
  stackBadgesInScreenSpace() {
    if (!this.camera || !this.container) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const frustumH = this.camera.top - this.camera.bottom;
    const pxPerWorldY = (height / frustumH) * this.camera.zoom;
    const minSepPx = 42; // Vertical minimum pixel separation
    const minSepX = 145; // Horizontal proximity window in screen pixels

    const items = [];
    const worldPos = new THREE.Vector3();

    const addSprite = (sprite, baseLocalY) => {
      if (!sprite || !sprite.visible) return;
      sprite.getWorldPosition(worldPos);
      const p = worldPos.clone().project(this.camera);
      const sx = (p.x * 0.5 + 0.5) * width;
      const sy = (-p.y * 0.5 + 0.5) * height;
      items.push({ sprite, sx, sy, baseLocalY });
    };

    this.agentMeshes.forEach((item) => {
      if (item.badgeSprite) {
        addSprite(item.badgeSprite, item.bubble ? 2.5 : 2.15);
      }
    });

    if (this.bossTagSprite) {
      addSprite(this.bossTagSprite, 2.3);
    }
    if (this.khansaTagSprite) {
      addSprite(this.khansaTagSprite, 2.3);
    }

    // Sort top to bottom in screen Y
    items.sort((a, b) => a.sy - b.sy);

    for (let i = 0; i < items.length; i++) {
      const a = items[i];
      let offsetAccum = 0;
      for (let j = 0; j < i; j++) {
        const b = items[j];
        if (Math.abs(a.sx - b.sx) < minSepX) {
          const dy = a.sy - b.sy;
          if (dy < minSepPx) {
            const push = minSepPx - dy;
            offsetAccum += push;
            a.sy += push;
          }
        }
      }
      if (offsetAccum > 0) {
        a.sprite.position.y = a.baseLocalY + (offsetAccum / pxPerWorldY);
      } else {
        a.sprite.position.y = a.baseLocalY;
      }
    }
  }

  updateHolotable(elapsed) {
    this.holoElements.forEach((el) => {
      if (el.mesh) {
        el.mesh.rotation.z += el.rotSpeed;
        if (el.float) {
          el.mesh.rotation.x += el.rotSpeed * 0.8;
          el.mesh.position.y = 1.6 + Math.sin(elapsed * 2.5) * 0.08;
        }
      }
    });
  }

  updateDestRing(dt) {
    if (!this.destRing || this.destRing.material.opacity <= 0.01) return;

    this.destRing.material.opacity = Math.max(0, this.destRing.material.opacity - dt * 1.8);
    const s = this.destRing.scale.x + dt * 1.2;
    this.destRing.scale.set(s, s, s);
  }

  updateCamera(dt) {
    // Zoom interpolation
    this.zoomLevel += (this.targetZoom - this.zoomLevel) * 0.1;
    this.camera.zoom = this.zoomLevel;
    this.camera.updateProjectionMatrix();

    // Camera target: focus on selected agent desk or Raffa with user pan offset
    let targetLook;
    if (this.focusingOnAgent) {
      targetLook = this.focusingOnAgent;
    } else {
      // Keep center of the entire penthouse suite in view with balanced margins and subtle parallax follow
      targetLook = new THREE.Vector3(
        0.5 + this.playerPos.x * 0.25 + this.userPanOffset.x,
        0,
        3.5 + this.playerPos.z * 0.25 + this.userPanOffset.z
      );
    }

    // Smooth lerp camera focus
    this.camCurrentLook.lerp(targetLook, 0.08);

    // Keep camera at diagonal isometric offset relative to target
    this.camera.position.set(
      this.camCurrentLook.x + CAMERA_OFFSET.x,
      this.camCurrentLook.y + CAMERA_OFFSET.y,
      this.camCurrentLook.z + CAMERA_OFFSET.z
    );
    this.camera.lookAt(this.camCurrentLook);
  }

  setTheme(isLight) {
    if (!this.scene) return;
    const bgCol = isLight ? '#f1f5f9' : '#0c0c0e';
    this.scene.background = new THREE.Color(bgCol);
    if (this.scene.fog) {
      this.scene.fog.color = new THREE.Color(bgCol);
      this.scene.fog.density = isLight ? 0.008 : 0.015;
    }
  }

  checkProximity() {
    // Bos Raffa only interacts with Khansa (his First Lady & Corporate Secretary)!
    const khansaAgent = AGENTS.find((a) => a.id === 'tara');
    if (!khansaAgent) {
      this.onInteractPrompt(null);
      return;
    }

    // Check if Raffa is currently walking near a subordinate (desk or roaming)
    let nearestSubordinate = null;
    let minDist = 3.8;

    this.agentMeshes.forEach((item) => {
      if (item.agent.id === 'tara') return;
      const posToCheck = item.currentPos || item.deskPos;
      const dist = this.playerPos.distanceTo(posToCheck);
      if (dist < minDist) {
        minDist = dist;
        nearestSubordinate = item.agent;
      }
    });

    if (nearestSubordinate) {
      // Raffa instructs Khansa to command this specific subordinate!
      this.onInteractPrompt({
        ...khansaAgent,
        commandTarget: nearestSubordinate,
      });
    } else {
      // Regular consultation with Khansa
      this.onInteractPrompt(khansaAgent);
    }
  }

  destroy() {
    this.disposed = true;
    if (this.animId) cancelAnimationFrame(this.animId);

    if (this.renderer && this.renderer.domElement) {
      this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      this.renderer.domElement.removeEventListener('dblclick', this.onDblClick);
      this.renderer.domElement.removeEventListener('wheel', this.onWheel);
      window.removeEventListener('resize', this.onResize);
      if (this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer.dispose();
    }
  }

  async capture(): Promise<{ width: number; height: number }> {
    if (!this.renderer || !this.scene || !this.camera) {
      throw new Error('Scene 3D belum siap untuk capture');
    }
    this.renderer.render(this.scene, this.camera);
    const canvas = this.renderer.domElement;
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Gagal menangkap gambar kanvas'));
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `kantor-raffa-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        resolve({ width: canvas.width, height: canvas.height });
      }, 'image/png');
    });
  }
}
