from PIL import Image
import numpy as np
import sys

input_path = sys.argv[1]
output_path = sys.argv[2]

# Open the image and convert to RGBA
img = Image.open(input_path).convert("RGBA")
data = np.array(img)

# Unpack color channels
r, g, b, a = data.T

# We want to replace white-ish background with transparent.
# White is (255, 255, 255). Let's pick a threshold near white.
white_areas = (r > 240) & (g > 240) & (b > 240)
data[..., :-1][white_areas.T] = (255, 255, 255) # normalize
data[..., 3][white_areas.T] = 0 # set alpha to 0

# Convert back and save
new_img = Image.fromarray(data)
new_img.save(output_path)
print("Saved transparent logo to", output_path)
