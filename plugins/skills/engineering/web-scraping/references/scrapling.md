# Scrapling — settings to override

Read this only when the project uses Scrapling (`pip show scrapling`, `from scrapling`). Checked against the Scrapling docs on 2026-11-16; verify against the installed version before relying on a default.

| Area | Default to change | Set it to |
|---|---|---|
| Spiders | `robots_txt_obey` defaults to `False` | `True` |
| Spiders | `autothrottle_max_delay` caps `Crawl-delay` and `Retry-After` | At least the largest `Crawl-delay` you expect (e.g. 60) |
| Spiders | Per-domain concurrency unlimited | `concurrent_requests_per_domain` 1–2 |
| Spiders | `development_mode` replays cached responses with no rate limiting | Development only; never in the shipped config |
| Spiders | `crawldir` checkpoints pickle pending request `meta` | Only plain data in `meta` |
| Static fetcher | `stealthy_headers=True` (fake Google referer) | `False`, plus an honest `User-Agent` |
| Static fetcher | `impersonate` sends a Chrome TLS fingerprint | Leave unset |
| Static fetcher | `follow_redirects="safe"` | Keep; still apply `SKILL.md §6` for user-supplied URLs |
| Dynamic fetcher | Loads every resource | `disable_resources=True` for data scraping |
| Parser | `adaptive`/`auto_save` | Only with an explicit `url`; see `SKILL.md §4` |

**Not used by this plugin:** `StealthyFetcher`, `solve_cloudflare`, `hide_canvas`, `google_search`, CDP/WebRTC leak removal and the proxy-escalation recipes. They exist to get past a site's bot protection; a blocked site is a stop (`SKILL.md §3`).
