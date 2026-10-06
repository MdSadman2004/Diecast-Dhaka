---
name: Diecast Dhaka
description: A collector-garage workbench with graphite stages, racing orange and a pale inventory bench.
colors:
  primary: "#f36b28"
  primary-hover: "#ff8a43"
  orange-dark: "#a53b0a"
  ink: "#222824"
  muted: "#646c64"
  paper: "#f6f5f0"
  line: "#dedfd7"
  stage: "#202523"
  inspection-stage: "#30392d"
  image-bench: "#e9ebe3"
  secondary-surface: "#e4e7de"
  secondary-hover: "#d0d6ca"
  action-ink: "#1c241f"
  field-surface: "#fdfef8"
  field-border: "#c8d0bc"
  filter-active-text: "#f5f6ed"
  close-surface: "#f4f6ed"
  record-surface: "#e2e8d7"
  error: "#a02f17"
typography:
  display:
    fontFamily: "'Barlow Condensed', sans-serif"
    fontWeight: 800
    lineHeight: 0.93
    letterSpacing: "-0.018em"
  headline:
    fontFamily: "'Barlow Condensed', sans-serif"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Barlow Condensed', sans-serif"
    fontSize: "25px"
    fontWeight: 600
    lineHeight: 1.15
  inspection-title:
    fontFamily: "'Barlow Condensed', sans-serif"
    fontSize: "44px"
    fontWeight: 700
    lineHeight: 1
  body:
    fontFamily: "'Barlow', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.8
  hero-body:
    fontFamily: "'Barlow', sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  label-action:
    fontFamily: "'Barlow', sans-serif"
    fontSize: "15px"
    fontWeight: 600
  label-filter:
    fontFamily: "'Barlow', sans-serif"
    fontSize: "12px"
    fontWeight: 500
  label-nav:
    fontFamily: "'Barlow', sans-serif"
    fontSize: "14px"
    fontWeight: 500
  label-metadata:
    fontFamily: "'Barlow', sans-serif"
    fontSize: "10px"
    fontWeight: 500
    letterSpacing: "0.06em"
  price:
    fontFamily: "'Barlow', sans-serif"
    fontSize: "20px"
    fontWeight: 600
rounded:
  control: "3px"
  overlay: "4px"
  inspection: "5px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  drawer: "30px"
  detail-desktop: "35px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.action-ink}"
    typography: "{typography.label-action}"
    rounded: "{rounded.control}"
    padding: "17px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary-surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label-action}"
    rounded: "{rounded.control}"
    padding: "17px 24px"
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-close:
    backgroundColor: "{colors.close-surface}"
    textColor: "{colors.ink}"
    width: "44px"
    height: "44px"
  input-text:
    backgroundColor: "{colors.field-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
  input-search:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    width: "175px"
  nav-main:
    textColor: "{colors.ink}"
    typography: "{typography.label-nav}"
  chip-filter:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.label-filter}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  chip-filter-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.filter-active-text}"
  card-inventory:
    textColor: "{colors.ink}"
    padding: "20px 3px 19px"
  order-reference:
    backgroundColor: "{colors.record-surface}"
    textColor: "{colors.ink}"
    padding: "{spacing.lg}"
---

# Design System: Diecast Dhaka

## Overview

**Creative North Star: "Studio Garage Workbench"**

The implemented world is a collector's garage rather than a toy-store banner. Graphite display stages and directional studio lighting give the dimensional cars room to lead; a pale inventory bench makes the catalog, prices and buying controls easy to scan. Racing orange connects the track, selected emphasis and primary actions. Condensed motorsport lettering and thin mechanical icons provide the recognizable voice.

The contrast between cinematic display and practical bench is deliberate. Merchandise details and owner tasks remain matter-of-fact, while inspection and car-to-cart motion carry the collector experience. The procedural cars, demo inventory and planning prices stay visibly qualified; realism of presentation must never imply authenticated stock or product photography.

**Key Characteristics:**
- Graphite stages paired with a pale, lightly ruled inventory bench.
- Racing-orange actions and track geometry, not a multicolor brand palette.
- Self-hosted condensed display type, plain body type and consistent mechanical line icons.
- Dimensional merchandise inspection with honest illustrative/demo labels.

This is a scan-mode record of `src/style.css`, `src/main.js`, `index.html` and `src/cars.js`, using the approved `PRODUCT.md` and `.impeccable/surface.md` language. Frontmatter records implemented primitives, not an aspirational accessibility certification. Responsive fluid type stays in the prose because the portable dimension schema is narrower than CSS `clamp()`. Sidecar color ramps are synthesized previews, not additional production colors.

## Colors

One warm action family sits against graphite, off-white and restrained olive-gray materials. Frontmatter values are normative.

### Primary
- **Racing Orange** (`primary`): track identity, main shopping/add actions, accent words, selection and focus treatments; sourced from the orange CSS property.
- **Hot Track Highlight** (`primary-hover`): brighter primary-button hover state.
- **Burnt Orange** (`orange-dark`): hover emphasis for small text actions on pale surfaces.

### Neutral
- **Garage Ink** (`ink`) and **Action Ink** (`action-ink`): body/heading text and dark text on orange actions.
- **Muted Mechanic Gray** (`muted`): supporting descriptions, qualifications and secondary information.
- **Inventory Paper** (`paper`): page, header, dialog and drawer foundation.
- **Bench Rule** (`line`): shared dividers, header rule and modal specification separators.
- **Graphite Studio** (`stage`) and **Olive Inspection Bay** (`inspection-stage`): hero/closing backdrop and product-inspection canvas enclosure.
- **Thumbnail Bench** (`image-bench`): pale generated-product-image beds.
- **Secondary Surface / Hover** (`secondary-surface`, `secondary-hover`): quieter buttons, with no competing brand accent.
- **Field Surface / Border** (`field-surface`, `field-border`): checkout and owner-form fields.
- **Active Filter Text** (`filter-active-text`), **Close Surface** (`close-surface`) and **Record Surface** (`record-surface`): reversed selected chips, visible dismissal controls and order-reference/tracking panels.
- **Validation Red** (`error`): semantic form error text, not a second marketing accent.

**The Track-to-Action Rule.** Preserve the shared orange identity between the track and primary actions; do not introduce a competing brand accent.

## Typography

**Display Font:** Barlow Condensed (with sans-serif fallback)
**Body Font:** Barlow (with sans-serif fallback)

Self-hosted display weights are 600, 700 and 800; body weights are 400, 500 and 600.

The condensed display voice feels like motorsport lettering; Barlow keeps specifications, fields and order data practical. Prices and totals use tabular numerals in CSS. Icons are Lucide SVGs, normally 20px with a 1.65 stroke, not emoji or mixed icon families.

### Hierarchy
- **Display** (800, line-height 0.93, tracking -0.018em): hero heading. Desktop size is `clamp(62px,6.7vw,96px)`; the implemented narrower-breakpoint overrides are documented in Layout.
- **Headline** (700, line-height 1): catalog heading; desktop size `clamp(38px,4vw,56px)`.
- **Title** (600, 25px, line-height 1.15): inventory casting names; inspection uses a separate 44px/700 role.
- **Body** (400, 13px, line-height 1.8): product description, not an invented site-wide base size. Hero copy uses 17px/1.65; general page prose varies by surface.
- **Labels** (500 or 600, surface-specific sizing): primary actions use 15px/600; filters 12px/500; navigation 14px/500; category metadata 10px/500 with 0.06em tracking.
- **Price** (600, 20px): card price; inspection price is 27px/600. Qualification copy is smaller and visually subordinate, never removed to imply verified pricing.

**The Two-Family Rule.** Use Barlow Condensed for display and casting titles, and Barlow for copy, controls and data.

The current 7–10px narrow-screen microcopy is recorded prototype debt, not a desirable minimum for new content. This extraction does not upgrade its readability or the existing focus-outline contrast.

## Layout

The storefront is fluid, not constrained to a fabricated global 1200px container. Header gutters are 5%; most major sections use 6vw. The desktop hero divides 43% copy / 57% display, changing to 45% / 55% below 1150px. The inventory grid has three equal columns with 30px row / 23px column gaps. The owner workbench separately uses a 1240px maximum and 30px horizontal padding.

Observed spacing entries are recurring values, not a strict 8px grid. Primary buttons use 17px by 24px padding and a 52px minimum height; compact buttons use 13px by 16px and a 44px minimum. Inventory metadata uses 20px/3px/19px padding. Preserve the practical density without treating every one-off offset as a system token.

- **1600px and above:** taller hero/canvas and thumbnail beds.
- **1150px and below:** tighter hero and card presentation; card-add text is hidden and its control becomes 36px square. Hero heading becomes 73px.
- **800px and below:** hero and collector sections stack; inventory becomes two columns with 25px/16px gaps; filters scroll horizontally. Hero heading uses `clamp(64px,12vw,93px)`, and the catalog heading is 42px. Header height becomes 76px instead of 90px.
- **480px and below:** hero heading 65px, catalog heading 38px, product titles 22px and prices 18px; cards remain two columns, with 24px/13px gaps and 156px image beds. Navigation links recede while tracking and cart controls remain.

The inspection dialog is 990px wide, capped at 94vw and 94dvh, fixed and centered with internal vertical scrolling. Its desktop grid is 54% art / 46% copy, with a 410px canvas and 58px/35px/35px copy padding. At 800px it becomes one column, the canvas is 300px and copy padding is 20px. The 44px close control belongs to a sticky zero-height full-span wrapper 15px below the dialog top. Do not restore an absolute close button that scrolls out of reach. The cart is a right drawer, 480px wide and capped to the viewport, with a sticky header.

## Elevation & Depth

This is a hybrid: studio lighting and rendered car shadows establish the dimensional display, while most UI surfaces stay flat and separate by tone or fine rules. Inventory cards do not gain generic floating-card shadows. Native modal backdrops use a dark translucent veil (`#141b16a6`) and a 3px blur, keeping the foreground unmistakable.

### Shadow Vocabulary
- **Cart drawer** (`box-shadow: -10px 0 50px #07150730`): a lateral shadow separating the purchasing workbench.
- **Toast** (`0 7px 25px #1118`): a transient lifted confirmation.

**The Flat Bench Rule.** Keep inventory cards flat and rule-separated; reserve UI shadows for the drawer and transient feedback.

## Shapes

Controls have subtly engineered 3px corners; notices/toasts and information dialogs use 4px, and the inspection dialog uses 5px. Inventory cards and image beds are rectangular rather than oversized rounded tiles. Circular icon controls, swatches and the cart count use 50% radii in CSS, not an invented portable dimension token. The tracking status pill uses 30px corners.

Oval turntables, curved orange track and cropped scale/road graphics are signature scene geometry. Their decorative clipping is intentional; titles, prices, dismissal controls and purchase actions must remain within the usable modal/viewport clip.

## Components

### Buttons
Confident, compact mechanical actions. Primary orange and quiet secondary variants share a 3px shape, 15px/600 text and inline 20px icons. Primary hover brightens and lifts 2px with an 0.18s background/transform transition; secondary hover changes tone. Compact and full-width variants preserve the same identity. Disabled buttons retain the implemented 0.5 opacity and not-allowed cursor.

Buttons, links and canvases use the existing 3px orange focus outline with a 5px offset. This documents the current treatment, not a contrast pass. The inspection close is a 44px circular pale control; ordinary icon controls elsewhere remain 40px, with smaller card controls documented as debt.

### Chips
Collection filters are squared-off 3px controls, transparent at rest, with 10px/12px padding. The active filter reverses to Garage Ink with pale text; unselected hover uses a pale olive-gray fill. Mobile filters stay in a horizontally scrollable row rather than wrapping into a large toolbar.

### Cards / Containers
Inventory cards are flat rows of thumbnail bed plus metadata, divided by a fine bottom rule. Generated thumbnails and actual casting identity stay paired. Category, condensed title, BDT price, demo qualification and add control form the hierarchy. Do not add unsupported ratings, discount badges or scarcity claims.

Order references and tracking results use a pale olive record panel with 20px padding. References wrap anywhere when necessary, preventing an identifier from forcing document overflow.

### Inputs / Fields
Checkout fields use a pale field surface, thin olive-gray stroke, 3px corners, 12px/13px padding and 14px body type. Search uses an inline 15px search icon and a transparent field inside a 175px bordered enclosure, becoming flexible on mobile. Input focus is a 2px orange outline; search transfers that treatment to its enclosure. Validation errors use the recorded semantic red and adjacent alert text. Native validation, actual field labels and error states are not decorative placeholders.

### Navigation
The sticky paper header uses a condensed DD wordmark, Barlow navigation and a mechanical cart icon with circular count. Navigation links/buttons gain an orange underline on hover through a 0.2s scale transition. Responsive rules hide secondary links rather than inventing a menu that does not exist.

### Inspection and Car-to-Cart Motion
A native modal joins an olive 3D bay to the paper specification bench. The complete car, rotate affordance, illustrative qualifier, title, price and add action remain distinguishable. Use the fixed, internally scrollable dialog and sticky dismissal contract described in Layout.

Dialog entrance is 0.25s with `cubic-bezier(.2,.7,.2,1)` and a 15px upward settle. The selected car's body and color drive into the cart in a nominal 1700ms Three.js sequence; it is not a generic recolored vehicle. Reduced-motion CSS disables transitions/animations, and JavaScript bypasses the driving sequence while still adding the selected item. Component previews in the sidecar are static HTML/CSS examples, not a reimplementation of 3D or commerce behavior.

## Do's and Don'ts

### Do:
- Do preserve the graphite stage, racing-orange action family and pale inventory bench.
- Do pair Barlow Condensed casting titles with Barlow copy and consistent Lucide line icons.
- Do keep illustrative assets, demo inventory, planning prices and local-only orders visibly qualified.
- Do keep modal controls reachable after scroll and honor the reduced-motion cart path.

### Don't:
- Don't replace the collector-garage direction with a toy-store banner or a competing multicolor identity.
- Don't present procedural silhouettes as authenticated product photography or exact replicas.
- Don't add fabricated testimonials, ratings, discount claims, market values or scarcity.
- Don't confuse documented prototype styling with full accessibility certification or live-sales readiness.
