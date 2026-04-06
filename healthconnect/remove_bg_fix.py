from PIL import Image
import numpy as np
import sys

input_path = "C:\\Users\\Dev Gupta\\.gemini\\antigravity\\brain\\7f753456-b1ef-463d-b14f-87d7f2288171\\media__1775485538395.png"
output_path = "C:\\Users\\Dev Gupta\\Desktop\\pro2\\healthconnect\\public\\pulserate-logo.png"

# Open the image and convert to RGBA
img = Image.open(input_path).convert("RGBA")
data = np.array(img)

# Find white areas
r, g, b, a = data[:, :, 0], data[:, :, 1], data[:, :, 2], data[:, :, 3]
white_areas = (r > 240) & (g > 240) & (b > 240)

# Set alpha to 0 for white areas
data[white_areas, 3] = 0
data[white_areas, 0] = 255
data[white_areas, 1] = 255
data[white_areas, 2] = 255

# Convert back and save
new_img = Image.fromarray(data)
new_img.save(output_path)
print("Saved transparent logo to", output_path)
