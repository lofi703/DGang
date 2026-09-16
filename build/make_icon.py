#!/usr/bin/env python3
# DGang app icon — dark glass + DG gradient monogram
from PIL import Image, ImageDraw, ImageFont
import os

def font(sz):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf",
              "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"]:
        if os.path.exists(p): return ImageFont.truetype(p, sz)
    return ImageFont.load_default()

OUT="/home/ubuntu/social-app/public/icons"
os.makedirs(OUT,exist_ok=True)

def make(size, path):
    S=size*4  # supersample then downscale for smooth edges
    img=Image.new("RGBA",(S,S),(6,17,38,255))
    d=ImageDraw.Draw(img)
    # radial glow
    r=S*0.7; gle=Image.new("RGBA",(S,S),(0,0,0,0)); dg=ImageDraw.Draw(gle)
    dg.ellipse([S*0.15,S*0.1,S*0.85,S*0.9],fill=(22,168,255,60))
    dg.ellipse([S*0.3,S*0.3,S*0.9,S*1.1],fill=(255,62,200,45))
    img=Image.alpha_composite(img,gle); d=ImageDraw.Draw(img)
    # rounded-square gradient background
    for i in range(S):
        t=i/S
        col=(16+(155-16)*t, (0+92*t), (40+168*t))
        y0=i; y1=i+1+S//S
        d.rectangle([0,y0,S,y1],fill=(int(col[0]),int(col[1]),int(col[2]),255))
    # inner border
    b=int(S*0.05); d.rounded_rectangle([b,b,S-b,S-b],radius=int(S*0.22),outline=(255,255,255,40),width=max(1,int(S*0.02)))
    # monogram "DG"
    f=font(int(S*0.42))
    txt="DG"
    tb=d.textbbox((0,0),txt,font=f); tw=tb[2]-tb[0]; th=tb[3]-tb[1]
    d.text(((S-tw)/2 - tb[0],(S-th)/2 - tb[1]),txt,font=f,fill=(235,242,255,255))
    img=img.resize((size,size),Image.LANCZOS)
    img.save(path,"PNG")

make(512, os.path.join(OUT,"icon-512.png"))
make(192, os.path.join(OUT,"icon-192.png"))
print("icons done ->", OUT)