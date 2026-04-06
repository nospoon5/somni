import math
from PIL import Image

def process_image():
    img = Image.open('assets/somni_logo_full.png').convert("RGBA")
    data = list(img.getdata())
    width, height = img.size

    # Get background color from top-left pixel
    bg_color = data[0][:3]
    
    newData = []
    for r, g, b, a in data:
        # Calculate distance to background color
        dist = math.sqrt((r - bg_color[0])**2 + (g - bg_color[1])**2 + (b - bg_color[2])**2)
        
        # If very close to background color, make fully transparent
        if dist < 20:
            newData.append((255, 255, 255, 0))
        elif dist < 80:
            # Soft edge alpha
            alpha = int(min(255, (dist - 20) * (255 / 60)))
            newData.append((r, g, b, alpha))
        else:
            newData.append((r, g, b, a))

    img.putdata(newData)

    # Crop out transparent parts
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    # Crop top 65%
    w, h = img.size
    img = img.crop((0, 0, w, int(h * 0.65)))

    # Re-crop bounding box to be exact
    bbox2 = img.getbbox()
    if bbox2:
        img = img.crop(bbox2)

    img.save('public/somni_logo_clean_v3.png')

process_image()
print("Saved to public/somni_logo_clean_v3.png")
