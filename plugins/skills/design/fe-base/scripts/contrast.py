"""WCAG 2.x contrast ratio for foreground/background color pairs.

Usage:
  python contrast.py FG BG [FG BG ...]
  python contrast.py "#475569" "#F7F8FA" "oklch(0.6 0.15 250)" "#ffffff"

Colors: #rgb, #rrggbb, #rrggbbaa, rgb()/rgba(), oklch(L C H [/ a]) with L as 0-1 or %.
A translucent foreground is composited over its background first.
Exit code 1 if any pair fails 4.5:1 (normal text).
"""
import math
import re
import sys


def _num(s, scale=1.0):
    s = s.strip()
    return float(s[:-1]) / 100 * scale if s.endswith("%") else float(s)


def _oklch_to_srgb(l, c, h):
    a, b = c * math.cos(math.radians(h)), c * math.sin(math.radians(h))
    l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (l - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = (
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
    )
    out = []
    for v in lin:
        v = min(max(v, 0.0), 1.0)  # clip out-of-gamut to sRGB, as browsers do on sRGB screens
        out.append(12.92 * v if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055)
    return tuple(out)


def parse(color):
    s = color.strip().lower()
    if s.startswith("#"):
        h = s[1:]
        if len(h) in (3, 4):
            h = "".join(ch * 2 for ch in h)
        if len(h) not in (6, 8):
            raise ValueError(color)
        vals = [int(h[i:i + 2], 16) / 255 for i in range(0, len(h), 2)]
        return tuple(vals[:3]), (vals[3] if len(vals) == 4 else 1.0)
    m = re.fullmatch(r"(rgba?|oklch)\((.*)\)", s)
    if not m:
        raise ValueError(color)
    parts = [p for p in re.split(r"[\s,/]+", m.group(2).strip()) if p]
    alpha = _num(parts[3]) if len(parts) > 3 else 1.0
    if m.group(1) == "oklch":
        return _oklch_to_srgb(_num(parts[0]), _num(parts[1], 0.4), float(parts[2].rstrip("deg"))), alpha
    return tuple(_num(p, 255) / 255 for p in parts[:3]), alpha


def luminance(rgb):
    lin = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in rgb]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def ratio(fg, bg):
    (frgb, fa), (brgb, _) = parse(fg), parse(bg)
    frgb = tuple(fa * f + (1 - fa) * b for f, b in zip(frgb, brgb))
    hi, lo = sorted((luminance(frgb), luminance(brgb)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def main(args):
    if not args or len(args) % 2:
        print(__doc__)
        return 2
    failed = False
    for fg, bg in zip(args[::2], args[1::2]):
        r = ratio(fg, bg)
        ok = lambda t: "pass" if r >= t else "FAIL"
        failed |= r < 4.5
        print(f"{r:5.2f}:1  text {ok(4.5)} | large/UI {ok(3.0)}  {fg} on {bg}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
