# tools/slice_chicken.py
from PIL import Image
from collections import deque
import os, json, sys

IN_PATH = sys.argv[1] if len(sys.argv) > 1 else "public/assets/chicken/chicken.png"
OUT_DIR = sys.argv[2] if len(sys.argv) > 2 else "public/assets/chicken/parts"
ALPHA_T = 10  # порог альфы

img = Image.open(IN_PATH).convert("RGBA")
w, h = img.size
px = img.load()

os.makedirs(OUT_DIR, exist_ok=True)

visited = [[False]*w for _ in range(h)]

def is_solid(x,y):
    return px[x,y][3] > ALPHA_T

parts = []
idx = 0

for y in range(h):
    for x in range(w):
        if visited[y][x] or not is_solid(x,y):
            continue

        q = deque([(x,y)])
        visited[y][x] = True

        minx=miny=10**9
        maxx=maxy=-1

        while q:
            cx, cy = q.popleft()
            if cx < minx: minx = cx
            if cy < miny: miny = cy
            if cx > maxx: maxx = cx
            if cy > maxy: maxy = cy

            for nx, ny in ((cx-1,cy),(cx+1,cy),(cx,cy-1),(cx,cy+1)):
                if 0 <= nx < w and 0 <= ny < h and not visited[ny][nx] and is_solid(nx,ny):
                    visited[ny][nx] = True
                    q.append((nx,ny))

        # bbox inclusive -> crop box uses (left, upper, right, lower) with right/lower exclusive
        box = (minx, miny, maxx+1, maxy+1)
        part = img.crop(box)

        name = f"part_{idx:03d}"
        out_path = os.path.join(OUT_DIR, f"{name}.png")
        part.save(out_path)

        parts.append({
            "name": name,
            "file": f"/assets/chicken/parts/{name}.png",
            "x": minx, "y": miny,
            "w": (maxx+1-minx), "h": (maxy+1-miny)
        })
        idx += 1

meta = {
    "source": "/assets/chicken/chicken.png",
    "parts": parts
}

with open(os.path.join(OUT_DIR, "parts.json"), "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

print(f"OK: {len(parts)} parts -> {OUT_DIR}")