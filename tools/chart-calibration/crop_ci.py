import cv2, numpy as np, json, sys
S = sys.argv[1]; idx = {}
def crop(scan, box, ov_w, name, meta, rotate=None, trim_bottom=0.0, margin=0.06):
    img = cv2.imread(f"{S}/charts/hi/{scan}.jpg", 0)
    if rotate is not None: img = cv2.rotate(img, rotate)
    k = img.shape[1] / ov_w
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    X0, Y0 = int((x0 + w * margin) * k), int((y0 + h * margin) * k)
    X1, Y1 = int((x1 - w * margin) * k), int((y1 - h * (margin + trim_bottom)) * k)
    roi = img[Y0:Y1, X0:X1]
    cv2.imwrite(f"{S}/cal/ci/{name}.png", roi); idx[name] = dict(meta, w=roi.shape[1], h=roi.shape[0])
# Chart 0122 (rotated 90° in the scan): nodularity column, labels >90 85 75 55 30 <10 %
for (y0, y1), pct in zip([(210, 355), (370, 515), (530, 675), (690, 835), (848, 993), (1005, 1150)], [92, 85, 75, 55, 30, 8]):
    crop("Scan-0122", (960, y0, 1070, y1), 1800, f"NOD_{pct}", {"chart": "0122 nodularity", "nodularity": pct})
# Chart 0135 (ASTM A247): nodule size class 4–7 and flake size class 2–8 (100×)
for (x0, x1), c in zip([(843, 1018), (1027, 1202), (1211, 1386), (1395, 1570)], [4, 5, 6, 7]):
    crop("Scan-0135", (x0, 910, x1, 1047), 1800, f"NSIZE_{c}", {"chart": "0135 A247 nodule size", "size_class": c})
for (x0, x1), c in zip([(475, 650), (658, 835), (843, 1018), (1027, 1202), (1211, 1386), (1395, 1570), (1579, 1754)], [2, 3, 4, 5, 6, 7, 8]):
    crop("Scan-0135", (x0, 703, x1, 840), 1800, f"FSIZE135_{c}", {"chart": "0135 A247 flake size", "size_class": c})
# Graphite form Type I–VII (0135)
for (x0, x1), t in zip([(475, 650), (658, 835), (843, 1018), (1027, 1202), (1211, 1386), (1395, 1570), (1579, 1754)], ["I", "II", "III", "IV", "V", "VI", "VII"]):
    crop("Scan-0135", (x0, 487, x1, 622), 1800, f"FORM_{t}", {"chart": "0135 A247 graphite form", "form": t})
# Chart 0138 Plate I drawn flake sizes 1–8 (scan upside down)
xs = [(50, 250), (255, 465), (470, 675), (680, 885), (885, 1080), (1085, 1290), (1295, 1500), (1500, 1705)]
for (x0, x1), c in zip(xs, range(1, 9)):
    crop("Scan-0138", (x0, 399, x1, 621), 1800, f"FSIZE138_{c}", {"chart": "0138 A247 Plate I flake size (drawn)", "size_class": c}, rotate=cv2.ROTATE_180, trim_bottom=0.08, margin=0.03)
json.dump(idx, open(f"{S}/cal/ci/index.json", "w"), indent=1)
print(len(idx), "crops")
pv = [cv2.resize(cv2.imread(f"{S}/cal/ci/{n}.png", 0), (220, 200)) for n in ["NOD_92", "NOD_30", "NSIZE_4", "NSIZE_7", "FSIZE138_1", "FSIZE138_5", "FSIZE138_8", "FORM_IV"]]
cv2.imwrite(f"{S}/cal/ci_preview.png", np.hstack(pv))
