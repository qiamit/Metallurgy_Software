import { useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  ELEMENTS,
  formatDensity,
  formatTemp,
  formatTempInUnit,
  getPhaseAtTemp,
  getSpotlightPlacement,
  PHASE_LABELS,
  PHASE_MARKERS,
  PHASE_STYLES,
  searchElements,
  STP_TEMP_C,
  unitToCelsius,
  celsiusToUnit,
  type ElementCategory,
  type PeriodicElement,
  type TempUnit,
} from "@/features/periodic-table/elementsData";
import { ElementDetailPanel } from "@/features/periodic-table/ElementDetailPanel";
import {
  COLOR_MODE_LABELS,
  formatScaleValue,
  getLegend,
  getTileColor,
  HEAT_STOPS,
  type ColorMode,
} from "@/features/periodic-table/colorModes";
import {
  STEEL_ROLES,
  STEEL_ROLE_COLORS,
  steelRoleTags,
} from "@/features/periodic-table/metallurgyData";

function ElementCell({
  element,
  active,
  dimmed,
  tempC,
  colorMode,
  onSelect,
}: {
  element: PeriodicElement;
  active: boolean;
  dimmed: boolean;
  tempC: number;
  colorMode: ColorMode;
  onSelect: (el: PeriodicElement) => void;
}) {
  const phase = getPhaseAtTemp(element, tempC);
  const phaseStyle = PHASE_STYLES[phase];
  const tile = getTileColor(element, colorMode, tempC);
  const noData = tile.fill === null;

  return (
    <button
      type="button"
      className={`pt-element pt-element-phase-${phase} ${noData ? "pt-element-nodata" : ""} ${active ? "pt-element-active" : ""} ${dimmed ? "pt-element-dimmed" : ""}`}
      style={{
        backgroundColor: tile.fill ?? undefined,
        gridRow: element.gridRow,
        gridColumn: element.gridCol,
        borderColor: tile.border,
      }}
      onClick={() => onSelect(element)}
      title={`${element.number} ${element.name} — ${PHASE_LABELS[phase]} at ${formatTempInUnit(tempC, "C")}`}
    >
      <span className="pt-element-number">{element.number}</span>
      <span
        className="pt-element-phase-badge"
        style={{ backgroundColor: "#fff", borderColor: phaseStyle.border, color: "#0f172a" }}
      >
        {PHASE_MARKERS[phase]}
      </span>
      <span className="pt-element-symbol">{element.symbol}</span>
      <span className="pt-element-name">{element.name}</span>
      <span className="pt-element-mass">{element.mass}</span>
      <span className="pt-element-meta">
        P{element.period} · G{element.group}
        {element.electronegativity !== null ? ` · χ${element.electronegativity}` : ""}
      </span>
    </button>
  );
}

function ElementSpotlight({
  element,
  tempC,
  onOpenDetail,
}: {
  element: PeriodicElement;
  tempC: number;
  onOpenDetail: () => void;
}) {
  const bg = CATEGORY_COLORS[element.category];
  const phase = getPhaseAtTemp(element, tempC);
  const phaseStyle = PHASE_STYLES[phase];
  const placement = getSpotlightPlacement();
  const slotStyle = {
    gridRow: placement.gridRow,
    gridColumn: placement.gridColumn,
  };
  const accentStyle = { borderColor: phaseStyle.border };

  return (
    <div className="pt-spotlight-slot" style={slotStyle}>
      <div
        className="pt-spotlight pt-spotlight-compact"
        style={{ ...accentStyle, backgroundColor: bg }}
      >
        <div className="pt-spotlight-compact-head">
          <div className="pt-spotlight-compact-identity">
            <span className="pt-spotlight-number">{element.number}</span>
            <span className="pt-spotlight-symbol">{element.symbol}</span>
            <span className="pt-spotlight-name">{element.name}</span>
          </div>
          <span
            className="pt-spotlight-phase-pill"
            style={{
              borderColor: phaseStyle.border,
              backgroundColor: "rgba(255, 255, 255, 0.82)",
            }}
          >
            <strong>{PHASE_MARKERS[phase]}</strong>
            {PHASE_LABELS[phase]}
          </span>
        </div>

        <dl className="pt-spotlight-compact-stats">
          <div className="pt-spotlight-stat-cell">
            <dt>Mass</dt>
            <dd>{element.mass}</dd>
          </div>
          <div className="pt-spotlight-stat-cell">
            <dt>Phase</dt>
            <dd>{PHASE_LABELS[phase]}</dd>
          </div>
          <div className="pt-spotlight-stat-cell">
            <dt>Melt</dt>
            <dd>{formatTemp(element.meltingPointC)}</dd>
          </div>
          <div className="pt-spotlight-stat-cell">
            <dt>Boil</dt>
            <dd>{formatTemp(element.boilingPointC)}</dd>
          </div>
          <div className="pt-spotlight-stat-cell">
            <dt>Density</dt>
            <dd>{formatDensity(element.density)}</dd>
          </div>
          <div className="pt-spotlight-stat-cell pt-spotlight-stat-cell-config">
            <dt>Config</dt>
            <dd>{element.electronConfiguration}</dd>
          </div>
        </dl>

        <button type="button" className="pt-spotlight-cta" onClick={onOpenDetail}>
          Properties &amp; Metallurgy
        </button>
      </div>
    </div>
  );
}

export function PeriodicTable() {
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ElementCategory | null>(null);
  const [tempC, setTempC] = useState(STP_TEMP_C);
  const [tempUnit, setTempUnit] = useState<TempUnit>("C");
  const [colorMode, setColorMode] = useState<ColorMode>("category");
  const gridRef = useRef<HTMLDivElement>(null);
  const legend = useMemo(() => getLegend(colorMode), [colorMode]);
  const steelRows = useMemo(
    () => ELEMENTS.filter((el) => STEEL_ROLES[el.symbol] !== undefined),
    [],
  );

  const displayTemp = useMemo(
    () => Math.round(celsiusToUnit(tempC, tempUnit) * 10) / 10,
    [tempC, tempUnit],
  );

  function selectElement(element: PeriodicElement) {
    setSelected(element);
    setDetailOpen(false);
  }

  function selectFromTable(element: PeriodicElement) {
    selectElement(element);
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function openDetail() {
    setDetailOpen(true);
  }

  function closeDetail() {
    setDetailOpen(false);
  }

  const matches = useMemo(() => {
    const found = searchElements(search);
    return new Set(found.map((el) => el.number));
  }, [search]);

  const hasFilter = search.trim().length > 0 || categoryFilter !== null;

  function isDimmed(el: PeriodicElement) {
    if (categoryFilter && el.category !== categoryFilter) return true;
    if (search.trim() && !matches.has(el.number)) return true;
    return false;
  }

  function onCategoryChange(value: string) {
    setCategoryFilter(value ? (value as ElementCategory) : null);
  }

  function onTempSliderChange(value: number) {
    setTempC(Math.round(value));
  }

  function onTempInputChange(value: string) {
    const num = Number(value);
    if (Number.isNaN(num)) return;
    setTempC(Math.round(unitToCelsius(num, tempUnit)));
  }

  function onTempUnitChange(unit: TempUnit) {
    setTempUnit(unit);
  }

  return (
    <div className="pt-shell">
      <div className="pt-toolbar">
        <h1 className="page-title pt-toolbar-title">Periodic Table</h1>

        <div className="pt-toolbar-controls">
          <div className="pt-search-wrap">
            <Search size={16} className="text-[var(--muted)] shrink-0" />
            <input
              className="pt-search input"
              type="search"
              placeholder="Search by Name, Symbol, or Atomic Number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="pt-search-clear" onClick={() => setSearch("")}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className="pt-category-filter">
            <label className="sr-only" htmlFor="pt-color-select">
              Colour by
            </label>
            <select
              id="pt-color-select"
              className="input pt-category-select"
              value={colorMode}
              onChange={(e) => setColorMode(e.target.value as ColorMode)}
            >
              {(Object.keys(COLOR_MODE_LABELS) as ColorMode[]).map((mode) => (
                <option key={mode} value={mode}>
                  Colour: {COLOR_MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-category-filter">
            <label className="sr-only" htmlFor="pt-category-select">
              Element Category
            </label>
            <select
              id="pt-category-select"
              className="input pt-category-select"
              value={categoryFilter ?? ""}
              onChange={(e) => onCategoryChange(e.target.value)}
            >
              <option value="">All Categories</option>
              {(Object.keys(CATEGORY_LABELS) as ElementCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {hasFilter && (
            <button
              type="button"
              className="btn btn-ghost text-xs py-1 px-2 shrink-0"
              onClick={() => {
                setSearch("");
                setCategoryFilter(null);
              }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="pt-layout">
        <div className="pt-grid-wrap card overflow-x-auto">
          <div className="pt-temp-bar">
            <label className="pt-temp-label shrink-0" htmlFor="pt-temp-slider">
              Temperature
            </label>
            <input
              id="pt-temp-slider"
              className="pt-temp-slider"
              type="range"
              min={-273}
              max={6000}
              step={1}
              value={tempC}
              onChange={(e) => onTempSliderChange(Number(e.target.value))}
            />
            <input
              className="input pt-temp-input shrink-0"
              type="number"
              value={displayTemp}
              onChange={(e) => onTempInputChange(e.target.value)}
            />
            <select
              className="input pt-temp-unit shrink-0"
              value={tempUnit}
              onChange={(e) => onTempUnitChange(e.target.value as TempUnit)}
            >
              <option value="C">°C</option>
              <option value="F">°F</option>
              <option value="K">K</option>
            </select>
            <button
              type="button"
              className="btn btn-ghost text-xs py-1 px-2 shrink-0"
              onClick={() => setTempC(STP_TEMP_C)}
            >
              Reset STP
            </button>

          </div>

          <div className="pt-legend" aria-label={`Legend: ${COLOR_MODE_LABELS[colorMode]}`}>
            {legend.kind === "scale" ? (
              <span className="pt-legend-scale">
                <span>{formatScaleValue(legend.min)}</span>
                <span
                  className="pt-legend-gradient"
                  style={{ backgroundImage: `linear-gradient(to right, ${HEAT_STOPS.join(", ")})` }}
                />
                <span>
                  {formatScaleValue(legend.max)} {legend.unit}
                </span>
              </span>
            ) : (
              legend.items.map((item) => (
                <span key={item.label} className="pt-phase-legend-item">
                  <span
                    className="pt-phase-legend-swatch"
                    style={{
                      backgroundColor: item.color,
                      borderColor: item.border ?? "rgba(15, 23, 42, 0.25)",
                    }}
                  />
                  {item.label}
                </span>
              ))
            )}
            {(legend.kind === "scale" || legend.noData) && (
              <span className="pt-phase-legend-item">
                <span className="pt-phase-legend-swatch pt-legend-nodata" />
                No data
              </span>
            )}
          </div>

          <div className="pt-grid" ref={gridRef}>
            <div className="pt-series-label" style={{ gridRow: 6, gridColumn: 3 }}>
              57–71
            </div>
            <div className="pt-series-label" style={{ gridRow: 7, gridColumn: 3 }}>
              89–103
            </div>

            {selected && (
              <ElementSpotlight
                element={selected}
                tempC={tempC}
                onOpenDetail={openDetail}
              />
            )}

            {ELEMENTS.map((el) => (
              <ElementCell
                key={el.number}
                element={el}
                active={selected?.number === el.number}
                dimmed={isDimmed(el)}
                tempC={tempC}
                colorMode={colorMode}
                onSelect={selectElement}
              />
            ))}
          </div>

          {detailOpen && selected && (
            <div
              className="pt-modal-overlay"
              role="presentation"
              onClick={closeDetail}
            >
              <div
                className="pt-modal-panel"
                role="dialog"
                aria-modal="true"
                aria-label={`${selected.name} details`}
                onClick={(e) => e.stopPropagation()}
              >
                <ElementDetailPanel
                  element={selected}
                  tempC={tempC}
                  onClose={closeDetail}
                />
              </div>
            </div>
          )}
        </div>

        {colorMode === "steel" && (
          <div className="card pt-steel-card">
            <h2 className="section-title">Alloying Elements in Steel</h2>
            <div className="pt-steel-scroll">
              <table className="pt-steel-table">
                <thead className="table-head">
                  <tr>
                    <th>Element</th>
                    <th>Role</th>
                    <th>Typical wt%</th>
                    <th>Key effects</th>
                  </tr>
                </thead>
                <tbody>
                  {steelRows.map((el) => {
                    const r = STEEL_ROLES[el.symbol];
                    const active = selected?.number === el.number;
                    return (
                      <tr
                        key={el.number}
                        className={active ? "pt-steel-row-active" : undefined}
                        tabIndex={0}
                        onClick={() => selectFromTable(el)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            selectFromTable(el);
                          }
                        }}
                      >
                        <td className="pt-steel-el">
                          <span
                            className="pt-steel-symbol"
                            style={{ backgroundColor: STEEL_ROLE_COLORS[r.group] }}
                          >
                            {el.symbol}
                          </span>
                          {el.name}
                        </td>
                        <td>
                          <span className="pt-role-tags">
                            {steelRoleTags(r).map((t) => (
                              <span key={t.label} className="pt-role-tag">
                                <i style={{ backgroundColor: STEEL_ROLE_COLORS[t.group] }} />
                                {t.label}
                              </span>
                            ))}
                          </span>
                        </td>
                        <td className="pt-steel-typical">{r.typical}</td>
                        <td>{[...r.effects, ...r.cautions].slice(0, 3).join("; ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
