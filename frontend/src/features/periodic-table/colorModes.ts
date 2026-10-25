import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  ELEMENTS,
  getPhaseAtTemp,
  PHASE_LABELS,
  PHASE_STYLES,
  type ElementCategory,
  type ElementPhase,
  type PeriodicElement,
} from "@/features/periodic-table/elementsData";
import {
  CRYSTAL_COLORS,
  CRYSTAL_LABELS,
  getCrystalStructure,
  getSteelRole,
  STEEL_ROLE_COLORS,
  STEEL_ROLE_LABELS,
  type CrystalStructure,
  type SteelRoleGroup,
} from "@/features/periodic-table/metallurgyData";

export type ColorMode =
  | "category"
  | "phase"
  | "melting"
  | "density"
  | "electronegativity"
  | "structure"
  | "steel";

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  category: "Category",
  phase: "Phase at temperature",
  melting: "Melting point",
  density: "Density",
  electronegativity: "Electronegativity",
  structure: "Crystal structure",
  steel: "Steel alloying role",
};

type NumericMode = "melting" | "density" | "electronegativity";

const NUMERIC: Record<NumericMode, { get: (el: PeriodicElement) => number | null; unit: string }> = {
  melting: { get: (el) => el.meltingPointC, unit: "°C" },
  density: { get: (el) => el.density, unit: "g/cm³" },
  electronegativity: { get: (el) => el.electronegativity, unit: "Pauling" },
};

function isNumericMode(mode: ColorMode): mode is NumericMode {
  return mode === "melting" || mode === "density" || mode === "electronegativity";
}

const RANGES: Record<NumericMode, { min: number; max: number }> = (() => {
  const out = {} as Record<NumericMode, { min: number; max: number }>;
  (Object.keys(NUMERIC) as NumericMode[]).forEach((mode) => {
    const values = ELEMENTS.map(NUMERIC[mode].get).filter((v): v is number => v !== null);
    out[mode] = { min: Math.min(...values), max: Math.max(...values) };
  });
  return out;
})();

/** Light sequential scale so dark tile text stays readable. */
export const HEAT_STOPS = ["#f5f9d2", "#fde68a", "#fdba74", "#fb923c", "#f87171"];

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function heatColor(t: number): string {
  const x = Math.min(1, Math.max(0, t)) * (HEAT_STOPS.length - 1);
  const i = Math.min(HEAT_STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = hexToRgb(HEAT_STOPS[i]);
  const b = hexToRgb(HEAT_STOPS[i + 1]);
  const mix = a.map((v, k) => Math.round(v + (b[k] - v) * f));
  return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
}

export interface TileColor {
  /** null = no data for this mode. */
  fill: string | null;
  border?: string;
}

export function getTileColor(el: PeriodicElement, mode: ColorMode, tempC: number): TileColor {
  if (mode === "category") return { fill: CATEGORY_COLORS[el.category] };
  if (mode === "phase") {
    const s = PHASE_STYLES[getPhaseAtTemp(el, tempC)];
    return { fill: s.fill, border: s.border };
  }
  if (isNumericMode(mode)) {
    const v = NUMERIC[mode].get(el);
    if (v === null) return { fill: null };
    const { min, max } = RANGES[mode];
    return { fill: heatColor(max === min ? 0 : (v - min) / (max - min)) };
  }
  if (mode === "structure") {
    const s = getCrystalStructure(el.symbol);
    return { fill: s ? CRYSTAL_COLORS[s] : null };
  }
  const r = getSteelRole(el.symbol);
  return { fill: r ? STEEL_ROLE_COLORS[r.group] : null };
}

export type Legend =
  | { kind: "swatches"; items: { label: string; color: string; border?: string }[]; noData: boolean }
  | { kind: "scale"; min: number; max: number; unit: string };

export function getLegend(mode: ColorMode): Legend {
  if (mode === "category") {
    return {
      kind: "swatches",
      noData: false,
      items: (Object.keys(CATEGORY_LABELS) as ElementCategory[]).map((c) => ({
        label: CATEGORY_LABELS[c],
        color: CATEGORY_COLORS[c],
      })),
    };
  }
  if (mode === "phase") {
    return {
      kind: "swatches",
      noData: false,
      items: (Object.keys(PHASE_LABELS) as ElementPhase[]).map((p) => ({
        label: PHASE_LABELS[p],
        color: PHASE_STYLES[p].fill,
        border: PHASE_STYLES[p].border,
      })),
    };
  }
  if (isNumericMode(mode)) {
    return { kind: "scale", ...RANGES[mode], unit: NUMERIC[mode].unit };
  }
  if (mode === "structure") {
    return {
      kind: "swatches",
      noData: true,
      items: (Object.keys(CRYSTAL_LABELS) as CrystalStructure[]).map((s) => ({
        label: CRYSTAL_LABELS[s],
        color: CRYSTAL_COLORS[s],
      })),
    };
  }
  return {
    kind: "swatches",
    noData: true,
    items: (Object.keys(STEEL_ROLE_LABELS) as SteelRoleGroup[]).map((g) => ({
      label: STEEL_ROLE_LABELS[g],
      color: STEEL_ROLE_COLORS[g],
    })),
  };
}

export function formatScaleValue(v: number): string {
  if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
  return Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : String(Math.round(v * 100) / 100);
}
