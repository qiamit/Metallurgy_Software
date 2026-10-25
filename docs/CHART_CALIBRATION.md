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

| Reference | Original | First calibration | Revision 2 (watershed) |
|---|---|---|---|
| E112 Plate I-B, G 3.0–10.0 (15 fields) | intercept **+1.5 G**, planimetric **+4.2 G** | 0.19 G mean (max 0.74), planimetric 0.25 | **0.17 G** mean (max 0.49), planimetric **0.12** |
| E112 Plate IV No. 3–8 (photos) | — | within ±0.7 G | within **±0.8 G** (No. 8: 7.99, No. 6: 5.22) |
| E112 Plate IV No. 1–2 (martensite needles) | — | +3 G (needles counted as boundaries) | 3.56 / 4.30 — see printing note |
| Duplex false flags on uniform plates | — | IB G10, IV No. 6, IV No. 8 | **none** (largest 9.6 %, below the 10 % limit) |

Method (revision 2): boundaries are now closed by **marker-controlled watershed**. The boundary mask (top-hat
of the thin phase, Otsu) gives a distance map of grain interiors; each distance peak that is separated from a
higher peak by a saddle below 70 % of its height becomes one seed (an etch gap is a narrow waist, so the two
grains on either side keep separate seeds). The smoothed image is flooded from the seeds. Needles and carbides
inside a grain lie in one basin and add no boundary; boundary-mask pieces 16–64 px are kept only when they
enclose a grain (network fragments do, needles do not). Very fine grains are analysed above native resolution
(up to 2×). The duplex reference size ignores boundary slivers (< 2.5 boundary widths across).

Printing note: on this poster Plate IV No. 1–2 and Plate I-A read about +2.3 G with every method, and their
circles are printed at a different pixel scale from the other panels; a manual count of the No. 1 crop gives
~20 grains where E112 G 1 would have ~4. After the watershed change the No. 1–2 overlays trace the visible
boundaries correctly, so the remaining offset is the print, not the algorithm.

E1181 duplex chart (0128): it is a schematic — coarse grains are drawn as blank white islands — not a
micrograph, so it cannot be measured with the grain analyser (earlier ±4 % figures came from a separate
prototype). The duplex flag was checked on the uniform plates (no false flags) instead.

Remaining limitation: twin boundaries (Plates II / III) are not separated from grain boundaries.

### Inclusion rating — ISO 4967:2013 Method A / ASTM E45 Method A

| Reference | Result |
|---|---|
| E45 Plate I-r, 48 fields (A/B/C/D × thin/heavy × ½–3) | severity **within ±½ on 48/48**, exact on 33/48 |

Severity limits (minimum values, µm per 0.50 mm²): A 37/127/261/436/649/898, B 17/77/184/343/555/822,
C 18/76/176/320/510/746, D 1/4/9/16/25/36 particles, DS 13/19/27/38/53/76 µm. Particles within 40 µm along and
10 µm across the rolling direction form one inclusion; ≥ 3 low-aspect particles in a line form a B stringer.
Thin / heavy (revision 2): series is now decided on a **blur-independent width** — the intensity deficit
(matrix − pixel) summed across the particle divided by full contrast and length. On a 3 µm line blurred with
σ = 1.5 µm it reads 3.5 µm (thresholded width: 4 µm); on 9 µm it reads 9.0 µm (thresholded: 8 µm). Measured on
the poster, thin lines are 6–8 µm (A), 8–10 µm (C) and heavy 9–13 µm with **both** methods, so the poster really
prints the thin series ~2× wider than E45 specifies; the ISO width limits (A 4, B 9, C 5, D 8 µm) are kept and
the chart's thin/heavy split (25/48) is not a meaningful target. A vs C is decided by particle tone (sulphides
mid-grey, silicates dark) — on the black-printed chart both read as dark.

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
| A247 Plate I (drawn), size 1–8 | classes 3–6 correct. Classes 1–2: flakes (≥ 0.64 mm) are longer than the 0.8 mm field and are reported as "class X or coarser — rate at 50× or on a wider field". Classes 7–8: crowded drawn flakes touch and merge. (A 95th-percentile basis rated the drawn chart 3–8 correctly but real grey-iron fields 1–2 classes too fine, so the A247 basis — mean of the 5 longest flakes — is kept; a 5 px closing rejoins thin flakes broken at faint spots.) |
| Chart 0135 flake-size photos | not usable — small half-tone thumbnails |

### Hardness conversion — ASTM E140 (new module)

Both tables of chart 0127 were transcribed (hardened: HRC 80–20, 11 scales; soft: HRB 100–0, 14 scales). Every
column was checked for monotonic order (0 errors). Values between rows are interpolated linearly; no extrapolation.

### Fe–C phase diagram (new module)

Key points from chart 0131 (727 °C / 0.77 % C, 1148 °C / 4.30 % C, 2.11 % C, 6.67 % Fe₃C, 912 / 1394 / 1538 °C).
Gives the phase field at any %C / temperature, A₃ / A_cm, lever-rule pearlite / proeutectoid fractions, and a carbon
estimate from pearlite area (also shown on Micro analysis results).

## Real-specimen test (web micrographs, revision 2)

52 real micrographs with stated reference values were collected from open-access papers (CC BY, mostly MDPI
via PMC), DoITPoMS (CC BY-NC-SA) and Wikimedia Commons; scale from each figure's scale bar (masked before
analysis). Paper values describe the whole specimen, not the exact field shown. Images are not stored in the
repository.

| Module | Real images | Result |
|---|---|---|
| Grain size, boundary etch | pure iron (nital), 4 conditions | mean diameter 33 / 34 / 39 / 89 µm vs paper 27 / 33 / 43 / 82 µm |
| Grain size, contrast (tint) etch (beta) | high-Mn austenite 1100 / 1200 °C | G 4.5 / 1.9 vs paper 3.0 / 1.5 with *Etch type: contrast* (twin bands that differ in shade are counted; E112 excludes twins). Boundary-etch mode on these images: G 0.8 / −0.8 |
| Grain size | high-Mn austenite 900 / 1000 °C (G 9.5 / 8.5) | **not resolved**: grains ≈ 10 px in the published figure; reads G 5.8 / 5.0 |
| Nodule count (SG iron) | 6 alloys | 85–89 % of the paper's count, consistently (E2567 / ISO 945-4 ignore particles < 10 µm; the paper may count smaller) |
| Nodularity (compacted iron) | 4 wall thicknesses | reads 48–64 % vs paper 14–33 %: images are only 386 px (1.75 µm/px), too coarse for vermicular graphite |
| Flake size (grey iron) | 6 samples, A247 class 2–3 | class 3–4 from one field; the paper rates the specimen's largest flakes |
| Inclusions | MnS (rolling direction), cast-steel sulphides, alumina | MnS rated type A in 3 / 3; no JK severities published to compare; alumina not recognised as B |
| Micro / carbon | ferrite–pearlite 0.1 / 0.18 % C | 0.08 / 0.25 % C. Fully pearlitic and tinted low-magnification images (0.4 / 0.8 % C) are now **flagged** instead of giving a wrong carbon value |
| Decarburization | 38Si7 spring steel, complete decarb 93.4 µm | **102.9 µm** (old method: 1.5 µm) |

Fixes made from this test:
- **Grain boundaries on real etches**: threshold now uses Otsu clipped at the 99th percentile — dust, pits and
  inclusions (very dark specks) had pushed the threshold above faint boundaries (pure iron 805 °C: 137 → 89 µm).
- **Etch type option** (capture page and job edit, stored as `analysis_options.etch`): *contrast / tint etch*
  (beta) adds the shade gradient to the watershed and seeds every uniform interior, for E112 Plate III-style
  specimens, at native resolution (no adaptive rescaling). Synthetic shade-only grains: within 0.7 G. Default
  *boundary etch* is unchanged (calibrated on the charts).
- **Resolution warning** when the measured grain intercept is under 8 px.
- **Decarburization rebuilt** (ISO 3887): finds the free surface on any side (dark mount band), reports complete
  (ferrite-only) and total (back to core) depth with an overlay; reports "no decarburized layer" when none.
- **Micro**: detects when the light phase is not smooth ferrite (texture ratio ≥ 0.6) and withholds the
  carbon estimate.

Guidance for lab images: ≥ 15 px per grain intercept (grain size), ≤ 1 µm/px for cast iron, unetched polished
sections for inclusions and graphite, nital-etched edge with the mount visible for decarburization.

## Re-running

```bash
# synthetic, repository-only tests (run in CI)
npm test --prefix backend/functions

# chart harness against the lab's scans (scans stay outside git)
tools/chart-calibration/run.sh "<…/Qirlpl Testing Lab/Metallurgical Charts>"
```
