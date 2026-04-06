from PIL import Image
import numpy as np

img = Image.open('assets/somni_logo_full.png').convert("RGBA")
data = np.array(img)

# Make white background transparent
r, g, b, a = data.T
white_areas = (r > 230) & (g > 230) & (b > 230)
data[..., -1][white_areas.T] = 0 # Alpha to 0

img2 = Image.fromarray(data)

# Trim standard bounding box
bbox = img2.getbbox()
if bbox:
    img2 = img2.crop(bbox)

width, height = img2.size
# Crop to top 65% to remove the "baby sleep" text at the bottom.
img2 = img2.crop((0, 0, width, int(height * 0.65)))

# Trim again exactly
bbox2 = img2.getbbox()
if bbox2:
    img2 = img2.crop(bbox2)

img2.save('public/somni_logo_cropped.png')
print("Successfully cropped and removed background to public/somni_logo_cropped.png")
