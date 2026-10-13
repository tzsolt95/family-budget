# Draws the app icon (teal square with three white bars) as PNG files, no extra libraries needed.
import struct, sys, zlib
from pathlib import Path

def png(size, path):
    bg, fg = (15, 118, 110), (255, 255, 255)
    bars = [(0.22, 0.55), (0.42, 0.35), (0.62, 0.20)]  # (left edge, top edge) as a fraction of size
    w, base = 0.16, 0.78
    rows = []
    for y in range(size):
        row = bytearray([0])
        fy = y / size
        for x in range(size):
            fx = x / size
            on = any(l <= fx < l + w and t <= fy < base for l, t in bars)
            row += bytes(fg if on else bg)
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b'')
    Path(path).write_bytes(data)

out = Path(sys.argv[1])
for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    png(size, out / name)
