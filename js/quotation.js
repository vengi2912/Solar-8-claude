/* ==========================================================================
   quotation.js — orchestrates geo + climate + roof-layout + generation +
   sizing + pricing into three full quotations (on-grid / hybrid / off-grid)
   and a comparison table, plus validation warnings for unrealistic inputs.
   ========================================================================== */
window.SolarApp = window.SolarApp || {};

SolarApp.Quotation = (function () {

  function buildOnGrid(ctx) {
    const { roofCapacity, cfg, consumption } = ctx;
    const capacityKW = ctx.recommendedKW;
    const panelCount = Math.round(capacityKW * 1000 / roofCapacity.panel.wattage);
    const inverter = pickInverter(cfg.inverters, "on-grid", capacityKW);
    const generation = SolarApp.Generation.computeGeneration(capacityKW, ctx.monthlyClimatology, cfg.losses);
    const cost = SolarApp.Pricing.buildSystemCost({ capacityKW, panelCount, panel: roofCapacity.panel, inverter }, cfg);
    const savings = SolarApp.Pricing.savingsAndPayback(generation.annualKWh, consumption.annual, cfg.tariff, cost.finalPrice);
    return { type: "On-Grid", capacityKW, panelCount, inverter, cost, savings, generation, battery: null, backupHours: 0 };
  }

  function buildHybrid(ctx) {
    const { roofCapacity, cfg, consumption, criticalLoadKW, backupHours } = ctx;
    const capacityKW = ctx.recommendedKW;
    const panelCount = Math.round(capacityKW * 1000 / roofCapacity.panel.wattage);
    const inverter = pickInverter(cfg.inverters, "hybrid", capacityKW);
    const battery = cfg.batteries.find(b => b.id === cfg.defaultBatteryId) || cfg.batteries[0];
    const batterySizing = SolarApp.Sizing.sizeBattery(criticalLoadKW, backupHours, battery, cfg.battery.systemLossPct);
    const generation = SolarApp.Generation.computeGeneration(capacityKW, ctx.monthlyClimatology, cfg.losses);
    const cost = SolarApp.Pricing.buildSystemCost({
      capacityKW, panelCount, panel: roofCapacity.panel, inverter, battery, batteryUnits: batterySizing.unitsNeeded,
    }, cfg);
    const savings = SolarApp.Pricing.savingsAndPayback(generation.annualKWh, consumption.annual, cfg.tariff, cost.finalPrice);
    return { type: "Hybrid", capacityKW, panelCount, inverter, cost, savings, generation, battery, batterySizing, backupHours };
  }

  function buildOffGrid(ctx) {
    const { cfg, consumption, criticalLoadKW, backupHours } = ctx;
    const battery = cfg.batteries.find(b => b.id === cfg.defaultBatteryId) || cfg.batteries[0];
    const dailyEnergyKWh = consumption.avgMonthly / 30 || criticalLoadKW * 6;
    const autonomyDays = Math.max(1, backupHours / 24);
    // rough peak-sun-hours estimate from climatology, for initial sizing
    const roughPeakSun = ctx.monthlyClimatology.reduce((s, m) => s + m.ghi, 0) / ctx.monthlyClimatology.length;
    const offgrid = SolarApp.Sizing.sizeOffGrid(dailyEnergyKWh, autonomyDays, battery, cfg.battery.systemLossPct, roughPeakSun);
    const capacityKW = Math.max(0.5, roundHalf(offgrid.requiredSolarKW || criticalLoadKW * 1.3));
    const panel = ctx.roofCapacity.panel;
    const panelCount = Math.round(capacityKW * 1000 / panel.wattage);
    const inverter = pickInverter(cfg.inverters, "off-grid", capacityKW);
    const generation = SolarApp.Generation.computeGeneration(capacityKW, ctx.monthlyClimatology, cfg.losses);
    const cost = SolarApp.Pricing.buildSystemCost({
      capacityKW, panelCount, panel, inverter, battery, batteryUnits: offgrid.batterySizing.unitsNeeded,
    }, cfg);
    // Off-grid: "savings" vs a grid bill is conceptual (property may already be off-grid) — shown for comparison only
    const savings = SolarApp.Pricing.savingsAndPayback(generation.annualKWh, consumption.annual, cfg.tariff, cost.finalPrice);
    return { type: "Off-Grid", capacityKW, panelCount, inverter, cost, savings, generation, battery, batterySizing: offgrid.batterySizing, backupHours };
  }

  function roundHalf(v) { return Math.round(v * 2) / 2; }

  function pickInverter(inverters, type, capacityKW) {
    const candidates = inverters.filter(i => i.type === type);
    if (candidates.length === 0) return inverters[0];
    // smallest inverter whose capacity >= system capacity; else the largest available
    const sorted = [...candidates].sort((a, b) => a.capacityKW - b.capacityKW);
    return sorted.find(i => i.capacityKW >= capacityKW) || sorted[sorted.length - 1];
  }

  function buildComparison(onGrid, hybrid, offGrid) {
    return [
      { param: "Solar Capacity", onGrid: `${onGrid.capacityKW.toFixed(2)} kWp`, hybrid: `${hybrid.capacityKW.toFixed(2)} kWp`, offGrid: `${offGrid.capacityKW.toFixed(2)} kWp` },
      { param: "Battery", onGrid: "No", hybrid: `${hybrid.batterySizing.unitsNeeded} x ${hybrid.battery.model} (${hybrid.batterySizing.totalNameplateKWh.toFixed(1)} kWh)`, offGrid: `${offGrid.batterySizing.unitsNeeded} x ${offGrid.battery.model} (${offGrid.batterySizing.totalNameplateKWh.toFixed(1)} kWh)` },
      { param: "Backup", onGrid: "No", hybrid: `${hybrid.backupHours} hrs`, offGrid: `${offGrid.backupHours} hrs (full autonomy)` },
      { param: "Annual Generation (est.)", onGrid: `${Math.round(onGrid.generation.annualKWh).toLocaleString("en-IN")} kWh`, hybrid: `${Math.round(hybrid.generation.annualKWh).toLocaleString("en-IN")} kWh`, offGrid: `${Math.round(offGrid.generation.annualKWh).toLocaleString("en-IN")} kWh` },
      { param: "System Cost (incl. GST)", onGrid: fmtINR(onGrid.cost.finalPrice), hybrid: fmtINR(hybrid.cost.finalPrice), offGrid: fmtINR(offGrid.cost.finalPrice) },
      { param: "AMC (per year)", onGrid: fmtINR(onGrid.cost.amc.perYear), hybrid: fmtINR(hybrid.cost.amc.perYear), offGrid: fmtINR(offGrid.cost.amc.perYear) },
      { param: "Estimated Annual Savings", onGrid: fmtINR(onGrid.savings.annualSavings), hybrid: fmtINR(hybrid.savings.annualSavings), offGrid: fmtINR(offGrid.savings.annualSavings) },
      { param: "Payback Period", onGrid: fmtYears(onGrid.savings.paybackYears), hybrid: fmtYears(hybrid.savings.paybackYears), offGrid: fmtYears(offGrid.savings.paybackYears) },
    ];
  }

  function fmtINR(n) { return Number.isFinite(n) ? "₹" + Math.round(n).toLocaleString("en-IN") : "—"; }
  function fmtYears(n) { return Number.isFinite(n) ? n.toFixed(1) + " yrs" : "—"; }

  // ---- Validation warnings ----
  function validate(ctx) {
    const warnings = [];
    if (ctx.roofCapacity.footprintAreaM2 < 10) warnings.push("⚠ Roof area is very small (<10 m²) — double-check the uploaded footprint.");
    if (ctx.recommendedKW > ctx.roofCapacity.finalCapacityKW + 0.01) warnings.push("⚠ Recommended system exceeds the roof's physical panel capacity.");
    if (ctx.criticalLoadKW && ctx.backupHours && ctx.criticalLoadKW > ctx.recommendedKW * 2) warnings.push("⚠ Critical load seems large relative to the recommended solar capacity — inverter may be undersized.");
    if (ctx.generation && ctx.consumption && ctx.generation.annualKWh > ctx.consumption.annual * 1.6) warnings.push("⚠ Estimated generation exceeds consumption by an unusually large margin — confirm consumption figures and export/net-metering limits.");
    warnings.push("⚠ Preliminary estimate — physical site survey and structural verification required.");
    warnings.push("⚠ Actual generation may vary due to shading, weather, soiling, and system losses.");
    warnings.push("⚠ Utility (TANGEDCO) approval requirements may change — verify net-metering rules before committing.");
    return warnings;
  }

  return { buildOnGrid, buildHybrid, buildOffGrid, buildComparison, validate, fmtINR, fmtYears };
})();
