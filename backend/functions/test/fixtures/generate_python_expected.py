import sys, json, cv2, numpy as np
sys.path.insert(0, sys.argv[1])
from app.services.grain_size import analyze_grain_size
from app.services.phase2_analysis import analyze_inclusion, analyze_decarb, analyze_micro, analyze_macro
out_dir = sys.argv[2]
rng = np.random.default_rng(7)
imgs = {}
# grain: polygon network
g = np.full((480, 640, 3), 210, np.uint8)
pts = rng.integers(0, [640, 480], size=(60, 2))
for i in range(len(pts)):
    d = np.linalg.norm(pts - pts[i], axis=1); idx = np.argsort(d)[1:4]
    for j in idx: cv2.line(g, tuple(map(int, pts[i])), tuple(map(int, pts[j])), (60, 60, 60), 2)
g = cv2.add(g, rng.integers(0, 20, g.shape, dtype=np.uint8))
imgs['grain_size'] = g
inc = np.full((480, 640, 3), 200, np.uint8)
for _ in range(40):
    x, y = map(int, rng.integers(20, [620, 460])); w = int(rng.integers(3, 60)); h = int(rng.integers(3, 12))
    if rng.random() < .5: w, h = h, w
    cv2.rectangle(inc, (x, y), (x + w, y + h), (40, 40, 40), -1)
imgs['inclusion'] = inc
dec = np.zeros((300, 500, 3), np.uint8)
for x in range(500): dec[:, x] = 230 if x < 140 else 90
dec = cv2.add(dec, rng.integers(0, 15, dec.shape, dtype=np.uint8))
imgs['decarb'] = dec
mic = np.full((400, 400, 3), 180, np.uint8)
for _ in range(80): cv2.circle(mic, tuple(map(int, rng.integers(0, 400, 2))), int(rng.integers(5, 25)), (50, 50, 50), -1)
imgs['micro'] = mic
mac = np.full((400, 600, 3), 210, np.uint8)
for _ in range(12):
    x, y = map(int, rng.integers(10, [500, 380])); cv2.rectangle(mac, (x, y), (x + int(rng.integers(20, 90)), y + int(rng.integers(2, 6))), (30, 30, 30), -1)
imgs['macro'] = mac
fns = dict(grain_size=analyze_grain_size, inclusion=analyze_inclusion, decarb=analyze_decarb, micro=analyze_micro, macro=analyze_macro)
scales = dict(grain_size=(0.65, 0.65), inclusion=(0.5, 0.5), decarb=(1.2, 1.2), micro=(0.65, 0.7), macro=(25, 25))
res = {}
for k, img in imgs.items():
    cv2.imwrite(f"{out_dir}/{k}.png", img)
    r, ov = fns[k](img, *scales[k])
    cv2.imwrite(f"{out_dir}/{k}_py_overlay.png", ov)
    res[k] = r
json.dump({'results': res, 'scales': scales}, open(f"{out_dir}/py.json", "w"), indent=1, default=float)
