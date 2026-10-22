"""Camera fitting for the 3D office against docs/reference.png.

Usage (repo root):
  python3 scripts/office-preview/fit_camera.py            # fit the camera to the landmarks, print residuals
  python3 scripts/office-preview/fit_camera.py --unproject  # floor (x, z) under reference pixels, for layout.ts

World (same as src/renderer/src/office/layout.ts): the back corner is the origin, the left wall is the plane x = 0
(running along +z), the right wall is z = 0 (running along +x). Pixel coordinates are in the full 1536x1024 reference;
the office canvas covers its region (172, 80)-(1232, 880). Pure numpy so it runs anywhere.
"""
import sys
import numpy as np

OX, OY, CW, CH = 172, 80, 1060, 800
FOV = 10.0

# CAMERA in layout.ts: yaw, elevation (degrees), distance, target x, target z, target y.
CURRENT = np.array([42.6, 19.6, 63.7, 9.06, 7.37, 1.11])

# Layout points (metres) and where the reference shows them (pixels): seated heads (y = 1.25) and the room's
# structural corners.
LANDMARKS = [
    ((4.4, 1.25, 8.2), (424, 412)),      # Pip
    ((7.35, 1.25, 5.45), (705, 410)),    # Rex
    ((11.15, 1.25, 4.45), (952, 455)),   # Nova
    ((11.55, 1.25, 10.9), (652, 577)),   # Axel
    ((11.75, 1.25, 9.75), (727, 560)),   # Axel's neighbour
    ((15.6, 1.25, 8.1), (1037, 600)),    # Muse
    ((0, 0, 0), (595, 300)),             # back corner, floor
    ((0, 3.4, 0), (598, 105)),           # back corner, wall cap
    ((16.5, 0, 15.4), (705, 875)),       # front corner
]

# Reference pixels whose floor position is useful when placing furniture.
MARKS = {
    'pip': (430, 476), 'sofa': (760, 720), 'lamp_front': (910, 745), 'bookcase_right': (1160, 640),
    'meeting_glass_back_corner': (527, 730), 'meeting_glass_front_corner': (352, 800), 'printer': (480, 423),
}


def camera(p):
    yaw, elev, dist, tx, tz, ty = p
    a, e = np.radians(yaw), np.radians(elev)
    target = np.array([tx, ty, tz])
    pos = target + dist * np.array([np.cos(e) * np.sin(a), np.sin(e), np.cos(e) * np.cos(a)])
    f = (target - pos) / np.linalg.norm(target - pos)
    r = np.cross(f, [0, 1, 0])
    r /= np.linalg.norm(r)
    return pos, f, r, np.cross(r, f)


def project(p, point):
    pos, f, r, u = camera(p)
    d = np.asarray(point, float) - pos
    z = d @ f
    t = np.tan(np.radians(FOV) / 2)
    nx = (d @ r) / (z * t * CW / CH)
    ny = (d @ u) / (z * t)
    return np.array([OX + (nx + 1) / 2 * CW, OY + (1 - ny) / 2 * CH])


def unproject_floor(p, px, py):
    pos, f, r, u = camera(p)
    t = np.tan(np.radians(FOV) / 2)
    nx = (px - OX) / CW * 2 - 1
    ny = 1 - (py - OY) / CH * 2
    ray = f + r * nx * t * CW / CH + u * ny * t
    hit = pos + (-pos[1] / ray[1]) * ray
    return hit[0], hit[2]


def cost(p):
    return sum(float(np.sum((project(p, a) - np.array(b)) ** 2)) for a, b in LANDMARKS)


def fit(p, fixed_elevation=True):
    """Coordinate descent; elevation stays fixed by default (the reference's angle is a design choice)."""
    p = p.copy()
    step = np.array([2, 2, 3, 0.5, 0.5, 0.3])
    best = cost(p)
    for _ in range(80):
        improved = False
        for i in range(len(p)):
            if fixed_elevation and i == 1:
                continue
            for sign in (1, -1):
                q = p.copy()
                q[i] += sign * step[i]
                c = cost(q)
                if c < best:
                    p, best, improved = q, c, True
        if not improved:
            step *= 0.5
    return p, best


if __name__ == '__main__':
    if '--unproject' in sys.argv:
        for name, (x, y) in MARKS.items():
            print(f'{name:22s}', np.round(unproject_floor(CURRENT, x, y), 2))
    else:
        print('current rms px', round((cost(CURRENT) / len(LANDMARKS)) ** 0.5, 1))
        p, c = fit(CURRENT)
        print('fitted yaw, elev, dist, tx, tz, ty =', np.round(p, 2), 'rms px', round((c / len(LANDMARKS)) ** 0.5, 1))
        for a, b in LANDMARKS:
            print(a, '->', np.round(project(p, a)), 'reference', b)
