import cv2, numpy as np, json, sys
S = sys.argv[1]
img = cv2.rotate(cv2.imread(f"{S}/charts/hi/Scan-0123.jpg", 0), cv2.ROTATE_180)
_, b = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
cnts, _ = cv2.findContours(b, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
boxes = []
for c in cnts:
    x, y, w, h = cv2.boundingRect(c)
    if 500 < w < 800 and 0.9 < w / h < 1.1:
        boxes.append((x, y, w, h))
# de-duplicate (outer/inner edge of the same frame)
boxes.sort(key=lambda r: (r[1], r[0])); uniq = []
for r in boxes:
    if all(abs(r[0] - u[0]) > 40 or abs(r[1] - u[1]) > 40 for u in uniq): uniq.append(r)
print('squares found', len(uniq))
xs = sorted(set(round(u[0] / 100) for u in uniq)); ys = sorted(set(round(u[1] / 100) for u in uniq))
cols = sorted({u[0] for u in uniq}); 
# cluster columns / rows
def clusters(vals, tol=150):
    out = []
    for v in sorted(vals):
        if not out or v - out[-1][-1] > tol: out.append([v])
        else: out[-1].append(v)
    return [sum(c) / len(c) for c in out]
cx = clusters([u[0] for u in uniq]); cy = clusters([u[1] for u in uniq])
print('columns', len(cx), 'rows', len(cy))
types = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D']; series = ['thin', 'heavy'] * 4
sev = ['0.5', '1', '1.5', '2', '2.5', '3']
idx = {}
for (x, y, w, h) in uniq:
    ci = int(np.argmin([abs(x - c) for c in cx])); ri = int(np.argmin([abs(y - c) for c in cy]))
    if len(cx) != 8 or len(cy) != 6: continue
    m = int(w * 0.03)
    field = img[y + m:y + h - m, x + m:x + w - m]
    name = f"{types[ci]}_{series[ci]}_{sev[ri]}"
    cv2.imwrite(f"{S}/cal/jk/{name}.png", field)
    idx[name] = {"type": types[ci], "series": series[ci], "severity": float(sev[ri]), "um_per_px": 710.0 / w}
json.dump(idx, open(f"{S}/cal/jk/index.json", "w"), indent=1)
print(len(idx), 'fields; µm/px', round(np.mean([v['um_per_px'] for v in idx.values()]), 3))
