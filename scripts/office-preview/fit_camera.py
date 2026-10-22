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
FOV = 22.0

# CAMERA in layout.ts: yaw, elevation (degrees), distance, target x, target z, target y.
CURRENT = np.array([41.4, 27.0, 35.7, 9.07, 7.2, 0.12])

# Layout points (metres) and where the reference shows them (pixels): seated agents, the sofa, the back corner.
LANDMARKS = [
    ((4.8 + 0.78, 0, 8.8), (505, 470)),     # Pip
    ((7.0 + 0.78, 0, 5.75), (700, 450)),    # Rex
    ((12.45 + 0.78, 0, 5.2), (985, 520)),   # Nova
    ((11.6 + 0.78, 0, 10.4), (725, 625)),   # Axel
    ((16.0 + 0.78, 0, 7.95), (1036, 660)),  # Muse
    ((14.6, 0, 12.3), (760, 720)),          # sofa
    ((0, 3.0, 0), (600, 100)),              # back corner, top of the fitted wall band
]

# Reference pixels whose floor position is useful when placing furniture.
MARKS = {
    'pip': (505, 470), 'rex': (700, 450), 'nova': (955, 525), 'axel': (725, 625), 'muse': (1036, 660),
    'sofa': (760, 720), 'lamp_front': (910, 745), 'lamp_back': (1157, 520), 'bookcase_right': (1160, 640),
    'meeting_glass_corner': (515, 740), 'meeting_glass_back': (250, 560),
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
