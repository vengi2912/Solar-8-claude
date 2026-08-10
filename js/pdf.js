/* ==========================================================================
   pdf.js — builds the professional quotation PDF: company header, customer
   details, site analysis, all three system proposals, detailed BOM, GST,
   comparison, warranty/terms, and the mandatory preliminary-estimate notice.
   ========================================================================== */
window.SolarApp = window.SolarApp || {};

SolarApp.PDF = (function () {

  function generateQuotationPDF(project) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const cfg = project.cfg;
    const pageW = 210, margin = 14;
    let y = 16;

    function line(text, opts = {}) {
      doc.setFontSize(opts.size || 10);
      doc.setFont(undefined, opts.bold ? "bold" : "normal");
      if (opts.color) doc.setTextColor(...opts.color); else doc.setTextColor(20, 20, 20);
      doc.text(text, opts.x || margin, y);
      y += opts.gap || 5.5;
    }
    function rule() {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageW - margin, y);
      y += 5;
    }
    function ensureSpace(needed) {
      if (y + needed > 285) { doc.addPage(); y = 16; }
    }
    function sectionTitle(text) {
      ensureSpace(14);
      doc.setFillColor(27, 67, 50);
      doc.rect(margin, y - 4.5, pageW - margin * 2, 7, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11); doc.setFont(undefined, "bold");
      doc.text(text, margin + 2, y);
      y += 8;
      doc.setTextColor(20, 20, 20);
    }

    // ---- Header: company ----
    line(cfg.company.name, { size: 17, bold: true, gap: 6, color: [27, 67, 50] });
    line(cfg.company.address, { size: 9, color: [90, 90, 90] });
    line(`${cfg.company.phone}  |  ${cfg.company.email}  |  ${cfg.company.website}`, { size: 9, color: [90, 90, 90], gap: 7 });
    rule();

    line("SOLAR SYSTEM QUOTATION", { size: 14, bold: true, gap: 7 });
    line(`Quotation No: ${project.quotationNumber}`, { size: 10, bold: true });
    line(`Date: ${project.date}`, { size: 10, gap: 7 });

    // ---- Customer ----
    sectionTitle("CUSTOMER DETAILS");
    const c = project.customer;
    line(`Name: ${c.name || "-"}`);
    line(`Mobile: ${c.mobile || "-"}    Email: ${c.email || "-"}`);
    line(`Site Address: ${c.address || "-"}, ${c.village || ""}, ${c.district || "Tiruchirappalli"} - ${c.pincode || ""}`);
    y += 2;

    // ---- Site analysis ----
    sectionTitle("SITE ANALYSIS");
    const rc = project.roofCapacity;
    line(`Coordinates: ${project.lat}, ${project.lon}`);
    line(`Roof Area: ${rc.footprintAreaM2.toFixed(1)} m²  (${(rc.footprintAreaM2 * 10.7639).toFixed(0)} sq.ft)`);
    line(`Usable Roof Area: ${rc.usableAreaM2.toFixed(1)} m²  (after setbacks/walkways)`);
    line(`Maximum Roof Solar Capacity: ${rc.finalCapacityKW.toFixed(2)} kWp  (${rc.finalPanelCount} panels)`);
    line(`Approximate panel layout: ${rc.packing.rows} rows x ${rc.packing.cols} columns (${rc.packing.orientation}) — approximate rectangular-packing visualization, not a final layout drawing`, { size: 8.5, color: [120, 120, 120] });
    y += 2;

    // ---- Electricity ----
    sectionTitle("ELECTRICITY CONSUMPTION");
    const cs = project.consumption;
    line(`Average Monthly Consumption: ${cs.avgMonthly.toFixed(0)} kWh    Annual: ${cs.annual.toFixed(0)} kWh`);
    line(`Peak Monthly: ${cs.peakMonthly.toFixed(0)} kWh    Minimum Monthly: ${cs.minMonthly.toFixed(0)} kWh`);
    y += 2;

    // ---- Recommended sizing ----
    sectionTitle("RECOMMENDED SYSTEM SIZE");
    line(`Roof Maximum Capacity: ${project.sizing.roofMaxKW.toFixed(2)} kWp`);
    line(`Consumption-based Requirement: ${project.sizing.consumptionBasedKW.toFixed(2)} kWp`);
    line(`Recommended Capacity: ${project.sizing.recommendedKW.toFixed(2)} kWp  (limited by: ${project.sizing.limitedBy})`, { bold: true });
    y += 2;

    // ---- Three system proposals ----
    [project.onGrid, project.hybrid, project.offGrid].forEach(sys => {
      ensureSpace(20);
      sectionTitle(`${sys.type.toUpperCase()} SYSTEM PROPOSAL`);
      line(`Capacity: ${sys.capacityKW.toFixed(2)} kWp   Panels: ${sys.panelCount} x ${rc.panel.wattage}W   Inverter: ${sys.inverter.manufacturer} ${sys.inverter.model}`);
      if (sys.battery) line(`Battery: ${sys.batterySizing.unitsNeeded} x ${sys.battery.manufacturer} ${sys.battery.model} (${sys.batterySizing.totalNameplateKWh.toFixed(1)} kWh nameplate, backup ${sys.backupHours} hrs)`);
      line(`Annual Generation (est.): ${Math.round(sys.generation.annualKWh).toLocaleString("en-IN")} kWh    Specific Yield: ${sys.generation.specificYield.toFixed(0)} kWh/kWp/yr`);
      line(`Estimated Annual Savings: ${SolarApp.Quotation.fmtINR(sys.savings.annualSavings)}    Payback: ${SolarApp.Quotation.fmtYears(sys.savings.paybackYears)}`);

      // BOM table
      ensureSpace(10);
      doc.setFontSize(8.5); doc.setFont(undefined, "bold");
      doc.text("Item", margin, y); doc.text("Qty", 130, y); doc.text("Unit Price", 150, y); doc.text("Total", 180, y);
      y += 4;
      doc.setDrawColor(220, 220, 220); doc.line(margin, y - 3, pageW - margin, y - 3);
      doc.setFont(undefined, "normal");
      sys.cost.lineItems.forEach(li => {
        ensureSpace(6);
        const itemText = doc.splitTextToSize(String(li.item), 110);
        doc.text(itemText, margin, y);
        doc.text(String(li.qty), 130, y);
        doc.text(fmtNum(li.unitPrice), 150, y);
        doc.text(fmtNum(li.total), 180, y);
        y += Math.max(4.2, itemText.length * 4.2);
      });
      y += 1;
      doc.setDrawColor(180, 180, 180); doc.line(margin, y, pageW - margin, y); y += 5;
      line(`Equipment + BOM Subtotal: ${SolarApp.Quotation.fmtINR(sys.cost.equipmentCost)}`, { size: 9 });
      line(`Installation: ${SolarApp.Quotation.fmtINR(sys.cost.install.amount)}    Transportation: ${SolarApp.Quotation.fmtINR(sys.cost.install.transportation)}`, { size: 9 });
      line(`GST (${sys.cost.gstPct}%): ${SolarApp.Quotation.fmtINR(sys.cost.gstAmount)}`, { size: 9 });
      line(`TOTAL (incl. GST): ${SolarApp.Quotation.fmtINR(sys.cost.finalPrice)}`, { size: 11, bold: true, color: [27, 67, 50], gap: 6 });
      line(`AMC: ${SolarApp.Quotation.fmtINR(sys.cost.amc.perYear)}/year   (5-yr: ${SolarApp.Quotation.fmtINR(sys.cost.amc.fiveYear)}, 10-yr: ${SolarApp.Quotation.fmtINR(sys.cost.amc.tenYear)})`, { size: 9, gap: 7 });
    });

    // ---- Comparison ----
    ensureSpace(60);
    sectionTitle("SYSTEM COMPARISON");
    const comp = project.comparison;
    doc.setFontSize(8.5);
    const colX = [margin, 78, 118, 158];
    doc.setFont(undefined, "bold");
    doc.text("Parameter", colX[0], y); doc.text("On-Grid", colX[1], y); doc.text("Hybrid", colX[2], y); doc.text("Off-Grid", colX[3], y);
    y += 4.5;
    doc.setDrawColor(200, 200, 200); doc.line(margin, y - 3, pageW - margin, y - 3);
    doc.setFont(undefined, "normal");
    comp.forEach(row => {
      ensureSpace(8);
      const wrap = (t, w) => doc.splitTextToSize(String(t), w);
      const cells = [wrap(row.param, 60), wrap(row.onGrid, 36), wrap(row.hybrid, 36), wrap(row.offGrid, 36)];
      const maxLines = Math.max(...cells.map(c => c.length));
      cells.forEach((c, i) => doc.text(c, colX[i], y));
      y += maxLines * 4.2 + 1;
    });
    y += 3;
    line(`Recommended: ${project.recommendedSystemType || "On-Grid"} — best fit for this site's roof capacity, consumption pattern, and budget.`, { bold: true, size: 9.5 });

    // ---- Warranty & Terms ----
    ensureSpace(40);
    sectionTitle("WARRANTY");
    line(`Solar Panels: ${rc.panel.warrantyYears} years performance warranty (manufacturer)`, { size: 9 });
    line(`Inverter: as per manufacturer (typically 5–10 years)`, { size: 9 });
    line(`Installation Workmanship: 1 year from commissioning`, { size: 9, gap: 7 });

    sectionTitle("TERMS & CONDITIONS");
    (project.terms || DEFAULT_TERMS).forEach(t => { ensureSpace(6); line("• " + t, { size: 8.5 }); });

    // ---- Validation / disclaimer ----
    ensureSpace(30);
    sectionTitle("IMPORTANT NOTES");
    (project.warnings || []).forEach(w => { ensureSpace(6); line(w, { size: 8.5, color: [180, 90, 20] }); });
    ensureSpace(14);
    doc.setFont(undefined, "italic"); doc.setFontSize(8.5); doc.setTextColor(90, 90, 90);
    const notice = "This is a preliminary quotation based on available site information. Final system design, generation and pricing are subject to physical site survey, structural verification, electrical inspection and applicable utility requirements.";
    const noticeLines = doc.splitTextToSize(notice, pageW - margin * 2);
    ensureSpace(noticeLines.length * 4.5);
    doc.text(noticeLines, margin, y);

    doc.save(`${project.quotationNumber}.pdf`);
  }

  function fmtNum(n) { return Number.isFinite(n) ? Math.round(n).toLocaleString("en-IN") : "-"; }

  const DEFAULT_TERMS = [
    "Prices valid for 15 days from the date of this quotation.",
    "50% advance on order confirmation, balance on commissioning.",
    "Subsidy (if applicable) is credited by the government directly to the customer's bank account; timelines depend on DISCOM/MNRE processing.",
    "Net-metering approval and any DISCOM charges are the customer's responsibility unless separately agreed.",
    "Delivery and installation timeline: 15–30 working days from advance payment, subject to material availability.",
  ];

  return { generateQuotationPDF, DEFAULT_TERMS };
})();
