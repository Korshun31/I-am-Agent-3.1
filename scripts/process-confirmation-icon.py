#!/usr/bin/env python3
"""Remove black background, trim edges, resize to match pencil icon."""
from PIL import Image

PENCIL_SIZE = (94, 96)
SRC = "/Users/igorkorshunov/.cursor/projects/Users-igorkorshunov-I-am-agent-Cursor/assets/ChatGPT_Image_13____._2026__.__01_04_58-c3897d32-ee47-45f7-9a8d-062f1f6fd220.png"
DST = "/Users/igorkorshunov/I am agent Cursor/assets/icon-booking-confirmation.png"

img = Image.open(SRC).convert("RGBA")
data = img.getdata()

# Remove black background: pixels with R,G,B all < 40 become transparent
new_data = []
BLACK_THRESHOLD = 40
for item in data:
    r, g, b, a = item
    if r < BLACK_THRESHOLD and g < BLACK_THRESHOLD and b < BLACK_THRESHOLD:
        new_data.append((0, 0, 0, 0))
    else:
        new_data.append(item)

img.putdata(new_data)

# Trim transparent edges
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# Resize to match pencil icon, preserve aspect ratio
img.thumbnail(PENCIL_SIZE, Image.Resampling.LANCZOS)

# Create output at exact pencil size (center the content)
out = Image.new("RGBA", PENCIL_SIZE, (0, 0, 0, 0))
x = (PENCIL_SIZE[0] - img.width) // 2
y = (PENCIL_SIZE[1] - img.height) // 2
out.paste(img, (x, y), img)
out.save(DST)
print(f"Saved to {DST}")
