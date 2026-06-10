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
  { name: "[SII] 6731", rest: 6730.82 }
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
  deleteMode: false,
  deletePoints: [],
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
const deletedSectionsList = document.querySelector("#deletedSectionsList");
const deleteHint = document.querySelector("#deleteHint");
const speciesList = document.querySelector("#speciesList");
const ctx = canvas.getContext("2d");

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
  if (state.deleteMode && isInsidePlot(event)) {
    const point = canvasPoint(event);
    const restX = pxToValue(point.x, state.plotArea.left, canvas.clientWidth - state.plotArea.right, state.currentDomain.min, state.currentDomain.max);
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
    state.dragZoomMode = false;
    dragZoomButton.classList.remove("active");
  }
});
window.addEventListener("mouseup", finishDragZoom);

window.addEventListener("resize", drawSpectrum);
dragZoomButton.addEventListener("click", () => {
  state.dragZoomMode = !state.dragZoomMode;
  dragZoomButton.classList.toggle("active", state.dragZoomMode);
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
