from PIL import Image

def remove_white_bg_and_invert():
    img = Image.open('assets/somni_logo_full.png').convert("RGBA")
    
    # Crop top 65% manually
    width, height = img.size
    img = img.crop((0, 0, width, int(height * 0.65)))
    
    # Use getdata (not deprecated simple iteration)
    data = list(img.getdata())
    new_data = []

    for r, g, b, a in data:
        # Normalize to 0.0 - 1.0
        rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
        
        # Calculate how far the pixel is from pure white
        max_diff = max(1.0 - rf, 1.0 - gf, 1.0 - bf)
        
        # Alpha based on distance from white (multiplied to give solid edges to darks)
        alpha = min(max_diff * 1.5, 1.0)
        
        if alpha < 0.01:
            new_data.append((255, 255, 255, 0))
            continue
            
        # Reverse the white blending to reveal true color
        orig_rf = min(max((rf - 1.0 + alpha) / alpha, 0.0), 1.0)
        orig_gf = min(max((gf - 1.0 + alpha) / alpha, 0.0), 1.0)
        orig_bf = min(max((bf - 1.0 + alpha) / alpha, 0.0), 1.0)
        
        # Detect if true color is dark (text and baby silhouette)
        lum = 0.299 * orig_rf + 0.587 * orig_gf + 0.114 * orig_bf
        if lum < 0.35:
            # Turn the dark text into the off-white text color we use in the UI (#fef0dc)
            new_data.append((254, 240, 220, int(alpha * 255)))
        else:
            # Leave yellow elements alone
            new_data.append((int(orig_rf * 255), int(orig_gf * 255), int(orig_bf * 255), int(alpha * 255)))

    # Apply data
    img.putdata(new_data)

    # Crop boundary
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    img.save('public/somni_logo_clean_v4.png')

remove_white_bg_and_invert()
print("Saved v4")
