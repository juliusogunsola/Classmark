/* =========================================================
   Class Attendance — script.js
   All data saved to localStorage under key "attendance_records"
   ========================================================= */

'use strict';

// ── Storage helpers ──────────────────────────────────────
const STORAGE_KEY = 'attendance_records';

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords(records) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// ── State ────────────────────────────────────────────────
let records   = loadRecords();      // { id, name, date, status }[]
let editingId = null;               // id of record being edited, or null
let pendingDeleteId = null;         // id waiting for modal confirmation

// ── DOM refs ─────────────────────────────────────────────
const inputName      = document.getElementById('input-name');
const inputDate      = document.getElementById('input-date');
const btnPresent     = document.getElementById('btn-present');
const btnAbsent      = document.getElementById('btn-absent');
const btnSave        = document.getElementById('btn-save');
const btnCancel      = document.getElementById('btn-cancel');
const formTitle      = document.getElementById('form-title');
const formError      = document.getElementById('form-error');

const searchInput    = document.getElementById('search-input');
const filterDate     = document.getElementById('filter-date');
const filterStatus   = document.getElementById('filter-status');
const btnClearFilters= document.getElementById('btn-clear-filters');

const recordsList    = document.getElementById('records-list');
const statTotal      = document.getElementById('stat-total');
const statPresent    = document.getElementById('stat-present');
const statAbsent     = document.getElementById('stat-absent');

const modalOverlay   = document.getElementById('modal-overlay');
const modalMessage   = document.getElementById('modal-message');
const btnModalConfirm= document.getElementById('btn-modal-confirm');
const btnModalCancel = document.getElementById('btn-modal-cancel');

// ── Utilities ────────────────────────────────────────────
function todayISO() {
  // Returns local date as YYYY-MM-DD (not UTC)
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const dd   = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  // Parse as local date to avoid timezone shifts
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getSelectedStatus() {
  return btnPresent.classList.contains('active') ? 'Present' : 'Absent';
}

function setSelectedStatus(status) {
  if (status === 'Present') {
    btnPresent.classList.add('active');
    btnPresent.setAttribute('aria-pressed', 'true');
    btnAbsent.classList.remove('active');
    btnAbsent.setAttribute('aria-pressed', 'false');
  } else {
    btnAbsent.classList.add('active');
    btnAbsent.setAttribute('aria-pressed', 'true');
    btnPresent.classList.remove('active');
    btnPresent.setAttribute('aria-pressed', 'false');
  }
}

function showError(msg) {
  formError.textContent = msg;
  formError.hidden = false;
}

function clearError() {
  formError.textContent = '';
  formError.hidden = true;
}

// ── Form: Status toggle ──────────────────────────────────
btnPresent.addEventListener('click', () => setSelectedStatus('Present'));
btnAbsent.addEventListener('click',  () => setSelectedStatus('Absent'));

// ── Form: Save ───────────────────────────────────────────
btnSave.addEventListener('click', () => {
  const name   = inputName.value.trim();
  const date   = inputDate.value;
  const status = getSelectedStatus();

  clearError();

  // Validation
  if (!name && !date) {
    showError('Please enter a student name and select a date.');
    inputName.focus();
    return;
  }
  if (!name) {
    showError('Please enter a student name.');
    inputName.focus();
    return;
  }
  if (!date) {
    showError('Please select a date.');
    inputDate.focus();
    return;
  }

  // Duplicate check (skip for the record being edited)
  const duplicate = records.find(r =>
    r.name.toLowerCase() === name.toLowerCase() &&
    r.date === date &&
    r.id !== editingId
  );

  if (duplicate) {
    showError(`${name} is already marked for ${formatDateDisplay(date)}.`);
    return;
  }

  if (editingId) {
    // Update existing
    records = records.map(r =>
      r.id === editingId ? { ...r, name, date, status } : r
    );
    cancelEdit();
  } else {
    // Add new
    records.unshift({ id: generateId(), name, date, status });
    resetForm();
  }

  saveRecords(records);
  render();
});

// ── Form: Cancel edit ────────────────────────────────────
btnCancel.addEventListener('click', cancelEdit);

function cancelEdit() {
  editingId = null;
  formTitle.textContent = 'Add Record';
  btnSave.textContent   = 'Save Record';
  btnCancel.hidden      = true;
  resetForm();
  clearError();
}

function resetForm() {
  inputName.value = '';
  inputDate.value = todayISO();
  setSelectedStatus('Present');
}

// ── Edit a record ────────────────────────────────────────
function startEdit(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;

  editingId = id;
  formTitle.textContent = 'Edit Record';
  btnSave.textContent   = 'Update Record';
  btnCancel.hidden      = false;
  clearError();

  inputName.value = rec.name;
  inputDate.value = rec.date;
  setSelectedStatus(rec.status);

  // Scroll form into view on mobile
  document.querySelector('.form-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  inputName.focus();
}

// ── Delete: show modal ───────────────────────────────────
function confirmDelete(id) {
  const rec = records.find(r => r.id === id);
  if (!rec) return;

  pendingDeleteId = id;
  modalMessage.textContent =
    `Delete the record for "${rec.name}" on ${formatDateDisplay(rec.date)}? This cannot be undone.`;
  modalOverlay.hidden = false;
  btnModalConfirm.focus();
}

btnModalConfirm.addEventListener('click', () => {
  if (pendingDeleteId) {
    records = records.filter(r => r.id !== pendingDeleteId);
    saveRecords(records);
    // If we were editing this record, cancel the edit
    if (editingId === pendingDeleteId) cancelEdit();
    pendingDeleteId = null;
    render();
  }
  closeModal();
});

btnModalCancel.addEventListener('click', closeModal);

// Close modal on overlay backdrop click
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});

// Close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalOverlay.hidden) closeModal();
});

function closeModal() {
  modalOverlay.hidden = true;
  pendingDeleteId = null;
}

// ── Filters ──────────────────────────────────────────────
searchInput.addEventListener('input', render);
filterDate.addEventListener('change', render);
filterStatus.addEventListener('change', render);

btnClearFilters.addEventListener('click', () => {
  searchInput.value    = '';
  filterDate.value     = '';
  filterStatus.value   = 'All';
  render();
});

// ── Render ───────────────────────────────────────────────
function getFilteredRecords() {
  const query  = searchInput.value.trim().toLowerCase();
  const byDate = filterDate.value;
  const byStatus = filterStatus.value;

  return records.filter(r => {
    const matchName   = !query  || r.name.toLowerCase().includes(query);
    const matchDate   = !byDate || r.date === byDate;
    const matchStatus = byStatus === 'All' || r.status === byStatus;
    return matchName && matchDate && matchStatus;
  });
}

function render() {
  // ── Stats (respect date filter only) ──
  const dateForStats = filterDate.value;
  const statsPool = dateForStats
    ? records.filter(r => r.date === dateForStats)
    : records;

  statTotal.textContent   = statsPool.length;
  statPresent.textContent = statsPool.filter(r => r.status === 'Present').length;
  statAbsent.textContent  = statsPool.filter(r => r.status === 'Absent').length;

  // ── List ──
  const filtered = getFilteredRecords();

  // Sort newest date first; ties: preserve insertion order (records already unshifted)
  const sorted = [...filtered].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return 0; // keep relative order for same date
  });

  recordsList.innerHTML = '';

  if (sorted.length === 0) {
    recordsList.appendChild(buildEmptyState());
    return;
  }

  sorted.forEach(rec => {
    recordsList.appendChild(buildRecordItem(rec));
  });
}

function buildEmptyState() {
  const hasFilters = searchInput.value.trim() || filterDate.value || filterStatus.value !== 'All';
  const div = document.createElement('div');
  div.className = 'empty-state';

  if (hasFilters) {
    div.innerHTML = `
      <div class="empty-icon">🔍</div>
      <p>No records match your search or filters.<br>Try adjusting or <strong>clearing filters</strong>.</p>`;
  } else {
    div.innerHTML = `
      <div class="empty-icon">📋</div>
      <p>No attendance records yet.<br>Add your first record above!</p>`;
  }
  return div;
}

function buildRecordItem(rec) {
  const item = document.createElement('div');
  item.className = 'record-item';
  item.dataset.id = rec.id;

  const isEditing = rec.id === editingId;
  const badgeClass = rec.status === 'Present' ? 'present' : 'absent';

  item.innerHTML = `
    <div class="record-info">
      <div class="record-name" title="${escapeHtml(rec.name)}">${escapeHtml(rec.name)}</div>
      <div class="record-date">${formatDateDisplay(rec.date)}</div>
    </div>
    <span class="status-badge ${badgeClass}" aria-label="Status: ${rec.status}">${rec.status}</span>
    <div class="record-actions">
      <button class="icon-btn edit" title="Edit record" aria-label="Edit record for ${escapeHtml(rec.name)}"${isEditing ? ' aria-current="true"' : ''}>✏️</button>
      <button class="icon-btn delete" title="Delete record" aria-label="Delete record for ${escapeHtml(rec.name)}">🗑️</button>
    </div>
  `;

  item.querySelector('.icon-btn.edit').addEventListener('click', () => startEdit(rec.id));
  item.querySelector('.icon-btn.delete').addEventListener('click', () => confirmDelete(rec.id));

  return item;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Init ─────────────────────────────────────────────────
(function init() {
  inputDate.value = todayISO();
  render();
})();

