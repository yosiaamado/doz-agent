// The Doz Studio logo: a robot in the middle of a 4-step flow (document → check → data → settings).
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs>
<linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f6bff"/><stop offset="1" stop-color="#18b8b0"/></linearGradient>
<linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f7bff"/><stop offset="1" stop-color="#2748e6"/></linearGradient>
<linearGradient id="gp" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#4f46e5"/></linearGradient>
<linearGradient id="gt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2dd4bf"/><stop offset="1" stop-color="#0ea5b7"/></linearGradient>
<linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1d6ff2"/><stop offset="1" stop-color="#16a3d9"/></linearGradient>
</defs>
<path d="M50 23V20a7 7 0 0 0-2-4.9M16 30v-8a8 8 0 0 1 8-8h22M16 36v8a8 8 0 0 0 8 8h24a8 8 0 0 0 8-8v-8" fill="none" stroke="url(#gl)" stroke-width="3.2" stroke-linecap="round"/>
<path d="M45 10.5l4.2 3.6-4.2 3.6" fill="none" stroke="#2f7bff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="21" y="7" width="20" height="13" rx="4.5" fill="url(#gb)"/>
<rect x="25.5" y="11" width="11" height="2.2" rx="1.1" fill="#eef3ff"/><rect x="25.5" y="14.6" width="12.5" height="2.2" rx="1.1" fill="#eef3ff"/>
<rect x="6" y="26" width="15" height="15" rx="4.5" fill="url(#gp)"/>
<circle cx="13.5" cy="33.5" r="3.6" fill="none" stroke="#f5f3ff" stroke-width="2.4" stroke-dasharray="2.1 1.2"/><circle cx="13.5" cy="33.5" r="1.3" fill="#f5f3ff"/>
<rect x="43" y="26" width="15" height="15" rx="4.5" fill="url(#gt)"/>
<path d="M46.8 33.6l2.7 2.7 5-5.3" fill="none" stroke="#f0fdfa" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="24" y="46" width="15" height="12" rx="4" fill="url(#gd)"/>
<ellipse cx="31.5" cy="49.5" rx="4" ry="1.4" fill="#e8f3ff"/><rect x="27.5" y="51.4" width="8" height="1.9" rx=".95" fill="#e8f3ff"/><rect x="27.5" y="54.2" width="8" height="1.9" rx=".95" fill="#e8f3ff"/>
<line x1="31.5" y1="21.5" x2="31.5" y2="25" stroke="#2f55ea" stroke-width="2"/><circle cx="31.5" cy="21" r="2.1" fill="#2f7bff"/>
<rect x="21.3" y="29.5" width="3.4" height="7" rx="1.7" fill="#2f6bff"/><rect x="38.3" y="29.5" width="3.4" height="7" rx="1.7" fill="#2f6bff"/>
<rect x="23.5" y="25" width="16" height="15" rx="7" fill="#f2f5ff" stroke="#6d8dff" stroke-width="1"/>
<rect x="25.8" y="28.3" width="11.4" height="8" rx="4" fill="#18234d"/>
<rect x="28.4" y="30.4" width="1.8" height="3.6" rx=".9" fill="#f2f5ff"/><rect x="32.8" y="30.4" width="1.8" height="3.6" rx=".9" fill="#f2f5ff"/>
</svg>`;

export const BRAND = 'Doz Studio';

export default function Logo({ size = 28 }) {
  return (
    <span
      className="logo" role="img" aria-label={BRAND} style={{ width: size, height: size, display: 'inline-block', flex: 'none' }}
      // Static SVG owned by the app itself (not user input), so inlining it is safe.
      dangerouslySetInnerHTML={{ __html: LOGO_SVG }}
    />
  );
}
