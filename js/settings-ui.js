/* ==========================================================================
   settings-ui.js — renders every editable database (panels, inverters,
   batteries, BOM pricing, installation/AMC/GST, tariff, roof defaults,
   losses, company info) into the Settings modal, and reads it all back into
   SolarApp.Config on Save. Nothing here has calculation logic — it's pure
   form <-> config plumbing.
   ========================================================================== */
window.SolarApp = window.SolarApp || {};

SolarApp.SettingsUI = (function () {

  function openModal() {
    document.getElementById("settingsModal").hidden = false;
    renderAll();
  }
  function closeModal() {
    document.getElementById("settingsModal").hidden = true;
  }

  function switchTab(tabName) {
    document.querySelectorAll(".settings-tab").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(".settings-tab-btn").forEach(el => el.classList.remove("active"));
    document.getElementById("tab-" + tabName).classList.add("active");
    document.querySelector(`.settings-tab-btn[data-tab="${tabName}"]`).classList.add("active");
  }

  function renderAll() {
    const cfg = SolarApp.Config.get();
    renderCompany(cfg);
    renderTable("panelsTableBody", cfg.panels, PANEL_COLS);
    renderTable("invertersTableBody", cfg.inverters, INVERTER_COLS);
    renderTable("batteriesTableBody", cfg.batteries, BATTERY_COLS);
    renderBomPricing(cfg);
    renderInstallAmcGst(cfg);
    renderTariff(cfg);
    renderRoofDefaults(cfg);
    renderLosses(cfg);
  }

  function renderCompany(cfg) {
    const c = cfg.company;
    setVal("companyName", c.name); setVal("companyAddress", c.address);
    setVal("companyPhone", c.phone); setVal("companyEmail", c.email);
    setVal("companyWebsite", c.website); setVal("companyPrefix", c.quotationPrefix);
  }

  const PANEL_COLS = [
    ["manufacturer", "Manufacturer", "text"], ["model", "Model", "text"], ["wattage", "Watts", "number"],
    ["lengthMM", "Length mm", "number"], ["widthMM", "Width mm", "number"], ["efficiencyPct", "Eff %", "number"],
    ["warrantyYears", "Warranty yr", "number"], ["pricePerPanel", "Price ₹", "number"],
  ];
  const INVERTER_COLS = [
    ["manufacturer", "Manufacturer", "text"], ["model", "Model", "text"],
    ["type", "Type (on-grid/hybrid/off-grid)", "text"], ["capacityKW", "kW", "number"],
    ["efficiencyPct", "Eff %", "number"], ["warrantyYears", "Warranty yr", "number"], ["price", "Price ₹", "number"],
  ];
  const BATTERY_COLS = [
    ["manufacturer", "Manufacturer", "text"], ["model", "Model", "text"], ["chemistry", "Chemistry", "text"],
    ["voltage", "Voltage", "number"], ["capacityKWh", "kWh", "number"], ["dodPct", "DoD %", "number"],
    ["roundtripEffPct", "RT Eff %", "number"], ["cycleLife", "Cycle Life", "number"],
    ["warrantyYears", "Warranty yr", "number"], ["price", "Price ₹", "number"],
  ];

  function renderTable(tbodyId, rows, cols) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = "";
    // header (rebuilt each time in case cols change)
    const thead = tbody.closest("table").querySelector("thead");
    thead.innerHTML = "<tr>" + cols.map(c => `<th>${c[1]}</th>`).join("") + "<th></th></tr>";

    rows.forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.dataset.index = i;
      tr.innerHTML = cols.map(([key, label, type]) =>
        `<td><input type="${type}" step="any" data-key="${key}" value="${escapeAttr(row[key])}"></td>`
      ).join("") + `<td><button class="row-del" data-tbody="${tbodyId}" data-index="${i}">✕</button></td>`;
      tbody.appendChild(tr);
    });
  }

  function addRow(tbodyId, cols, blankRow) {
    const cfg = SolarApp.Config.get();
    const arr = arrayForTbody(tbodyId, cfg);
    arr.push({ id: (tbodyId + "_" + Date.now()), ...blankRow });
    SolarApp.Config.save(cfg);
    renderTable(tbodyId, arr, cols);
  }

  function deleteRow(tbodyId, index) {
    const cfg = SolarApp.Config.get();
    const arr = arrayForTbody(tbodyId, cfg);
    arr.splice(index, 1);
    SolarApp.Config.save(cfg);
    renderTable(tbodyId, arr, tbodyId === "panelsTableBody" ? PANEL_COLS : tbodyId === "invertersTableBody" ? INVERTER_COLS : BATTERY_COLS);
  }

  function arrayForTbody(tbodyId, cfg) {
    if (tbodyId === "panelsTableBody") return cfg.panels;
    if (tbodyId === "invertersTableBody") return cfg.inverters;
    if (tbodyId === "batteriesTableBody") return cfg.batteries;
    return [];
  }

  function readTableIntoArray(tbodyId, cols, existingArray) {
    const tbody = document.getElementById(tbodyId);
    const rows = Array.from(tbody.querySelectorAll("tr"));
    return rows.map((tr, i) => {
      const obj = { id: (existingArray[i] && existingArray[i].id) || (tbodyId + "_" + i) };
      cols.forEach(([key, , type]) => {
        const input = tr.querySelector(`input[data-key="${key}"]`);
        obj[key] = type === "number" ? parseFloat(input.value) : input.value;
      });
      return obj;
    });
  }

  function renderBomPricing(cfg) {
    const b = cfg.bomPricing;
    Object.keys(b).forEach(k => setVal("bom_" + k, b[k]));
  }

  function renderInstallAmcGst(cfg) {
    setVal("installMethod", cfg.installation.method);
    setVal("installPercentage", cfg.installation.percentageOfEquipment);
    setVal("installFixed", cfg.installation.fixedAmount);
    setVal("installTransport", cfg.installation.transportationFlat);
    setVal("amcOnGrid", cfg.amc.onGridPerYearPerKW);
    setVal("amcHybridOffGrid", cfg.amc.hybridOffGridPerYearPerKW);
    setVal("gstPct", cfg.gstPct);
  }

  function renderTariff(cfg) {
    setVal("tariffVersion", cfg.tariff.version);
    setVal("tariffAsOf", cfg.tariff.asOf);
    setVal("tariffFlatFallback", cfg.tariff.flatRateFallback);
    const tbody = document.getElementById("tariffTableBody");
    tbody.innerHTML = "";
    cfg.tariff.slabsPerUnit.forEach((slab, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="number" data-key="uptoUnits" value="${slab.uptoUnits === Infinity ? "" : slab.uptoUnits}" placeholder="∞ if last slab"></td>
        <td><input type="number" step="any" data-key="rate" value="${slab.rate}"></td>
        <td><button class="row-del" data-tariff-index="${i}">✕</button></td>`;
      tbody.appendChild(tr);
    });
  }

  function renderRoofDefaults(cfg) {
    const r = cfg.roof;
    Object.keys(r).forEach(k => setVal("roof_" + k, r[k]));
  }

  function renderLosses(cfg) {
    const l = cfg.losses;
    Object.keys(l).forEach(k => setVal("loss_" + k, l[k]));
  }

  function saveAll() {
    const cfg = SolarApp.Config.get();

    cfg.company.name = getVal("companyName");
    cfg.company.address = getVal("companyAddress");
    cfg.company.phone = getVal("companyPhone");
    cfg.company.email = getVal("companyEmail");
    cfg.company.website = getVal("companyWebsite");
    cfg.company.quotationPrefix = getVal("companyPrefix");

    cfg.panels = readTableIntoArray("panelsTableBody", PANEL_COLS, cfg.panels);
    cfg.inverters = readTableIntoArray("invertersTableBody", INVERTER_COLS, cfg.inverters);
    cfg.batteries = readTableIntoArray("batteriesTableBody", BATTERY_COLS, cfg.batteries);

    Object.keys(cfg.bomPricing).forEach(k => { cfg.bomPricing[k] = parseFloat(getVal("bom_" + k)) || 0; });

    cfg.installation.method = getVal("installMethod");
    cfg.installation.percentageOfEquipment = parseFloat(getVal("installPercentage")) || 0;
    cfg.installation.fixedAmount = parseFloat(getVal("installFixed")) || 0;
    cfg.installation.transportationFlat = parseFloat(getVal("installTransport")) || 0;
    cfg.amc.onGridPerYearPerKW = parseFloat(getVal("amcOnGrid")) || 0;
    cfg.amc.hybridOffGridPerYearPerKW = parseFloat(getVal("amcHybridOffGrid")) || 0;
    cfg.gstPct = parseFloat(getVal("gstPct")) || 0;

    cfg.tariff.version = getVal("tariffVersion");
    cfg.tariff.asOf = getVal("tariffAsOf");
    cfg.tariff.flatRateFallback = parseFloat(getVal("tariffFlatFallback")) || 0;
    const tariffRows = Array.from(document.getElementById("tariffTableBody").querySelectorAll("tr"));
    cfg.tariff.slabsPerUnit = tariffRows.map(tr => {
      const uptoRaw = tr.querySelector('[data-key="uptoUnits"]').value;
      const rate = parseFloat(tr.querySelector('[data-key="rate"]').value) || 0;
      return { uptoUnits: uptoRaw === "" ? Infinity : parseFloat(uptoRaw), rate };
    });

    Object.keys(cfg.roof).forEach(k => {
      const el = document.getElementById("roof_" + k);
      if (!el) return;
      cfg.roof[k] = el.tagName === "SELECT" ? el.value : (parseFloat(el.value) || 0);
    });

    Object.keys(cfg.losses).forEach(k => { cfg.losses[k] = parseFloat(getVal("loss_" + k)) || 0; });

    SolarApp.Config.save(cfg);
    return cfg;
  }

  function setVal(id, value) { const el = document.getElementById(id); if (el) el.value = value; }
  function getVal(id) { const el = document.getElementById(id); return el ? el.value : ""; }
  function escapeAttr(v) { return String(v).replace(/"/g, "&quot;"); }

  function wireEvents() {
    document.getElementById("settingsBtn").addEventListener("click", openModal);
    document.getElementById("settingsCloseBtn").addEventListener("click", closeModal);
    document.querySelectorAll(".settings-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    document.getElementById("addPanelRow").addEventListener("click", () =>
      addRow("panelsTableBody", PANEL_COLS, { manufacturer: "New", model: "Model", wattage: 550, lengthMM: 2278, widthMM: 1134, efficiencyPct: 21, warrantyYears: 25, pricePerPanel: 13000 }));
    document.getElementById("addInverterRow").addEventListener("click", () =>
      addRow("invertersTableBody", INVERTER_COLS, { manufacturer: "New", model: "Model", type: "on-grid", capacityKW: 5, efficiencyPct: 97, warrantyYears: 10, price: 40000 }));
    document.getElementById("addBatteryRow").addEventListener("click", () =>
      addRow("batteriesTableBody", BATTERY_COLS, { manufacturer: "New", model: "Model", chemistry: "LiFePO4", voltage: 51.2, capacityKWh: 5, dodPct: 90, roundtripEffPct: 95, cycleLife: 6000, warrantyYears: 10, price: 140000 }));
    document.getElementById("addTariffSlab").addEventListener("click", () => {
      const cfg = SolarApp.Config.get();
      cfg.tariff.slabsPerUnit.push({ uptoUnits: Infinity, rate: 0 });
      renderTariff(cfg);
    });

    document.getElementById("settingsForm").addEventListener("click", (e) => {
      if (e.target.classList.contains("row-del")) {
        if (e.target.dataset.tbody) deleteRow(e.target.dataset.tbody, parseInt(e.target.dataset.index, 10));
        if (e.target.dataset.tariffIndex !== undefined) {
          const cfg = SolarApp.Config.get();
          cfg.tariff.slabsPerUnit.splice(parseInt(e.target.dataset.tariffIndex, 10), 1);
          renderTariff(cfg);
        }
      }
    });

    document.getElementById("saveSettingsBtn").addEventListener("click", () => {
      saveAll();
      closeModal();
      if (SolarApp.App && SolarApp.App.onSettingsSaved) SolarApp.App.onSettingsSaved();
    });
    document.getElementById("resetSettingsBtn").addEventListener("click", () => {
      if (confirm("Reset ALL settings (panels, prices, tariff, etc.) to defaults? This can't be undone.")) {
        SolarApp.Config.resetToDefaults();
        renderAll();
      }
    });
  }

  return { openModal, closeModal, switchTab, renderAll, saveAll, wireEvents };
})();
