from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
out = root / "output" / "booklet-ocr"
out.mkdir(parents=True, exist_ok=True)
tesseract = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
images = sorted(root.glob("WhatsApp Image*.jpeg"))

def run(image: Path):
    target = out / image.stem
    subprocess.run([str(tesseract), str(image), str(target), "--psm", "6", "-l", "eng"], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return image.name

with ThreadPoolExecutor(max_workers=6) as pool:
    futures = [pool.submit(run, image) for image in images]
    for future in as_completed(futures):
        print(future.result())
