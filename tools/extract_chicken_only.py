from PIL import Image
import os

IN_PATH = "public/assets/chicken/chicken.png"
OUT_PATH = "public/assets/chicken/chicken_only.png"

img = Image.open(IN_PATH).convert("RGBA")

# ✅ ЖЁСТКИЙ CROP ПОД КУРИЦУ (под твой атлас)
# x1, y1, x2, y2
CROP = (
    20,   # left
    40,   # top
    300,  # right
    320   # bottom
)

crop = img.crop(CROP)
os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
crop.save(OUT_PATH)

print("Saved:", OUT_PATH, "size:", crop.size)