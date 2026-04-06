from PIL import Image

def process_image():
    img = Image.open('assets/somni_logo_full.png').convert("RGBA")
    data = img.getdata()

    newData = []
    # The logo accent color is ~ #E8B44A (R:232, G:180, B:74)
    # White background is high in all (R>240, G>240, B>240)
    for r, g, b, a in data:
        if r > 200 and g > 200 and b > 200:
            # Scale alpha based on how close to pure white it is
            avg = (r + g + b) / 3.0
            if avg > 245:
                newData.append((255, 255, 255, 0))
            else:
                alpha = int((255 - avg) * 25.5)
                newData.append((r, g, b, max(0, min(255, alpha))))
        elif r > 230 and g > 230 and b > 230:
            newData.append((255, 255, 255, 0))
        else:
            newData.append((r, g, b, a))

    img.putdata(newData)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    width, height = img.size
    img = img.crop((0, 0, width, int(height * 0.65)))

    bbox2 = img.getbbox()
    if bbox2:
        img = img.crop(bbox2)

    img.save('public/somni_logo_clean_v2.png')

process_image()
print("Saved to public/somni_logo_clean_v2.png")
