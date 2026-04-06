from PIL import Image

img = Image.open('assets/somni_logo_full.png').convert("RGBA")
datas = img.getdata()

newData = []
for item in datas:
    # If the pixel is close to white, make it transparent
    if item[0] > 230 and item[1] > 230 and item[2] > 230:
        newData.append((255, 255, 255, 0))
    else:
        newData.append(item)

img.putdata(newData)

# Trim transparent edges
bbox = img.getbbox()
if bbox:
    img = img.crop(bbox)

# Crop the top 65% manually
width, height = img.size
img = img.crop((0, 0, width, int(height * 0.65)))

# Trim again out of safety
bbox2 = img.getbbox()
if bbox2:
    img = img.crop(bbox2)

img.save('public/somni_logo_cropped.png')
print("Successfully processed pure PIL to public/somni_logo_cropped.png")
