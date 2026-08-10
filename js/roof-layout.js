/* ==========================================================================
   roof-layout.js — usable roof area (after setbacks/walkways) and an actual
   panel-packing algorithm (rows x columns), not just usable-area / panel-area.

   Honesty note: true irregular-polygon panel packing is a hard computational-
   geometry problem. This module approximates it by packing panels into the
   polygon's oriented bounding box (long-edge aligned), inset by the roof
   setbacks — a good, transparent approximation for typical rectangular-ish
   roofs, but not pixel-perfect for very irregular shapes. This is stated
   explicitly wherever the layout is shown to the user.
   ========================================================================== */
window.SolarApp = window.SolarApp || {};

SolarApp.RoofLayout = (function () {

  // Usable area after configurable setbacks/walkways — used as a sanity cap
  // and for the "quick estimate" path (no full packing).
  function usableArea(footprintAreaM2, roofCfg) {
    // Perimeter-based setback stripped off, plus a flat utilization ceiling
    // as a second, independent constraint (whichever is more conservative).
    const setbackFraction = Math.min(0.6, (roofCfg.edgeSetbackM + roofCfg.parapetSetbackM) / 10); // heuristic falloff
    const afterSetback = footprintAreaM2 * (1 - setbackFraction);
    const afterUtilCap = footprintAreaM2 * (roofCfg.utilizationPct / 100);
    return Math.min(afterSetback, afterUtilCap);
  }

  // Real rectangular packing inside the oriented bounding box, inset by setbacks.
  // Returns rows, columns, panel count, used area, and a grid description for
  // drawing an approximate layout on the map.
  function packPanels(obb, panel, roofCfg) {
    const orientation = roofCfg.panelOrientation === "landscape" ? "landscape" : "portrait";
    const panelW = orientation === "portrait" ? panel.widthMM / 1000 : panel.lengthMM / 1000;
    const panelH = orientation === "portrait" ? panel.lengthMM / 1000 : panel.widthMM / 1000;

    const inset = roofCfg.edgeSetbackM + roofCfg.parapetSetbackM + roofCfg.walkwayWidthM;
    const usableW = Math.max(0, obb.widthM - 2 * inset);
    const usableH = Math.max(0, obb.heightM - 2 * inset);

    const colPitch = panelW + roofCfg.columnSpacingM;
    const rowPitch = panelH + roofCfg.rowSpacingM;

    const cols = Math.max(0, Math.floor((usableW + roofCfg.columnSpacingM) / colPitch));
    const rows = Math.max(0, Math.floor((usableH + roofCfg.rowSpacingM) / rowPitch));

    const panelCount = rows * cols;
    const usedAreaM2 = panelCount * panelW * panelH;
    const capacityKW = panelCount * panel.wattage / 1000;

    return {
      orientation, panelW, panelH, rows, cols, panelCount, usedAreaM2, capacityKW,
      insetM: inset, usableW, usableH,
      approximate: true,
    };
  }

  // Combine both methods: geometric packing is primary; usable-area/panel-area
  // is shown alongside as a cross-check. The lower of the two panel counts wins
  // (conservative — never overpromise capacity).
  function computeRoofCapacity(footprintSummary, panel, roofCfg) {
    const areaM2 = footprintSummary.areaM2;
    const usableAreaM2 = usableArea(areaM2, roofCfg);
    const panelAreaM2 = (panel.lengthMM / 1000) * (panel.widthMM / 1000);
    const simplePanelCount = Math.floor(usableAreaM2 / panelAreaM2);

    const packing = packPanels(footprintSummary.obb, panel, roofCfg);

    const finalPanelCount = Math.min(simplePanelCount, packing.panelCount);
    const finalCapacityKW = finalPanelCount * panel.wattage / 1000;
    const usedAreaM2 = finalPanelCount * panelAreaM2;
    const remainingAreaM2 = Math.max(0, areaM2 - usedAreaM2);

    return {
      footprintAreaM2: areaM2,
      usableAreaM2,
      simplePanelCount,
      packing,
      finalPanelCount,
      finalCapacityKW,
      usedAreaM2,
      remainingAreaM2,
      panel,
    };
  }

  return { usableArea, packPanels, computeRoofCapacity };
})();
