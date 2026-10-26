# Platform Conventions

Read this when building navigation, app chrome, desktop menus, a checkout, or anything meant to feel native on a desktop app (Electron, Tauri), a mobile app (React Native, Flutter) or an installable web app. Plain web pages take the principles and foundations in `SKILL.md`, not these platform rules.

The HIG changes several times a year. Before quoting a rule in a review, open the current page from §6.

## 1. Vocabulary

| Apple says | Flutter / React Native | Electron / Tauri / web | Meaning |
|---|---|---|---|
| System / semantic colors | ThemeData, design tokens | CSS custom properties | Colors named by role that adapt to light, dark and high contrast |
| SF Pro / system font | Platform font | `system-ui` font stack | A legible system face with optical sizes |
| Dynamic Type | `textScaler`, font scaling | Browser zoom, font-size settings | Text follows the user's size setting |
| SF Symbols | Material Icons, Lucide | One icon set | One weight-matched icon system |
| Tab bar | `BottomNavigationBar`, tab navigator | Bottom nav (mobile web) | Top-level sections, always visible |
| Sidebar, split view | `NavigationRail` + detail | Sidebar + content pane | Two- or three-column hierarchy |
| Toolbar | `AppBar`, header | Toolbar | Actions for the current view |
| Sheet, popover | Bottom sheet, modal | Dialog, panel, popover | A short, focused task |
| Liquid Glass, materials | `BackdropFilter`, `BlurView` | `backdrop-filter`, window vibrancy | Translucent functional layer over content |
| VoiceOver | TalkBack, `Semantics`, `accessibilityLabel` | ARIA, screen readers | Screen-reader support |
| Safe area | `SafeArea`, insets | `env(safe-area-inset-*)`, window chrome | Content never hides under system UI |
| Size classes | `LayoutBuilder`, `useWindowDimensions` | Media and container queries | Layout keyed to available space, not to the device |
| Menu bar | — | Native app menu, tray menu | Every command reachable from a menu |

## 2. Mobile (touch first)

- **Top-level navigation is a bottom tab bar** (or a sidebar on tablet width). Tabs navigate, they never perform actions. Few tabs, single-word labels, never hidden or disabled, no "More" overflow if avoidable.
- **Actions for the current view live in a toolbar.** The key action (Done, Save) gets the prominent style; overflow goes into a menu.
- **Important search gets a primary place:** its own tab, or a field near the bottom.
- **Reach:** important controls mid-screen or lower; content respects safe areas; swipe-back and list swipe actions work.
- **Lay out by available width, not by device model or orientation**, with the same functions at every size. Fixed widths and "is this a phone?" checks break foldables, split screens and new devices.
- **One codebase for iOS and Android:** decide per component whether to follow each platform's convention or one shared design, and write the decision down. People notice tab bars, sheets and back navigation first.

## 3. Desktop (pointer and keyboard)

- **Every command is reachable from the app menu**, including everything in the toolbar. Standard shortcuts work (`Cmd/Ctrl+S`, `+Z`, `+F`, `+,` for settings); custom shortcuts are few.
- **Windows** resize fluidly, use the system window controls, support multiple windows where it makes sense, and never keep critical information in a bottom bar.
- **Sidebars** show at most two levels, can be hidden, and keep critical actions out of the bottom edge.
- **Settings** live under the app menu, for general and rarely changed options.
- **Everything interactive** has a hover state, pointer feedback and a comfortable hit area. Right-click opens a context menu where people expect one.
- **Appearance follows the system** light/dark setting by default.

## 4. Glass and blur in code

- **Electron / Tauri: prefer the real system material over CSS imitation.** Electron: the `vibrancy` window option (macOS) and `backgroundMaterial` (Windows). Tauri: the `window-vibrancy` crate (macOS materials, Windows Mica/Acrylic). The native material follows the OS reduce-transparency setting by itself.
- **Inside a webview,** approximate with `backdrop-filter` (plus `-webkit-`), a translucent background and a 1px translucent border (`motion-physics.md` §7).
- **`prefers-reduced-transparency` isn't supported by every engine.** Check current support before relying on it. Where it's missing (e.g. a WebKit webview), read the OS setting natively and pass it to the page, or use the native window material.
- **Clear (very transparent) glass only over media,** with a dark dimming layer (around 35%) when the media is bright. Text-heavy surfaces use the frostier variant.
- **React Native:** `BlurView` (`expo-blur` or `@react-native-community/blur`) for bars, with opaque, static bars when reduce transparency or reduce motion is on. **Android:** prefer opaque or lightly translucent bars; glass isn't part of its design language and blur is costly.
- **Review in code:** glass on rows, cards or backgrounds → content-layer defect · more than a few glass surfaces, or glass nested in glass → restraint defect · an opaque color painted under a bar → replaces the material and the scroll-edge effect · a hand-built bar where the platform component would do → loses system behavior · no reduced-transparency branch around custom blur → accessibility defect.

## 5. Apple Pay on the web

Treat any violation as **Critical**: App Store review rejects apps whose checkout breaks these, including web checkouts the app opens. Verify against the current Apple Pay HIG page before implementing.

- **Use Apple's button, never a look-alike.** Web: the `<apple-pay-button>` element from Apple's Apple Pay JS SDK, or `-webkit-appearance: -apple-pay-button`. Size it only through its documented CSS properties; put nothing inside it and add no background. React Native / Flutter: the payment SDK's native button (e.g. Stripe's platform pay button, the `pay` package), not a JS-drawn copy.
- **No Apple logo glyph or icon-library "apple-pay" icon** standing in for the mark or the word "Apple". Only Apple's unaltered artwork, changed in height only — no recolor, crop, shadow, rotation or animation.
- **Write "Apple Pay"** — two words, capital A and P, never translated.
- **Don't hide or grey out the button** because an option isn't chosen yet; explain after the tap. Hiding it on devices that can't pay is correct.
- **Not smaller or lower than other payment buttons.**

## 6. HIG pages by topic

Base URL: `https://developer.apple.com/design/human-interface-guidelines/<page>`

| Topic | Pages |
|---|---|
| Foundations | `design-principles`, `accessibility`, `layout`, `typography`, `color`, `dark-mode`, `writing`, `branding` |
| Motion and materials | `motion`, `materials`, `playing-haptics` |
| Navigation | `tab-bars`, `toolbars`, `sidebars`, `split-views`, `searching` |
| Actions and modality | `buttons`, `menus`, `modality`, `sheets`, `alerts`, `undo-and-redo` |
| Feedback and data entry | `feedback`, `loading`, `entering-data`, `onboarding`, `privacy` |
| Platforms | `designing-for-ios`, `designing-for-macos`, `designing-for-iphone-duo` |
| Desktop input | `the-menu-bar`, `keyboards`, `pointing-devices`, `windows`, `settings` |
| Payments | `apple-pay` |

To review against many pages offline, the community project [dickwu/apple-design-skill](https://github.com/dickwu/apple-design-skill) keeps a pulled copy of the HIG with a refresh script. That copy is Apple's text; don't paste it into this repo.
