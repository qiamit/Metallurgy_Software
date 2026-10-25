import cv2, numpy as np, json, sys
S = sys.argv[1]
out = {}
def crop_fields(scan, boxes_overview, ov_w, labels, tag):
    img = cv2.imread(f"{S}/charts/hi/{scan}.jpg", cv2.IMREAD_GRAYSCALE)
    k = img.shape[1] / ov_w
    for (x0, y0, x1, y1), g in zip(boxes_overview, labels):
        pad = 25
        X0, Y0, X1, Y1 = [int(v * k) for v in (x0 - pad, y0 - pad, x1 + pad, y1 + pad)]
        roi = img[Y0:Y1, X0:X1]
        # tight box around the drawn field (dark pixels)
        dark = (roi < 150).astype(np.uint8)
        ys, xs = np.where(dark > 0)
        ry0, ry1 = np.percentile(ys, 0.2), np.percentile(ys, 99.8)
        rx0, rx1 = np.percentile(xs, 0.2), np.percentile(xs, 99.8)
        field = roi[int(ry0):int(ry1), int(rx0):int(rx1)]
        name = f"{tag}_G{g}"
        cv2.imwrite(f"{S}/cal/e112/{name}.png", field)
        out[name] = {"scan": scan, "G": g, "w": field.shape[1], "h": field.shape[0]}
# Plate IB (Scan-0129): overview 1800 px wide
r = [(310, 490), (565, 745), (820, 1000)]
cx = [(125, 305), (378, 558), (636, 818), (893, 1072), (1150, 1330)]
boxes = [(x0, y0, x1, y1) for (y0, y1) in r for (x0, x1) in cx]
labels = ["3.0","3.5","4.0","4.5","5.0","5.5","6.0","6.5","7.0","7.5","8.0","8.5","9.0","9.5","10.0"]
crop_fields("Scan-0129", boxes, 1800, labels, "IB")
# Plate IA (Scan-0130)
boxes = [(85, 275, 445, 630), (520, 275, 878, 638), (940, 270, 1310, 632),
         (68, 686, 445, 1068), (498, 692, 870, 1060), (950, 696, 1310, 1058), (1390, 696, 1748, 1058)]
crop_fields("Scan-0130", boxes, 1800, ["00","0","0.5","1.0","1.5","2.0","2.5"], "IA")
json.dump(out, open(f"{S}/cal/e112/index.json", "w"), indent=1)
print(json.dumps(out)[:600])
