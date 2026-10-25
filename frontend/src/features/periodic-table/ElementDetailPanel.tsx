import { X } from "lucide-react";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatDensity,
  formatTemp,
  formatTempInUnit,
  getPhaseAtTemp,
  getPhaseTransitionNote,
  isMetalCategory,
  PHASE_LABELS,
  PHASE_STYLES,
  type ElementCategory,
  type PeriodicElement,
} from "@/features/periodic-table/elementsData";
import {
  CRYSTAL_LABELS,
  formatLattice,
  getMetallurgy,
  getSteelRole,
  STEEL_ROLE_COLORS,
  steelRoleTags,
} from "@/features/periodic-table/metallurgyData";

export type ElementDetailViewMode = "properties" | "metallurgy";

function getMaterialClass(category: ElementCategory): string {
  if (isMetalCategory(category)) return "Metal";
  if (category === "metalloid") return "Metalloid";
  if (category === "nonmetal" || category === "halogen" || category === "noble-gas") {
    return "Nonmetal";
  }
  return "Unknown";
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="pt-detail-fact">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`pt-detail-section${wide ? " pt-detail-section-wide" : ""}`}>
      <h3 className="pt-detail-section-title">{title}</h3>
      {children}
    </section>
  );
}

function MetallurgySection({ element }: { element: PeriodicElement }) {
  const m = getMetallurgy(element.symbol);
  const role = getSteelRole(element.symbol);
  const structure = m.structure
    ? `${CRYSTAL_LABELS[m.structure]}${m.structureNote ? ` (${m.structureNote})` : ""}`
    : "—";

  return (
    <DetailSection title="Metallurgy" wide>
      <dl className="pt-detail-facts pt-detail-facts-4">
        <DetailFact label="Crystal Structure (RT)" value={structure} />
        <DetailFact label="Lattice Parameter" value={m.lattice ? formatLattice(m.lattice) : "—"} />
        <DetailFact
          label="Young's Modulus"
          value={m.youngsModulusGPa !== null ? `${m.youngsModulusGPa} GPa` : "—"}
        />
        <DetailFact
          label="Thermal Conductivity"
          value={m.thermalConductivity !== null ? `${m.thermalConductivity} W/m·K` : "—"}
        />
      </dl>

      {m.allotropes.length > 0 && (
        <div className="pt-detail-block">
          <div className="pt-detail-block-label">Allotropes</div>
          <ul className="pt-allotropes">
            {m.allotropes.map((a, i) => (
              <li key={a.name}>
                <strong>{a.name}</strong>
                <span>
                  {CRYSTAL_LABELS[a.structure]}
                  {a.note ? ` (${a.note})` : ""}
                </span>
                <span className="pt-allotrope-temp">
                  {a.aboveC !== null
                    ? `> ${a.approx ? "≈" : ""}${a.aboveC.toLocaleString()} °C`
                    : i === 0
                      ? "RT"
                      : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {role && (
        <div className="pt-detail-block">
          <div className="pt-detail-block-label">Role in Steel</div>
          <div className="pt-role-tags">
            {steelRoleTags(role).map((t) => (
              <span key={t.label} className="pt-role-tag">
                <i style={{ backgroundColor: STEEL_ROLE_COLORS[t.group] }} />
                {t.label}
              </span>
            ))}
            <span className="pt-role-tag pt-role-typical">Typical {role.typical} wt%</span>
          </div>
          {role.effects.length > 0 && (
            <ul className="pt-detail-bullets">
              {role.effects.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {role.cautions.length > 0 && (
            <ul className="pt-detail-bullets pt-detail-bullets-warn">
              {role.cautions.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ul className="pt-detail-bullets">
        <li>{element.metallurgyNote}</li>
      </ul>
    </DetailSection>
  );
}

export function ElementDetailBody({
  element,
  tempC,
}: {
  element: PeriodicElement;
  tempC: number;
}) {
  const phase = getPhaseAtTemp(element, tempC);
  const phaseStyle = PHASE_STYLES[phase];
  const transitionNote = getPhaseTransitionNote(element, tempC);
  const stpPhase =
    element.phase === "unknown"
      ? "Unknown"
      : element.phase.charAt(0).toUpperCase() + element.phase.slice(1);

  return (
    <div className="pt-detail-sheet-sections">
      <DetailSection title="Temperature & Phase">
        <div className="pt-detail-phase-banner">
          <span
            className={`pt-detail-phase-chip pt-detail-phase-chip-${phase}`}
            style={{ borderColor: phaseStyle.border }}
          >
            {PHASE_LABELS[phase]} at {formatTempInUnit(tempC, "C")}
          </span>
          <span className="pt-detail-phase-note">{transitionNote}</span>
        </div>
        <dl className="pt-detail-facts pt-detail-facts-3">
          <DetailFact label="Phase (STP)" value={stpPhase} />
          <DetailFact label="Phase at T" value={PHASE_LABELS[phase]} />
          <DetailFact label="Temperature" value={formatTempInUnit(tempC, "C")} />
        </dl>
      </DetailSection>

      <DetailSection title="Classification">
        <dl className="pt-detail-facts pt-detail-facts-3">
          <DetailFact label="Element Category" value={CATEGORY_LABELS[element.category]} />
          <DetailFact label="Material Class" value={getMaterialClass(element.category)} />
          <DetailFact label="Block" value={`${element.block.toUpperCase()}-Block`} />
          <DetailFact label="Period" value={String(element.period)} />
          <DetailFact label="Group" value={String(element.group)} />
          <DetailFact label="Atomic Number" value={String(element.number)} />
        </dl>
      </DetailSection>

      <DetailSection title="Physical Properties">
        <dl className="pt-detail-facts pt-detail-facts-3">
          <DetailFact label="Atomic Mass" value={element.mass} />
          <DetailFact label="Density" value={formatDensity(element.density)} />
          <DetailFact label="Melting Point" value={formatTemp(element.meltingPointC)} />
          <DetailFact label="Boiling Point" value={formatTemp(element.boilingPointC)} />
        </dl>
      </DetailSection>

      <DetailSection title="Chemical & Electronic">
        <dl className="pt-detail-facts pt-detail-facts-2">
          <DetailFact
            label="Electronegativity (Pauling)"
            value={
              element.electronegativity !== null ? String(element.electronegativity) : "—"
            }
          />
          <DetailFact label="Electron Configuration" value={element.electronConfiguration} />
        </dl>
      </DetailSection>

      <DetailSection title="Discovery">
        <dl className="pt-detail-facts pt-detail-facts-2">
          <DetailFact label="Year Discovered" value={element.discovered} />
          <DetailFact label="Element Name" value={element.name} />
        </dl>
      </DetailSection>

      <MetallurgySection element={element} />

      <DetailSection title="Table Position">
        <dl className="pt-detail-facts pt-detail-facts-4">
          <DetailFact label="Grid Row" value={String(element.gridRow)} />
          <DetailFact label="Grid Column" value={String(element.gridCol)} />
          <DetailFact label="Symbol" value={element.symbol} />
          <DetailFact label="Standard Phase Marker" value={PHASE_LABELS[element.phase]} />
        </dl>
      </DetailSection>
    </div>
  );
}

export function ElementDetailPanel({
  element,
  tempC,
  onClose,
}: {
  element: PeriodicElement;
  tempC: number;
  onClose?: () => void;
  /** @deprecated Tabs removed — all sections shown at once */
  view?: ElementDetailViewMode;
  /** @deprecated Tabs removed */
  onViewChange?: (view: ElementDetailViewMode) => void;
}) {
  const bg = CATEGORY_COLORS[element.category];
  const phase = getPhaseAtTemp(element, tempC);

  return (
    <div className="pt-detail-sheet">
      <header className="pt-detail-sheet-hero" style={{ backgroundColor: bg }}>
        <div className="pt-detail-sheet-hero-main">
          <span className="pt-detail-sheet-number">{element.number}</span>
          <div>
            <div className="pt-detail-sheet-symbol">{element.symbol}</div>
            <div className="pt-detail-sheet-name">{element.name}</div>
          </div>
        </div>
        <div className="pt-detail-sheet-hero-meta">
          <span className="pt-detail-sheet-category">{CATEGORY_LABELS[element.category]}</span>
          <span className={`pt-detail-sheet-phase pt-detail-sheet-phase-${phase}`}>
            {PHASE_LABELS[phase]} · {formatTempInUnit(tempC, "C")}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            className="pt-detail-sheet-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        )}
      </header>

      <div className="pt-detail-sheet-body">
        <ElementDetailBody element={element} tempC={tempC} />
      </div>
    </div>
  );
}
