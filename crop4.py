import numpy as np
from PIL import Image

def remove_white_bg_and_crop(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    
    # Crop first
    width, height = img.size
    img = img.crop((0, 0, width, int(height * 0.65)))
    
    # Convert to numpy array
    arr = np.array(img).astype(float) / 255.0
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    
    # We want to identify the dark parts (text/baby) and yellow parts (accent).
    # Background is white (1.0, 1.0, 1.0).
    
    # Assume the image is a mix of Foreground with alpha and White background.
    # C = F * alpha + White * (1 - alpha)
    # Since White is 1, C = F * alpha + 1 - alpha -> 1 - C = alpha * (1 - F)
    # We can estimate alpha based on how far the pixel is from white.
    
    # Distance from white
    dist_from_white = np.sqrt(((1-r)**2 + (1-g)**2 + (1-b)**2) / 3.0)
    
    # For a purely dark foreground (F ~ 0), alpha ~ dist_from_white.
    # For a yellow foreground (F ~ 0.9, 0.7, 0.3), dist_from_white is smaller.
    # Let's find the max difference from 1 across all channels
    max_diff = np.max(1.0 - arr[:, :, :3], axis=2)
    
    # Let alpha be something related to max_diff. To keep solid colors solid, scale it.
    alpha = np.clip(max_diff * 1.5, 0, 1)
    
    # For the yellow, F_y is high, so max_diff is dominated by the blue channel.
    # Max blue difference from 1 is ~0.7 for yellow (0.9, 0.7, 0.3) -> 1 - 0.3 = 0.7.
    # 0.7 * 1.5 = 1.05 -> clipped to 1.0. So yellow will be opaque!
    
    # Now, recover the original foreground color F = (C - 1 + alpha) / alpha
    # (avoid division by zero)
    safe_alpha = np.where(alpha < 0.01, 1.0, alpha)
    safe_alpha = safe_alpha[:, :, np.newaxis]
    
    F = (arr[:, :, :3] - 1.0 + safe_alpha) / safe_alpha
    F = np.clip(F, 0, 1)
    
    # Because the original text was dark (F_rgb ~ 0), and the UI background is dark,
    # the user won't be able to see the dark text.
    # We should invert the lightness of the dark parts but leave the yellow alone.
    # Yellow is identified by high R, high G, low B.
    # Dark text is low R, low G, low B.
    
    # Identify dark pixels (where original F was very dark)
    # We can do this safely: F_lum
    F_lum = 0.299*F[:, :, 0] + 0.587*F[:, :, 1] + 0.114*F[:, :, 2]
    
    # If F_lum < 0.3, it's the dark text. Let's make it a light color like #fef0dc!
    # #fef0dc is (254, 240, 220) -> (0.996, 0.941, 0.862)
    
    is_dark = F_lum < 0.4
    F[is_dark, 0] = 0.996 # R
    F[is_dark, 1] = 0.941 # G
    F[is_dark, 2] = 0.862 # B
    
    # Reassemble with new alpha
    out_arr = np.zeros_like(arr)
    out_arr[:, :, :3] = F
    out_arr[:, :, 3] = alpha
    
    out_img = Image.fromarray((out_arr * 255).astype(np.uint8))
    
    # Trim
    bbox = out_img.getbbox()
    if bbox:
        out_img = out_img.crop(bbox)
        
    out_img.save(output_path)

remove_white_bg_and_crop('assets/somni_logo_full.png', 'public/somni_logo_clean_v4.png')
print("Saved v4")
