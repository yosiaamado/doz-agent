"""Price facts for one symbol vs a benchmark and peers, from Yahoo Finance chart data.

Usage:
  python -I price_check.py BBCA.JK --bench ^JKSE --peers BBRI.JK,BMRI.JK --range 1y
  python -I price_check.py BTC-USD --bench ETH-USD --since 2026-10-28

--since YYYY-MM-DD reports the move from that date's close (the news date) to the last close,
in % and in ATR multiples, so "is it priced in?" is answered with numbers, not impressions.
--macro idx|us|crypto or a comma list adds one line per macro proxy: its own trend, and the
60-day correlation and beta of the symbol's daily returns to it (which factor drives this price).
Standard library only. Prints one compact block per symbol.
"""
import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

URL = "https://query1.finance.yahoo.com/v8/finance/chart/{sym}?range={rng}&interval=1d"

# Proxies checked on 2026-11-03. Rates (^TNX, ^IRX) are quoted in percent.
MACRO = {
    "idx": "IDR=X,DX-Y.NYB,^TNX,^VIX,CL=F,GC=F,HG=F,EEM,000001.SS",
    "us": "^TNX,^IRX,DX-Y.NYB,^VIX,CL=F,GC=F,HG=F",
    "crypto": "^IXIC,DX-Y.NYB,^TNX,^VIX,GC=F",
}


def fetch(sym, rng):
    url = URL.format(sym=urllib.parse.quote(sym), rng=rng)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.load(resp)
    result = (data.get("chart") or {}).get("result")
    if not result:
        raise ValueError(f"no data for {sym}: {(data.get('chart') or {}).get('error')}")
    r = result[0]
    q = r["indicators"]["quote"][0]
    rows = []
    for i, ts in enumerate(r.get("timestamp") or []):
        o, h, l, c, v = (q[k][i] for k in ("open", "high", "low", "close", "volume"))
        if None in (o, h, l, c):
            continue
        day = datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d")
        rows.append((day, o, h, l, c, v or 0))
    return r["meta"], rows


def sma(xs, n):
    return sum(xs[-n:]) / n if len(xs) >= n else None


def rsi(closes, n=14):
    if len(closes) <= n:
        return None
    gains, losses = [], []
    for a, b in zip(closes[:-1], closes[1:]):
        gains.append(max(b - a, 0))
        losses.append(max(a - b, 0))
    ag, al = sum(gains[:n]) / n, sum(losses[:n]) / n
    for g, l in zip(gains[n:], losses[n:]):  # Wilder smoothing
        ag, al = (ag * (n - 1) + g) / n, (al * (n - 1) + l) / n
    return 100.0 if al == 0 else 100 - 100 / (1 + ag / al)


def atr(rows, n=14):
    if len(rows) <= n:
        return None
    trs = [max(h - l, abs(h - pc), abs(l - pc))
           for (_, _, h, l, _, _), (_, _, _, _, pc, _) in zip(rows[1:], rows[:-1])]
    a = sum(trs[:n]) / n
    for t in trs[n:]:
        a = (a * (n - 1) + t) / n
    return a


def ret(closes, n):
    return (closes[-1] / closes[-1 - n] - 1) * 100 if len(closes) > n else None


def fmt(x, d=2):
    return "n/a" if x is None else f"{x:,.{d}f}"


def daily_returns(rows):
    return {b[0]: b[4] / a[4] - 1 for a, b in zip(rows[:-1], rows[1:]) if a[4]}


def corr_beta(target, factor, n=60):
    days = sorted(set(target) & set(factor))[-n:]
    if len(days) < 20:
        return None, None
    xs, ys = [factor[d] for d in days], [target[d] for d in days]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    vx = sum((x - mx) ** 2 for x in xs)
    vy = sum((y - my) ** 2 for y in ys)
    if not vx or not vy:
        return None, None
    return cov / (vx * vy) ** 0.5, cov / vx


def lagged(factor, target_days):
    """Factor's return on day d mapped to the target's next session after d (US closes after Asia)."""
    out, days = {}, sorted(target_days)
    for d, r in factor.items():
        nxt = next((t for t in days if t > d), None)
        if nxt:
            out[nxt] = r
    return out


def macro_block(target_rows, symbols, rng):
    target = daily_returns(target_rows)
    out = ["## Macro & cross-asset (60d daily-return corr / beta of the symbol to each factor; "
           "lag1 = factor's previous session, for factors that trade after this market closes)"]
    for sym in symbols:
        try:
            _, rows = fetch(sym, rng)
            closes = [r[4] for r in rows]
            factor = daily_returns(rows)
            c, b = corr_beta(target, factor)
            c1, _ = corr_beta(target, lagged(factor, target))
            m50 = sma(closes, 50)
            trend = "n/a" if m50 is None else ("above" if closes[-1] > m50 else "below") + " MA50"
            out.append(f"{sym}: {fmt(closes[-1])} | 5d {fmt(ret(closes, 5))}% | 20d {fmt(ret(closes, 20))}% | "
                       f"{trend} | corr {fmt(c)} | lag1 {fmt(c1)} | beta {fmt(b)}")
        except Exception as e:
            out.append(f"{sym}: ERROR {e}")
    return "\n".join(out)


def describe(sym, rng, since, bench_rows=None):
    meta, rows = fetch(sym, rng)
    if len(rows) < 2:
        raise ValueError(f"too few rows for {sym}")
    closes = [r[4] for r in rows]
    vols = [r[5] for r in rows]
    last = closes[-1]
    a = atr(rows)
    out = [f"## {sym} ({meta.get('currency')}, {meta.get('exchangeName')}) last close {rows[-1][0]}: {fmt(last)}"]
    ma = {n: sma(closes, n) for n in (20, 50, 200)}
    out.append("MA20 {} | MA50 {} | MA200 {} | above: {}".format(
        fmt(ma[20]), fmt(ma[50]), fmt(ma[200]),
        ",".join(str(n) for n, v in ma.items() if v and last > v) or "none"))
    out.append(f"RSI14 {fmt(rsi(closes), 1)} | ATR14 {fmt(a)} ({fmt(a / last * 100 if a else None)}% of price)")
    out.append("Return 5d {}% | 20d {}% | 60d {}%".format(*(fmt(ret(closes, n)) for n in (5, 20, 60))))
    for n in (20, 60):
        w = rows[-n:]
        out.append(f"{n}d range: low {fmt(min(r[3] for r in w))} - high {fmt(max(r[2] for r in w))}")
    hi52, lo52 = max(r[2] for r in rows), min(r[3] for r in rows)
    out.append(f"Period range ({rng}): low {fmt(lo52)} - high {fmt(hi52)} | off high {fmt((last / hi52 - 1) * 100)}%")
    v20 = sma(vols[:-1], 20)
    out.append(f"Volume last {vols[-1]:,.0f} vs 20d avg {fmt(v20, 0)} = {fmt(vols[-1] / v20 if v20 else None)}x")
    out.append("Last 10 closes: " + ", ".join(f"{r[0][5:]} {fmt(r[4])}" for r in rows[-10:]))
    if since:
        base = [r for r in rows if r[0] <= since]
        if base:
            b = base[-1]
            move = (last / b[4] - 1) * 100
            peak = max(r[2] for r in rows if r[0] > b[0]) if rows[-1][0] > b[0] else last
            out.append(f"Since {b[0]} close {fmt(b[4])}: {fmt(move)}% = {fmt((last - b[4]) / a if a else None)} ATR | "
                       f"high after {fmt(peak)}")
        else:
            out.append(f"Since {since}: date before available data")
    if bench_rows and len(bench_rows) > 20 and len(closes) > 20:
        rs = ret(closes, 20) - ret([r[4] for r in bench_rows], 20)
        c, b = corr_beta(daily_returns(rows), daily_returns(bench_rows))
        out.append(f"Relative strength 20d vs bench: {fmt(rs)} pts | beta {fmt(b)} | corr {fmt(c)}")
    return rows, "\n".join(out)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("symbol")
    p.add_argument("--bench")
    p.add_argument("--peers", default="")
    p.add_argument("--range", default="1y")
    p.add_argument("--since")
    p.add_argument("--macro", help="idx | us | crypto, or a comma list of Yahoo symbols")
    args = p.parse_args()
    bench = None
    if args.bench:
        try:
            bench, text = describe(args.bench, args.range, args.since)  # rows
            print(text + "\n")
        except Exception as e:  # keep going: the main symbol still matters
            print(f"## {args.bench}: ERROR {e}\n")
    failed, main_rows = False, None
    for sym in [args.symbol] + [s for s in args.peers.split(",") if s]:
        try:
            rows, text = describe(sym, args.range, args.since, bench)
            main_rows = main_rows or (rows if sym == args.symbol else None)
            print(text + "\n")
        except Exception as e:
            failed = failed or sym == args.symbol
            print(f"## {sym}: ERROR {e}\n")
    if args.macro and main_rows:
        symbols = MACRO.get(args.macro, args.macro).split(",")
        print(macro_block(main_rows, [s for s in symbols if s], args.range))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
