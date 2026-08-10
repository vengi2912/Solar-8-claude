# Musiri Solar Quotation & Site Analysis

A professional, offline-capable Solar Site Analysis + System Sizing + Quotation Generator built for a solar EPC business in **Musiri, Tiruchirappalli, Tamil Nadu**. Runs entirely in the browser — no backend, no server, no build step, no API keys.

This is an upgrade of an earlier single-page rooftop solar estimator. The upgrade **kept and reused** everything that already worked well (KML/KMZ parsing, area/centroid math, the 3-source climate-data fallback chain) and **added** a full 9-step quotation workflow: customer intake → site & footprint → roof capacity & panel layout → electricity consumption → solar system sizing → battery sizing → pricing → On-Grid/Hybrid/Off-Grid comparison → final PDF quotation.

## What's new vs. the earlier estimator

| Area | Earlier version | This upgrade |
|---|---|---|
| Footprint input | KML, KMZ | KML, KMZ, **+ GeoJSON** (Shapefile ZIP intentionally not supported — see Limitations) |
| Panel count | `usable area ÷ panel area` | Same cross-check, **plus** real rows×columns rectangular packing inside the roof's oriented bounding box |
| Roof area | Flat 65% utilization factor | Configurable edge/parapet setback, walkway width, row/column spacing — editable per quotation |
| Panels/inverters/batteries | Fixed defaults in code | **Fully editable databases** in Settings (add/edit/delete rows) |
| Pricing | Two numbers ($/W, tariff) | **Full BOM** (structure, cabling, DCDB/ACDB, earthing, lightning arrester, MC4, civil work), configurable installation (%, or fixed), transport, GST, AMC |
| System types | One (on-grid only) | **On-Grid, Hybrid, Off-Grid** — sized, priced, and compared side-by-side, with an auto-recommendation |
| Output | Feasibility PDF | **Professional quotation PDF** — company header/logo, customer details, site analysis, all 3 proposals with itemised BOM, comparison table, warranty, terms, quotation number |
| Data persistence | None | Save/Load/Export/Import project as JSON (localStorage + file) |
| Site survey | Not present | Orientation, tilt, roof type, parapet height, shading/tree obstruction, connection type, phase, sanctioned load, notes |

## Architecture

Deliberately modular — no single "do everything" file (per your requirement #29):

```
musiri-solar/
├── index.html               # 9-step wizard UI + Settings modal
├── style.css                # dashboard styling (dark, gold/teal accents)
├── js/
│   ├── config.js            # ALL editable defaults: company, panel/inverter/battery DBs,
│   │                          BOM pricing, installation, AMC, GST, tariff, roof defaults, losses
│   ├── geo.js                # KML/KMZ/GeoJSON parsing; pure geometry (area, perimeter,
│   │                          centroid, oriented bounding box) — no DOM code
│   ├── climate.js             # NASA POWER → Open-Meteo → PVGIS fallback (reused, proven)
│   ├── roof-layout.js         # usable area + rows×cols panel-packing algorithm
│   ├── generation.js          # PV generation model with 7 configurable loss factors
│   ├── sizing.js               # roof-capacity-based vs consumption-based sizing; battery sizing
│   ├── pricing.js              # BOM cost build, installation, AMC, savings/payback
│   ├── quotation.js            # orchestrates the above into On-Grid/Hybrid/Off-Grid proposals,
│   │                             the comparison table, and validation warnings
│   ├── storage.js               # project save/load/export/import (localStorage + JSON file)
│   ├── pdf.js                    # professional multi-page quotation PDF builder
│   ├── map.js                     # Leaflet: street/satellite layers, draw/edit footprint,
│   │                                 approximate panel-layout overlay
│   ├── charts.js                   # Chart.js monthly-generation bar chart
│   ├── settings-ui.js               # renders/reads every editable database into the Settings modal
│   └── app.js                        # wizard navigation + wires all the above to the DOM —
│                                        contains NO calculation logic itself
├── sample-footprint.kml / .kmz    # test files
└── LICENSE
```

Nothing calculates a number using a value that isn't in `SolarApp.Config` — every price, loss factor, setback, and tariff slab is editable from the Settings modal (⚙ top-right) and persists in the browser's localStorage.

## Running it

No install needed:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Or open `index.html` directly in a browser (a local server is still recommended, since some browsers restrict local-file `fetch` for the KML/climate-data calls).

## The 9-step workflow

1. **Customer** — name, mobile, email, address, auto-generated quotation number (`MSR-SOLAR-2026-0001`, editable)
2. **Site** — lat/long (auto-filled from footprint centroid), KML/KMZ/GeoJSON upload or draw-on-map, plus a full Site Survey section (orientation, tilt, roof type, shading, connection details)
3. **Roof** — pick a panel, tune setbacks/spacing, get the real packed panel count, rows×columns, and maximum roof capacity, with an approximate panel-layout overlay on the map
4. **Electricity** — average monthly units, or a full 12-month breakdown; shows annual/peak/minimum and a blended tariff estimate
5. **Solar System** — fetches solar resource data (NASA POWER → Open-Meteo → PVGIS automatic fallback) and recommends a capacity that respects **both** the roof's physical limit and the customer's consumption — never one without the other
6. **Battery** — critical load × backup hours → sized battery bank (units, nameplate, usable capacity), shared basis for both Hybrid and Off-Grid
7. **Pricing** — per-quotation installation method/GST overrides; live BOM preview
8. **Comparison** — builds all three system proposals and a comparison table, with an auto-highlighted recommendation and validation warnings
9. **Quotation** — final quotation number, editable terms, **Download Quotation PDF**, and Save/Export/Import project

## Verification performed

Since this sandbox has no network access (can't reach the real CDN libraries or even a local browser over localhost from the test tool), verification was done at the logic level rather than a live visual walkthrough:

- Every calculation module (`geo`, `roof-layout`, `generation`, `sizing`, `pricing`, `quotation`) was run end-to-end offline in Node with representative data (a ~1,446 m² roof, 750 units/month) — panel packing, sizing, BOM, GST, and On-Grid/Hybrid/Off-Grid comparison all produced consistent, sane numbers (e.g. On-Grid: 5.5 kWp, 10 panels, ₹3.37L, ~8.3-year payback at default settings)
- **Two real bugs found and fixed during this review:**
  1. Several UI icons/symbols (⚙, ☀, →, ₹, etc.) had been written as literal `\uXXXX` text instead of real characters — would have displayed as garbage. Fixed across all files.
  2. The tariff table's "unlimited last slab" uses `Infinity`, which `JSON.stringify` silently turns into `null` when Settings are saved to localStorage — silently breaking the tariff calculation after first save (verified: correct payback ~8.3 years became a wrong ~23.9 years). Fixed and stress-tested across repeated save/reload cycles.
- The PDF generator was run against a mock `jsPDF` that records every call — confirmed it produces 3 pages covering customer details, site analysis, all three system proposals with itemised BOM, the comparison table, warranty, and terms, with no runtime errors
- Every `getElementById()` call across all JS files was cross-checked against actual `index.html` IDs — no mismatches
- GeoJSON parsing (Polygon, MultiPolygon, FeatureCollection, and invalid/empty-input error cases) verified correct

**What this does *not* replace**: an actual visual walkthrough in a browser (checking layout, click targets, responsiveness on a real phone). Please open the app yourself after deploying and click through all 9 steps once before using it with a real customer — if anything looks off, tell me exactly what and I'll fix it.

## Known limitations (stated, not hidden)

- **Panel layout is an approximation.** True panel packing on an arbitrary, possibly-concave roof polygon is a hard computational-geometry problem. This app packs panels into the polygon's *oriented bounding box* (long-edge aligned), inset by your configured setbacks — accurate for typical rectangular-ish roofs, but not a substitute for a site survey on irregular shapes. This is stated in the UI, not just here.
- **Shapefile ZIP is not supported.** The app tells the user to convert to GeoJSON or KML first (e.g. via mapshaper.org or QGIS) rather than silently failing or faking support.
- **Tariff table is illustrative**, clearly labelled as such, and fully editable — verify against the customer's actual TANGEDCO/TNPDCL bill before quoting.
- **No polygon drawing/editing** was verified in a live browser in this pass (Leaflet.draw is wired in `map.js`, but couldn't be visually confirmed here — please test this specifically).
- Site-survey **photos** are not supported — only text notes. Photo upload/storage was scoped out to keep the offline/localStorage architecture simple; flagged here rather than left unmentioned.

## Customizing

Open **⚙ Settings** (top-right) to edit: company name/contact/logo/quotation prefix, panel/inverter/battery databases, BOM component pricing, installation method & GST, tariff slabs, roof defaults, and system loss factors. Nothing requires touching the source code.
