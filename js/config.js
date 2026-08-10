/* ==========================================================================
   config.js — all editable defaults live here. Nothing else in the app
   should hard-code a price, a panel spec, or a tariff number: everything
   reads from window.SolarApp.Config (which is loaded from localStorage on
   top of these defaults, so the user's edits in Settings persist).
   ========================================================================== */
window.SolarApp = window.SolarApp || {};

SolarApp.Config = (function () {

  const DEFAULTS = {
    company: {
      name: "Musiri Solar Solutions",
      address: "Musiri, Tiruchirappalli District, Tamil Nadu",
      phone: "+91 00000 00000",
      email: "info@musirisolar.example",
      website: "www.musirisolar.example",
      logoDataUrl: "", // filled from Settings (base64 image), optional
      quotationPrefix: "MSR-SOLAR",
    },

    // ---- Panel database (ALMM-style entries; user edits freely) ----
    panels: [
      { id: "p540", manufacturer: "Waaree", model: "540W Mono PERC", wattage: 540, lengthMM: 2278, widthMM: 1134, efficiencyPct: 20.9, warrantyYears: 25, pricePerPanel: 12500 },
      { id: "p550", manufacturer: "Adani Solar", model: "550W Mono PERC", wattage: 550, lengthMM: 2278, widthMM: 1134, efficiencyPct: 21.2, warrantyYears: 25, pricePerPanel: 12800 },
      { id: "p575", manufacturer: "Tata Power Solar", model: "575W Mono PERC", wattage: 575, lengthMM: 2384, widthMM: 1303, efficiencyPct: 21.5, warrantyYears: 25, pricePerPanel: 13600 },
      { id: "p600", manufacturer: "Vikram Solar", model: "600W TOPCon", wattage: 600, lengthMM: 2465, widthMM: 1134, efficiencyPct: 22.0, warrantyYears: 30, pricePerPanel: 14800 },
    ],
    defaultPanelId: "p550",

    // ---- Inverter database ----
    inverters: [
      { id: "inv-og-3k", manufacturer: "Growatt", model: "MIN 3000TL-X", type: "on-grid", capacityKW: 3, efficiencyPct: 97.6, warrantyYears: 10, price: 28000 },
      { id: "inv-og-5k", manufacturer: "Growatt", model: "MIN 5000TL-X", type: "on-grid", capacityKW: 5, efficiencyPct: 98.0, warrantyYears: 10, price: 42000 },
      { id: "inv-og-10k", manufacturer: "Growatt", model: "MID 10KTL3-X", type: "on-grid", capacityKW: 10, efficiencyPct: 98.2, warrantyYears: 10, price: 78000 },
      { id: "inv-hy-5k", manufacturer: "Luminous", model: "Hybrid NXG+ 5kVA", type: "hybrid", capacityKW: 5, efficiencyPct: 96.5, warrantyYears: 5, price: 95000 },
      { id: "inv-hy-8k", manufacturer: "Growatt", model: "SPH 8000", type: "hybrid", capacityKW: 8, efficiencyPct: 97.0, warrantyYears: 5, price: 140000 },
      { id: "inv-og-off-3k", manufacturer: "Microtek", model: "Off-Grid 3kVA", type: "off-grid", capacityKW: 3, efficiencyPct: 92.0, warrantyYears: 3, price: 32000 },
      { id: "inv-og-off-5k", manufacturer: "Microtek", model: "Off-Grid 5kVA", type: "off-grid", capacityKW: 5, efficiencyPct: 92.5, warrantyYears: 3, price: 55000 },
    ],

    // ---- Battery database ----
    batteries: [
      { id: "b-lfp-5", manufacturer: "Luminous", model: "LiFePO4 5.12kWh", chemistry: "LiFePO4", voltage: 51.2, capacityKWh: 5.12, dodPct: 90, roundtripEffPct: 95, cycleLife: 6000, warrantyYears: 10, price: 145000 },
      { id: "b-lfp-10", manufacturer: "Luminous", model: "LiFePO4 10.24kWh", chemistry: "LiFePO4", voltage: 51.2, capacityKWh: 10.24, dodPct: 90, roundtripEffPct: 95, cycleLife: 6000, warrantyYears: 10, price: 275000 },
      { id: "b-lead-3", manufacturer: "Exide", model: "Tubular Lead-Acid 150Ah", chemistry: "Lead-Acid", voltage: 12, capacityKWh: 1.8, dodPct: 50, roundtripEffPct: 80, cycleLife: 1500, warrantyYears: 3, price: 18000 },
    ],
    defaultBatteryId: "b-lfp-5",

    // ---- BOM component pricing (per-Wp or flat, user editable) ----
    bomPricing: {
      mountingStructurePerWp: 4.5,      // ₹ per Wp of DC capacity
      dcCablePerKW: 900,                // ₹ per kW
      acCablePerKW: 700,                // ₹ per kW
      dcdbFlat: 3500,
      acdbFlat: 3500,
      earthingFlat: 6000,
      lightningArresterFlat: 4500,
      mc4ConnectorsPerKW: 350,
      civilWorkPerKW: 1200,
      otherChargesPerKW: 500,
    },

    installation: {
      method: "percentage",     // "percentage" | "fixed"
      percentageOfEquipment: 8, // %
      fixedAmount: 25000,       // ₹
      transportationFlat: 6000,
    },

    amc: {
      onGridPerYearPerKW: 800,
      hybridOffGridPerYearPerKW: 1400,   // includes battery inspection/backup test
    },

    gstPct: 13.8, // blended effective GST as commonly billed on solar EPC (module 12% + BOS 18%) — EDIT to your CA's guidance

    tariff: {
      version: "TANGEDCO LT-domestic, illustrative — verify before quoting",
      asOf: "2026-08",
      slabsPerUnit: [
        { uptoUnits: 100, rate: 0 },
        { uptoUnits: 200, rate: 2.35 },
        { uptoUnits: 400, rate: 4.7 },
        { uptoUnits: Infinity, rate: 6.35 },
      ],
      flatRateFallback: 6.35, // used for quick estimates when slab calc isn't needed
    },

    // ---- Roof / usable-area defaults ----
    roof: {
      utilizationPct: 65,      // fallback flat factor if geometric packing isn't used
      edgeSetbackM: 0.5,
      parapetSetbackM: 1.0,
      walkwayWidthM: 0.6,
      rowSpacingM: 0.3,
      columnSpacingM: 0.02,
      panelOrientation: "portrait", // "portrait" | "landscape"
    },

    // ---- PV system losses (each a fractional derate, editable) ----
    losses: {
      temperaturePct: 6,
      inverterPct: 3,
      cablePct: 2,
      soilingPct: 3,
      mismatchPct: 2,
      shadingPct: 3,
      availabilityPct: 2,
    },

    battery: {
      dodOverridePct: null, // null = use battery DB value
      systemLossPct: 8,     // additional losses in hybrid/off-grid battery loop
    },
  };

  const STORAGE_KEY = "musiriSolar.config.v1";

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return normalizeTariffInfinity(structuredClone(DEFAULTS));
      const parsed = JSON.parse(saved);
      // shallow-merge so new default fields introduced by app updates aren't lost
      return normalizeTariffInfinity(deepMerge(structuredClone(DEFAULTS), parsed));
    } catch (e) {
      console.warn("Config load failed, using defaults:", e);
      return normalizeTariffInfinity(structuredClone(DEFAULTS));
    }
  }

  // JSON has no Infinity — JSON.stringify silently turns it into null when the
  // config is persisted to localStorage. The "last, unbounded" tariff slab uses
  // Infinity as its uptoUnits sentinel, so every load restores null/undefined
  // back to Infinity (any slab, not just the last, in case slabs get reordered).
  function normalizeTariffInfinity(cfg) {
    if (cfg && cfg.tariff && Array.isArray(cfg.tariff.slabsPerUnit)) {
      cfg.tariff.slabsPerUnit = cfg.tariff.slabsPerUnit.map(slab => ({
        ...slab,
        uptoUnits: (slab.uptoUnits === null || slab.uptoUnits === undefined) ? Infinity : slab.uptoUnits,
      }));
    }
    return cfg;
  }

  function deepMerge(base, override) {
    for (const k in override) {
      if (override[k] && typeof override[k] === "object" && !Array.isArray(override[k]) && base[k]) {
        base[k] = deepMerge(base[k], override[k]);
      } else {
        base[k] = override[k];
      }
    }
    return base;
  }

  let current = load();

  function get() { return current; }
  function save(newConfig) {
    current = newConfig;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  }
  function resetToDefaults() {
    current = normalizeTariffInfinity(structuredClone(DEFAULTS));
    localStorage.removeItem(STORAGE_KEY);
    return current;
  }
  function nextQuotationNumber() {
    const year = new Date().getFullYear();
    const counterKey = "musiriSolar.quoteCounter." + year;
    let n = parseInt(localStorage.getItem(counterKey) || "0", 10) + 1;
    localStorage.setItem(counterKey, String(n));
    return `${current.company.quotationPrefix}-${year}-${String(n).padStart(4, "0")}`;
  }

  return { get, save, resetToDefaults, nextQuotationNumber, DEFAULTS };
})();
