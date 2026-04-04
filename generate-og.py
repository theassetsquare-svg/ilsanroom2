#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/nix/store/al25l64xyi9lyw7yhsvsbdkn6z75jgkn-ghostscript-with-X-10.02.1/share/ghostscript/10.02.1/Resource/CIDFSubst/DroidSansFallback.ttf"

W, H = 1200, 1200
BG = "#1a1a2e"
ACCENT = "#8B5CF6"
BAR_H = 100

# Main text = 신실장 (big, eye-catching)
# Sub text = 일산명월관
main_text = "신실장"
sub_text = "일산명월관"
bottom_text = "일산룸 현지인 가이드"

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# Top bar
draw.rectangle([0, 0, W, BAR_H], fill=ACCENT)

# Bottom bar
draw.rectangle([0, H - BAR_H, W, H], fill=ACCENT)

# Find max font size for main text to fill ~80% width
def fit_font(text, max_width, max_size=500, min_size=50):
    for size in range(max_size, min_size, -5):
        font = ImageFont.truetype(FONT_PATH, size)
        bbox = font.getbbox(text)
        tw = bbox[2] - bbox[0]
        if tw <= max_width:
            return font, tw, bbox[3] - bbox[1]
    return ImageFont.truetype(FONT_PATH, min_size), 0, 0

target_w = int(W * 0.8)

# Main text — HUGE
main_font, main_tw, main_th = fit_font(main_text, target_w, 400, 100)

# Sub text — smaller
sub_font, sub_tw, sub_th = fit_font(sub_text, target_w, 180, 40)

# Bottom label
label_font = ImageFont.truetype(FONT_PATH, 48)

# Layout: center vertically
total_h = sub_th + 40 + main_th + 40 + 48
start_y = (H - total_h) // 2

# Draw sub text (일산명월관)
sub_x = (W - sub_tw) // 2
draw.text((sub_x, start_y), sub_text, fill="#c4a0ff", font=sub_font)

# Draw main text (신실장) — WHITE, HUGE
main_x = (W - main_tw) // 2
main_y = start_y + sub_th + 40

# Shadow for depth
for dx, dy in [(4, 4), (3, 3), (2, 2)]:
    draw.text((main_x + dx, main_y + dy), main_text, fill="#0a0a1e", font=main_font)

draw.text((main_x, main_y), main_text, fill="#FFFFFF", font=main_font)

# Bottom label text
label_bbox = label_font.getbbox(bottom_text)
label_tw = label_bbox[2] - label_bbox[0]
label_x = (W - label_tw) // 2
label_y = main_y + main_th + 40
draw.text((label_x, label_y), bottom_text, fill="#a0a0b0", font=label_font)

# Top bar text
top_font = ImageFont.truetype(FONT_PATH, 42)
top_text = "일산룸 No.1 가이드"
top_bbox = top_font.getbbox(top_text)
top_tw = top_bbox[2] - top_bbox[0]
top_th = top_bbox[3] - top_bbox[1]
draw.text(((W - top_tw) // 2, (BAR_H - top_th) // 2), top_text, fill="#FFFFFF", font=top_font)

# Bottom bar text
bot_font = ImageFont.truetype(FONT_PATH, 36)
bot_text = "ilsanroom2.pages.dev"
bot_bbox = bot_font.getbbox(bot_text)
bot_tw = bot_bbox[2] - bot_bbox[0]
bot_th = bot_bbox[3] - bot_bbox[1]
draw.text(((W - bot_tw) // 2, H - BAR_H + (BAR_H - bot_th) // 2), bot_text, fill="#FFFFFF", font=bot_font)

# Save
img.save("og-image.png", "PNG", optimize=True)
print(f"Generated og-image.png ({W}x{H})")
print(f"Main text: '{main_text}' at size {main_font.size}px")
print(f"Sub text: '{sub_text}' at size {sub_font.size}px")
