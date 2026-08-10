/* ==========================================================================
   app.js — wires the step wizard UI to the calculation modules. No pricing,
   sizing, or geometry logic lives here — only DOM plumbing and orchestration.
   ========================================================================== */
window.SolarApp = window.SolarApp || {};

SolarApp.App = (function () {
  const STEPS = [
    { n: 1, label: "Customer" }, { n: 2, label: "Site" }, { n: 3, label: "Roof" },
    { n: 4, label: "Electricity" }, { n: 5, label: "Solar System" }, { n: 6, label: "Battery" },
    { n: 7, label: "Pricing" }, { n: 8, label: "Comparison" }, { n: 9, label: "Quotation" },
  ];

  const state = {
    currentStep: 1,
    maxStepReached: 1,
    footprintSummary: null,   // from SolarApp.Geo.summarize()
    roofCapacity: null,       // from SolarApp.RoofLayout.computeRoofCapacity()
    consumption: null,        // from SolarApp.Sizing.consumptionStats()
    climatology: null,        // from SolarApp.Climate.fetchClimatology()
    sizing: null,             // from SolarApp.Sizing.recommendCapacity()
    generation: null,         // from SolarApp.Generation.computeGeneration()
    batteryPreview: null,
    onGrid: null, hybrid: null, offGrid: null, comparison: null, warnings: [],
    quotationNumber: null,
  };

  // ---------------- Stepper ----------------
  function renderStepper() {
    const el = document.getElementById("stepper");
    el.innerHTML = STEPS.map(s => {
      const cls = s.n === state.currentStep ? "active" : (s.n < state.maxStepReached || s.n < state.currentStep ? "done" : "");
      return `<button type="button" class="step-pill ${cls}" data-goto="${s.n}"><span class="num">${String(s.n).padStart(2,"0")}</span> ${s.label}</button>`;
    }).join("");
    el.querySelectorAll("[data-goto]").forEach(btn => {
      btn.addEventListener("click", () => goToStep(parseInt(btn.dataset.goto, 10)));
    });
  }

  function goToStep(n) {
    state.currentStep = n;
    state.maxStepReached = Math.max(state.maxStepReached, n);
    document.querySelectorAll(".wizard-step").forEach(sec => {
      sec.classList.toggle("active", parseInt(sec.dataset.step, 10) === n);
    });
    renderStepper();
    window.scrollTo({ top: document.querySelector(".wizard-shell").offsetTop - 10, behavior: "smooth" });
    if (n === 3) syncRoofStepDefaults();
    if (n === 7) syncPricingStepDefaults();
  }

  // ---------------- Init ----------------
  function init() {
    const cfg = SolarApp.Config.get();
    SolarApp.SettingsUI.wireEvents();

    // Quotation number + date default
    state.quotationNumber = SolarApp.Config.nextQuotationNumber();
    document.getElementById("custQuoteNumber").value = state.quotationNumber;
    document.getElementById("finalQuoteNumber").value = state.quotationNumber;
    document.getElementById("custDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("termsTextarea").value = SolarApp.PDF.DEFAULT_TERMS.join("\n");

    populateSelects(cfg);
    renderStepper();
    goToStep(1);

    SolarApp.MapView.init("siteMap");
    SolarApp.MapView.onFootprintDrawn = onFootprintReady;

    wireFootprintUpload();
    wireConsumptionStep();
    wireRoofStep();
    wireSolarSystemStep();
    wireBatteryStep();
    wirePricingStep();
    wireComparisonStep();
    wireQuotationStep();
  }

  function populateSelects(cfg) {
    const panelSelect = document.getElementById("panelSelect");
    panelSelect.innerHTML = cfg.panels.map(p => `<option value="${p.id}">${p.manufacturer} ${p.model} (${p.wattage}W)</option>`).join("");
    panelSelect.value = cfg.defaultPanelId;

    const batterySelect = document.getElementById("batterySelect");
    batterySelect.innerHTML = cfg.batteries.map(b => `<option value="${b.id}">${b.manufacturer} ${b.model} (${b.capacityKWh}kWh)</option>`).join("");
    batterySelect.value = cfg.defaultBatteryId;
  }

  function onSettingsSaved() {
    // Re-populate dropdowns in case panel/battery lists changed; keep current selections if still valid.
    const cfg = SolarApp.Config.get();
    const curPanel = document.getElementById("panelSelect").value;
    const curBattery = document.getElementById("batterySelect").value;
    populateSelects(cfg);
    if (cfg.panels.some(p => p.id === curPanel)) document.getElementById("panelSelect").value = curPanel;
    if (cfg.batteries.some(b => b.id === curBattery)) document.getElementById("batterySelect").value = curBattery;
  }

  // ---------------- Step 2: Footprint ----------------
  function wireFootprintUpload() {
    document.getElementById("footprintFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      const hint = document.getElementById("footprintHint");
      if (!file) return;
      hint.style.color = ""; hint.textContent = "Reading " + file.name + "…";
      try {
        const polygons = await SolarApp.Geo.readFootprintFile(file);
        onFootprintReady(polygons, file.name);
      } catch (err) {
        hint.style.color = "#E8654B";
        hint.textContent = "Couldn't read " + file.name + ": " + err.message;
      }
    });
  }

  function onFootprintReady(polygons, sourceName) {
    const summary = SolarApp.Geo.summarize(polygons);
    state.footprintSummary = summary;

    document.getElementById("lat").value = summary.centroid.lat.toFixed(6);
    document.getElementById("lon").value = summary.centroid.lon.toFixed(6);

    const hint = document.getElementById("footprintHint");
    hint.style.color = "#3FB8AF";
    hint.textContent = `✓ ${sourceName ? "Loaded from " + sourceName : "Footprint drawn"} — area ${summary.areaM2.toFixed(1)} m² (${summary.areaSqFt.toFixed(0)} sq.ft), perimeter ${summary.perimeterM.toFixed(1)} m`;

    document.getElementById("areaReadout").textContent =
      `Footprint area — ${summary.areaM2.toFixed(1)} m² (${summary.areaSqFt.toFixed(0)} sq ft) · perimeter ${summary.perimeterM.toFixed(1)} m · ${polygons.length} polygon(s)`;

    try { SolarApp.MapView.showFootprint(polygons); } catch (e) { console.warn("Map preview failed:", e); }

    // Step 3 summary cards
    document.getElementById("roofAreaDisplay").textContent = summary.areaM2.toFixed(1) + " m²";
    document.getElementById("roofAreaSqftDisplay").textContent = summary.areaSqFt.toFixed(0) + " sq.ft";
    document.getElementById("perimeterDisplay").textContent = summary.perimeterM.toFixed(1) + " m";
    document.getElementById("roofLatLonDisplay").textContent = `${summary.centroid.lat.toFixed(6)}, ${summary.centroid.lon.toFixed(6)}`;
  }

  // ---------------- Step 3: Roof capacity & layout ----------------
  function syncRoofStepDefaults() {
    const cfg = SolarApp.Config.get();
    setValIfEmpty("utilizationPct", cfg.roof.utilizationPct);
    setValIfEmpty("edgeSetbackM", cfg.roof.edgeSetbackM);
    setValIfEmpty("parapetSetbackM", cfg.roof.parapetSetbackM);
    setValIfEmpty("walkwayWidthM", cfg.roof.walkwayWidthM);
    setValIfEmpty("rowSpacingM", cfg.roof.rowSpacingM);
    setValIfEmpty("columnSpacingM", cfg.roof.columnSpacingM);
  }
  function setValIfEmpty(id, v) { const el = document.getElementById(id); if (el && el.value === "") el.value = v; }

  function wireRoofStep() {
    document.getElementById("calcRoofBtn").addEventListener("click", () => {
      if (!state.footprintSummary) {
        alert("Upload or draw a building footprint in Step 2 first.");
        return;
      }
      const cfg = SolarApp.Config.get();
      const panel = cfg.panels.find(p => p.id === document.getElementById("panelSelect").value) || cfg.panels[0];
      const roofCfg = {
        utilizationPct: numVal("utilizationPct"),
        edgeSetbackM: numVal("edgeSetbackM"),
        parapetSetbackM: numVal("parapetSetbackM"),
        walkwayWidthM: numVal("walkwayWidthM"),
        rowSpacingM: numVal("rowSpacingM"),
        columnSpacingM: numVal("columnSpacingM"),
        panelOrientation: document.getElementById("panelOrientation").value,
      };
      const rc = SolarApp.RoofLayout.computeRoofCapacity(state.footprintSummary, panel, roofCfg);
      state.roofCapacity = rc;

      document.getElementById("usableAreaDisplay").textContent = rc.usableAreaM2.toFixed(1) + " m²";
      document.getElementById("rowsColsDisplay").textContent = `${rc.packing.rows} × ${rc.packing.cols} (${rc.packing.orientation})`;
      document.getElementById("finalPanelCountDisplay").textContent = rc.finalPanelCount + " panels";
      document.getElementById("finalCapacityDisplay").textContent = rc.finalCapacityKW.toFixed(2) + " kWp";
      document.getElementById("usedAreaDisplay").textContent = rc.usedAreaM2.toFixed(1) + " m²";
      document.getElementById("remainingAreaDisplay").textContent = rc.remainingAreaM2.toFixed(1) + " m²";

      try { SolarApp.MapView.showPanelLayout(state.footprintSummary, rc.packing); } catch (e) { console.warn("Panel layout overlay failed:", e); }
    });
  }

  // ---------------- Step 4: Electricity consumption ----------------
  function wireConsumptionStep() {
    const modeSelect = document.getElementById("consumptionMode");
    const monthly12Block = document.getElementById("monthly12Block");
    const MONTHS = SolarApp.Climate.MONTHS;

    modeSelect.addEventListener("change", () => {
      const isMonthly = modeSelect.value === "monthly12";
      document.getElementById("avgConsumptionBlock").style.display = isMonthly ? "none" : "grid";
      monthly12Block.style.display = isMonthly ? "grid" : "none";
      if (isMonthly && monthly12Block.children.length === 0) {
        monthly12Block.innerHTML = MONTHS.map(m => `<label>${m} (kWh) <input type="number" class="monthlyUnitInput" value="750"></label>`).join("");
      }
    });

    document.getElementById("calcConsumptionBtn").addEventListener("click", () => {
      const cfg = SolarApp.Config.get();
      let consumptionInput;
      if (modeSelect.value === "monthly12") {
        const vals = Array.from(document.querySelectorAll(".monthlyUnitInput")).map(i => parseFloat(i.value) || 0);
        consumptionInput = { monthly: vals };
      } else {
        consumptionInput = { monthlyUnits: numVal("avgMonthlyUnits") };
      }
      const stats = SolarApp.Sizing.consumptionStats(consumptionInput);
      state.consumption = stats;

      document.getElementById("consAnnualDisplay").textContent = Math.round(stats.annual).toLocaleString("en-IN") + " kWh";
      document.getElementById("consAvgDisplay").textContent = Math.round(stats.avgMonthly).toLocaleString("en-IN") + " kWh";
      document.getElementById("consPeakDisplay").textContent = Math.round(stats.peakMonthly).toLocaleString("en-IN") + " kWh";
      document.getElementById("consMinDisplay").textContent = Math.round(stats.minMonthly).toLocaleString("en-IN") + " kWh";

      const avgRate = SolarApp.Pricing.effectiveAverageRate(cfg.tariff, stats.annual);
      const billText = document.getElementById("currentBillInput").value;
      document.getElementById("tariffInfoDisplay").textContent =
        `Blended tariff estimate: ₹${avgRate.toFixed(2)}/unit (${cfg.tariff.version}, as of ${cfg.tariff.asOf}). ` +
        (billText ? `Your entered current bill: ₹${billText}/month.` : "Edit slabs in Settings → Tariff to match the customer's actual bill.");
    });
  }

  // ---------------- Step 5: Solar system sizing + generation ----------------
  function wireSolarSystemStep() {
    document.getElementById("fetchClimateBtn").addEventListener("click", async () => {
      const statusEl = document.getElementById("climateStatus");
      if (!state.roofCapacity) { statusEl.textContent = "Calculate roof capacity in Step 3 first."; return; }
      if (!state.consumption) { statusEl.textContent = "Calculate electricity consumption in Step 4 first."; return; }

      const lat = numVal("lat"), lon = numVal("lon");
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) { statusEl.textContent = "Missing latitude/longitude — check Step 2."; return; }

      statusEl.textContent = "Fetching solar resource data (NASA POWER → Open-Meteo → PVGIS)…";
      try {
        const clim = await SolarApp.Climate.fetchClimatology(lat, lon);
        state.climatology = clim;

        const cfg = SolarApp.Config.get();
        // First pass: rough specific yield at roof-max capacity, to inform consumption-based sizing
        const roughGen = SolarApp.Generation.computeGeneration(state.roofCapacity.finalCapacityKW || 1, clim.monthly, cfg.losses);
        const sizing = SolarApp.Sizing.recommendCapacity(state.roofCapacity.finalCapacityKW, state.consumption, roughGen.specificYield);
        state.sizing = sizing;

        const overrideEl = document.getElementById("recommendedKWOverride");
        const recommendedKW = overrideEl.value !== "" ? parseFloat(overrideEl.value) : sizing.recommendedKW;
        overrideEl.value = recommendedKW;

        const generation = SolarApp.Generation.computeGeneration(recommendedKW, clim.monthly, cfg.losses);
        state.generation = generation;

        document.getElementById("sizingRoofMax").textContent = sizing.roofMaxKW.toFixed(2) + " kWp";
        document.getElementById("sizingConsBased").textContent = sizing.consumptionBasedKW.toFixed(2) + " kWp";
        document.getElementById("sizingRecommended").textContent = recommendedKW.toFixed(2) + " kWp";
        document.getElementById("sizingLimitedBy").textContent = sizing.limitedBy === "roof" ? "Roof capacity" : "Consumption";
        document.getElementById("dataSourceDisplay").value = clim.source;

        document.getElementById("annualGenDisplay").textContent = Math.round(generation.annualKWh).toLocaleString("en-IN") + " kWh";
        document.getElementById("specificYieldDisplay").textContent = generation.specificYield.toFixed(0) + " kWh/kWp/yr";
        document.getElementById("peakSunDisplay").textContent = generation.peakSunHoursAvg.toFixed(2) + " hrs/day";
        document.getElementById("lossPctDisplay").textContent = generation.totalLossPct.toFixed(1) + "%";

        SolarApp.Charts.renderGenerationChart("genChart", generation.rows);
        statusEl.textContent = `Done — data source: ${clim.source}.`;
      } catch (err) {
        statusEl.textContent = "Error: " + err.message + ". If this persists, your network may be blocking these APIs.";
      }
    });

    document.getElementById("recommendedKWOverride").addEventListener("change", () => {
      if (!state.climatology) return;
      const cfg = SolarApp.Config.get();
      const kw = parseFloat(document.getElementById("recommendedKWOverride").value);
      if (!Number.isFinite(kw) || kw <= 0) return;
      state.generation = SolarApp.Generation.computeGeneration(kw, state.climatology.monthly, cfg.losses);
      document.getElementById("annualGenDisplay").textContent = Math.round(state.generation.annualKWh).toLocaleString("en-IN") + " kWh";
      document.getElementById("specificYieldDisplay").textContent = state.generation.specificYield.toFixed(0) + " kWh/kWp/yr";
      SolarApp.Charts.renderGenerationChart("genChart", state.generation.rows);
    });
  }

  // ---------------- Step 6: Battery preview ----------------
  function wireBatteryStep() {
    document.getElementById("calcBatteryBtn").addEventListener("click", () => {
      const cfg = SolarApp.Config.get();
      const battery = cfg.batteries.find(b => b.id === document.getElementById("batterySelect").value) || cfg.batteries[0];
      const criticalLoadKW = numVal("criticalLoadKW");
      const backupHours = numVal("backupHours");
      const sizing = SolarApp.Sizing.sizeBattery(criticalLoadKW, backupHours, battery, cfg.battery.systemLossPct);
      state.batteryPreview = sizing;

      document.getElementById("battRawEnergy").textContent = sizing.rawEnergyKWh.toFixed(2) + " kWh";
      document.getElementById("battUnitsNeeded").textContent = sizing.unitsNeeded + " × " + battery.model;
      document.getElementById("battNameplate").textContent = sizing.totalNameplateKWh.toFixed(2) + " kWh";
      document.getElementById("battUsable").textContent = sizing.totalUsableKWh.toFixed(2) + " kWh";
    });
  }

  // ---------------- Step 7: Pricing preview ----------------
  function syncPricingStepDefaults() {
    const cfg = SolarApp.Config.get();
    document.getElementById("installMethodQuote").value = cfg.installation.method;
    document.getElementById("installValueQuote").value = cfg.installation.method === "fixed" ? cfg.installation.fixedAmount : cfg.installation.percentageOfEquipment;
    document.getElementById("transportQuote").value = cfg.installation.transportationFlat;
    document.getElementById("gstPctQuote").value = cfg.gstPct;
  }

  function wirePricingStep() {
    document.getElementById("previewBomBtn").addEventListener("click", () => {
      if (!state.roofCapacity || !state.generation) {
        alert("Complete Step 3 (Roof) and Step 5 (Solar System) first.");
        return;
      }
      const cfg = quoteScopedConfig();
      const capacityKW = parseFloat(document.getElementById("recommendedKWOverride").value) || state.sizing.recommendedKW;
      const panel = state.roofCapacity.panel;
      const panelCount = Math.round(capacityKW * 1000 / panel.wattage);
      const inverter = pickOnGridInverter(cfg, capacityKW);
      const cost = SolarApp.Pricing.buildSystemCost({ capacityKW, panelCount, panel, inverter }, cfg);

      const table = document.getElementById("bomPreviewTable");
      table.innerHTML = "<thead><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>" +
        cost.lineItems.map(li => `<tr><td>${li.item}</td><td>${li.qty}</td><td>₹${fmtNum(li.unitPrice)}</td><td>₹${fmtNum(li.total)}</td></tr>`).join("") +
        `<tr><td colspan="3" style="text-align:right;font-weight:700;">Equipment + BOM</td><td style="font-weight:700;">₹${fmtNum(cost.equipmentCost)}</td></tr>` +
        `<tr><td colspan="3" style="text-align:right;">Installation + Transport</td><td>₹${fmtNum(cost.install.amount + cost.install.transportation)}</td></tr>` +
        `<tr><td colspan="3" style="text-align:right;">GST (${cost.gstPct}%)</td><td>₹${fmtNum(cost.gstAmount)}</td></tr>` +
        `<tr><td colspan="3" style="text-align:right;font-weight:700;color:var(--gold);">TOTAL</td><td style="font-weight:700;color:var(--gold);">₹${fmtNum(cost.finalPrice)}</td></tr></tbody>`;
    });
  }

  function pickOnGridInverter(cfg, capacityKW) {
    const candidates = cfg.inverters.filter(i => i.type === "on-grid");
    const sorted = [...candidates].sort((a, b) => a.capacityKW - b.capacityKW);
    return sorted.find(i => i.capacityKW >= capacityKW) || sorted[sorted.length - 1] || cfg.inverters[0];
  }

  function fmtNum(n) { return Number.isFinite(n) ? Math.round(n).toLocaleString("en-IN") : "-"; }

  // Builds a Config clone with the Step-7 per-quotation overrides (install method/value, transport, GST) applied.
  function quoteScopedConfig() {
    const cfg = JSON.parse(JSON.stringify(SolarApp.Config.get()));
    const method = document.getElementById("installMethodQuote").value;
    const value = parseFloat(document.getElementById("installValueQuote").value);
    if (Number.isFinite(value)) {
      cfg.installation.method = method;
      if (method === "fixed") cfg.installation.fixedAmount = value; else cfg.installation.percentageOfEquipment = value;
    }
    const transport = parseFloat(document.getElementById("transportQuote").value);
    if (Number.isFinite(transport)) cfg.installation.transportationFlat = transport;
    const gst = parseFloat(document.getElementById("gstPctQuote").value);
    if (Number.isFinite(gst)) cfg.gstPct = gst;
    return cfg;
  }

  // ---------------- Step 8: Comparison ----------------
  function wireComparisonStep() {
    document.getElementById("buildQuotationsBtn").addEventListener("click", () => {
      if (!state.roofCapacity || !state.climatology || !state.consumption || !state.sizing) {
        alert("Please complete Steps 3–5 (Roof, Electricity, Solar System) first.");
        return;
      }
      const cfg = quoteScopedConfig();
      const recommendedKW = parseFloat(document.getElementById("recommendedKWOverride").value) || state.sizing.recommendedKW;
      const criticalLoadKW = numVal("criticalLoadKW") || 2;
      const backupHours = numVal("backupHours") || 6;

      const ctx = {
        roofCapacity: state.roofCapacity,
        cfg,
        consumption: state.consumption,
        monthlyClimatology: state.climatology.monthly,
        recommendedKW,
        criticalLoadKW,
        backupHours,
      };

      state.onGrid = SolarApp.Quotation.buildOnGrid(ctx);
      state.hybrid = SolarApp.Quotation.buildHybrid(ctx);
      state.offGrid = SolarApp.Quotation.buildOffGrid(ctx);
      state.comparison = SolarApp.Quotation.buildComparison(state.onGrid, state.hybrid, state.offGrid);
      state.warnings = SolarApp.Quotation.validate({ ...ctx, generation: state.onGrid.generation });

      renderComparisonTable();
      renderWarnings();
    });
  }

  function renderComparisonTable() {
    const wrap = document.getElementById("comparisonWrap");
    const recommended = pickRecommendedType();
    const colKey = recommended === "On-Grid" ? "onGrid" : recommended === "Hybrid" ? "hybrid" : "offGrid";
    const cls = (key) => key === colKey ? "recommended" : "";
    wrap.innerHTML = `<table class="db-table comparison-table">
      <thead><tr><th>Parameter</th><th class="${cls('onGrid')}">On-Grid</th><th class="${cls('hybrid')}">Hybrid</th><th class="${cls('offGrid')}">Off-Grid</th></tr></thead>
      <tbody>${state.comparison.map(r => `<tr><td>${r.param}</td><td class="${cls('onGrid')}">${r.onGrid}</td><td class="${cls('hybrid')}">${r.hybrid}</td><td class="${cls('offGrid')}">${r.offGrid}</td></tr>`).join("")}</tbody>
    </table>
    <p class="disclaimer" style="margin-top:10px;">★ Recommended: <b>${recommended}</b> — auto-suggested from roof capacity, consumption pattern and payback; change the final selection in Step 9 if the customer prefers otherwise.</p>`;
    document.getElementById("recommendedSystemSelect").value = recommended;
  }

  function pickRecommendedType() {
    // Simple, transparent heuristic: On-Grid unless the customer clearly wants backup
    // (battery step was engaged) — shortest payback among viable options otherwise.
    const options = [state.onGrid, state.hybrid, state.offGrid].filter(Boolean);
    const withPayback = options.filter(o => Number.isFinite(o.savings.paybackYears));
    if (withPayback.length === 0) return "On-Grid";
    const best = withPayback.reduce((a, b) => (a.savings.paybackYears <= b.savings.paybackYears ? a : b));
    return best.type;
  }

  function renderWarnings() {
    const box = document.getElementById("warningsBox");
    box.innerHTML = state.warnings.map(w => `<div class="warning-line">${w}</div>`).join("");
  }

  // ---------------- Step 9: Final quotation / PDF / save-load ----------------
  function wireQuotationStep() {
    document.getElementById("downloadPdfBtn").addEventListener("click", () => {
      if (!state.onGrid || !state.hybrid || !state.offGrid) {
        alert("Build the three system proposals in Step 8 first.");
        return;
      }
      const project = assembleProject();
      try {
        SolarApp.PDF.generateQuotationPDF(project);
      } catch (err) {
        alert("Couldn't generate the PDF: " + err.message);
        console.error(err);
      }
    });

    document.getElementById("saveProjectBtn").addEventListener("click", () => {
      const project = assembleProject();
      SolarApp.Storage.saveProject(project.quotationNumber, project);
      renderSavedProjects();
      alert("Saved: " + project.quotationNumber);
    });

    document.getElementById("exportProjectBtn").addEventListener("click", () => {
      const project = assembleProject();
      SolarApp.Storage.exportProjectFile(project, project.quotationNumber + ".json");
    });

    document.getElementById("importProjectFile").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const project = await SolarApp.Storage.importProjectFile(file);
        loadProjectIntoWizard(project);
        alert("Project loaded: " + (project.quotationNumber || file.name));
      } catch (err) {
        alert("Couldn't import project: " + err.message);
      }
    });

    renderSavedProjects();
  }

  function renderSavedProjects() {
    const all = SolarApp.Storage.listProjects();
    const ids = Object.keys(all);
    const el = document.getElementById("savedProjectsList");
    if (ids.length === 0) { el.innerHTML = `<p class="disclaimer">No saved projects yet.</p>`; return; }
    el.innerHTML = "<p class='disclaimer'>Saved projects (this browser only):</p>" + ids.map(id => `
      <div class="saved-project-row">
        <span>${id} <span style="color:var(--muted);">— ${new Date(all[id].savedAt).toLocaleString()}</span></span>
        <span>
          <button type="button" data-load="${id}">Load</button>
          <button type="button" data-del="${id}">Delete</button>
        </span>
      </div>`).join("");
    el.querySelectorAll("[data-load]").forEach(b => b.addEventListener("click", () => loadProjectIntoWizard(SolarApp.Storage.loadProject(b.dataset.load))));
    el.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => { SolarApp.Storage.deleteProject(b.dataset.del); renderSavedProjects(); }));
  }

  function assembleProject() {
    const cfg = quoteScopedConfig();
    const quotationNumber = document.getElementById("finalQuoteNumber").value || state.quotationNumber;
    return {
      quotationNumber,
      date: document.getElementById("custDate").value,
      cfg,
      customer: {
        name: val("custName"), mobile: val("custMobile"), email: val("custEmail"),
        address: val("custAddress"), village: val("custVillage"), district: val("custDistrict"), pincode: val("custPincode"),
      },
      siteSurvey: {
        orientation: val("roofOrientation"), tilt: val("roofTilt"), roofType: val("roofType"),
        parapetHeight: val("parapetHeight"), shadowObstacles: val("shadowObstacles"), treeObstruction: val("treeObstruction"),
        nearbyBuildings: val("nearbyBuildings"), electricalConnection: val("electricalConnection"),
        phase: val("connectionPhase"), sanctionedLoad: val("sanctionedLoad"), notes: val("siteNotes"),
      },
      lat: val("lat"), lon: val("lon"),
      footprintSummary: state.footprintSummary,
      roofCapacity: state.roofCapacity,
      consumption: state.consumption,
      sizing: { ...state.sizing, recommendedKW: parseFloat(document.getElementById("recommendedKWOverride").value) || state.sizing.recommendedKW },
      dataSource: state.climatology ? state.climatology.source : "",
      onGrid: state.onGrid, hybrid: state.hybrid, offGrid: state.offGrid,
      comparison: state.comparison, warnings: state.warnings,
      recommendedSystemType: document.getElementById("recommendedSystemSelect").value,
      terms: (document.getElementById("termsTextarea").value || "").split("\n").filter(Boolean),
    };
  }

  function loadProjectIntoWizard(project) {
    if (!project) { alert("Project not found."); return; }
    setVal("custName", project.customer?.name); setVal("custMobile", project.customer?.mobile);
    setVal("custEmail", project.customer?.email); setVal("custAddress", project.customer?.address);
    setVal("custVillage", project.customer?.village); setVal("custDistrict", project.customer?.district);
    setVal("custPincode", project.customer?.pincode); setVal("custQuoteNumber", project.quotationNumber);
    setVal("finalQuoteNumber", project.quotationNumber); setVal("custDate", project.date);
    setVal("lat", project.lat); setVal("lon", project.lon);

    if (project.footprintSummary) {
      state.footprintSummary = project.footprintSummary;
      try { SolarApp.MapView.showFootprint(project.footprintSummary.polygons); } catch (e) {}
      document.getElementById("areaReadout").textContent = `Loaded from saved project — area ${project.footprintSummary.areaM2.toFixed(1)} m²`;
      document.getElementById("roofAreaDisplay").textContent = project.footprintSummary.areaM2.toFixed(1) + " m²";
    }
    if (project.roofCapacity) {
      state.roofCapacity = project.roofCapacity;
      document.getElementById("finalCapacityDisplay").textContent = project.roofCapacity.finalCapacityKW.toFixed(2) + " kWp";
    }
    if (project.consumption) state.consumption = project.consumption;
    if (project.sizing) {
      state.sizing = project.sizing;
      document.getElementById("recommendedKWOverride").value = project.sizing.recommendedKW;
    }
    if (project.onGrid) { state.onGrid = project.onGrid; state.hybrid = project.hybrid; state.offGrid = project.offGrid; state.comparison = project.comparison; state.warnings = project.warnings; renderComparisonTable(); renderWarnings(); }
    if (project.terms) document.getElementById("termsTextarea").value = project.terms.join("\n");
    if (project.recommendedSystemType) document.getElementById("recommendedSystemSelect").value = project.recommendedSystemType;
    goToStep(1);
  }

  // ---------------- Small helpers ----------------
  function numVal(id) { return parseFloat(document.getElementById(id).value); }
  function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
  function setVal(id, v) { const el = document.getElementById(id); if (el && v !== undefined && v !== null) el.value = v; }

  document.addEventListener("DOMContentLoaded", init);

  return { goToStep, onSettingsSaved };
})();
