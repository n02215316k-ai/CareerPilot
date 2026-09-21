from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter
import re, subprocess

root = Path(__file__).resolve().parents[1]
crop_dir = root / "output" / "booklet-columns"
ocr_dir = root / "output" / "booklet-column-ocr-11"
crop_dir.mkdir(parents=True, exist_ok=True)
ocr_dir.mkdir(parents=True, exist_ok=True)
tesseract = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")

def is_roster(path: Path):
    match = re.search(r"at (\d{2}\.\d{2}\.\d{2})", path.name)
    if not match: return False
    stamp = match.group(1)
    return "12.43.40" <= stamp <= "12.44.03"

jobs = []
for source in sorted(filter(is_roster, root.glob("WhatsApp Image*.jpeg"))):
    image = Image.open(source).convert("L")
    image = ImageEnhance.Contrast(image).enhance(1.7).filter(ImageFilter.SHARPEN)
    width, height = image.size
    # A small overlap protects names close to the page centre.
    for column, (left, right) in enumerate(((0, int(width * .54)), (int(width * .46), width)), 1):
        target = crop_dir / f"{source.stem}__c{column}.png"
        image.crop((left, 0, right, height)).resize(((right-left)*2, height*2)).save(target)
        jobs.append(target)

def run(image: Path):
    target = ocr_dir / image.stem
    subprocess.run([str(tesseract), str(image), str(target), "--psm", "11", "-l", "eng"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return image.name

with ThreadPoolExecutor(max_workers=6) as pool:
    futures = [pool.submit(run, image) for image in jobs]
    for future in as_completed(futures): print(future.result())
