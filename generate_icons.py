import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("PIL not found. Please ensure Pillow is installed for the python environment running this script.")
    sys.exit(1)

def draw_guitar_pick(size, color, text_color):
    # Create a transparent image
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Guitar pick shape (roughly an inverted rounded triangle)
    # We'll draw a polygon and smooth it or just use a path
    # For simplicity in PIL without complex paths, we can draw a circle and modify it or just a rounded rectangle
    # Let's try a simple rounded triangle using a polygon
    
    w, h = size, size
    
    # Points for a triangle
    # Top-left, Top-right, Bottom-center
    # But a pick is usually wider at top.
    
    # Let's just draw a circle for the main body and a triangle for the tip?
    # Or just a nice circle is safer and standard for icons.
    # Let's stick to a Circle for the icon to be safe and clean, with a Guitar Pick inside?
    # Or just a Guitar Pick shape.
    
    # Let's do a Circle background with the accent color
    draw.ellipse((0, 0, size, size), fill=color)
    
    # Draw a "Play" triangle in the center
    # Triangle points
    center_x, center_y = w / 2, h / 2
    triangle_size = size * 0.4
    
    # Point 1: Tip (Right)
    p1 = (center_x + triangle_size * 0.8, center_y)
    # Point 2: Top Left
    p2 = (center_x - triangle_size * 0.5, center_y - triangle_size * 0.8)
    # Point 3: Bottom Left
    p3 = (center_x - triangle_size * 0.5, center_y + triangle_size * 0.8)
    
    draw.polygon([p1, p2, p3], fill=text_color)
    
    return img

def main():
    icons_dir = 'icons'
    if not os.path.exists(icons_dir):
        os.makedirs(icons_dir)
        
    sizes = [16, 48, 128]
    # Color from the user's screenshot (approx orange)
    bg_color = (242, 140, 56, 255) # #F28C38
    symbol_color = (255, 255, 255, 255) # White
    
    for size in sizes:
        print(f"Generating icon{size}.png...")
        img = draw_guitar_pick(size, bg_color, symbol_color)
        img.save(os.path.join(icons_dir, f'icon{size}.png'), 'PNG')
        print(f"Saved icon{size}.png")

if __name__ == "__main__":
    main()
