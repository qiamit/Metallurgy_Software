#!/usr/bin/env bash
# Re-run the chart calibration against the lab's chart scans (not stored in git: copyrighted).
#   tools/chart-calibration/run.sh "<folder with Scan-0122.pdf … Scan-0138.pdf>"
# Needs: python3 with opencv-python-headless + numpy, and `npm install --prefix backend/functions`.
set -euo pipefail
CHARTS="${1:?path to the Metallurgical Charts folder}"
HERE="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
WORK="${WORK_DIR:-$(mktemp -d)}"
LIB="$REPO/backend/functions/lib/analysis.mjs"
mkdir -p "$WORK/charts/hi" "$WORK/cal/e112" "$WORK/cal/fields" "$WORK/cal/jk" "$WORK/cal/ci"
for f in "$CHARTS"/Scan-01*.pdf; do python3 "$HERE/extract_scan.py" "$f" "$WORK/charts/hi/$(basename "${f%.pdf}")"; done
python3 "$HERE/crop_e112.py" "$WORK"
python3 "$HERE/prep_fields.py" "$WORK"
python3 "$HERE/crop_jk.py" "$WORK"
python3 "$HERE/crop_ci.py" "$WORK"
cd "$REPO/backend/functions"
echo "== Grain size (ASTM E112 plates)"; node "$HERE/eval_grain.mjs" "$LIB" "$WORK/cal/fields" | tail -2
echo "== Inclusion rating (ASTM E45 Plate I-r)"; node "$HERE/eval_jk.mjs" "$LIB" "$WORK/cal/jk" | tail -1
echo "== Cast iron (ISO 945 / A247)"; node "$HERE/eval_ci.mjs" "$LIB" "$WORK/cal/ci" | grep -E "==|mean|correct"
echo "Work files: $WORK"
