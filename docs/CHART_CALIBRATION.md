# Chart calibration and testing (2026-10-25)

The lab's 17 standard charts (Madras Metallurgical Services prints of ASTM / ISO / IS charts,
`Qirlpl Testing Lab/Metallurgical Charts/Scan-0122 … Scan-0138.pdf`) were used to calibrate and test every
image-analysis module. The scans are copyrighted and are **not** stored in this repository; the repository tests use
synthetic images with exactly known geometry instead. The chart harness scripts read the charts from the lab folder.

## Chart inventory

| Scan | Content | Used for |
|---|---|---|
| 0129 | ASTM E112 Plate I-B, untwinned grains, 100×, G 3.0–10.0 | Grain size calibration (primary) |
| 0130 | ASTM E112 Plate I-A, untwinned grains, 100×, G 00–2.5 | Trend check only (see note) |
| 0132 | ASTM E112 Plate IV, austenite grains (McQuaid-Ehn), 100×, No. 1–8 | Grain size on real photomicrographs |
| 0134 | ASTM E112 Plate II, twinned grains (flat etch), 100× | Reference (twins not separated) |
| 0133 | ASTM E112 Plate III, twinned grains (contrast etch), 75× | Reference |
| 0128 | ASTM E1181 duplex grain sizes, 5–50 % coarse area | Duplex area measurement |
| 0123 | ASTM E45 Plate I-r (JK chart), A/B/C/D thin & heavy, ½–3 | Inclusion rating calibration (primary) |
| 0125, 0126 | ISO 4967 / IS 4163 inclusion charts (circular fields) | Severity limits cross-check |
| 0124 | ASTM E45 Plate II (oxide / silicate 1–8) | Reference |
| 0122 | Ductile iron casting quality control (graphite types, nodularity %, nodule size, matrix) | Nodularity calibration |
| 0135 | ASTM A247 graphite rating: form I–VII, distribution, flake size 2–8, nodule size 4–7 | Nodule size, graphite form |
| 0138 | ASTM A247 Plate I flake size 1–8 (drawn + photos), Plate II flake types A–E | Flake size calibration |
| 0136 | Grey iron rating chart: graphite types A–F, size, % pearlite, carbides | Reference / AI prompt |
| 0137 | SG iron casting defects atlas | Reference (qualitative) |
| 0127 | ASTM E140 hardness conversion tables (hardened and soft) | Hardness Conversion module data |
| 0131 | Fe–Fe₃C phase diagram | Fe–C Phase Diagram module |

## Method

1. Each chart PDF holds one ~300 dpi scan (≈ 10,700 px wide); the embedded image was extracted, not re-rendered.
2. Reference fields were cropped automatically (frame / circle detection) and their scale derived from the chart
   itself: E112 plates from the 79.8 mm reference circle (0.798 mm at 100×), E45 from the 71 mm field square
   (0.71 mm at 100×). Charts without a printed scale (A247 panels) were tested with a single fitted print scale per
   chart — one free parameter for 4–8 known classes.
3. The **production** functions-service code (OpenCV.js) measured every field; results compared with chart labels.

## Results

### Grain size — ASTM E112-13 / ISO 643

| Reference | Old algorithm (before) | New algorithm |
|---|---|---|
| E112 Plate I-B, G 3.0–10.0 (15 fields) | intercept **+1.5 G**, planimetric **+4.2 G** | intercept **0.19 G** mean error (max 0.74), planimetric 0.25 G |
| E112 Plate IV No. 3–8 (photos) | — | within **±0.7 G** |
| E112 Plate IV No. 1–2 (very coarse, martensitic) | — | **+3 G** — limitation, see below |

Fixes: the old planimetric formula (`log2(N_A) + 1`) was wrong — now ASTM E112-13 `G = 3.3219·log10(N_A) − 2.954`;
the intercept constants were updated to E112-13 (`−6.6439·log10 ℓ − 3.288`); boundaries are found as the thin phase
with a width-matched top-hat (edge detection counted both sides of each line); isolated needles are dropped; the
image is analysed at a resolution where a grain spans ~40 px.

Limitations: heavy texture inside very coarse grains (martensite needles in Plate IV No. 1–2) still raises G — the
overlay must be checked. Plate I-A on this poster does not keep E112's grain-to-circle ratio (both methods read
+2.3 G consistently), so it was used only as a trend check. The duplex flag (≥ 10 % of grain area ≥ 3 G coarser) can
fire where the boundary network has gaps (seen on IB G10, IV No. 6 and 8) and is labelled "suspected".
E1181 chart: coarse-area measurement within ±4 percentage points (5→5, 15→14, 30→33, 50→53 %).

### Inclusion rating — ISO 4967:2013 Method A / ASTM E45 Method A

| Reference | Result |
|---|---|
| E45 Plate I-r, 48 fields (A/B/C/D × thin/heavy × ½–3) | severity **within ±½ on 48/48**, exact on 33/48 |

Severity limits (minimum values, µm per 0.50 mm²): A 37/127/261/436/649/898, B 17/77/184/343/555/822,
C 18/76/176/320/510/746, D 1/4/9/16/25/36 particles, DS 13/19/27/38/53/76 µm. Particles within 40 µm along and
10 µm across the rolling direction form one inclusion; ≥ 3 low-aspect particles in a line form a B stringer.
Limitations: the poster prints A/B/C lines ~1.5–2× thicker than E45 specifies (D dots are true to size), so the
thin/heavy split could not be calibrated from this chart (25/48); ISO width limits are used. A vs C is decided by
particle tone (sulphides mid-grey, silicates dark) — on the black-printed chart both read as dark.

### Nodularity — ISO 945-4 / ASTM E2567 / A247 (new module)

| Reference | Result |
|---|---|
| Chart 0122 nodularity >90 / 85 / 75 / 55 / 30 / <10 % | 92 / 73 / 56 / 57 / 19 / 10 % — mean error 7.5 points |
| A247 nodule size class 4–7 (chart 0135) | **4/4** with one print scale; class-to-class size ratio 2.4 / 1.8 / 2.0 (nominal 2.0) |
| A247 graphite form I–VII | I 86 %, II 84 %, III 26 %, IV 13 %, V 21 %, VI 39 %, VII 1 % nodular — correct ordering |

Nodular = roundness `4A/(π·Fmax²)` ≥ 0.60 (E2567); particles < 10 µm ignored. The 85/75/30 % fields read lower —
those chart values look like visual estimates (the method agrees exactly at 92, 55 and 8 %).

### Graphite flake size — ASTM A247 (new module)

| Reference | Result |
|---|---|
| A247 Plate I (drawn), size 1–8 | classes 3–6 correct; 1–2 flakes run off the field (now reported as "class X or coarser"); 7–8 crowded flakes merge |
| Chart 0135 flake-size photos | not usable — small half-tone thumbnails |

### Hardness conversion — ASTM E140 (new module)

Both tables of chart 0127 were transcribed (hardened: HRC 80–20, 11 scales; soft: HRB 100–0, 14 scales). Every
column was checked for monotonic order (0 errors). Values between rows are interpolated linearly; no extrapolation.

### Fe–C phase diagram (new module)

Key points from chart 0131 (727 °C / 0.77 % C, 1148 °C / 4.30 % C, 2.11 % C, 6.67 % Fe₃C, 912 / 1394 / 1538 °C).
Gives the phase field at any %C / temperature, A₃ / A_cm, lever-rule pearlite / proeutectoid fractions, and a carbon
estimate from pearlite area (also shown on Micro analysis results).

## Re-running

```bash
# synthetic, repository-only tests (run in CI)
npm test --prefix backend/functions

# chart harness against the lab's scans (scans stay outside git)
tools/chart-calibration/run.sh "<…/Qirlpl Testing Lab/Metallurgical Charts>"
```
