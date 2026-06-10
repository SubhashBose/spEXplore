const SPEED_OF_LIGHT_KMS = 299792.458;
const DEFAULT_LINE_COLORS = ["#b42318", "#0f766e", "#7c3aed", "#c2410c", "#1d4ed8"];

const INBUILT_LINES = [
  { name: "Ly-alpha", rest: 1215.67 },
  { name: "NV 1240", rest: 1240.14 },
  { name: "OI 1302", rest: 1302.17 },
  { name: "CII 1335", rest: 1335.71 },
  { name: "SiIV 1393", rest: 1393.76 },
  { name: "SiIV 1402", rest: 1402.77 },
  { name: "CIV 1548", rest: 1548.19 },
  { name: "CIV 1550", rest: 1550.77 },
  { name: "HeII 1640", rest: 1640.42 },
  { name: "CIII] 1909", rest: 1908.73 },
  { name: "CII] 2326", rest: 2326.50 },
  { name: "MgII 2796", rest: 2796.35 },
  { name: "MgII 2803", rest: 2803.53 },
  { name: "[OII] 3727", rest: 3727.09 },
  { name: "CaII K", rest: 3933.66 },
  { name: "CaII H", rest: 3968.47 },
  { name: "H-delta", rest: 4101.74 },
  { name: "H-gamma", rest: 4340.47 },
  { name: "H-beta", rest: 4861.33 },
  { name: "[OIII] 4959", rest: 4958.91 },
  { name: "[OIII] 5007", rest: 5006.84 },
  { name: "HeI 5876", rest: 5875.62 },
  { name: "[OI] 6300", rest: 6300.30 },
  { name: "H-alpha", rest: 6562.82 },
  { name: "[NII] 6584", rest: 6583.45 },
  { name: "[SII] 6716", rest: 6716.44 },
  { name: "[SII] 6731", rest: 6730.82 },
  { name: "FeII 4924", rest: 4924 },
  { name: "FeII 5018", rest: 5018 },
  { name: "FeII 5169", rest: 5169 }
];

const state = {
  spectrum: [],
  fileName: "",
  redshift: 0,
  binSize: 1,
  commonVelocity: 0,
  lines: [
    { visible: true, species: "H-alpha", rest: "6562.82", velocity: "0", color: "#b42318" },
    { visible: true, species: "[OIII] 5007", rest: "5006.84", velocity: "0", color: "#0f766e" },
    { visible: true, species: "H-beta", rest: "4861.33", velocity: "0", color: "#7c3aed" }
  ],
  deletedSections: [],
  fittedProfiles: [],
  deleteMode: false,
  deletePoints: [],
  fitMode: false,
  fitPoints: [],
  zoom: null,
  dragZoomMode: false,
  dragStart: null,
  dragCurrent: null,
  plotArea: null,
  currentDomain: null,
  currentRange: null
};

const fileInput = document.querySelector("#fileInput");
const fileStatus = document.querySelector("#fileStatus");
const plotPanel = document.querySelector("#plotPanel");
const canvas = document.querySelector("#spectrumCanvas");
const emptyState = document.querySelector("#emptyState");
const redshiftInput = document.querySelector("#redshiftInput");
const redshiftSlider = document.querySelector("#redshiftSlider");
const binningInput = document.querySelector("#binningInput");
const commonVelocityInput = document.querySelector("#commonVelocityInput");
const commonVelocitySlider = document.querySelector("#commonVelocitySlider");
const addLineButton = document.querySelector("#addLineButton");
const lineTableBody = document.querySelector("#lineTableBody");
const dragZoomButton = document.querySelector("#dragZoomButton");
const zoomInButton = document.querySelector("#zoomInButton");
const zoomOutButton = document.querySelector("#zoomOutButton");
const resetZoomButton = document.querySelector("#resetZoomButton");
const mouseReadout = document.querySelector("#mouseReadout");
const deleteSectionButton = document.querySelector("#deleteSectionButton");
const fitProfileButton = document.querySelector("#fitProfileButton");
const deletedSectionsList = document.querySelector("#deletedSectionsList");
const fittedProfilesList = document.querySelector("#fittedProfilesList");
const deleteHint = document.querySelector("#deleteHint");
const fitHint = document.querySelector("#fitHint");
const speciesList = document.querySelector("#speciesList");
const ctx = canvas.getContext("2d");
const saveSessionButton = document.querySelector("#saveSessionButton");
const loadSessionButton = document.querySelector("#loadSessionButton");
const sessionFileInput = document.querySelector("#sessionFileInput");

// Initialize datalist
INBUILT_LINES.forEach(line => {
  const option = document.createElement("option");
  option.value = line.name;
  speciesList.appendChild(option);
});

fileInput.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) loadSpectrumFile(file);
});

redshiftInput.addEventListener("input", () => {
  state.redshift = Number.parseFloat(redshiftInput.value) || 0;
  state.zoom = null;
  renderAll();
});

saveSessionButton.addEventListener("click", saveSession);
loadSessionButton.addEventListener("click", () => sessionFileInput.click());
sessionFileInput.addEventListener("change", event => {
  const file = event.target.files[0];
  if (file) loadSession(file);
  sessionFileInput.value = "";
});

attachCenteredSlider(redshiftSlider, () => state.redshift, value => {
  state.redshift = value;
  redshiftInput.value = formatInputValue(value, 6);
  state.zoom = null;
  renderAll();
}, 0.001);

binningInput.addEventListener("input", () => {
  const parsed = Number.parseFloat(binningInput.value);
  if (!Number.isFinite(parsed)) return;
  state.binSize = normalizedBinSize(parsed);
  drawSpectrum();
});
binningInput.addEventListener("change", () => {
  state.binSize = normalizedBinSize(binningInput.value);
  binningInput.value = String(state.binSize);
  drawSpectrum();
});

commonVelocityInput.addEventListener("input", () => {
  setCommonVelocity(Number.parseFloat(commonVelocityInput.value) || 0);
});

attachCenteredSlider(commonVelocitySlider, () => state.commonVelocity, value => {
  setCommonVelocity(value);
  commonVelocityInput.value = formatInputValue(value, 3);
}, 1);

addLineButton.addEventListener("click", () => {
  state.lines.push({
    visible: true,
    species: "",
    rest: "",
    velocity: formatInputValue(state.commonVelocity, 3),
    observed: "",
    color: DEFAULT_LINE_COLORS[state.lines.length % DEFAULT_LINE_COLORS.length]
  });
  renderAll();
});

plotPanel.addEventListener("dragover", event => {
  event.preventDefault();
  plotPanel.classList.add("drag-over");
});
plotPanel.addEventListener("dragleave", event => {
  if (!plotPanel.contains(event.relatedTarget)) plotPanel.classList.remove("drag-over");
});
plotPanel.addEventListener("drop", event => {
  event.preventDefault();
  plotPanel.classList.remove("drag-over");
  const file = event.dataTransfer.files[0];
  if (file) loadSpectrumFile(file);
});

canvas.addEventListener("mousemove", handleMouseMove);
canvas.addEventListener("mouseleave", () => {
  mouseReadout.textContent = "Rest x: - | Flux: -";
  if (!state.dragStart) return;
  state.dragStart = null;
  state.dragCurrent = null;
  drawSpectrum();
});
canvas.addEventListener("mousedown", event => {
  if (state.fitMode && isInsidePlot(event)) {
    const fitPoint = plotValueFromEvent(event);
    state.fitPoints.push(fitPoint);

    if (state.fitPoints.length === 2) {
      const fit = fitGaussianProfile(state.fitPoints[0], state.fitPoints[1]);
      state.fitMode = false;
      state.fitPoints = [];
      fitProfileButton.classList.remove("active");
      fitHint.classList.remove("visible");
      canvas.classList.remove("fit-mode-cursor");
      if (fit) {
        state.fittedProfiles.push(fit);
      } else {
        mouseReadout.textContent = "Fit failed: choose a wider range with at least five spectrum points.";
      }
      renderAll();
    } else {
      drawSpectrum();
    }
    return;
  }

  if (state.deleteMode && isInsidePlot(event)) {
    const { restX } = plotValueFromEvent(event);
    const observedX = restX * redshiftFactor();
    state.deletePoints.push(observedX);

    if (state.deletePoints.length === 2) {
      const min = Math.min(...state.deletePoints);
      const max = Math.max(...state.deletePoints);
      state.deletedSections.push({ min, max });
      state.deleteMode = false;
      state.deletePoints = [];
      deleteSectionButton.classList.remove("active");
      deleteHint.classList.remove("visible");
      canvas.classList.remove("delete-mode-cursor");
      renderAll();
    }
    return;
  }
  if (!state.dragZoomMode || !state.spectrum.length || !isInsidePlot(event)) return;
  state.dragStart = canvasPoint(event);
  state.dragCurrent = state.dragStart;
});

deleteSectionButton.addEventListener("click", () => {
  state.deleteMode = !state.deleteMode;
  state.deletePoints = [];
  deleteSectionButton.classList.toggle("active", state.deleteMode);
  deleteHint.classList.toggle("visible", state.deleteMode);
  canvas.classList.toggle("delete-mode-cursor", state.deleteMode);
  if (state.deleteMode) {
    state.fitMode = false;
    state.fitPoints = [];
    fitProfileButton.classList.remove("active");
    fitHint.classList.remove("visible");
    canvas.classList.remove("fit-mode-cursor");
    state.dragZoomMode = false;
    dragZoomButton.classList.remove("active");
  }
});

fitProfileButton.addEventListener("click", () => {
  state.fitMode = !state.fitMode;
  state.fitPoints = [];
  fitProfileButton.classList.toggle("active", state.fitMode);
  fitHint.classList.toggle("visible", state.fitMode);
  canvas.classList.toggle("fit-mode-cursor", state.fitMode);
  if (state.fitMode) {
    state.deleteMode = false;
    state.deletePoints = [];
    deleteSectionButton.classList.remove("active");
    deleteHint.classList.remove("visible");
    canvas.classList.remove("delete-mode-cursor");
    state.dragZoomMode = false;
    dragZoomButton.classList.remove("active");
  }
});
window.addEventListener("mouseup", finishDragZoom);

window.addEventListener("resize", drawSpectrum);
dragZoomButton.addEventListener("click", () => {
  state.dragZoomMode = !state.dragZoomMode;
  dragZoomButton.classList.toggle("active", state.dragZoomMode);
  if (state.dragZoomMode) {
    state.deleteMode = false;
    state.deletePoints = [];
    deleteSectionButton.classList.remove("active");
    deleteHint.classList.remove("visible");
    canvas.classList.remove("delete-mode-cursor");
    state.fitMode = false;
    state.fitPoints = [];
    fitProfileButton.classList.remove("active");
    fitHint.classList.remove("visible");
    canvas.classList.remove("fit-mode-cursor");
  }
});
resetZoomButton.addEventListener("click", () => {
  state.zoom = null;
  renderAll();
});
zoomInButton.addEventListener("click", () => zoomBy(0.5));
zoomOutButton.addEventListener("click", () => zoomBy(2));

renderAll();

async function loadSpectrumFile(file) {
  try {
    const text = await file.text();
    const spectrum = parseSpectrum(text);
    if (spectrum.length < 2) throw new Error("Need at least two numeric rows with wavelength and flux.");

    state.spectrum = spectrum;
    state.fileName = file.name;
    state.zoom = null;
    state.fittedProfiles = [];
    state.fitMode = false;
    state.fitPoints = [];
    fitProfileButton.classList.remove("active");
    fitHint.classList.remove("visible");
    canvas.classList.remove("fit-mode-cursor");
    fileStatus.textContent = `${file.name} - ${spectrum.length.toLocaleString()} points`;
    renderAll();
  } catch (error) {
    state.spectrum = [];
    state.fileName = "";
    state.zoom = null;
    fileStatus.textContent = error.message;
    renderAll();
  }
}

function parseSpectrum(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || /^(#|%|;|\/\/)/.test(trimmed)) continue;

    const columns = trimmed.split(/[\s,]+/);
    if (columns.length < 2) continue;

    const wavelength = Number.parseFloat(columns[0]);
    const flux = Number.parseFloat(columns[1]);
    if (Number.isFinite(wavelength) && Number.isFinite(flux)) rows.push({ wavelength, flux });
  }

  rows.sort((a, b) => a.wavelength - b.wavelength);
  return rows;
}

function renderAll() {
  renderLineTable();
  renderDeletedSections();
  renderFittedProfiles();
  drawSpectrum();
}

function renderDeletedSections() {
  deletedSectionsList.replaceChildren();
  if (state.deletedSections.length === 0) {
    const empty = document.createElement("div");
    empty.style.color = "var(--muted)";
    empty.style.fontSize = "13px";
    empty.textContent = "No sections deleted.";
    deletedSectionsList.append(empty);
    return;
  }

  const factor = redshiftFactor();
  state.deletedSections.forEach((section, index) => {
    const card = document.createElement("div");
    card.className = "delete-card";
    const label = document.createElement("span");
    label.className = "range-label";
    const restMin = section.min / factor;
    const restMax = section.max / factor;
    label.textContent = `${restMin.toFixed(2)} - ${restMax.toFixed(2)} A (Rest)`;
    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.textContent = "Undelete";
    btn.addEventListener("click", () => {
      state.deletedSections.splice(index, 1);
      renderAll();
    });
    card.append(label, btn);
    deletedSectionsList.append(card);
  });
}

function renderFittedProfiles() {
  fittedProfilesList.replaceChildren();
  if (state.fittedProfiles.length === 0) {
    const empty = document.createElement("div");
    empty.style.color = "var(--muted)";
    empty.style.fontSize = "13px";
    empty.textContent = "No fitted profiles yet.";
    fittedProfilesList.append(empty);
    return;
  }

  state.fittedProfiles.forEach((profile, index) => {
    const card = document.createElement("div");
    card.className = "fit-card";

    const title = document.createElement("div");
    title.className = "fit-card-title";
    title.textContent = `${profile.kind} profile ${index + 1}`;

    // --- Species + rest wavelength input row ---
    const lineIdRow = document.createElement("div");
    lineIdRow.className = "fit-line-id-row";

    const speciesWrap = document.createElement("div");
    speciesWrap.className = "fit-field-wrap";
    const speciesLabel = document.createElement("span");
    speciesLabel.className = "line-field-label";
    speciesLabel.textContent = "Line";
    const speciesInput = document.createElement("input");
    speciesInput.type = "text";
    speciesInput.className = "fit-species-input";
    speciesInput.setAttribute("list", "speciesList");
    speciesInput.placeholder = "Species";
    speciesInput.value = profile.species || "";
    speciesWrap.append(speciesLabel, speciesInput);

    const restWrap = document.createElement("div");
    restWrap.className = "fit-field-wrap";
    const restLabel = document.createElement("span");
    restLabel.className = "line-field-label";
    restLabel.textContent = "Rest (Å)";
    const restInput = document.createElement("input");
    restInput.type = "number";
    restInput.className = "fit-rest-input";
    restInput.step = "0.001";
    restInput.placeholder = "Wavelength";
    restInput.value = profile.lineRest || "";
    restWrap.append(restLabel, restInput);

    lineIdRow.append(speciesWrap, restWrap);

    // --- Measured values dl ---
    const values = document.createElement("dl");
    values.className = "fit-values";
    appendFitValue(values, "Mean", `${formatNumber(profile.mean)} Å`);
    appendFitValue(values, "FWHM", `${formatNumber(profile.fwhm)} Å`);
    appendFitValue(values, "pEW", `${formatNumber(profile.pEW)} Å`);
    appendFitValue(values, "Range", `${formatNumber(profile.minX)}–${formatNumber(profile.maxX)} Å`);

    // Velocity rows — shown only when rest wavelength is set
    const meanVelTerm = document.createElement("dt");
    const meanVelDesc = document.createElement("dd");
    meanVelTerm.textContent = "Mean vel.";
    const fwhmVelTerm = document.createElement("dt");
    const fwhmVelDesc = document.createElement("dd");
    fwhmVelTerm.textContent = "FWHM vel.";

    function updateVelocityRows() {
      const rest = Number.parseFloat(restInput.value);
      if (!Number.isFinite(rest) || rest <= 0) {
        meanVelTerm.style.display = "none";
        meanVelDesc.style.display = "none";
        fwhmVelTerm.style.display = "none";
        fwhmVelDesc.style.display = "none";
        return;
      }
      // Mean velocity: redshift-corrected velocity from rest wavelength
      // v = c * (lambda_obs / lambda_rest - 1), where lambda_obs = mean
      // const observedMean = profile.mean * redshiftFactor();
      const meanVel = SPEED_OF_LIGHT_KMS * (profile.mean / rest - 1);
      // FWHM in velocity: delta_lambda / rest * c (non-relativistic width)
      const fwhmVel = SPEED_OF_LIGHT_KMS * profile.fwhm / rest;
      meanVelDesc.textContent = `${formatNumber(meanVel)} km/s`;
      fwhmVelDesc.textContent = `${formatNumber(Math.abs(fwhmVel))} km/s`;
      meanVelTerm.style.display = "";
      meanVelDesc.style.display = "";
      fwhmVelTerm.style.display = "";
      fwhmVelDesc.style.display = "";
    }

    values.append(meanVelTerm, meanVelDesc, fwhmVelTerm, fwhmVelDesc);
    updateVelocityRows();

    // Wire up species input: autocomplete from INBUILT_LINES fills rest field
    speciesInput.addEventListener("input", () => { profile.species = speciesInput.value; });
    speciesInput.addEventListener("change", () => {
      profile.species = speciesInput.value;
      const found = INBUILT_LINES.find(l => l.name === speciesInput.value);
      if (found) {
        profile.lineRest = formatInputValue(found.rest, 4);
        restInput.value = profile.lineRest;
        updateVelocityRows();
      }
    });

    // Wire up rest wavelength input
    restInput.addEventListener("input", () => {
      profile.lineRest = restInput.value;
      updateVelocityRows();
    });

    const button = document.createElement("button");
    button.className = "remove-btn";
    button.type = "button";
    button.textContent = "Remove";
    button.addEventListener("click", () => {
      state.fittedProfiles.splice(index, 1);
      renderAll();
    });

    card.append(title, lineIdRow, values, button);
    fittedProfilesList.append(card);
  });
}

function appendFitValue(list, label, value) {
  const term = document.createElement("dt");
  const description = document.createElement("dd");
  term.textContent = label;
  description.textContent = value;
  list.append(term, description);
}

function renderLineTable() {
  lineTableBody.replaceChildren();

  if (state.lines.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-line-row";
    const cell = document.createElement("td");
    cell.className = "empty-line-cell";
    cell.colSpan = 7;
    cell.textContent = "No spectral lines yet.";
    cell.style.color = "var(--muted)";
    row.append(cell);
    lineTableBody.append(row);
    return;
  }

  state.lines.forEach((line, index) => {
    if (line.visible === undefined) line.visible = true;
    syncLineObserved(line);
    const row = document.createElement("tr");
    row.className = "line-card";
    let velocityInput;
    let observedInput;

    const refreshCoupledInputs = () => {
      if (velocityInput) velocityInput.value = line.velocity;
      if (observedInput) observedInput.value = line.observed;
      drawSpectrum();
    };

    const velocityCell = numericSliderCell("Velocity (km/s)", line.velocity, "1", () => numericValue(line.velocity), value => {
      line.velocity = formatInputValue(value, 3);
      syncLineObserved(line);
      refreshCoupledInputs();
    });
    velocityInput = velocityCell.querySelector("input[type='number']");

    const observedCell = numericSliderCell("Observed A", line.observed, "0.001", () => numericValue(line.observed), value => {
      line.observed = formatInputValue(value, 3);
      syncLineVelocity(line);
      refreshCoupledInputs();
    });
    observedInput = observedCell.querySelector("input[type='number']");

    row.append(
      visibilityCell("Show", line, value => {
        line.visible = value;
        drawSpectrum();
      }),
      textCell("Species", line.species, value => {
        line.species = value;
        drawSpectrum();
      }, (rest) => {
        line.rest = formatInputValue(rest, 3);
        syncLineObserved(line);
        renderAll();
      }),
      numericSliderCell("Rest A", line.rest, "0.001", () => numericValue(line.rest), value => {
        line.rest = formatInputValue(value, 3);
        syncLineObserved(line);
        refreshCoupledInputs();
      }),
      velocityCell,
      observedCell,
      colorCell("Color", line.color, value => {
        line.color = value;
        drawSpectrum();
      }),
      removeCell(index)
    );
    lineTableBody.append(row);
  });
}

function fieldLabel(text) {
  const label = document.createElement("span");
  label.className = "line-field-label";
  label.textContent = text;
  return label;
}

function visibilityCell(label, line, onInput) {
  const cell = document.createElement("td");
  const input = document.createElement("input");
  cell.className = "visibility-cell";
  input.type = "checkbox";
  input.checked = line.visible !== false;
  input.title = "Show line";
  input.addEventListener("change", () => onInput(input.checked));
  cell.append(fieldLabel(label), input);
  return cell;
}

function textCell(label, value, onInput, onSpeciesSelect) {
  const cell = document.createElement("td");
  cell.className = "species-cell";
  const input = document.createElement("input");
  input.type = "text";
  input.setAttribute("list", "speciesList");
  input.value = value;
  input.addEventListener("input", () => onInput(input.value));
  input.addEventListener("change", () => {
    const found = INBUILT_LINES.find(l => l.name === input.value);
    if (found) {
      onSpeciesSelect(found.rest);
    }
  });
  cell.append(fieldLabel(label), input);
  return cell;
}

function numericSliderCell(label, value, step, getValue, setValue) {
  const cell = document.createElement("td");
  cell.className = "numeric-cell";
  const wrap = document.createElement("div");
  const input = document.createElement("input");
  const slider = document.createElement("input");

  wrap.className = "field-stack";
  input.type = "number";
  input.step = step;
  input.value = value;
  slider.type = "range";
  slider.className = "center-slider";
  slider.min = "-1";
  slider.max = "1";
  slider.step = "0.001";
  slider.value = "0";

  input.addEventListener("input", () => setValue(Number.parseFloat(input.value)));
  attachCenteredSlider(slider, getValue, value => {
    setValue(value);
    input.value = formatInputValue(value, sliderDigits(step));
  }, Number.parseFloat(step) || 0.001);

  wrap.append(input, slider);
  cell.append(fieldLabel(label), wrap);
  return cell;
}

function colorCell(label, value, onInput) {
  const cell = document.createElement("td");
  cell.className = "color-cell";
  const input = document.createElement("input");
  input.type = "color";
  input.value = value || DEFAULT_LINE_COLORS[0];
  input.addEventListener("input", () => onInput(input.value));
  cell.append(fieldLabel(label), input);
  return cell;
}

function removeCell(index) {
  const cell = document.createElement("td");
  cell.className = "remove-cell";
  const button = document.createElement("button");
  button.className = "remove-line";
  button.type = "button";
  button.title = "Remove line";
  button.textContent = "x";
  button.addEventListener("click", () => {
    state.lines.splice(index, 1);
    renderAll();
  });
  cell.append(fieldLabel("\u00a0"), button);
  return cell;
}

function attachCenteredSlider(slider, getValue, setValue, minimumSpan = 0.001) {
  let previewBase = null;
  const preview = () => {
    if (previewBase === null) previewBase = finiteOrZero(getValue());
    setValue(centerSliderValue(previewBase, Number.parseFloat(slider.value), minimumSpan));
  };
  const commit = () => {
    preview();
    slider.value = "0";
    previewBase = null;
  };

  slider.addEventListener("input", preview);
  slider.addEventListener("change", commit);
  slider.addEventListener("pointerup", commit);
  slider.addEventListener("keyup", event => {
    if (event.key === "Enter" || event.key === " ") commit();
  });
}

function centerSliderValue(base, sliderPosition, minimumSpan) {
  const span = Math.max(Math.abs(base) * 0.1, minimumSpan);
  return base + sliderPosition * span;
}

function setCommonVelocity(value) {
  state.commonVelocity = finiteOrZero(value);
  commonVelocityInput.value = formatInputValue(state.commonVelocity, 3);
  state.lines.forEach(line => {
    line.velocity = formatInputValue(state.commonVelocity, 3);
    syncLineObserved(line);
  });
  renderAll();
}

function syncLineObserved(line) {
  const rest = numericValue(line.rest);
  const velocity = numericValue(line.velocity);
  if (!Number.isFinite(rest)) {
    line.observed = "";
    return;
  }
  line.observed = formatInputValue(rest * redshiftFactor() * (1 + finiteOrZero(velocity) / SPEED_OF_LIGHT_KMS), 3);
}

function syncLineVelocity(line) {
  const rest = numericValue(line.rest);
  const observed = numericValue(line.observed);
  if (!Number.isFinite(rest) || !Number.isFinite(observed) || rest === 0 || redshiftFactor() === 0) {
    line.velocity = "";
    return;
  }
  line.velocity = formatInputValue(SPEED_OF_LIGHT_KMS * (observed / (rest * redshiftFactor()) - 1), 3);
}

function observedWavelength(line) {
  const observed = numericValue(line.observed);
  return Number.isFinite(observed) ? observed : Number.NaN;
}

function restLineWavelength(line) {
  const observed = observedWavelength(line);
  return Number.isFinite(observed) ? observed / redshiftFactor() : Number.NaN;
}

function drawSpectrum() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(300, Math.floor(rect.height));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const plot = { left: 70, right: 28, top: 52, bottom: 58 };
  state.plotArea = plot;

  if (state.spectrum.length < 2) {
    emptyState.classList.remove("hidden");
    state.currentDomain = { min: 0, max: 1 };
    state.currentRange = { min: 0, max: 1 };
    drawAxes(width, height, plot, state.currentDomain, state.currentRange);
    return;
  }

  emptyState.classList.add("hidden");

  const points = currentSpectrumPoints();
  const fullDomain = extent(points.map(point => point.restX));
  const domain = state.zoom ? { ...state.zoom.x } : fullDomain;
  const visiblePoints = points.filter(point => point.restX >= domain.min && point.restX <= domain.max);
  const range = state.zoom ? { ...state.zoom.y } : paddedExtent((visiblePoints.length ? visiblePoints : points).map(point => point.flux), 0.06);

  state.currentDomain = domain;
  state.currentRange = range;
  drawAxes(width, height, plot, domain, range);
  drawSpectrumLine(points, width, height, plot, domain, range);
  drawFittedProfiles(width, height, plot, domain, range);
  drawFitSelection(width, height, plot, domain, range);
  drawSpectralLines(width, height, plot, domain);
  drawSelectionBox();
}

function currentSpectrumPoints() {
  const factor = redshiftFactor();
  let points = state.spectrum.map(point => ({
    observedX: point.wavelength,
    restX: point.wavelength / factor,
    flux: point.flux
  }));

  if (state.deletedSections.length > 0) {
    points = points.filter(p => !state.deletedSections.some(s => p.observedX >= s.min && p.observedX <= s.max));
  }

  return movingAveragePoints(points, state.binSize);
}

function movingAveragePoints(points, requestedSize) {
  const size = normalizedBinSize(requestedSize);
  if (size <= 1 || points.length < 2) return points;

  const halfLeft = Math.floor((size - 1) / 2);
  const halfRight = Math.ceil((size - 1) / 2);
  const averaged = [];
  let sum = 0;
  let start = 0;
  let end = -1;

  for (let index = 0; index < points.length; index += 1) {
    const targetStart = Math.max(0, index - halfLeft);
    const targetEnd = Math.min(points.length - 1, index + halfRight);

    while (end < targetEnd) {
      end += 1;
      sum += points[end].flux;
    }
    while (start < targetStart) {
      sum -= points[start].flux;
      start += 1;
    }

    averaged.push({
      observedX: points[index].observedX,
      restX: points[index].restX,
      flux: sum / (end - start + 1)
    });
  }

  return averaged;
}

function drawAxes(width, height, plot, domain, range) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const x0 = plot.left;
  const y0 = height - plot.bottom;
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;

  ctx.strokeStyle = "#d8ded9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(x0, plot.top, plotWidth, plotHeight);
  ctx.stroke();

  ctx.fillStyle = "#66716d";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";

  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    const x = x0 + t * plotWidth;
    const restValue = domain.min + t * (domain.max - domain.min);
    const observedValue = restValue * redshiftFactor();
    ctx.strokeStyle = i === 0 || i === 5 ? "#d8ded9" : "#e6eae6";
    ctx.beginPath();
    ctx.moveTo(x, plot.top);
    ctx.lineTo(x, y0);
    ctx.stroke();

    ctx.textBaseline = "top";
    ctx.fillText(formatNumber(restValue), x, y0 + 8);
    ctx.textBaseline = "bottom";
    ctx.fillText(formatNumber(observedValue), x, plot.top - 8);
  }

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 5; i += 1) {
    const t = i / 5;
    const y = y0 - t * plotHeight;
    const value = range.min + t * (range.max - range.min);
    ctx.strokeStyle = i === 0 || i === 5 ? "#d8ded9" : "#e6eae6";
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(width - plot.right, y);
    ctx.stroke();
    ctx.fillText(formatNumber(value), x0 - 10, y);
  }

  ctx.fillStyle = "#1c2422";
  ctx.textAlign = "center";
  ctx.font = "13px Inter, system-ui, sans-serif";
  ctx.textBaseline = "bottom";
  ctx.fillText("Observed wavelength (A)", x0 + plotWidth / 2, 18);
  ctx.fillText("Rest wavelength (A)", x0 + plotWidth / 2, height - 8);

  ctx.save();
  ctx.translate(16, plot.top + plotHeight / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText("Flux", 0, 0);
  ctx.restore();
}

function drawSpectrumLine(points, width, height, plot, domain, range) {
  const xToPx = makeScale(domain.min, domain.max, plot.left, width - plot.right);
  const yToPx = makeScale(range.min, range.max, height - plot.bottom, plot.top);

  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, width - plot.left - plot.right, height - plot.top - plot.bottom);
  ctx.clip();

  ctx.strokeStyle = "#243b53";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  let started = false;
  points.forEach(point => {
    const x = xToPx(point.restX);
    const y = yToPx(point.flux);
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
  ctx.restore();
}

function drawSpectralLines(width, height, plot, domain) {
  const xToPx = makeScale(domain.min, domain.max, plot.left, width - plot.right);
  const top = plot.top;
  const bottom = height - plot.bottom;

  state.lines.forEach(line => {
    if (line.visible === false) return;
    const restX = restLineWavelength(line);
    if (!Number.isFinite(restX) || restX < domain.min || restX > domain.max) return;

    const x = xToPx(restX);
    const color = line.color || DEFAULT_LINE_COLORS[0];
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    const observed = observedWavelength(line);
    const label = line.species || `${observed.toFixed(1)} A`;
    ctx.save();
    ctx.translate(x + 5, top + 8);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = color;
    ctx.font = "12px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

function drawFitSelection(width, height, plot, domain, range) {
  if (!state.fitMode || state.fitPoints.length === 0) return;

  const xToPx = makeScale(domain.min, domain.max, plot.left, width - plot.right);
  const yToPx = makeScale(range.min, range.max, height - plot.bottom, plot.top);

  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, width - plot.left - plot.right, height - plot.top - plot.bottom);
  ctx.clip();
  ctx.strokeStyle = "#c2410c";
  ctx.fillStyle = "#c2410c";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);

  if (state.fitPoints.length === 2) {
    ctx.beginPath();
    ctx.moveTo(xToPx(state.fitPoints[0].restX), yToPx(state.fitPoints[0].flux));
    ctx.lineTo(xToPx(state.fitPoints[1].restX), yToPx(state.fitPoints[1].flux));
    ctx.stroke();
  }

  ctx.setLineDash([]);
  state.fitPoints.forEach(point => {
    ctx.beginPath();
    ctx.arc(xToPx(point.restX), yToPx(point.flux), 4, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

function drawFittedProfiles(width, height, plot, domain, range) {
  if (state.fittedProfiles.length === 0) return;

  const xToPx = makeScale(domain.min, domain.max, plot.left, width - plot.right);
  const yToPx = makeScale(range.min, range.max, height - plot.bottom, plot.top);

  ctx.save();
  ctx.beginPath();
  ctx.rect(plot.left, plot.top, width - plot.left - plot.right, height - plot.top - plot.bottom);
  ctx.clip();

  state.fittedProfiles.forEach(profile => {
    if (profile.maxX < domain.min || profile.minX > domain.max) return;

    const color = profile.amplitude >= 0 ? "#c2410c" : "#1d4ed8";
    const samples = profileSamples(profile, 160);

    ctx.strokeStyle = "#66716d";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xToPx(profile.minX), yToPx(continuumAt(profile, profile.minX)));
    ctx.lineTo(xToPx(profile.maxX), yToPx(continuumAt(profile, profile.maxX)));
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    samples.forEach((sample, index) => {
      const x = xToPx(sample.x);
      const y = yToPx(sample.y);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    if (profile.mean >= domain.min && profile.mean <= domain.max) {
      const baseY = continuumAt(profile, profile.mean);
      const peakY = baseY + profile.amplitude;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(xToPx(profile.mean), yToPx(baseY));
      ctx.lineTo(xToPx(profile.mean), yToPx(peakY));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  ctx.restore();
}

function fitGaussianProfile(firstPoint, secondPoint) {
  const minX = Math.min(firstPoint.restX, secondPoint.restX);
  const maxX = Math.max(firstPoint.restX, secondPoint.restX);
  const span = maxX - minX;
  if (!Number.isFinite(span) || span <= 0) return null;

  const continuum = continuumFromPoints(firstPoint, secondPoint);
  const samples = currentSpectrumPoints().filter(point => point.restX >= minX && point.restX <= maxX);
  if (samples.length < 5) return null;

  const residuals = samples.map(point => ({
    x: point.restX,
    residual: point.flux - lineAt(continuum, point.restX)
  }));
  const strongest = residuals.reduce((best, point) => Math.abs(point.residual) > Math.abs(best.residual) ? point : best, residuals[0]);

  const minSigma = Math.max(span / 250, 1e-9);
  const maxSigma = Math.max(span, minSigma * 2);
  let mu = strongest.x;
  let sigma = Math.max(span / 6, minSigma);
  let fit = solveAmplitude(residuals, mu, sigma);
  let stepMu = span / 8;
  let stepSigma = span / 8;

  for (let iteration = 0; iteration < 80; iteration += 1) {
    let improved = false;
    const candidates = [
      { mu: mu - stepMu, sigma },
      { mu: mu + stepMu, sigma },
      { mu, sigma: sigma - stepSigma },
      { mu, sigma: sigma + stepSigma },
      { mu: mu - stepMu, sigma: sigma - stepSigma },
      { mu: mu - stepMu, sigma: sigma + stepSigma },
      { mu: mu + stepMu, sigma: sigma - stepSigma },
      { mu: mu + stepMu, sigma: sigma + stepSigma }
    ];

    candidates.forEach(candidate => {
      const candidateMu = Math.min(Math.max(candidate.mu, minX), maxX);
      const candidateSigma = Math.min(Math.max(candidate.sigma, minSigma), maxSigma);
      const candidateFit = solveAmplitude(residuals, candidateMu, candidateSigma);
      if (candidateFit.sse < fit.sse) {
        mu = candidateMu;
        sigma = candidateSigma;
        fit = candidateFit;
        improved = true;
      }
    });

    if (!improved) {
      stepMu *= 0.55;
      stepSigma *= 0.55;
      if (stepMu < span / 10000 && stepSigma < span / 10000) break;
    }
  }

  const profile = {
    minX,
    maxX,
    continuum,
    amplitude: fit.amplitude,
    mean: mu,
    sigma,
    fwhm: 2 * Math.sqrt(2 * Math.log(2)) * sigma,
    kind: fit.amplitude >= 0 ? "Emission" : "Absorption"
  };
  profile.pEW = pseudoEquivalentWidth(profile, 240);

  // Auto-match closest line from the line list within 3% of the fitted mean (observed frame)
  const observedMean = mu * redshiftFactor();
  const tolerance = observedMean * 0.03;
  let bestLine = null;
  let bestDist = Infinity;
  state.lines.forEach(line => {
    const obs = numericValue(line.observed);
    if (!Number.isFinite(obs)) return;
    const dist = Math.abs(obs - observedMean);
    if (dist <= tolerance && dist < bestDist) {
      bestDist = dist;
      bestLine = line;
    }
  });
  profile.species = bestLine ? bestLine.species : "";
  profile.lineRest = bestLine ? formatInputValue(numericValue(bestLine.rest), 4) : "";

  return profile;
}

function continuumFromPoints(firstPoint, secondPoint) {
  const dx = secondPoint.restX - firstPoint.restX || 1e-12;
  const slope = (secondPoint.flux - firstPoint.flux) / dx;
  return {
    x1: firstPoint.restX,
    y1: firstPoint.flux,
    x2: secondPoint.restX,
    y2: secondPoint.flux,
    slope,
    intercept: firstPoint.flux - slope * firstPoint.restX
  };
}

function lineAt(line, x) {
  return line.slope * x + line.intercept;
}

function continuumAt(profile, x) {
  return lineAt(profile.continuum, x);
}

function gaussianValue(amplitude, mean, sigma, x) {
  const z = (x - mean) / sigma;
  return amplitude * Math.exp(-0.5 * z * z);
}

function solveAmplitude(points, mean, sigma) {
  let numerator = 0;
  let denominator = 0;
  points.forEach(point => {
    const basis = Math.exp(-0.5 * ((point.x - mean) / sigma) ** 2);
    numerator += point.residual * basis;
    denominator += basis * basis;
  });
  const amplitude = denominator > 0 ? numerator / denominator : 0;
  let sse = 0;
  points.forEach(point => {
    const model = gaussianValue(amplitude, mean, sigma, point.x);
    const error = point.residual - model;
    sse += error * error;
  });
  return { amplitude, sse };
}

function profileSamples(profile, count) {
  const samples = [];
  const steps = Math.max(2, count);
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const x = profile.minX + t * (profile.maxX - profile.minX);
    samples.push({
      x,
      y: continuumAt(profile, x) + gaussianValue(profile.amplitude, profile.mean, profile.sigma, x)
    });
  }
  return samples;
}


// ─── Session save / load ────────────────────────────────────────────────────

const SESSION_VERSION = 1;

function saveSession() {
  // Serialise only the persistent, restorable parts of state.
  // Transient UI interaction state (deleteMode, fitMode, dragZoom etc.) is
  // intentionally excluded — it resets cleanly on load.
  const session = {
    version: SESSION_VERSION,
    fileName: state.fileName,
    redshift: state.redshift,
    binSize: state.binSize,
    commonVelocity: state.commonVelocity,
    zoom: state.zoom,
    spectrum: state.spectrum,            // [{wavelength, flux}, ...]
    lines: state.lines.map(l => ({      // shallow copy, all fields are primitives
      visible: l.visible,
      species: l.species,
      rest: l.rest,
      velocity: l.velocity,
      observed: l.observed,
      color: l.color
    })),
    deletedSections: state.deletedSections.map(s => ({ min: s.min, max: s.max })),
    fittedProfiles: state.fittedProfiles.map(p => ({
      minX: p.minX,
      maxX: p.maxX,
      amplitude: p.amplitude,
      mean: p.mean,
      sigma: p.sigma,
      fwhm: p.fwhm,
      pEW: p.pEW,
      kind: p.kind,
      species: p.species,
      lineRest: p.lineRest,
      continuum: {
        x1: p.continuum.x1,
        y1: p.continuum.y1,
        x2: p.continuum.x2,
        y2: p.continuum.y2,
        slope: p.continuum.slope,
        intercept: p.continuum.intercept
      }
    }))
  };

  const json = JSON.stringify(session);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  // Use spectrum filename as base, or "session" if none loaded
  const base = state.fileName ? state.fileName.replace(/\.[^.]+$/, "") : "session";
  anchor.href = url;
  anchor.download = `${base}.spx`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function loadSession(file) {
  let session;
  try {
    const text = await file.text();
    session = JSON.parse(text);
  } catch {
    fileStatus.textContent = "Session load failed: file is not valid JSON.";
    return;
  }

  if (!session || session.version !== SESSION_VERSION) {
    fileStatus.textContent = "Session load failed: unrecognised session format.";
    return;
  }

  // ── Restore spectrum ──────────────────────────────────────────────────────
  state.spectrum = Array.isArray(session.spectrum) ? session.spectrum : [];
  state.fileName = typeof session.fileName === "string" ? session.fileName : "";

  // ── Restore scalar settings ───────────────────────────────────────────────
  state.redshift = Number.isFinite(session.redshift) ? session.redshift : 0;
  state.binSize = Number.isFinite(session.binSize) && session.binSize >= 1
    ? Math.round(session.binSize) : 1;
  state.commonVelocity = Number.isFinite(session.commonVelocity) ? session.commonVelocity : 0;
  state.zoom = session.zoom && Number.isFinite(session.zoom.x?.min) ? session.zoom : null;

  // ── Restore line list ─────────────────────────────────────────────────────
  state.lines = Array.isArray(session.lines)
    ? session.lines.map(l => ({
        visible: l.visible !== false,
        species: String(l.species || ""),
        rest: String(l.rest || ""),
        velocity: String(l.velocity || "0"),
        observed: String(l.observed || ""),
        color: typeof l.color === "string" ? l.color : DEFAULT_LINE_COLORS[0]
      }))
    : [];

  // ── Restore deleted sections ──────────────────────────────────────────────
  state.deletedSections = Array.isArray(session.deletedSections)
    ? session.deletedSections.filter(s => Number.isFinite(s.min) && Number.isFinite(s.max))
    : [];

  // ── Restore fitted profiles ───────────────────────────────────────────────
  state.fittedProfiles = Array.isArray(session.fittedProfiles)
    ? session.fittedProfiles
        .filter(p => p && Number.isFinite(p.mean) && p.continuum)
        .map(p => ({
          minX: p.minX,
          maxX: p.maxX,
          amplitude: p.amplitude,
          mean: p.mean,
          sigma: p.sigma,
          fwhm: p.fwhm,
          pEW: p.pEW,
          kind: typeof p.kind === "string" ? p.kind : "Emission",
          species: String(p.species || ""),
          lineRest: String(p.lineRest || ""),
          continuum: {
            x1: p.continuum.x1,
            y1: p.continuum.y1,
            x2: p.continuum.x2,
            y2: p.continuum.y2,
            slope: p.continuum.slope,
            intercept: p.continuum.intercept
          }
        }))
    : [];

  // ── Reset transient interaction state ────────────────────────────────────
  state.deleteMode = false;
  state.deletePoints = [];
  state.fitMode = false;
  state.fitPoints = [];
  state.dragZoomMode = false;
  state.dragStart = null;
  state.dragCurrent = null;
  deleteSectionButton.classList.remove("active");
  deleteHint.classList.remove("visible");
  canvas.classList.remove("delete-mode-cursor");
  fitProfileButton.classList.remove("active");
  fitHint.classList.remove("visible");
  canvas.classList.remove("fit-mode-cursor");
  dragZoomButton.classList.remove("active");

  // ── Sync UI controls to restored values ──────────────────────────────────
  redshiftInput.value = formatInputValue(state.redshift, 6);
  redshiftSlider.value = "0";
  binningInput.value = String(state.binSize);
  commonVelocityInput.value = formatInputValue(state.commonVelocity, 3);
  commonVelocitySlider.value = "0";

  if (state.spectrum.length > 0) {
    fileStatus.textContent = `${state.fileName} — ${state.spectrum.length.toLocaleString()} points (session)`;
  } else {
    fileStatus.textContent = state.fileName ? `${state.fileName} — no spectrum data` : "No spectrum loaded";
  }

  renderAll();
}

function pseudoEquivalentWidth(profile, count) {
  const samples = profileSamples(profile, count);
  // Use a relative threshold based on the peak continuum value to handle
  // any flux scale (including typical astro units like 1e-17 erg/s/cm²/Å)
  const peakContinuum = Math.max(
    Math.abs(continuumAt(profile, profile.minX)),
    Math.abs(continuumAt(profile, profile.maxX))
  );
  const threshold = peakContinuum * 1e-10;
  let area = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const previousBase = continuumAt(profile, previous.x);
    const currentBase = continuumAt(profile, current.x);
    const previousNorm = Math.abs(previousBase) > threshold ? 1 - previous.y / previousBase : 0;
    const currentNorm = Math.abs(currentBase) > threshold ? 1 - current.y / currentBase : 0;
    area += 0.5 * (previousNorm + currentNorm) * (current.x - previous.x);
  }
  return area;
}

function handleMouseMove(event) {
  if (!state.currentDomain || !state.currentRange || !state.plotArea) return;
  const point = canvasPoint(event);
  const plot = state.plotArea;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  if (state.dragStart) {
    state.dragCurrent = point;
    drawSpectrum();
  }

  if (point.x < plot.left || point.x > width - plot.right || point.y < plot.top || point.y > height - plot.bottom) {
    mouseReadout.textContent = "Rest x: - | Flux: -";
    return;
  }

  const restX = pxToValue(point.x, plot.left, width - plot.right, state.currentDomain.min, state.currentDomain.max);
  const flux = pxToValue(point.y, height - plot.bottom, plot.top, state.currentRange.min, state.currentRange.max);
  const observedX = restX * redshiftFactor();
  mouseReadout.textContent = `Rest x: ${formatNumber(restX)} A | Obs x: ${formatNumber(observedX)} A | Flux: ${formatNumber(flux)}`;
}

function finishDragZoom() {
  if (!state.dragStart || !state.dragCurrent || !state.currentDomain || !state.currentRange) return;
  const start = clampToPlot(state.dragStart);
  const end = clampToPlot(state.dragCurrent);
  state.dragStart = null;
  state.dragCurrent = null;

  if (Math.abs(start.x - end.x) < 8 || Math.abs(start.y - end.y) < 8) {
    drawSpectrum();
    return;
  }

  const plot = state.plotArea;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const xMin = pxToValue(Math.min(start.x, end.x), plot.left, width - plot.right, state.currentDomain.min, state.currentDomain.max);
  const xMax = pxToValue(Math.max(start.x, end.x), plot.left, width - plot.right, state.currentDomain.min, state.currentDomain.max);
  const yMin = pxToValue(Math.max(start.y, end.y), height - plot.bottom, plot.top, state.currentRange.min, state.currentRange.max);
  const yMax = pxToValue(Math.min(start.y, end.y), height - plot.bottom, plot.top, state.currentRange.min, state.currentRange.max);

  state.zoom = { x: { min: xMin, max: xMax }, y: { min: yMin, max: yMax } };
  renderAll();
}

function drawSelectionBox() {
  if (!state.dragStart || !state.dragCurrent) return;
  const start = clampToPlot(state.dragStart);
  const end = clampToPlot(state.dragCurrent);
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(start.x - end.x);
  const height = Math.abs(start.y - end.y);

  ctx.fillStyle = "rgba(15, 118, 110, 0.12)";
  ctx.strokeStyle = "rgba(15, 118, 110, 0.82)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.setLineDash([]);
}

function zoomBy(factor) {
  if (!state.currentDomain || !state.currentRange) return;
  const x = zoomRange(state.currentDomain, factor);
  const y = zoomRange(state.currentRange, factor);
  state.zoom = { x, y };
  renderAll();
}

function zoomRange(range, factor) {
  const center = (range.min + range.max) / 2;
  const half = ((range.max - range.min) * factor) / 2;
  return { min: center - half, max: center + half };
}

function plotValueFromEvent(event) {
  const point = canvasPoint(event);
  const plot = state.plotArea;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  return {
    restX: pxToValue(point.x, plot.left, width - plot.right, state.currentDomain.min, state.currentDomain.max),
    flux: pxToValue(point.y, height - plot.bottom, plot.top, state.currentRange.min, state.currentRange.max)
  };
}

function isInsidePlot(event) {
  const point = canvasPoint(event);
  const plot = state.plotArea;
  if (!plot) return false;
  return point.x >= plot.left && point.x <= canvas.clientWidth - plot.right && point.y >= plot.top && point.y <= canvas.clientHeight - plot.bottom;
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function clampToPlot(point) {
  const plot = state.plotArea;
  return {
    x: Math.min(Math.max(point.x, plot.left), canvas.clientWidth - plot.right),
    y: Math.min(Math.max(point.y, plot.top), canvas.clientHeight - plot.bottom)
  };
}

function redshiftFactor() {
  const factor = 1 + finiteOrZero(state.redshift);
  return Math.abs(factor) < 1e-12 ? 1e-12 : factor;
}

function normalizedBinSize(value) {
  const number = Math.round(Number.parseFloat(value));
  return Number.isFinite(number) && number > 1 ? number : 1;
}

function sliderDigits(step) {
  const text = String(step);
  return text.includes(".") ? text.split(".")[1].length : 3;
}

function numericValue(value) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : Number.NaN;
}

function finiteOrZero(value) {
  return Number.isFinite(value) ? value : 0;
}

function extent(values) {
  let min = Infinity;
  let max = -Infinity;
  values.forEach(value => {
    if (value < min) min = value;
    if (value > max) max = value;
  });
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  return { min, max };
}

function paddedExtent(values, fraction) {
  const base = extent(values);
  const padding = (base.max - base.min) * fraction || 1;
  return { min: base.min - padding, max: base.max + padding };
}

function makeScale(inputMin, inputMax, outputMin, outputMax) {
  const inputRange = inputMax - inputMin || 1;
  return value => outputMin + ((value - inputMin) / inputRange) * (outputMax - outputMin);
}

function pxToValue(px, outputMin, outputMax, inputMin, inputMax) {
  const outputRange = outputMax - outputMin || 1;
  return inputMin + ((px - outputMin) / outputRange) * (inputMax - inputMin);
}

function formatNumber(value) {
  const absolute = Math.abs(value);
  if (!Number.isFinite(value)) return "-";
  if (absolute >= 1000) return value.toFixed(0);
  if (absolute >= 10) return value.toFixed(2);
  if (absolute >= 0.01) return value.toFixed(4);
  return value.toExponential(2);
}

function formatInputValue(value, digits) {
  if (!Number.isFinite(value)) return "";
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}