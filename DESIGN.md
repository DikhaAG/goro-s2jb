---
name: PLN GORO Responsive Web System
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#3d494c'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#6d797c'
  outline-variant: '#bcc9cc'
  surface-tint: '#006877'
  primary: '#006877'
  on-primary: '#ffffff'
  primary-container: '#00a2b9'
  on-primary-container: '#00313a'
  inverse-primary: '#5ed6ee'
  secondary: '#9d4300'
  on-secondary: '#ffffff'
  secondary-container: '#fd761a'
  on-secondary-container: '#5c2400'
  tertiary: '#006e2f'
  on-tertiary: '#ffffff'
  tertiary-container: '#00aa4d'
  on-tertiary-container: '#003413'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a5eeff'
  primary-fixed-dim: '#5ed6ee'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#004e5a'
  secondary-fixed: '#ffdbca'
  secondary-fixed-dim: '#ffb690'
  on-secondary-fixed: '#341100'
  on-secondary-fixed-variant: '#783200'
  tertiary-fixed: '#6bff8f'
  tertiary-fixed-dim: '#4ae176'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005321'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
  primary-teal-dark: '#0097A7'
  text-primary: '#1E293B'
  text-dark-carbon: '#0F172A'
  text-secondary: '#64748B'
  neutral-info-bg: '#F8FAFC'
  neutral-info-icon: '#475569'
  warning-bg: '#FFF7ED'
  warning-icon: '#F97316'
  success-bg: '#F0FDF4'
  success-icon: '#22C55E'
  error-bg: '#FEF2F2'
  error-icon: '#EF4444'
  reward-accent: '#F97316'
  surface-card: '#FFFFFF'
  chevron-neutral: '#94A3B8'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  title-card:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-meta:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-badge:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-action:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-desktop: 2rem
  margin: 1rem
  margin-tablet: 2rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style
The design system translates the clarity, immediacy, and trust of an essential public utility service into a modern responsive web environment. Designed for millions of residential and commercial utility customers, the experience centers on calmness, operational clarity, and low cognitive overhead during critical alerts (outages, billing deadlines, and token activations).

The aesthetic builds upon **Modern Utility Minimalism**: flat, high-legibility pastel notification cards paired with authoritative solid-accent icon discs, precise typography, generous click targets, and restrained contrast. Micro-surfaces prioritize data hierarchy, using clean structural whitespace and unmistakable status color associations rather than heavy shadows or ornamental borders.

## Colors
The color architecture relies on a calm, high-efficiency palette with clear functional semantics:

- **Primary Teal (`#00A2B9`, `#0097A7`)**: Serves as the primary operational signature for interactive buttons (e.g., "Aktifkan", quick top-ups), actionable links ("Atur"), active navigation states, and primary feature tile glyphs.
- **Carbon & Slate Neutrals (`#0F172A`, `#1E293B`, `#64748B`)**: Text levels must strictly prioritize legibility. Headings and critical numeric data use dark carbon (`#0F172A` / `#1E293B`), while subtitles, timestamps, and metadata employ secondary muted slate (`#64748B`).
- **Semantic Notification System**:
  - **Neutral / Info**: Pastel slate tint `#F8FAFC` paired with a solid dark slate `#475569` circular icon (used for routine bills, meter reports, and account updates).
  - **Warning**: Pastel orange `#FFF7ED` paired with solid orange `#F97316` circular icon (used for planned maintenance and power outages).
  - **Success**: Pastel green `#F0FDF4` paired with solid green `#22C55E` circular icon (used for token received confirmation and successful payments).
  - **Error / Attention**: Pastel rose/red `#FEF2F2` paired with solid red `#EF4444` circular icon (used for declined account verifications and failed transactions).
  - **Reward Accent (`#F97316`)**: Reserved strictly for gamification, IDPel linking incentives, and reward highlights within cards.

## Typography
Typography is anchored by **Inter**, selected for its systematic clarity, crisp numerals, and tall x-height suited for dense financial and power-consumption metrics.

- **Headings & Titles**: Employ `font-weight: 600` (Semi-Bold) for section titles ("Pemberitahuan", "Saldo PLN Mobile") and individual alert titles ("Tagihan Listrik Bulan Juni", "Token Diterima").
- **Body & Meta Information**: Rendered in `font-weight: 400` (Regular) at 13px–14px with `color: #64748B`.
- **Center Dot Separator Rule**: All compound meta-information (e.g., Account ID, Location, Datetime, or Rupiah amounts) must use the center dot character ` • ` with single space padding (`TP House • Besok, 09:00-11:00` or `193748998378 • Rp 50.000`) to guarantee fast scan speed.

## Layout & Spacing
The layout translates a compact mobile view into a responsive web desktop dashboard:

- **Container Boundaries**: Content is restricted to centered boundaries (`max-w-5xl` for focused utility flows or `max-w-7xl` for full dashboard grids) using `mx-auto` with safe outer margins (`margin-desktop: 3rem`).
- **Adaptive Grid Structure**:
  - *Mobile (< 768px)*: 4-column quick action grid, full-width single-column notification list.
  - *Tablet (768px - 1024px)*: 6-column quick action grid; 2-column dashboard layout separating balance/quick actions and notification streams.
  - *Desktop (> 1024px)*: 8-column service matrix or a dedicated left utility sidebar alongside a primary 2-column split (Left: Balance & Quick Services; Right: Real-time Notifications & Promotion banners).
- **Rhythm & Gaps**: Vertical stack of notification cards maintains a strict `12px` to `16px` (`space-md`) gap. Inside notification cards, layout relies on a three-zone flex row with `16px` (`space-md`) spacing between the leading avatar icon, central text body, and trailing navigation chevron.

## Elevation & Depth
Depth follows strict functional restraint:

- **Flat Pastel Cards (Zero Elevation)**: All semantic status and notification cards are intentionally completely flat (`box-shadow: none; border: none;`). Depth is achieved purely through 5%–10% pastel color tints resting on clean canvas surfaces.
- **Floating Accent Widget (Subtle Elevation)**: Floating account modules, such as the persistent balance widget ("Saldo PLN Mobile"), leverage a delicate low-intensity drop shadow (`shadow-sm`: `0 1px 3px 0 rgba(0, 0, 0, 0.06), 0 1px 2px -1px rgba(0, 0, 0, 0.04)`).
- **Quick Service Grid Elements**: Pure flat white or transparent button containers on subtle neutral borders (`border: 1px solid #F1F5F9`) with no shadow, gaining subtle soft elevation only on hover (`translate-y: -1px`, `shadow-sm`).

## Shapes
Curvature forms the foundational visual DNA of the interface:

- **Notification & Status Cards**: Generous, approachable rounded corners using `rounded-xl` (12px) to `rounded-2xl` (16px).
- **Semantic Icon Badges**: Strictly full-circle (`rounded-full` / 9999px) with fixed dimensions (40px × 40px or 44px × 44px) to provide balanced focal points against soft pastel backgrounds.
- **Interactive Buttons**: Action buttons ("Aktifkan", "Atur") use `rounded-lg` (8px) or pill shapes (`rounded-full`) depending on container context.

## Components

### 1. Semantic Notification Cards
- **Structure**: `flex flex-row items-center gap-4 w-full p-4 rounded-2xl transition-all duration-200 cursor-pointer`
- **Variants**:
  - *Info*: Background `#F8FAFC`, icon container `#475569`, icon color `#FFFFFF`.
  - *Warning*: Background `#FFF7ED`, icon container `#F97316`, icon color `#FFFFFF`.
  - *Success*: Background `#F0FDF4`, icon container `#22C55E`, icon color `#FFFFFF`.
  - *Error*: Background `#FEF2F2`, icon container `#EF4444`, icon color `#FFFFFF`.
- **Leading Element**: 40px × 40px circular container (`rounded-full`) holding centered icon glyphs (lightning, alert, user-error, receipt).
- **Content Block**: `flex flex-col text-left`. Title in semi-bold carbon `#1E293B` (`text-title-card`), subtitle in slate `#64748B` (`text-body-meta`) using the mandatory ` • ` middle separator.
- **Trailing Action**: `chevron-right` icon aligned to the far right via `ml-auto`, colored `#94A3B8`.

### 2. Balance & Floating Utility Card
- **Surface**: Background `#FFFFFF`, border-radius `rounded-2xl`, elevation `shadow-sm`, padding `1.25rem`.
- **Header**: Flex row with account label, balance display, and high-visibility `#00A2B9` primary button with white text and `rounded-lg` borders.

### 3. Action Buttons & Links
- **Primary Action**: Solid `#00A2B9` teal, white typography, hover fill `#0097A7`, active scale 0.98.
- **Tertiary/Header Link ("Atur")**: Pure text button, `#00A2B9`, weight `600`, hover underline or subtle opacity shift.
- **Interactive Promo Action ("Get rewards...")**: Distinctive `#F97316` bold text with inline gift icon accent.

### 4. Service Matrix Navigation Tile
- **Mobile to Web Behavior**: Expands from a 4-column carousel/grid into an 8-column web utility dock or 2-row desktop dashboard widget.
- **Icon Container**: Solid `#00A2B9` rounded square (`rounded-2xl`, 48px × 48px) with high-contrast white vector icons.
- **Label**: Centered below icon, `text-xs font-medium text-slate-700` (`#334155`).

### 5. Inputs & Form Fields
- Crisp `#F8FAFC` background with `#CBD5E1` 1px border. Focus state activates a 2px outer ring in brand teal `#00A2B9` with zero shadow.
