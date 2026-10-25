/**
 * Metallurgical reference data for the periodic table: room-temperature crystal structure,
 * allotropes, lattice parameters, Young's modulus, thermal conductivity and role in steel.
 * Values are standard handbook figures (polycrystalline, ~20–25 °C). Unknown = absent / null.
 */

export type CrystalStructure =
  | "BCC"
  | "FCC"
  | "HCP"
  | "DHCP"
  | "diamond"
  | "tetragonal"
  | "rhombohedral"
  | "orthorhombic"
  | "hexagonal"
  | "monoclinic"
  | "cubic";

export const CRYSTAL_LABELS: Record<CrystalStructure, string> = {
  BCC: "BCC",
  FCC: "FCC",
  HCP: "HCP",
  DHCP: "Double HCP",
  diamond: "Diamond cubic",
  tetragonal: "Tetragonal",
  rhombohedral: "Rhombohedral",
  orthorhombic: "Orthorhombic",
  hexagonal: "Hexagonal",
  monoclinic: "Monoclinic",
  cubic: "Cubic (other)",
};

export const CRYSTAL_COLORS: Record<CrystalStructure, string> = {
  BCC: "#93c5fd",
  FCC: "#fca5a5",
  HCP: "#86efac",
  DHCP: "#d9f99d",
  diamond: "#fde68a",
  tetragonal: "#fdba74",
  rhombohedral: "#c4b5fd",
  orthorhombic: "#f9a8d4",
  hexagonal: "#5eead4",
  monoclinic: "#f0abfc",
  cubic: "#67e8f9",
};

/** Room-temperature (≈25 °C) structure of the solid element. Gases / liquids at RT are omitted. */
const STRUCTURE: Record<string, CrystalStructure> = {
  Li: "BCC", Be: "HCP", B: "rhombohedral", C: "hexagonal",
  Na: "BCC", Mg: "HCP", Al: "FCC", Si: "diamond", S: "orthorhombic",
  K: "BCC", Ca: "FCC", Sc: "HCP", Ti: "HCP", V: "BCC", Cr: "BCC", Mn: "cubic",
  Fe: "BCC", Co: "HCP", Ni: "FCC", Cu: "FCC", Zn: "HCP", Ga: "orthorhombic",
  Ge: "diamond", As: "rhombohedral", Se: "hexagonal",
  Rb: "BCC", Sr: "FCC", Y: "HCP", Zr: "HCP", Nb: "BCC", Mo: "BCC", Tc: "HCP",
  Ru: "HCP", Rh: "FCC", Pd: "FCC", Ag: "FCC", Cd: "HCP", In: "tetragonal",
  Sn: "tetragonal", Sb: "rhombohedral", Te: "hexagonal", I: "orthorhombic",
  Cs: "BCC", Ba: "BCC", La: "DHCP", Ce: "FCC", Pr: "DHCP", Nd: "DHCP", Pm: "DHCP",
  Sm: "rhombohedral", Eu: "BCC", Gd: "HCP", Tb: "HCP", Dy: "HCP", Ho: "HCP",
  Er: "HCP", Tm: "HCP", Yb: "FCC", Lu: "HCP",
  Hf: "HCP", Ta: "BCC", W: "BCC", Re: "HCP", Os: "HCP", Ir: "FCC", Pt: "FCC",
  Au: "FCC", Tl: "HCP", Pb: "FCC", Bi: "rhombohedral", Po: "cubic",
  Ra: "BCC", Ac: "FCC", Th: "FCC", Pa: "tetragonal", U: "orthorhombic",
  Np: "orthorhombic", Pu: "monoclinic", Am: "DHCP", Cm: "DHCP",
};

const STRUCTURE_NOTE: Record<string, string> = {
  C: "Graphite",
  Mn: "α-Mn, complex cubic (cI58)",
  Se: "Grey (trigonal) Se",
  Te: "Trigonal",
  Sn: "β-Sn (white tin)",
  Po: "α-Po, simple cubic",
  Pa: "Body-centred tetragonal",
  Ce: "γ-Ce",
  B: "β-rhombohedral",
  S: "α-S (S₈)",
};

export interface Allotrope {
  /** Phase name, e.g. "α-Fe". */
  name: string;
  structure: CrystalStructure;
  /** Stable above this temperature (°C); null for the low-temperature form. */
  aboveC: number | null;
  approx?: boolean;
  note?: string;
}

const ALLOTROPES: Record<string, Allotrope[]> = {
  Fe: [
    { name: "α-Fe", structure: "BCC", aboveC: null },
    { name: "γ-Fe", structure: "FCC", aboveC: 912 },
    { name: "δ-Fe", structure: "BCC", aboveC: 1394 },
  ],
  Ti: [
    { name: "α-Ti", structure: "HCP", aboveC: null },
    { name: "β-Ti", structure: "BCC", aboveC: 882 },
  ],
  Zr: [
    { name: "α-Zr", structure: "HCP", aboveC: null },
    { name: "β-Zr", structure: "BCC", aboveC: 863 },
  ],
  Co: [
    { name: "ε-Co", structure: "HCP", aboveC: null },
    { name: "α-Co", structure: "FCC", aboveC: 422, approx: true },
  ],
  Sn: [
    { name: "α-Sn (grey)", structure: "diamond", aboveC: null },
    { name: "β-Sn (white)", structure: "tetragonal", aboveC: 13.2 },
  ],
  Mn: [
    { name: "α-Mn", structure: "cubic", aboveC: null, note: "cI58" },
    { name: "β-Mn", structure: "cubic", aboveC: 727, approx: true, note: "cP20" },
    { name: "γ-Mn", structure: "FCC", aboveC: 1100, approx: true },
    { name: "δ-Mn", structure: "BCC", aboveC: 1138, approx: true },
  ],
  Be: [
    { name: "α-Be", structure: "HCP", aboveC: null },
    { name: "β-Be", structure: "BCC", aboveC: 1270, approx: true },
  ],
  Ca: [
    { name: "α-Ca", structure: "FCC", aboveC: null },
    { name: "β-Ca", structure: "BCC", aboveC: 443, approx: true },
  ],
  Sc: [
    { name: "α-Sc", structure: "HCP", aboveC: null },
    { name: "β-Sc", structure: "BCC", aboveC: 1337, approx: true },
  ],
  Y: [
    { name: "α-Y", structure: "HCP", aboveC: null },
    { name: "β-Y", structure: "BCC", aboveC: 1478, approx: true },
  ],
  La: [
    { name: "α-La", structure: "DHCP", aboveC: null },
    { name: "β-La", structure: "FCC", aboveC: 310, approx: true },
    { name: "γ-La", structure: "BCC", aboveC: 865, approx: true },
  ],
  Tl: [
    { name: "α-Tl", structure: "HCP", aboveC: null },
    { name: "β-Tl", structure: "BCC", aboveC: 230, approx: true },
  ],
  Th: [
    { name: "α-Th", structure: "FCC", aboveC: null },
    { name: "β-Th", structure: "BCC", aboveC: 1360, approx: true },
  ],
  U: [
    { name: "α-U", structure: "orthorhombic", aboveC: null },
    { name: "β-U", structure: "tetragonal", aboveC: 668 },
    { name: "γ-U", structure: "BCC", aboveC: 776 },
  ],
  S: [
    { name: "α-S", structure: "orthorhombic", aboveC: null },
    { name: "β-S", structure: "monoclinic", aboveC: 95.3, approx: true },
  ],
  C: [
    { name: "Graphite", structure: "hexagonal", aboveC: null },
    { name: "Diamond", structure: "diamond", aboveC: null, note: "metastable" },
  ],
};

/** Lattice parameters at room temperature, nm. */
export interface Lattice {
  a: number;
  b?: number;
  c?: number;
}

const LATTICE: Record<string, Lattice> = {
  Fe: { a: 0.28665 },
  Cr: { a: 0.28846 },
  Mo: { a: 0.3147 },
  W: { a: 0.31652 },
  V: { a: 0.3024 },
  Nb: { a: 0.33004 },
  Ta: { a: 0.33013 },
  Al: { a: 0.40495 },
  Cu: { a: 0.36149 },
  Ni: { a: 0.3524 },
  Ag: { a: 0.40862 },
  Au: { a: 0.40786 },
  Pt: { a: 0.39242 },
  Pd: { a: 0.38907 },
  Pb: { a: 0.49502 },
  Ir: { a: 0.38394 },
  Rh: { a: 0.38034 },
  Si: { a: 0.5431 },
  Ge: { a: 0.56579 },
  Ti: { a: 0.29508, c: 0.46855 },
  Zr: { a: 0.32316, c: 0.51475 },
  Hf: { a: 0.31946, c: 0.50511 },
  Zn: { a: 0.26649, c: 0.49468 },
  Mg: { a: 0.32094, c: 0.52107 },
  Co: { a: 0.25071, c: 0.40695 },
  Cd: { a: 0.29794, c: 0.56186 },
  Be: { a: 0.22856, c: 0.35832 },
  Ru: { a: 0.27058, c: 0.42816 },
  Os: { a: 0.27344, c: 0.43173 },
  Re: { a: 0.2761, c: 0.4456 },
  Sn: { a: 0.58318, c: 0.31819 },
  In: { a: 0.32523, c: 0.49461 },
  Mn: { a: 0.8912 },
  U: { a: 0.2854, b: 0.5869, c: 0.4955 },
};

/** Young's modulus, GPa (polycrystalline, RT). */
const MODULUS: Record<string, number> = {
  Fe: 211, Al: 70, Cu: 130, Ni: 200, Ti: 116, W: 411, Mo: 329, Cr: 279,
  V: 128, Nb: 105, Ta: 186, Co: 209, Mn: 198, Zn: 108, Mg: 45, Ag: 83,
  Au: 79, Pt: 168, Pd: 121, Pb: 16, Sn: 50, Zr: 88, Hf: 78, Re: 463,
  Ir: 528, Rh: 380, Ru: 447, Be: 287, Cd: 50, In: 11, Bi: 32, Sb: 55,
  Li: 4.9, Na: 10, Ca: 20, U: 208, Th: 79, Y: 64, Sc: 74, Gd: 55, Tl: 8,
};

/** Thermal conductivity, W/m·K (RT). */
const CONDUCTIVITY: Record<string, number> = {
  Fe: 80.4, Al: 237, Cu: 401, Ni: 90.9, Ti: 21.9, W: 173, Mo: 138, Cr: 93.9,
  V: 30.7, Nb: 53.7, Ta: 57.5, Co: 100, Mn: 7.81, Zn: 116, Mg: 156, Ag: 429,
  Au: 318, Pt: 71.6, Pd: 71.8, Pb: 35.3, Sn: 66.8, Zr: 22.6, Hf: 23, Re: 48,
  Ir: 147, Rh: 150, Ru: 117, Os: 87.6, Be: 200, Cd: 96.6, In: 81.8, Bi: 7.97,
  Sb: 24.4, Li: 84.8, Na: 142, K: 102.5, Ca: 201, Si: 149, Ge: 60.2, U: 27.5,
  Th: 54, Y: 17.2, Sc: 15.8, Gd: 10.6, Tl: 46.1, Ga: 40.6,
};

export interface ElementMetallurgy {
  structure: CrystalStructure | null;
  structureNote: string | null;
  allotropes: Allotrope[];
  lattice: Lattice | null;
  youngsModulusGPa: number | null;
  thermalConductivity: number | null;
}

export function getMetallurgy(symbol: string): ElementMetallurgy {
  return {
    structure: STRUCTURE[symbol] ?? null,
    structureNote: STRUCTURE_NOTE[symbol] ?? null,
    allotropes: ALLOTROPES[symbol] ?? [],
    lattice: LATTICE[symbol] ?? null,
    youngsModulusGPa: MODULUS[symbol] ?? null,
    thermalConductivity: CONDUCTIVITY[symbol] ?? null,
  };
}

export function getCrystalStructure(symbol: string): CrystalStructure | null {
  return STRUCTURE[symbol] ?? null;
}

export function formatLattice(l: Lattice): string {
  const parts = [`a ${l.a.toFixed(5).replace(/0+$/, "").replace(/\.$/, "")}`];
  if (l.b !== undefined) parts.push(`b ${l.b}`);
  if (l.c !== undefined) parts.push(`c ${l.c}`);
  return `${parts.join(", ")} nm`;
}

export function formatAllotropes(list: Allotrope[]): string {
  return list
    .map((p, i) => {
      const s = `${p.name} ${CRYSTAL_LABELS[p.structure]}${p.note ? ` (${p.note})` : ""}`;
      if (i === 0 || p.aboveC === null) return s;
      return `${s} > ${p.approx ? "≈" : ""}${p.aboveC} °C`;
    })
    .join(" → ");
}

/* ---------- Role in steel ---------- */

export type SteelRoleGroup = "austenite" | "ferrite" | "carbide" | "residual" | "other";

export const STEEL_ROLE_LABELS: Record<SteelRoleGroup, string> = {
  austenite: "Austenite stabiliser",
  ferrite: "Ferrite stabiliser",
  carbide: "Carbide former",
  residual: "Residual / harmful",
  other: "Other addition",
};

export const STEEL_ROLE_COLORS: Record<SteelRoleGroup, string> = {
  austenite: "#86efac",
  ferrite: "#93c5fd",
  carbide: "#fcd34d",
  residual: "#fca5a5",
  other: "#d8b4fe",
};

export type CarbideStrength = "strong" | "medium" | "weak";

export interface SteelRole {
  /** Tile tint group. */
  group: SteelRoleGroup;
  austeniteStabilizer: boolean;
  ferriteStabilizer: boolean;
  carbideFormer: CarbideStrength | null;
  nitrideFormer: boolean;
  deoxidizer: boolean;
  harmful: boolean;
  /** Typical content in steels, wt%. */
  typical: string;
  effects: string[];
  cautions: string[];
}

type RoleInit = Partial<Omit<SteelRole, "group" | "typical" | "effects" | "cautions">> &
  Pick<SteelRole, "group" | "typical" | "effects"> & { cautions?: string[] };

function role(r: RoleInit): SteelRole {
  return {
    austeniteStabilizer: false,
    ferriteStabilizer: false,
    carbideFormer: null,
    nitrideFormer: false,
    deoxidizer: false,
    harmful: false,
    cautions: [],
    ...r,
  };
}

const REM_ROLE = role({
  group: "other",
  deoxidizer: true,
  typical: "0.01–0.05 (as REM)",
  effects: ["Desulphurisation", "Sulphide shape control", "Oxide scale adherence (heat-resistant alloys)"],
});

export const STEEL_ROLES: Record<string, SteelRole> = {
  H: role({
    group: "residual",
    harmful: true,
    typical: "≤ 0.0002 (2 ppm, degassed)",
    effects: [],
    cautions: ["Hydrogen embrittlement", "Flakes in heavy sections", "Delayed (cold) cracking in welds"],
  }),
  B: role({
    group: "other",
    nitrideFormer: true,
    typical: "0.0005–0.003",
    effects: ["Large hardenability gain at ppm levels", "Effective only when protected from N (Ti, Al)"],
    cautions: ["Excess B reduces toughness and hot workability"],
  }),
  C: role({
    group: "austenite",
    austeniteStabilizer: true,
    typical: "0.02–2.1",
    effects: ["Strength and hardness", "Martensite hardness", "Hardenability"],
    cautions: ["Lowers weldability and toughness"],
  }),
  N: role({
    group: "austenite",
    austeniteStabilizer: true,
    typical: "0.003–0.02 (to ~0.5 in N-alloyed stainless)",
    effects: ["Strength in austenitic / duplex stainless", "Nitride precipitation with Al, V, Nb, Ti", "Pitting resistance (PREN)"],
    cautions: ["Strain ageing", "Free N lowers toughness"],
  }),
  O: role({
    group: "residual",
    harmful: true,
    typical: "≤ 0.003 (killed steel)",
    effects: [],
    cautions: ["Oxide inclusions", "Lower toughness and fatigue life"],
  }),
  Al: role({
    group: "ferrite",
    ferriteStabilizer: true,
    nitrideFormer: true,
    deoxidizer: true,
    typical: "0.02–0.06 (to ~1.5 nitriding steels)",
    effects: ["Strong deoxidiser (Al-killed)", "AlN grain-size control", "High surface hardness in nitriding steels"],
    cautions: ["Al₂O₃ clusters / nozzle clogging"],
  }),
  Si: role({
    group: "ferrite",
    ferriteStabilizer: true,
    deoxidizer: true,
    typical: "0.15–0.35 (to ~2 spring, ~3.5 electrical)",
    effects: ["Deoxidiser", "Solid-solution strengthening of ferrite", "Electrical resistivity (Si steels)", "Oxidation resistance"],
    cautions: ["Promotes decarburisation", "Lowers toughness at high levels"],
  }),
  P: role({
    group: "residual",
    ferriteStabilizer: true,
    harmful: true,
    typical: "≤ 0.04 (residual)",
    effects: ["Strength and machinability (rephosphorised)", "Atmospheric corrosion resistance (weathering)"],
    cautions: ["Temper embrittlement", "Cold shortness", "Strong segregation"],
  }),
  S: role({
    group: "residual",
    harmful: true,
    typical: "≤ 0.035 (0.08–0.35 free-machining)",
    effects: ["MnS improves machinability"],
    cautions: ["Hot shortness (FeS) if Mn is insufficient", "MnS stringers lower transverse ductility and toughness"],
  }),
  Ca: role({
    group: "other",
    deoxidizer: true,
    typical: "0.001–0.005",
    effects: ["Deoxidation and desulphurisation", "Inclusion shape control (globular)", "Modifies Al₂O₃ — better castability"],
  }),
  Ti: role({
    group: "carbide",
    ferriteStabilizer: true,
    carbideFormer: "strong",
    nitrideFormer: true,
    deoxidizer: true,
    typical: "0.01–0.1 (≥ 5×C in 321)",
    effects: ["TiN grain refinement", "Stabilises stainless against intergranular corrosion", "Protects B for hardenability"],
    cautions: ["Coarse TiN inclusions"],
  }),
  V: role({
    group: "carbide",
    ferriteStabilizer: true,
    carbideFormer: "strong",
    nitrideFormer: true,
    typical: "0.03–0.15 (to ~5 tool steels)",
    effects: ["Precipitation strengthening V(C,N)", "Grain refinement", "Secondary hardening, wear resistance"],
  }),
  Cr: role({
    group: "ferrite",
    ferriteStabilizer: true,
    carbideFormer: "medium",
    nitrideFormer: true,
    typical: "0.5–3 (10.5–30 stainless)",
    effects: ["Hardenability", "Corrosion resistance ≥ 10.5 %", "Oxidation resistance", "Temper resistance", "Wear-resistant carbides"],
    cautions: ["Sensitisation (Cr₂₃C₆) in stainless", "Sigma phase at high Cr"],
  }),
  Mn: role({
    group: "austenite",
    austeniteStabilizer: true,
    carbideFormer: "weak",
    deoxidizer: true,
    typical: "0.3–1.6 (11–14 Hadfield)",
    effects: ["Deoxidiser", "Ties S as MnS", "Hardenability and strength"],
    cautions: ["Segregation / banding", "Promotes temper embrittlement"],
  }),
  Co: role({
    group: "austenite",
    austeniteStabilizer: true,
    typical: "5–12 HSS (8–18 maraging)",
    effects: ["Hot (red) hardness in HSS", "Strength in maraging steels", "Raises Ms"],
    cautions: ["Lowers hardenability"],
  }),
  Ni: role({
    group: "austenite",
    austeniteStabilizer: true,
    typical: "0.3–5 (8–35 austenitic stainless)",
    effects: ["Low-temperature toughness", "Hardenability", "Austenite in stainless steels"],
  }),
  Cu: role({
    group: "austenite",
    austeniteStabilizer: true,
    typical: "≤ 0.3 residual (0.2–0.5 weathering, 3–5 PH)",
    effects: ["Atmospheric corrosion resistance", "Precipitation strengthening (17-4PH)"],
    cautions: ["Hot shortness (surface cracking), worse with Sn"],
  }),
  As: role({
    group: "residual",
    harmful: true,
    typical: "≤ 0.03 (residual)",
    effects: [],
    cautions: ["Temper embrittlement", "Segregation"],
  }),
  Se: role({
    group: "other",
    typical: "0.15–0.35 (free-machining stainless)",
    effects: ["Machinability (303Se)"],
  }),
  Zr: role({
    group: "carbide",
    carbideFormer: "strong",
    nitrideFormer: true,
    deoxidizer: true,
    typical: "0.01–0.1",
    effects: ["Sulphide shape control", "Fixes N", "Grain refinement"],
  }),
  Nb: role({
    group: "carbide",
    ferriteStabilizer: true,
    carbideFormer: "strong",
    nitrideFormer: true,
    typical: "0.01–0.05 (≥ 10×C in 347)",
    effects: ["Grain refinement (controlled rolling)", "Precipitation strengthening", "Stabilises stainless (347)"],
  }),
  Mo: role({
    group: "carbide",
    ferriteStabilizer: true,
    carbideFormer: "medium",
    typical: "0.15–0.5 (2–3 in 316, to ~10 HSS)",
    effects: ["Hardenability", "Creep strength", "Reduces temper embrittlement", "Pitting resistance in stainless", "Secondary hardening"],
  }),
  Sn: role({
    group: "residual",
    harmful: true,
    typical: "≤ 0.03 (residual)",
    effects: [],
    cautions: ["Temper embrittlement", "Hot shortness with Cu", "Lower hot ductility"],
  }),
  Sb: role({
    group: "residual",
    harmful: true,
    typical: "≤ 0.01 (residual)",
    effects: [],
    cautions: ["Temper embrittlement (strong)"],
  }),
  Te: role({
    group: "other",
    typical: "≤ 0.1 (free-machining)",
    effects: ["Machinability", "MnS shape control"],
    cautions: ["Hot shortness"],
  }),
  La: REM_ROLE,
  Ce: REM_ROLE,
  Ta: role({
    group: "carbide",
    carbideFormer: "strong",
    nitrideFormer: true,
    typical: "Minor, with Nb (347)",
    effects: ["Stabilises stainless like Nb", "Strong carbide former"],
  }),
  W: role({
    group: "carbide",
    ferriteStabilizer: true,
    carbideFormer: "medium",
    typical: "1–18 (tool / HSS)",
    effects: ["Hot hardness", "Secondary hardening", "Wear-resistant carbides", "Creep strength"],
  }),
  Pb: role({
    group: "other",
    typical: "0.15–0.35 (free-machining)",
    effects: ["Machinability"],
    cautions: ["Liquid-metal embrittlement", "Health / environmental restrictions"],
  }),
  Bi: role({
    group: "other",
    typical: "0.1–0.4 (Pb replacement)",
    effects: ["Machinability"],
    cautions: ["Hot shortness"],
  }),
};

export function getSteelRole(symbol: string): SteelRole | null {
  return STEEL_ROLES[symbol] ?? null;
}

/** Short chips for a steel role (used in table and detail panel). */
export function steelRoleTags(r: SteelRole): { label: string; group: SteelRoleGroup }[] {
  const tags: { label: string; group: SteelRoleGroup }[] = [];
  if (r.austeniteStabilizer) tags.push({ label: "γ stabiliser", group: "austenite" });
  if (r.ferriteStabilizer) tags.push({ label: "α stabiliser", group: "ferrite" });
  if (r.carbideFormer) tags.push({ label: `Carbide (${r.carbideFormer})`, group: "carbide" });
  if (r.nitrideFormer) tags.push({ label: "Nitride", group: "carbide" });
  if (r.deoxidizer) tags.push({ label: "Deoxidiser", group: "other" });
  if (r.harmful) tags.push({ label: "Residual / harmful", group: "residual" });
  if (tags.length === 0) tags.push({ label: STEEL_ROLE_LABELS[r.group], group: r.group });
  return tags;
}

export const STRUCTURE_COUNT = Object.keys(STRUCTURE).length;
export const STEEL_ROLE_COUNT = Object.keys(STEEL_ROLES).length;
