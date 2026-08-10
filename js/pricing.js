/* ==========================================================================
   pricing.js — turns a sized system (capacity + panels + optional battery)
   into a full bill-of-materials cost, then into savings/payback. Every price
   comes from Config (Settings) — nothing is hard-coded here.
   ========================================================================== */
window.SolarApp = window.SolarApp || {};

SolarApp.Pricing = (function () {

  function panelsCost(panelCount, panel) {
    return panelCount * panel.pricePerPanel;
  }

  function bomCost(capacityKW, bomCfg) {
    const capacityW = capacityKW * 1000;
    const items = [
      { item: "Mounting Structure", qty: `${capacityW.toFixed(0)} Wp`, unitPrice: bomCfg.mountingStructurePerWp, total: capacityW * bomCfg.mountingStructurePerWp },
      { item: "DC Cable", qty: `${capacityKW.toFixed(2)} kW`, unitPrice: bomCfg.dcCablePerKW, total: capacityKW * bomCfg.dcCablePerKW },
      { item: "AC Cable", qty: `${capacityKW.toFixed(2)} kW`, unitPrice: bomCfg.acCablePerKW, total: capacityKW * bomCfg.acCablePerKW },
      { item: "DCDB", qty: 1, unitPrice: bomCfg.dcdbFlat, total: bomCfg.dcdbFlat },
      { item: "ACDB", qty: 1, unitPrice: bomCfg.acdbFlat, total: bomCfg.acdbFlat },
      { item: "Earthing", qty: 1, unitPrice: bomCfg.earthingFlat, total: bomCfg.earthingFlat },
      { item: "Lightning Arrester", qty: 1, unitPrice: bomCfg.lightningArresterFlat, total: bomCfg.lightningArresterFlat },
      { item: "MC4 Connectors", qty: `${capacityKW.toFixed(2)} kW`, unitPrice: bomCfg.mc4ConnectorsPerKW, total: capacityKW * bomCfg.mc4ConnectorsPerKW },
      { item: "Civil Work", qty: `${capacityKW.toFixed(2)} kW`, unitPrice: bomCfg.civilWorkPerKW, total: capacityKW * bomCfg.civilWorkPerKW },
      { item: "Other Charges", qty: `${capacityKW.toFixed(2)} kW`, unitPrice: bomCfg.otherChargesPerKW, total: capacityKW * bomCfg.otherChargesPerKW },
    ];
    const total = items.reduce((s, r) => s + r.total, 0);
    return { items, total };
  }

  function installationCost(equipmentCost, installCfg) {
    const base = installCfg.method === "fixed"
      ? installCfg.fixedAmount
      : equipmentCost * (installCfg.percentageOfEquipment / 100);
    return { method: installCfg.method, amount: base, transportation: installCfg.transportationFlat };
  }

  function amcCost(capacityKW, isBatterySystem, amcCfg) {
    const perYearPerKW = isBatterySystem ? amcCfg.hybridOffGridPerYearPerKW : amcCfg.onGridPerYearPerKW;
    const perYear = perYearPerKW * capacityKW;
    return { perYear, fiveYear: perYear * 5, tenYear: perYear * 10 };
  }

  // Full quotation cost build for one system type.
  // opts: { capacityKW, panelCount, panel, inverter, battery(optional), batteryUnits(optional) }
  function buildSystemCost(opts, cfg) {
    const panelsTotal = panelsCost(opts.panelCount, opts.panel);
    const inverterTotal = opts.inverter.price;
    const batteryTotal = opts.battery ? opts.battery.price * (opts.batteryUnits || 1) : 0;
    const bom = bomCost(opts.capacityKW, cfg.bomPricing);

    const equipmentCost = panelsTotal + inverterTotal + batteryTotal + bom.total;
    const install = installationCost(equipmentCost, cfg.installation);
    const preTaxTotal = equipmentCost + install.amount + install.transportation;
    const gstAmount = preTaxTotal * (cfg.gstPct / 100);
    const finalPrice = preTaxTotal + gstAmount;

    const amc = amcCost(opts.capacityKW, !!opts.battery, cfg.amc);

    const lineItems = [
      { item: `Solar Panels (${opts.panel.manufacturer} ${opts.panel.model} x ${opts.panelCount})`, qty: opts.panelCount, unitPrice: opts.panel.pricePerPanel, total: panelsTotal },
      { item: `Inverter (${opts.inverter.manufacturer} ${opts.inverter.model})`, qty: 1, unitPrice: opts.inverter.price, total: inverterTotal },
      ...(opts.battery ? [{ item: `Battery (${opts.battery.manufacturer} ${opts.battery.model} x ${opts.batteryUnits || 1})`, qty: opts.batteryUnits || 1, unitPrice: opts.battery.price, total: batteryTotal }] : []),
      ...bom.items,
      { item: "Installation", qty: 1, unitPrice: install.amount, total: install.amount },
      { item: "Transportation", qty: 1, unitPrice: install.transportation, total: install.transportation },
    ];

    return {
      lineItems, equipmentCost, install, preTaxTotal, gstAmount, gstPct: cfg.gstPct, finalPrice, amc,
    };
  }

  // Savings/payback from annual generation, tariff, and system cost.
  function savingsAndPayback(annualGenerationKWh, annualConsumptionKWh, tariffCfg, systemFinalPrice) {
    const offsetKWh = Math.min(annualGenerationKWh, annualConsumptionKWh);
    const avgRate = effectiveAverageRate(tariffCfg, annualConsumptionKWh);
    const annualSavings = offsetKWh * avgRate;
    const currentAnnualCost = annualConsumptionKWh * avgRate;
    const paybackYears = annualSavings > 0 ? systemFinalPrice / annualSavings : null;
    return { offsetKWh, avgRate, annualSavings, currentAnnualCost, paybackYears };
  }

  // Approximate blended rate from the slab table for a given annual consumption
  // (spread evenly across 12 months) — for a quick estimate, not a bill simulator.
  function effectiveAverageRate(tariffCfg, annualConsumptionKWh) {
    const monthlyUnits = annualConsumptionKWh / 12;
    let remaining = monthlyUnits, cost = 0, lastCap = 0;
    for (const slab of tariffCfg.slabsPerUnit) {
      const slabUnits = Math.min(remaining, slab.uptoUnits - lastCap);
      if (slabUnits <= 0) { lastCap = slab.uptoUnits; continue; }
      cost += slabUnits * slab.rate;
      remaining -= slabUnits;
      lastCap = slab.uptoUnits;
      if (remaining <= 0) break;
    }
    if (monthlyUnits <= 0) return tariffCfg.flatRateFallback;
    return cost / monthlyUnits;
  }

  return { panelsCost, bomCost, installationCost, amcCost, buildSystemCost, savingsAndPayback, effectiveAverageRate };
})();
