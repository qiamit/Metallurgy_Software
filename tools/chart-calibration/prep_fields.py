import cv2, numpy as np, json, sys, glob, os, math
S = sys.argv[1]; out = {}
def hough(gray, rmin, rmax):
    h, w = gray.shape; f = 2
    small = cv2.resize(gray, (w // f, h // f))
    c = cv2.HoughCircles(cv2.GaussianBlur(small, (5, 5), 0), cv2.HOUGH_GRADIENT, dp=1.5, minDist=w,
                         param1=80, param2=30, minRadius=int(rmin * w / f), maxRadius=int(rmax * w / f))
    return None if c is None else tuple(float(v) * f for v in c[0][0])
# Plate I-B: dark lines on white, thin reference circle = 0.798 mm
for f in sorted(glob.glob(f"{S}/cal/e112/IB_G*.png")):
    if '_trim' in f: continue
    g = cv2.imread(f, 0); g = g[: int(g.shape[0] * 0.92)]
    cx, cy, r = hough(g, 0.30, 0.52)
    cv2.circle(g, (int(cx), int(cy)), int(r), 255, max(6, int(r * 0.02)))
    s = int(r * 0.96 * math.sqrt(2) / 2)
    crop = g[int(cy) - s:int(cy) + s, int(cx) - s:int(cx) + s]
    name = os.path.basename(f)[:-4]; cv2.imwrite(f"{S}/cal/fields/{name}.png", crop)
    out[name] = {"G": float(name.split('_G')[1]), "um_per_px": 798.0 / (2 * r), "plate": "E112 Plate I-B (100x)"}
# Plate IV (Scan-0132): circular photos, white boundaries on dark; photo circle = field (0.798 mm at 100x)
img = cv2.imread(f"{S}/charts/hi/Scan-0132.jpg", 0); k = img.shape[1] / 1800
centres = {1: (1165, 305, 255), 2: (1165, 865, 260), 3: (672, 200, 130), 4: (672, 585, 130), 5: (672, 980, 130),
           6: (300, 195, 130), 7: (300, 590, 130), 8: (300, 985, 130)}
for no, (x, y, rr) in centres.items():
    X, Y, R = int(x * k), int(y * k), int(rr * k * 1.15)
    roi = img[max(0, Y - R):Y + R, max(0, X - R):X + R]
    c = hough(roi, 0.38, 0.5)
    if c is None: print('no circle', no); continue
    cx, cy, r = c
    s = int(r * 0.90 * math.sqrt(2) / 2)
    crop = roi[int(cy) - s:int(cy) + s, int(cx) - s:int(cx) + s]
    name = f"IV_G{no}"; cv2.imwrite(f"{S}/cal/fields/{name}.png", crop)
    out[name] = {"G": float(no), "um_per_px": 798.0 / (2 * r), "plate": "E112 Plate IV (100x, McQuaid-Ehn)"}
json.dump(out, open(f"{S}/cal/fields/index.json", "w"), indent=1)
print({k_: round(v["um_per_px"], 3) for k_, v in out.items()})
