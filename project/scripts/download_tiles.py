#!/usr/bin/env python3
"""
download_tiles.py — Téléchargement tuiles OpenStreetMap pour usage offline
Usage: python3 download_tiles.py <lat_min> <lng_min> <lat_max> <lng_max> <zoom_min> <zoom_max>
Exemple Bobo-Dioulasso: python3 download_tiles.py 11.0 -4.5 11.4 -4.0 10 15
"""
import sys, os, math, time, urllib.request

TILES_DIR = os.path.join(os.path.dirname(__file__), 'frontend', 'tiles')
OSM_URL   = "https://tile.openstreetmap.org/{z}/{x}/{y}.png"
HEADERS   = {"User-Agent": "AlertPlatform/1.0 (offline-tiles-downloader)"}

def deg2tile(lat, lng, zoom):
    lat_r = math.radians(lat)
    n     = 2 ** zoom
    x     = int((lng + 180) / 360 * n)
    y     = int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n)
    return x, y

def download_tiles(lat_min, lng_min, lat_max, lng_max, zoom_min, zoom_max):
    total = 0
    for z in range(zoom_min, zoom_max + 1):
        x1, y2 = deg2tile(lat_max, lng_min, z)
        x2, y1 = deg2tile(lat_min, lng_max, z)
        count  = (x2 - x1 + 1) * (y2 - y1 + 1)
        print(f"Zoom {z}: {count} tuiles")
        total += count

    if total > 2000:
        ans = input(f"⚠️  {total} tuiles à télécharger. Continuer ? (o/N): ")
        if ans.lower() != 'o':
            print("Annulé.")
            return

    downloaded = 0
    skipped    = 0
    errors     = 0

    for z in range(zoom_min, zoom_max + 1):
        x1, y2 = deg2tile(lat_max, lng_min, z)
        x2, y1 = deg2tile(lat_min, lng_max, z)

        for x in range(x1, x2 + 1):
            for y in range(y1, y2 + 1):
                path = os.path.join(TILES_DIR, str(z), str(x))
                file = os.path.join(path, f"{y}.png")
                os.makedirs(path, exist_ok=True)

                if os.path.exists(file):
                    skipped += 1
                    continue

                url = OSM_URL.format(z=z, x=x, y=y)
                try:
                    req  = urllib.request.Request(url, headers=HEADERS)
                    resp = urllib.request.urlopen(req, timeout=10)
                    with open(file, 'wb') as f:
                        f.write(resp.read())
                    downloaded += 1
                    if downloaded % 50 == 0:
                        print(f"  {downloaded} téléchargées, {skipped} existantes, {errors} erreurs")
                    time.sleep(0.1)  # Respecter le rate limit OSM
                except Exception as e:
                    errors += 1
                    if errors < 5:
                        print(f"  Erreur {url}: {e}")

    print(f"\n✅ Terminé: {downloaded} téléchargées, {skipped} existantes, {errors} erreurs")
    print(f"Dossier: {TILES_DIR}")

if __name__ == '__main__':
    if len(sys.argv) < 7:
        # Défaut : Bobo-Dioulasso zoom 10-14
        lat_min, lng_min = 11.05, -4.45
        lat_max, lng_max = 11.30, -4.15
        zoom_min, zoom_max = 10, 14
        print(f"Usage par défaut: Bobo-Dioulasso zoom {zoom_min}-{zoom_max}")
    else:
        lat_min  = float(sys.argv[1])
        lng_min  = float(sys.argv[2])
        lat_max  = float(sys.argv[3])
        lng_max  = float(sys.argv[4])
        zoom_min = int(sys.argv[5])
        zoom_max = int(sys.argv[6])

    download_tiles(lat_min, lng_min, lat_max, lng_max, zoom_min, zoom_max)
