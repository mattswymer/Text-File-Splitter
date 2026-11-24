"use strict";

const MAX_FILE_SIZE_WARNING = 100 * 1024 * 1024;
const ALLOCATION_TOLERANCE = 0.001;
const DOWNLOAD_INTERVAL_MS = 350;
const URL_CLEANUP_DELAY_MS = 10_000;

const elements = {
  fileInput: document.querySelector("#fileInput"),
  dropZone: document.querySelector("#dropZone"),
  fileSummary: document.querySelector("#fileSummary"),
  fileName: document.querySelector("#fileName"),
  fileStats: document.querySelector("#fileStats"),
  fileNotice: document.querySelector("#fileNotice"),
  removeFile: document.querySelector("#removeFile"),
  partCount: document.querySelector("#partCount"),
  splitMode: document.querySelector("#splitMode"),
  allocationList: document.querySelector("#allocationList"),
  allocationStatus: document.querySelector("#allocationStatus"),
  allocationMessage: document.querySelector("#allocationMessage"),
  resetAllocation: document.querySelector("#resetAllocation"),
  filePrefix: document.querySelector("#filePrefix"),
  filenameExample: document.querySelector("#filenameExample"),
  previewCount: document.querySelector("#previewCount"),
  previewEmpty: document.querySelector("#previewEmpty"),
  previewDetails: document.querySelector("#previewDetails"),
  exportButton: document.querySelector("#exportButton"),
  resultMessage: document.querySelector("#resultMessage")
};

const state = {
  file: null,
  text: null,
  extension: ".txt",
  allocations: [34, 33, 33],
  isReading: false,
  isExporting: false,
  readRequest: 0,
  stats: null
};

function countWords(text) {
  let count = 0;
  for (const _match of text.matchAll(/\S+/gu)) count += 1;
  return count;
}

function countCharacters(text) {
  let count = 0;
  for (const _character of text) count += 1;
  return count;
}

function countLines(text) {
  if (text.length === 0) return 0;
  let count = 1;
  for (const _match of text.matchAll(/\r\n|\n|\r/gu)) count += 1;
  return count;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} ${unit}`;
}

function getEvenAllocations(count) {
  const base = Math.floor(10000 / count) / 100;
  const remainder = Number((100 - base * count).toFixed(2));
  return Array.from({ length: count }, (_, index) =>
    Number((base + (index === 0 ? remainder : 0)).toFixed(2))
  );
}

function resizeAllocations(current, nextCount) {
  const previousCount = current.length;
  if (nextCount === previousCount) return [...current];

  if (nextCount > previousCount) {
    const added = nextCount - previousCount;
    const donorIndex = previousCount - 1;
    const donorShare = current[donorIndex] / (added + 1);
    return [
      ...current.slice(0, donorIndex),
      ...Array.from({ length: added + 1 }, () => Number(donorShare.toFixed(4)))
    ];
  }

  const resized = current.slice(0, nextCount);
  const removedTotal = current.slice(nextCount).reduce((sum, value) => sum + value, 0);
  resized[nextCount - 1] = Number((resized[nextCount - 1] + removedTotal).toFixed(4));
  return resized;
}

function getAllocationTotal() {
  return state.allocations.reduce((sum, value) => sum + value, 0);
}

function isAllocationValid() {
  return state.allocations.every((value) => Number.isFinite(value) && value >= 0 && value <= 100)
    && Math.abs(getAllocationTotal() - 100) <= ALLOCATION_TOLERANCE;
}

function getSafePrefix(value) {
  const cleaned = value.trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "_")
    .replace(/[. ]+$/u, "")
    .slice(0, 100);
  return cleaned || "split";
}

function getOutputName(index) {
  const number = String(index + 1).padStart(2, "0");
  return `${getSafePrefix(elements.filePrefix.value)}_part-${number}${state.extension}`;
}

function showResult(message, isError = false) {
  elements.resultMessage.textContent = message;
  elements.resultMessage.classList.toggle("is-error", isError);
  elements.resultMessage.hidden = false;
}

function clearResult() {
  elements.resultMessage.hidden = true;
  elements.resultMessage.textContent = "";
  elements.resultMessage.classList.remove("is-error");
}

function updateExportAvailability() {
  elements.exportButton.disabled = !state.file || state.text === null
    || state.isReading || state.isExporting || !isAllocationValid();
}

function renderAllocations() {
  const fragment = document.createDocumentFragment();

  state.allocations.forEach((value, index) => {
    const row = document.createElement("div");
    row.className = "allocation-row";

    const label = document.createElement("label");
    label.className = "part-name";
    label.htmlFor = `allocation-${index}`;
    label.textContent = `Part ${String(index + 1).padStart(2, "0")}`;

    const input = document.createElement("input");
    input.className = "allocation-input";
    input.id = `allocation-${index}`;
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.step = "0.1";
    input.inputMode = "decimal";
    input.value = Number(value.toFixed(2));
    input.setAttribute("aria-label", `Part ${index + 1} percentage`);
    input.addEventListener("input", () => {
      state.allocations[index] = input.value === "" ? 0 : Number(input.value);
      updateAllocationStatus();
      updatePreview();
    });

    const percent = document.createElement("span");
    percent.className = "percent-sign";
    percent.textContent = "%";

    const track = document.createElement("div");
    track.className = "allocation-track";
    track.setAttribute("aria-hidden", "true");
    const fill = document.createElement("div");
    fill.className = "allocation-fill";
    fill.style.width = `${Math.max(0, Math.min(100, value))}%`;
    track.appendChild(fill);

    row.append(label, input, percent, track);
    fragment.appendChild(row);
  });

  elements.allocationList.replaceChildren(fragment);
  updateAllocationStatus();
}

function updateAllocationStatus() {
  const total = getAllocationTotal();
  const valid = isAllocationValid();
  elements.allocationStatus.classList.toggle("is-valid", valid);

  if (valid) {
    elements.allocationMessage.textContent = "100% allocated. Every part is accounted for.";
  } else {
    const difference = 100 - total;
    const detail = difference > 0
      ? `${difference.toFixed(2)}% still needs to be allocated.`
      : `${Math.abs(difference).toFixed(2)}% is over the document total.`;
    elements.allocationMessage.textContent = Number.isFinite(total)
      ? detail
      : "Enter a valid percentage for every part.";
  }
  updateExportAvailability();
}

function updateFileSummary() {
  const hasFile = Boolean(state.file);
  elements.fileSummary.hidden = !hasFile;
  elements.dropZone.hidden = hasFile;
  if (!hasFile) {
    elements.fileNotice.hidden = true;
    return;
  }

  elements.fileName.textContent = state.file.name;
  elements.fileStats.textContent = [
    formatBytes(state.file.size),
    `${state.stats.words.toLocaleString()} words`,
    `${state.stats.characters.toLocaleString()} characters`,
    `${state.stats.lines.toLocaleString()} lines`
  ].join(" · ");

  const isLarge = state.file.size > MAX_FILE_SIZE_WARNING;
  elements.fileNotice.hidden = !isLarge;
  elements.fileNotice.textContent = isLarge
    ? "This is a large file. Your browser may need additional memory while reading and exporting it."
    : "";
}

function updatePreview() {
  elements.previewCount.textContent = `${state.allocations.length} FILE${state.allocations.length === 1 ? "" : "S"}`;
  elements.filenameExample.textContent = getOutputName(0);

  if (!state.file || state.text === null) {
    elements.previewEmpty.hidden = false;
    elements.previewDetails.hidden = true;
    updateExportAvailability();
    return;
  }

  elements.previewEmpty.hidden = true;
  elements.previewDetails.hidden = false;
  const details = document.createDocumentFragment();
  const unitCount = elements.splitMode.value === "words"
    ? state.stats.words
    : state.stats.characters;
  const unitName = elements.splitMode.value;

  state.allocations.forEach((allocation, index) => {
    const row = document.createElement("div");
    row.className = "preview-row";
    const name = document.createElement("span");
    name.textContent = getOutputName(index);
    const amount = document.createElement("span");
    amount.textContent = `${allocation.toFixed(2)}% · ~${Math.round(unitCount * allocation / 100).toLocaleString()} ${unitName}`;
    row.append(name, amount);
    details.appendChild(row);
  });

  elements.previewDetails.replaceChildren(details);
  updateExportAvailability();
}

function getCumulativeBoundaries(total, allocations) {
  const boundaries = [];
  let cumulative = 0;

  for (let index = 0; index < allocations.length - 1; index += 1) {
    cumulative += allocations[index];
    boundaries.push(Math.max(
      boundaries[index - 1] || 0,
      Math.min(total, Math.round(total * cumulative / 100))
    ));
  }
  boundaries.push(total);
  return boundaries;
}

function splitByCharacters(text, allocations) {
  const splitPoints = getCumulativeBoundaries(countCharacters(text), allocations).slice(0, -1);
  const parts = [];
  let pointIndex = 0;
  let characterIndex = 0;
  let textOffset = 0;
  let partStart = 0;

  while (pointIndex < splitPoints.length && splitPoints[pointIndex] === 0) {
    parts.push("");
    pointIndex += 1;
  }

  for (const character of text) {
    characterIndex += 1;
    textOffset += character.length;
    while (pointIndex < splitPoints.length && characterIndex >= splitPoints[pointIndex]) {
      parts.push(text.slice(partStart, textOffset));
      partStart = textOffset;
      pointIndex += 1;
    }
  }

  parts.push(text.slice(partStart));
  return parts;
}

function splitByWords(text, allocations) {
  const splitPoints = getCumulativeBoundaries(countWords(text), allocations).slice(0, -1);
  const parts = [];
  const wordPattern = /\\S+/gu;
  const whitespacePattern = /\\s+/uy;
  let wordsSeen = 0;
  let textOffset = 0;
  let partStart = 0;

  for (const targetWordCount of splitPoints) {
    while (wordsSeen < targetWordCount) {
      wordPattern.lastIndex = textOffset;
      const match = wordPattern.exec(text);
      if (!match) break;
      wordsSeen += 1;
      textOffset = wordPattern.lastIndex;
    }

    // Keep whitespace after a completed word with the preceding part.
    whitespacePattern.lastIndex = textOffset;
    const whitespace = whitespacePattern.exec(text);
    if (whitespace) textOffset = whitespacePattern.lastIndex;

    parts.push(text.slice(partStart, textOffset));
    partStart = textOffset;
  }

  parts.push(text.slice(partStart));
  return parts;
}

function downloadBlob(filename, content) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), URL_CLEANUP_DELAY_MS);
}

async function loadFile(file) {
  if (!file) return;
  const extension = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : "";

  if (![".txt", ".md"].includes(extension)) {
    showResult("Choose a .txt or .md file.", true);
    elements.fileInput.value = "";
    return;
  }

  const requestId = ++state.readRequest;
  state.isReading = true;
  state.file = null;
  state.text = null;
  clearResult();
  updateFileSummary();
  updatePreview();
  updateExportAvailability();

  try {
    const text = await file.text();
    if (requestId !== state.readRequest) return;
    state.file = file;
    state.text = text;
    state.stats = {
      words: countWords(text),
      characters: countCharacters(text),
      lines: countLines(text)
    };
    state.extension = extension;
    elements.filePrefix.value = file.name.slice(0, -extension.length) || "split";
    updateFileSummary();
    updatePreview();
  } catch (error) {
    if (requestId === state.readRequest) {
      showResult(`Could not read this file: ${error.message || "unknown error"}`, true);
    }
  } finally {
    if (requestId === state.readRequest) {
      state.isReading = false;
      updateExportAvailability();
    }
  }
}

async function exportParts() {
  if (!state.file || state.text === null || !isAllocationValid() || state.isExporting) return;

  state.isExporting = true;
  clearResult();
  updateExportAvailability();

  try {
    const parts = elements.splitMode.value === "words"
      ? splitByWords(state.text, state.allocations)
      : splitByCharacters(state.text, state.allocations);

    if (parts.join("") !== state.text) {
      throw new Error("The split could not be verified. No files were exported.");
    }

    for (let index = 0; index < parts.length; index += 1) {
      downloadBlob(getOutputName(index), parts[index]);
      if (index < parts.length - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, DOWNLOAD_INTERVAL_MS));
      }
    }
    showResult(`Exported ${parts.length} files. All source text was preserved.`);
  } catch (error) {
    showResult(error.message || "The export could not be completed.", true);
  } finally {
    state.isExporting = false;
    updateExportAvailability();
  }
}

function clearFile() {
  state.readRequest += 1;
  state.file = null;
  state.text = null;
  state.stats = null;
  state.isReading = false;
  elements.fileInput.value = "";
  elements.filePrefix.value = "split";
  updateFileSummary();
  updatePreview();
  clearResult();
  updateExportAvailability();
}

elements.fileInput.addEventListener("change", (event) => loadFile(event.target.files?.[0]));
elements.removeFile.addEventListener("click", clearFile);
elements.partCount.addEventListener("change", () => {
  state.allocations = resizeAllocations(state.allocations, Number(elements.partCount.value));
  renderAllocations();
  updatePreview();
});
elements.resetAllocation.addEventListener("click", () => {
  state.allocations = getEvenAllocations(state.allocations.length);
  renderAllocations();
  updatePreview();
});
elements.splitMode.addEventListener("change", updatePreview);
elements.filePrefix.addEventListener("input", updatePreview);
elements.exportButton.addEventListener("click", exportParts);

elements.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  elements.dropZone.classList.add("is-dragging");
});
elements.dropZone.addEventListener("dragleave", (event) => {
  if (!elements.dropZone.contains(event.relatedTarget)) {
    elements.dropZone.classList.remove("is-dragging");
  }
});
elements.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  elements.dropZone.classList.remove("is-dragging");
  loadFile(event.dataTransfer?.files?.[0]);
});

renderAllocations();
updatePreview();
