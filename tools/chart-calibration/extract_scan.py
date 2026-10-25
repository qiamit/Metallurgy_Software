import re, sys, zlib, os
src, out = sys.argv[1], sys.argv[2]
data = open(src, 'rb').read()
best = None
for m in re.finditer(rb'<<(.*?)>>\s*stream\r?\n', data, re.S):
    d = m.group(1)
    if b'/Image' not in d: continue
    start = m.end()
    lm = re.search(rb'/Length\s+(\d+)(\s+0\s+R)?', d)
    end = data.find(b'endstream', start)
    raw = data[start:end]
    w = re.search(rb'/Width\s+(\d+)', d); h = re.search(rb'/Height\s+(\d+)', d)
    filt = re.findall(rb'/(DCTDecode|FlateDecode|JPXDecode|CCITTFaxDecode)', d)
    info = (int(w.group(1)) if w else 0, int(h.group(1)) if h else 0, [f.decode() for f in filt], len(raw), d[:200])
    if best is None or info[0]*info[1] > best[0][0]*best[0][1]:
        best = (info, raw)
info, raw = best
print(os.path.basename(src), info[0], 'x', info[1], info[2], len(raw))
ext = '.jpg' if 'DCTDecode' in info[2] else '.jp2' if 'JPXDecode' in info[2] else '.bin'
open(out + ext, 'wb').write(raw)
