// ============================================================
//  CarbonTrack — Frontend Application Logic
//  app.js — Single Page Application Controller
// ============================================================

const API_BASE = window.location.origin + '/api';
let authToken  = localStorage.getItem('ct_token') || null;
let currentUser = JSON.parse(localStorage.getItem('ct_user') || 'null');

// Cached data
let allEmissions  = [];
let allFacilities = [];
let allTasks      = [];
let allUsers      = [];
let allReports    = [];
let dashboardStats = null;

// Chart instances
let monthlyChart, statusChart, execRegionChart, execCompareChart, rtChart;
let rtInterval, monitorInterval, logInterval;

// ─────────────────────────────────────────────────────────────
//  INITIALISATION
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (authToken && currentUser) {
    showApp();
    loadDashboard();
  }
  // Set default dates for reports
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const el = document.getElementById('reportFromDate');
  if (el) el.value = firstOfMonth.toISOString().split('T')[0];
  const el2 = document.getElementById('reportToDate');
  if (el2) el2.value = today.toISOString().split('T')[0];

  // CO2e auto-calc
  document.getElementById('emissionCo2')?.addEventListener('input', updateCo2ePreview);
  document.getElementById('emissionMethane')?.addEventListener('input', updateCo2ePreview);
});

function updateCo2ePreview() {
  const co2 = parseFloat(document.getElementById('emissionCo2').value) || 0;
  const ch4 = parseFloat(document.getElementById('emissionMethane').value) || 0;
  document.getElementById('emissionCo2ePreview').value = (co2 + ch4 * 25).toFixed(4);
}

// ─────────────────────────────────────────────────────────────
//  AUTH
// ─────────────────────────────────────────────────────────────
function setRole(role, el) {
  document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const emailMap = { admin: 'admin@carbontrack.com', manager: 'manager@carbontrack.com', staff: 'staff@carbontrack.com' };
  document.getElementById('loginEmail').value = emailMap[role];
}

function fillDemo(email, pass) {
  document.getElementById('loginEmail').value = email;
  document.getElementById('loginPassword').value = pass;
}

function togglePassword() {
  const inp = document.getElementById('loginPassword');
  const eye = document.getElementById('pwEye');
  if (inp.type === 'password') { inp.type = 'text'; eye.className = 'bi bi-eye-slash'; }
  else { inp.type = 'password'; eye.className = 'bi bi-eye'; }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const err = document.getElementById('loginError');
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  btn.classList.add('loading'); err.style.display = 'none';

  try {
    const res = await apiFetch('/auth/login', 'POST', { email, password }, false);
    if (res.success) {
      authToken   = res.token;
      currentUser = res.user;
      localStorage.setItem('ct_token', authToken);
      localStorage.setItem('ct_user',  JSON.stringify(currentUser));
      showApp();
      loadDashboard();
    } else {
      showLoginError(res.message || 'Login failed.');
    }
  } catch (ex) {
    // Demo mode — allow login without backend
    if (demoLogin(email, password)) return;
    showLoginError('Cannot connect to server. Running in demo mode.');
    demoLogin(email, password);
  } finally {
    btn.classList.remove('loading');
  }
}

function demoLogin(email, password) {
  const demos = {
    'admin@carbontrack.com':   { id:1, name:'System Administrator', email, role:'admin',   department:'IT & Cloud' },
    'manager@carbontrack.com': { id:2, name:'Regional Manager',      email, role:'manager', department:'Compliance' },
    'staff@carbontrack.com':   { id:3, name:'Field Staff',           email, role:'staff',   department:'Data Entry' }
  };
  if (demos[email] && password === 'Admin@123') {
    authToken   = 'demo_token_' + Date.now();
    currentUser = demos[email];
    localStorage.setItem('ct_token', authToken);
    localStorage.setItem('ct_user',  JSON.stringify(currentUser));
    showApp();
    loadDashboard();
    return true;
  }
  return false;
}

function showLoginError(msg) {
  const err = document.getElementById('loginError');
  document.getElementById('loginErrorMsg').textContent = msg;
  err.style.display = 'flex';
}

function logout() {
  authToken = null; currentUser = null;
  localStorage.removeItem('ct_token'); localStorage.removeItem('ct_user');
  clearIntervals();
  document.getElementById('appLayout').style.display = 'none';
  document.getElementById('loginPage').style.display  = 'flex';
  showToast('info','Signed Out','You have been signed out successfully.');
}

function showApp() {
  document.getElementById('loginPage').style.display  = 'none';
  document.getElementById('appLayout').style.display  = 'flex';
  if (!currentUser) return;
  const initial = currentUser.name[0].toUpperCase();
  document.getElementById('sidebarAvatar').textContent = initial;
  document.getElementById('headerAvatar').textContent  = initial;
  document.getElementById('sidebarName').textContent   = currentUser.name;
  document.getElementById('sidebarRole').textContent   = currentUser.role;
  
  // Restrict staff from adding/modifying data
  if (currentUser.role === 'staff') {
    document.getElementById('usersNavItem').style.display = 'none';
    // Hide add buttons
    const addEmissionBtn = document.getElementById('addEmissionBtn');
    if (addEmissionBtn) addEmissionBtn.style.display = 'none';
    const addFacilityBtn = document.getElementById('addFacilityBtn');
    if (addFacilityBtn) addFacilityBtn.style.display = 'none';
    const addTaskBtn = document.getElementById('addTaskBtn');
    if (addTaskBtn) addTaskBtn.style.display = 'none';
    const generateReportBtn = document.getElementById('generateReportBtn');
    if (generateReportBtn) generateReportBtn.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────
//  NAVIGATION
// ─────────────────────────────────────────────────────────────
const pageConfig = {
  dashboard:  { title:'Dashboard',          subtitle:'Emissions overview and real-time statistics' },
  emissions:  { title:'Emission Records',   subtitle:'View, add and manage all emission data' },
  facilities: { title:'Facilities',         subtitle:'Registered monitoring facilities' },
  workflow:   { title:'Tasks & Approvals',  subtitle:'Workflow management and pending approvals' },
  reports:    { title:'Reports',            subtitle:'Generate and download compliance reports' },
  executive:  { title:'Executive View',     subtitle:'KPIs, trends and strategic analytics' },
  monitoring: { title:'System Monitoring',  subtitle:'AWS CloudWatch metrics and container health' },
  users:      { title:'User Management',    subtitle:'Manage user accounts and roles' }
};

function showPage(pageId, navEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pg = document.getElementById('page-' + pageId);
  if (pg) pg.classList.add('active');
  if (navEl) navEl.classList.add('active');
  const cfg = pageConfig[pageId] || {};
  document.getElementById('headerTitle').textContent    = cfg.title    || pageId;
  document.getElementById('headerSubtitle').textContent = cfg.subtitle || '';

  clearIntervals();

  switch (pageId) {
    case 'dashboard':  loadDashboard();  break;
    case 'emissions':  loadEmissions();  break;
    case 'facilities': loadFacilities(); break;
    case 'workflow':   loadTasks();      break;
    case 'reports':    loadReports();    break;
    case 'executive':  loadExecutive();  break;
    case 'monitoring': loadMonitoring(); break;
    case 'users':      loadUsers();      break;
  }
}

function refreshCurrentPage() {
  const active = document.querySelector('.nav-item.active');
  if (active) showPage(active.dataset.page, active);
}

function clearIntervals() {
  clearInterval(rtInterval);
  clearInterval(monitorInterval);
  clearInterval(logInterval);
}

// ─────────────────────────────────────────────────────────────
//  API HELPER
// ─────────────────────────────────────────────────────────────
async function apiFetch(endpoint, method = 'GET', body = null, auth = true) {
  // Prevent CORS console errors if the file is opened directly from the file system
  if (window.location.protocol === 'file:') {
    throw new Error('Running from local file system (Demo Mode). Skipping API request.');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers['Authorization'] = 'Bearer ' + authToken;
  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + endpoint, opts);
  const data = await res.json();
  if (res.status === 401) { logout(); return; }
  return data;
}

// ─────────────────────────────────────────────────────────────
//  DASHBOARD
// ─────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [statsRes, emissionsRes, pendingRes] = await Promise.all([
      apiFetch('/emissions/stats/summary').catch(() => null),
      apiFetch('/emissions?limit=8').catch(() => null),
      apiFetch('/workflow/pending-approvals').catch(() => null)
    ]);

    if (statsRes?.success) {
      const s = statsRes.stats;
      dashboardStats = s;
      document.getElementById('totalCo2e').textContent      = formatNum(s.totalCo2e) + ' t';
      document.getElementById('activeFacilities').textContent = s.activeFacilities;
      document.getElementById('complianceRate').textContent  = s.compliancePercentage + '%';
      document.getElementById('totalCo2').textContent       = formatNum(s.totalCo2) + ' t';
      document.getElementById('totalMethane').textContent   = formatNum(s.totalMethane) + ' t';

      const compEl = document.getElementById('complianceChange');
      compEl.className = 'stat-change ' + (s.compliancePercentage >= 70 ? 'up' : 'down');

      renderMonthlyChart(s.monthlyStats);
      renderStatusChart(s.statusCounts);
      renderRegionStats(s.regionStats);
    } else {
      loadDemoDashboard();
    }

    if (emissionsRes?.success) {
      renderRecentEmissions(emissionsRes.records);
    } else {
      renderRecentEmissions(getDemoEmissions());
    }

    const pending = pendingRes?.pendingCount || 0;
    document.getElementById('pendingCount').textContent = pending;
    const badge = document.getElementById('pendingBadge');
    if (pending > 0) { badge.style.display = 'flex'; badge.textContent = pending; }

  } catch (err) {
    loadDemoDashboard();
  }
}

function loadDemoDashboard() {
  document.getElementById('totalCo2e').textContent      = '17,886 t';
  document.getElementById('activeFacilities').textContent = '7';
  document.getElementById('complianceRate').textContent  = '67%';
  document.getElementById('pendingCount').textContent   = '4';
  document.getElementById('totalCo2').textContent       = '11,839 t';
  document.getElementById('totalMethane').textContent   = '413 t';

  const months = ['Jan','Feb','Mar','Apr','May','Jun'];
  const demoMonthly = months.map((m,i) => ({ month: `2026-0${i+1}`, total: 2000 + Math.random()*1500 }));
  renderMonthlyChart(demoMonthly);
  renderStatusChart([
    {status:'approved',count:8},{status:'pending',count:4},
    {status:'under_review',count:2},{status:'rejected',count:1}
  ]);
  renderRegionStats([
    {region:'Delhi',    total:8812, records:3},
    {region:'Mumbai',   total:4655, records:4},
    {region:'Kolkata',  total:4015, records:2},
    {region:'Hyderabad',total:3120, records:1},
    {region:'Chennai',  total:1365, records:2},
    {region:'Pune',     total:3474, records:2},
    {region:'Bangalore',total: 195, records:2},
    {region:'Ahmedabad',total:  25, records:1},
  ]);
  renderRecentEmissions(getDemoEmissions());
}

function renderMonthlyChart(data) {
  const ctx = document.getElementById('monthlyChart')?.getContext('2d');
  if (!ctx) return;
  if (monthlyChart) monthlyChart.destroy();
  const labels = data.map(d => d.month);
  const values = data.map(d => parseFloat(d.total || 0));
  monthlyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'CO₂e (metric tons)',
        data: values,
        borderColor: '#00d084',
        backgroundColor: 'rgba(0,208,132,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.45,
        pointBackgroundColor: '#00d084',
        pointRadius: 4,
        pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a2235', titleColor:'#f1f5f9', bodyColor:'#94a3b8' } },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569', font:{size:11} } },
        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#475569', font:{size:11} } }
      }
    }
  });
}

function renderStatusChart(data) {
  const ctx = document.getElementById('statusChart')?.getContext('2d');
  if (!ctx) return;
  if (statusChart) statusChart.destroy();
  const colorMap = { approved:'#22c55e', pending:'#f59e0b', under_review:'#06b6d4', rejected:'#ef4444', in_progress:'#0ea5e9' };
  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => capitalize(d.status)),
      datasets: [{ data: data.map(d => d.count), backgroundColor: data.map(d => colorMap[d.status]||'#94a3b8'), borderWidth: 2, borderColor: '#111827' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '72%',
      plugins: {
        legend: { position: 'bottom', labels: { color:'#94a3b8', font:{size:11}, padding:16, usePointStyle:true } },
        tooltip: { backgroundColor: '#1a2235', titleColor:'#f1f5f9', bodyColor:'#94a3b8' }
      }
    }
  });
}

function renderRegionStats(data) {
  const el = document.getElementById('regionStats');
  if (!el) return;
  const maxVal = Math.max(...data.map(d => parseFloat(d.total||0)));
  el.innerHTML = data.slice(0,8).map(r => {
    const pct = maxVal > 0 ? (parseFloat(r.total) / maxVal * 100).toFixed(0) : 0;
    return `
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-size:13px;font-weight:500;color:var(--text-primary);">${r.region}</span>
          <span style="font-size:12px;color:var(--text-muted);">${formatNum(r.total)} t</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill green" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

function renderRecentEmissions(records) {
  const tbody = document.getElementById('recentEmissionsBody');
  if (!tbody) return;
  if (!records?.length) { tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📊</div><h3>No records</h3></div></td></tr>`; return; }
  tbody.innerHTML = records.slice(0,8).map(r => `
    <tr>
      <td><div class="cell-primary">${r.facility_name || 'N/A'}</div></td>
      <td><span class="region-tag">${r.region || '—'}</span></td>
      <td style="color:var(--text-primary);font-weight:600;">${formatNum(r.total_co2e)}</td>
      <td>${formatDate(r.emission_date)}</td>
      <td><span class="badge badge-${r.status}">${capitalize(r.status)}</span></td>
    </tr>`).join('');
}

// ─────────────────────────────────────────────────────────────
//  EMISSIONS
// ─────────────────────────────────────────────────────────────
async function loadEmissions() {
  try {
    const [emRes, facRes] = await Promise.all([
      apiFetch('/emissions?limit=100').catch(() => null),
      apiFetch('/facilities').catch(() => null)
    ]);
    allEmissions  = emRes?.records  || getDemoEmissions();
    allFacilities = facRes?.facilities || getDemoFacilities();
    populateFacilityDropdowns();
    populateRegionFilter();
    renderEmissionsTable(allEmissions);
    document.getElementById('emissionCount').textContent = allEmissions.length + ' records';
  } catch (e) {
    allEmissions = getDemoEmissions();
    renderEmissionsTable(allEmissions);
  }
}

function renderEmissionsTable(records) {
  const tbody = document.getElementById('emissionsTableBody');
  if (!records?.length) {
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">📊</div><h3>No emission records found</h3><p>Add the first record using the button above.</p></div></td></tr>`;
    return;
  }
  const canEdit = currentUser?.role !== 'staff';
  tbody.innerHTML = records.map((r, i) => `
    <tr>
      <td style="color:var(--text-muted);">${r.record_id || i+1}</td>
      <td><div class="cell-primary">${r.facility_name || '—'}</div></td>
      <td><span class="region-tag">${r.region || '—'}</span></td>
      <td>${parseFloat(r.co2_emissions||0).toFixed(2)}</td>
      <td>${parseFloat(r.methane_emissions||0).toFixed(2)}</td>
      <td style="color:var(--primary);font-weight:600;">${parseFloat(r.total_co2e||0).toFixed(2)}</td>
      <td>${formatDate(r.emission_date)}</td>
      <td><span class="badge badge-${r.status}">${capitalize(r.status)}</span></td>
      <td>
        <div style="display:flex;gap:6px;">
          ${canEdit ? `
            <button class="btn btn-sm btn-secondary" onclick="editEmission(${JSON.stringify(r).replace(/"/g,'&quot;')})" title="Edit">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteRecord(${r.record_id || i+1},'emission')" title="Delete">
              <i class="bi bi-trash"></i>
            </button>
          ` : '<span style="color:var(--text-muted);font-size:12px;">—</span>'}
        </div>
      </td>
    </tr>`).join('');
}

function filterEmissions() {
  const search = document.getElementById('emissionSearch').value.toLowerCase();
  const status = document.getElementById('emissionStatusFilter').value;
  const region = document.getElementById('emissionRegionFilter').value;
  const filtered = allEmissions.filter(r =>
    (!search || (r.facility_name||'').toLowerCase().includes(search) || (r.region||'').toLowerCase().includes(search)) &&
    (!status || r.status === status) &&
    (!region || r.region === region)
  );
  renderEmissionsTable(filtered);
  document.getElementById('emissionCount').textContent = filtered.length + ' records';
}

function populateRegionFilter() {
  const sel = document.getElementById('emissionRegionFilter');
  if (!sel) return;
  const regions = [...new Set(allEmissions.map(r => r.region).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">All Regions</option>' + regions.map(r => `<option>${r}</option>`).join('');
}

function openEmissionModal(record = null) {
  document.getElementById('emissionModalTitle').textContent = record ? 'Edit Emission Record' : 'Add Emission Record';
  document.getElementById('emissionRecordId').value = record?.record_id || '';
  document.getElementById('emissionFacilityId').value = record?.facility_id || '';
  document.getElementById('emissionDate').value = record?.emission_date?.split('T')[0] || '';
  document.getElementById('emissionCo2').value = record?.co2_emissions || '';
  document.getElementById('emissionMethane').value = record?.methane_emissions || '';
  document.getElementById('emissionStatus').value = record?.status || 'pending';
  document.getElementById('emissionNotes').value = record?.notes || '';
  document.getElementById('emissionCo2ePreview').value = record?.total_co2e || '';
  populateFacilityDropdowns();
  openModal('emissionModal');
}

function editEmission(record) { openEmissionModal(record); }

async function saveEmission() {
  const id = document.getElementById('emissionRecordId').value;
  const body = {
    facility_id:        document.getElementById('emissionFacilityId').value,
    emission_date:      document.getElementById('emissionDate').value,
    co2_emissions:      document.getElementById('emissionCo2').value,
    methane_emissions:  document.getElementById('emissionMethane').value,
    status:             document.getElementById('emissionStatus').value,
    notes:              document.getElementById('emissionNotes').value
  };
  if (!body.facility_id || !body.emission_date || !body.co2_emissions || !body.methane_emissions) {
    showToast('warning','Validation','Please fill in all required fields.'); return;
  }
  try {
    const res = id
      ? await apiFetch(`/emissions/${id}`, 'PUT', body)
      : await apiFetch('/emissions', 'POST', body);
    if (res?.success) {
      showToast('success','Saved',res.message || 'Record saved successfully.');
      closeModal('emissionModal');
      loadEmissions();
    } else {
      showToast('error','Error', res?.message || 'Save failed.');
    }
  } catch {
    // Demo mode
    showToast('success','Demo Mode','Record saved locally (demo).');
    closeModal('emissionModal');
  }
}

// ─────────────────────────────────────────────────────────────
//  FACILITIES
// ─────────────────────────────────────────────────────────────
async function loadFacilities() {
  try {
    const res = await apiFetch('/facilities').catch(() => null);
    allFacilities = res?.facilities || getDemoFacilities();
    renderFacilitiesTable(allFacilities);
    document.getElementById('facilityCount').textContent = allFacilities.length + ' facilities';
  } catch {
    allFacilities = getDemoFacilities();
    renderFacilitiesTable(allFacilities);
  }
}

function renderFacilitiesTable(list) {
  const tbody = document.getElementById('facilitiesTableBody');
  if (!list?.length) { tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state"><div class="empty-icon">🏭</div><h3>No facilities</h3></div></td></tr>`; return; }
  const canEdit = currentUser?.role !== 'staff';
  tbody.innerHTML = list.map((f, i) => `
    <tr>
      <td style="color:var(--text-muted);">${f.facility_id || i+1}</td>
      <td><div class="cell-primary">${f.facility_name}</div><div class="cell-sub">${f.location||''}</div></td>
      <td><span class="region-tag">${f.region}</span></td>
      <td><span class="badge badge-medium">${capitalize(f.facility_type||'other')}</span></td>
      <td>${f.total_records||0}</td>
      <td style="color:var(--primary);font-weight:600;">${formatNum(f.total_emissions||0)} t</td>
      <td>${f.last_report_date ? formatDate(f.last_report_date) : '—'}</td>
      <td><span class="badge badge-${f.is_active ? 'approved' : 'rejected'}">${f.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        ${canEdit ? `
          <button class="btn btn-sm btn-danger" onclick="deleteRecord(${f.facility_id||i+1},'facility')" title="Delete">
            <i class="bi bi-trash"></i>
          </button>
        ` : '<span style="color:var(--text-muted);font-size:12px;">—</span>'}
      </td>
    </tr>`).join('');
}

function filterFacilities() {
  const q = document.getElementById('facilitySearch').value.toLowerCase();
  renderFacilitiesTable(allFacilities.filter(f =>
    f.facility_name.toLowerCase().includes(q) || f.region.toLowerCase().includes(q)
  ));
}

function openFacilityModal() { openModal('facilityModal'); }

async function saveFacility() {
  const body = {
    facility_name: document.getElementById('facilityName').value,
    region:        document.getElementById('facilityRegion').value,
    facility_type: document.getElementById('facilityType').value,
    location:      document.getElementById('facilityLocation').value,
    capacity_mw:   document.getElementById('facilityCapacity').value,
    operational_since: document.getElementById('facilityOpSince').value
  };
  if (!body.facility_name || !body.region || !body.facility_type) {
    showToast('warning','Validation','Fill in required fields.'); return;
  }
  try {
    const res = await apiFetch('/facilities', 'POST', body);
    if (res?.success) {
      showToast('success','Created','Facility added successfully.');
      closeModal('facilityModal');
      loadFacilities();
    } else showToast('error','Error', res?.message||'Failed.');
  } catch { showToast('success','Demo Mode','Facility added (demo).'); closeModal('facilityModal'); }
}

// ─────────────────────────────────────────────────────────────
//  WORKFLOW / TASKS
// ─────────────────────────────────────────────────────────────
async function loadTasks() {
  try {
    const [taskRes, userRes] = await Promise.all([
      apiFetch('/workflow/tasks').catch(() => null),
      apiFetch('/auth/users').catch(() => null)
    ]);
    allTasks = taskRes?.tasks || getDemoTasks();
    allUsers = userRes?.users || getDemoUsers();
    renderTasksTable(allTasks);
    renderWorkflowStats(allTasks);
    populateUserDropdown('taskAssignTo');
  } catch {
    allTasks = getDemoTasks();
    renderTasksTable(allTasks);
  }
}

function renderTasksTable(tasks) {
  const tbody = document.getElementById('tasksTableBody');
  if (!tasks?.length) { tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><h3>No tasks found</h3></div></td></tr>`; return; }
  tbody.innerHTML = tasks.map((t,i) => `
    <tr>
      <td style="color:var(--text-muted);">${t.task_id||i+1}</td>
      <td><div class="cell-primary">${t.title}</div><div class="cell-sub">${t.description||''}</div></td>
      <td>${t.assigned_to_name||'—'}</td>
      <td><span class="badge badge-${t.priority}">${capitalize(t.priority)}</span></td>
      <td>${t.due_date ? formatDate(t.due_date) : '—'}</td>
      <td><span class="badge badge-${t.approval_status}">${capitalize(t.approval_status)}</span></td>
      <td>
        ${t.approval_status === 'pending' && currentUser?.role !== 'staff' ? `
          <div style="display:flex;gap:6px;">
            <button class="btn btn-sm btn-success" onclick="updateTaskStatus(${t.task_id||i+1},'approved')">
              <i class="bi bi-check-lg"></i> Approve
            </button>
            <button class="btn btn-sm btn-danger" onclick="updateTaskStatus(${t.task_id||i+1},'rejected')">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>` : `<span style="color:var(--text-muted);font-size:12px;">${t.approval_status==='completed'?'Done':'—'}</span>`}
      </td>
    </tr>`).join('');
}

function renderWorkflowStats(tasks) {
  const count = (s) => tasks.filter(t => t.approval_status === s).length;
  document.getElementById('wf-pending').textContent    = count('pending');
  document.getElementById('wf-inprogress').textContent = count('in_progress');
  document.getElementById('wf-approved').textContent   = count('approved');
  document.getElementById('wf-rejected').textContent   = count('rejected');
}

function filterTasks() {
  const status   = document.getElementById('taskStatusFilter').value;
  const priority = document.getElementById('taskPriorityFilter').value;
  renderTasksTable(allTasks.filter(t =>
    (!status   || t.approval_status === status) &&
    (!priority || t.priority === priority)
  ));
}

function openTaskModal() { openModal('taskModal'); populateUserDropdown('taskAssignTo'); }

async function saveTask() {
  const body = {
    assigned_to: document.getElementById('taskAssignTo').value,
    title:       document.getElementById('taskTitle').value,
    description: document.getElementById('taskDesc').value,
    priority:    document.getElementById('taskPriority').value,
    due_date:    document.getElementById('taskDueDate').value,
    record_id:   document.getElementById('taskRecordId').value || null
  };
  if (!body.assigned_to || !body.title) { showToast('warning','Validation','Fill required fields.'); return; }
  try {
    const res = await apiFetch('/workflow/tasks', 'POST', body);
    if (res?.success) {
      showToast('success','Created','Task assigned.'); closeModal('taskModal'); loadTasks();
    } else showToast('error','Error',res?.message||'Failed.');
  } catch { showToast('success','Demo Mode','Task created (demo).'); closeModal('taskModal'); }
}

async function updateTaskStatus(id, status) {
  try {
    const res = await apiFetch(`/workflow/tasks/${id}/status`, 'PUT', { approval_status: status });
    if (res?.success) {
      showToast('success','Updated',`Task ${status}.`); loadTasks();
    } else showToast('error','Error',res?.message||'Failed.');
  } catch { showToast('success','Demo Mode',`Task ${status} (demo).`); loadTasks(); }
}

// ─────────────────────────────────────────────────────────────
//  REPORTS
// ─────────────────────────────────────────────────────────────
async function loadReports() {
  try {
    const res = await apiFetch('/reports').catch(() => null);
    allReports = res?.reports || getDemoReports();
    renderReportsTable(allReports);
  } catch {
    allReports = getDemoReports();
    renderReportsTable(allReports);
  }
}

function renderReportsTable(reports) {
  const tbody = document.getElementById('reportsTableBody');
  if (!reports?.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📄</div><h3>No reports generated yet</h3></div></td></tr>`; return; }
  tbody.innerHTML = reports.map((r,i) => `
    <tr>
      <td style="color:var(--text-muted);">${r.report_id||i+1}</td>
      <td><span class="badge badge-medium">${capitalize(r.report_type)}</span></td>
      <td>${r.from_date ? formatDate(r.from_date)+' – '+formatDate(r.to_date) : '—'}</td>
      <td>${r.region_filter||'All'}</td>
      <td>${r.total_records||0}</td>
      <td>${r.generated_by_name||'—'}</td>
      <td>${formatDate(r.generated_date)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="viewReport(${r.report_id||i+1})">
          <i class="bi bi-eye"></i> View
        </button>
      </td>
    </tr>`).join('');
}

async function generateReport() {
  const btn = document.getElementById('generateReportBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner me-2"></span>Generating…';
  const body = {
    report_type: document.getElementById('reportType').value,
    from_date:   document.getElementById('reportFromDate').value,
    to_date:     document.getElementById('reportToDate').value,
    region:      document.getElementById('reportRegion').value
  };
  try {
    const res = await apiFetch('/reports/generate', 'POST', body);
    if (res?.success) {
      showToast('success','Report Generated','Report created successfully.');
      renderReportSummary(res.summary);
      loadReports();
    } else {
      // Demo mode
      renderReportSummary({ totalCo2: 11839, totalCh4: 413, totalCo2e: 17886, totalRecords: 12, approved: 8 });
      showToast('success','Demo Mode','Sample report generated.');
    }
  } catch {
    renderReportSummary({ totalCo2: 11839, totalCh4: 413, totalCo2e: 17886, totalRecords: 12, approved: 8 });
    showToast('success','Demo Mode','Sample report generated.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-file-earmark-bar-graph"></i> Generate Report';
  }
}

function renderReportSummary(s) {
  const card = document.getElementById('reportSummaryCard');
  const body = document.getElementById('reportSummaryBody');
  card.style.display = 'block';
  body.innerHTML = `
    <div class="stat-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));">
      <div class="stat-card green"><div class="stat-icon green"><i class="bi bi-cloud-fill"></i></div>
        <div class="stat-body"><div class="stat-label">Total CO₂e</div><div class="stat-value" style="font-size:20px;">${formatNum(s.totalCo2e)} t</div></div></div>
      <div class="stat-card blue"><div class="stat-icon blue"><i class="bi bi-fire"></i></div>
        <div class="stat-body"><div class="stat-label">CO₂ Emissions</div><div class="stat-value" style="font-size:20px;">${formatNum(s.totalCo2)} t</div></div></div>
      <div class="stat-card cyan"><div class="stat-icon cyan"><i class="bi bi-wind"></i></div>
        <div class="stat-body"><div class="stat-label">CH₄ Emissions</div><div class="stat-value" style="font-size:20px;">${formatNum(s.totalCh4)} t</div></div></div>
      <div class="stat-card amber"><div class="stat-icon amber"><i class="bi bi-file-text"></i></div>
        <div class="stat-body"><div class="stat-label">Total Records</div><div class="stat-value" style="font-size:20px;">${s.totalRecords}</div></div></div>
      <div class="stat-card green"><div class="stat-icon green"><i class="bi bi-check2-circle"></i></div>
        <div class="stat-body"><div class="stat-label">Approved</div><div class="stat-value" style="font-size:20px;">${s.approved}</div></div></div>
    </div>`;
}

async function viewReport(id) {
  showToast('info','Opening Report',`Loading report #${id}…`);
}

// ─────────────────────────────────────────────────────────────
//  EXECUTIVE DASHBOARD
// ─────────────────────────────────────────────────────────────
async function loadExecutive() {
  const stats = dashboardStats || await apiFetch('/emissions/stats/summary').then(r=>r?.stats).catch(()=>null);

  const kpis = [
    { label:'Total CO₂e',       value: stats ? formatNum(stats.totalCo2e)+' t' : '17,886 t', color:'green',  icon:'bi-cloud-fill' },
    { label:'CO₂ Emissions',    value: stats ? formatNum(stats.totalCo2)+' t'  : '11,839 t', color:'blue',   icon:'bi-fire' },
    { label:'CH₄ Emissions',    value: stats ? formatNum(stats.totalMethane)+' t': '413 t',  color:'amber',  icon:'bi-wind' },
    { label:'Compliance Rate',  value: stats ? stats.compliancePercentage+'%'   : '67%',     color:'cyan',   icon:'bi-clipboard2-check' },
    { label:'Active Facilities',value: stats ? stats.activeFacilities            : '7',      color:'purple', icon:'bi-building-fill' },
  ];

  document.getElementById('execStatGrid').innerHTML = kpis.map(k => `
    <div class="stat-card ${k.color}">
      <div class="stat-icon ${k.color}"><i class="bi ${k.icon}"></i></div>
      <div class="stat-body"><div class="stat-label">${k.label}</div><div class="stat-value">${k.value}</div></div>
    </div>`).join('');

  const regionData = stats?.regionStats || [
    {region:'Delhi',total:8812},{region:'Mumbai',total:4655},{region:'Kolkata',total:4015},
    {region:'Hyderabad',total:3120},{region:'Pune',total:3474},{region:'Chennai',total:1365},
    {region:'Bangalore',total:195},{region:'Ahmedabad',total:25}
  ];

  // Exec region bar chart
  const ctx1 = document.getElementById('execRegionChart')?.getContext('2d');
  if (ctx1) {
    if (execRegionChart) execRegionChart.destroy();
    execRegionChart = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: regionData.map(r => r.region),
        datasets: [{ label:'CO₂e (t)', data: regionData.map(r => parseFloat(r.total||0)),
          backgroundColor: regionData.map((_,i) => `hsl(${160-i*15},70%,${50-i*3}%)`),
          borderRadius: 6, borderSkipped: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend:{display:false}, tooltip:{backgroundColor:'#1a2235',titleColor:'#f1f5f9',bodyColor:'#94a3b8'} },
        scales: { x:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#475569'}}, y:{grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#475569'}} }
      }
    });
  }

  // Compare chart
  const ctx2 = document.getElementById('execCompareChart')?.getContext('2d');
  if (ctx2) {
    if (execCompareChart) execCompareChart.destroy();
    const months = (stats?.monthlyStats||[]).map(m=>m.month).slice(-6);
    const co2vals = (stats?.monthlyStats||[]).slice(-6).map(m=>parseFloat(m.total||0)*0.66);
    const ch4vals = (stats?.monthlyStats||[]).slice(-6).map(m=>parseFloat(m.total||0)*0.34);
    execCompareChart = new Chart(ctx2, {
      type:'bar',
      data:{
        labels: months.length ? months : ['Jan','Feb','Mar','Apr','May','Jun'],
        datasets:[
          {label:'CO₂',  data: co2vals.length ? co2vals : [820,910,870,950,840,920], backgroundColor:'rgba(14,165,233,0.7)', borderRadius:4},
          {label:'CH₄',  data: ch4vals.length ? ch4vals : [420,460,440,490,430,470], backgroundColor:'rgba(0,208,132,0.7)',  borderRadius:4}
        ]
      },
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{labels:{color:'#94a3b8'}},tooltip:{backgroundColor:'#1a2235',titleColor:'#f1f5f9',bodyColor:'#94a3b8'}},
        scales:{x:{stacked:true, grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#475569'}},y:{stacked:true, grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#475569'}}}
      }
    });
  }

  // Compliance gauge
  const comp = stats?.compliancePercentage || 67;
  const gaugeEl = document.getElementById('complianceGauge');
  if (gaugeEl) {
    const color = comp >= 80 ? '#22c55e' : comp >= 60 ? '#f59e0b' : '#ef4444';
    gaugeEl.innerHTML = `
      <div style="position:relative;display:inline-block;margin:20px 0;">
        <svg width="200" height="120" viewBox="0 0 200 120">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="16" stroke-linecap="round"/>
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="${color}" stroke-width="16" stroke-linecap="round"
            stroke-dasharray="${comp * 2.51} 251" transform="rotate(0,100,100)"/>
        </svg>
        <div style="position:absolute;top:55%;left:50%;transform:translate(-50%,-50%);text-align:center;">
          <div style="font-size:36px;font-weight:800;color:${color};">${comp}%</div>
          <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.6px;">Compliance</div>
        </div>
      </div>
      <div style="font-size:13px;color:var(--text-secondary);margin-top:8px;">
        ${comp >= 80 ? '✅ Excellent compliance' : comp >= 60 ? '⚠️ Moderate – improvement needed' : '🔴 Below threshold – action required'}
      </div>`;
  }

  // Facility ranking
  const facilities = allFacilities.length ? allFacilities : getDemoFacilities();
  const ranked = [...facilities].sort((a,b) => parseFloat(b.total_emissions||0) - parseFloat(a.total_emissions||0));
  document.getElementById('execFacilityRank').innerHTML = ranked.slice(0,6).map((f,i) => {
    const compliance = Math.floor(60 + Math.random()*38);
    const color = compliance >= 80 ? 'badge-approved' : compliance >= 60 ? 'badge-pending' : 'badge-rejected';
    return `<tr>
      <td style="color:var(--primary);font-weight:700;">#${i+1}</td>
      <td><div class="cell-primary">${f.facility_name}</div></td>
      <td><span class="region-tag">${f.region}</span></td>
      <td style="color:var(--text-primary);font-weight:600;">${formatNum(f.total_emissions||0)}</td>
      <td>${f.total_records||0}</td>
      <td><span class="badge ${color}">${compliance}%</span></td>
    </tr>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────
//  MONITORING
// ─────────────────────────────────────────────────────────────
const rtHistory = { cpu:[], mem:[], labels:[] };
const MAX_POINTS = 20;

function loadMonitoring() {
  renderContainerList();
  updateMetrics();
  monitorInterval = setInterval(updateMetrics, 5000);
  startRealtimeChart();
  startLogStream();
}

function getMetricValue(min, max) { return Math.floor(min + Math.random() * (max - min)); }

function updateMetrics() {
  const cpu  = getMetricValue(18, 85);
  const mem  = getMetricValue(35, 78);
  const disk = getMetricValue(42, 72);
  const net  = (Math.random() * 50 + 5).toFixed(1);
  const users= getMetricValue(2, 12);
  const reqs = getMetricValue(40, 200);

  const cpuColor  = cpu  > 80 ? 'red' : cpu  > 60 ? 'amber' : 'green';
  const memColor  = mem  > 75 ? 'red' : mem  > 55 ? 'amber' : 'green';
  const diskColor = disk > 85 ? 'red' : disk > 65 ? 'amber' : 'green';

  setMetric('cpu',  cpu  + '%', cpu,  cpuColor,  cpu>80  ? '⚠️ HIGH — alert threshold exceeded' : '✅ Normal');
  setMetric('mem',  mem  + '%', mem,  memColor,  mem>75  ? '⚠️ HIGH — check memory' : '✅ Normal');
  setMetric('disk', disk + '%', disk, diskColor, disk>85 ? '⚠️ HIGH — clean up needed' : '✅ Normal');

  document.getElementById('netValue').textContent         = net + ' MB/s';
  document.getElementById('activeUsersVal').textContent   = users;
  document.getElementById('reqValue').textContent         = reqs + '/m';

  document.getElementById('monitorRefresh').textContent = '↻ Refreshed ' + new Date().toLocaleTimeString();

  // Update real-time chart data
  rtHistory.labels.push(new Date().toLocaleTimeString('en',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'}));
  rtHistory.cpu.push(cpu);
  rtHistory.mem.push(mem);
  if (rtHistory.labels.length > MAX_POINTS) {
    rtHistory.labels.shift(); rtHistory.cpu.shift(); rtHistory.mem.shift();
  }
  if (rtChart) {
    rtChart.data.labels = [...rtHistory.labels];
    rtChart.data.datasets[0].data = [...rtHistory.cpu];
    rtChart.data.datasets[1].data = [...rtHistory.mem];
    rtChart.update('none');
  }
}

function setMetric(key, val, pct, color, alertMsg) {
  const el = document.getElementById(key+'Value');
  if (el) { el.textContent = val; el.className = 'monitor-value ' + color; }
  const bar = document.getElementById(key+'Bar');
  if (bar) { bar.style.width = pct+'%'; bar.className = 'progress-bar-fill ' + color; }
  const alertEl = document.getElementById(key+'Alert');
  if (alertEl) { alertEl.textContent = alertMsg; alertEl.style.color = color==='red' ? 'var(--danger)' : color==='amber' ? 'var(--warning)' : 'var(--text-muted)'; }
}

function startRealtimeChart() {
  const ctx = document.getElementById('rtChart')?.getContext('2d');
  if (!ctx) return;
  if (rtChart) rtChart.destroy();
  rtChart = new Chart(ctx, {
    type:'line',
    data:{
      labels:[],
      datasets:[
        {label:'CPU %', data:[], borderColor:'#00d084', backgroundColor:'rgba(0,208,132,0.05)', borderWidth:2, tension:0.4, pointRadius:0},
        {label:'RAM %', data:[], borderColor:'#0ea5e9', backgroundColor:'rgba(14,165,233,0.05)', borderWidth:2, tension:0.4, pointRadius:0}
      ]
    },
    options:{
      responsive:true, maintainAspectRatio:false, animation:false,
      plugins:{legend:{labels:{color:'#94a3b8',usePointStyle:true}},tooltip:{backgroundColor:'#1a2235',titleColor:'#f1f5f9',bodyColor:'#94a3b8'}},
      scales:{
        x:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#475569',font:{size:10},maxTicksLimit:8}},
        y:{grid:{color:'rgba(255,255,255,0.04)'},ticks:{color:'#475569'},min:0,max:100}
      }
    }
  });
}

function renderContainerList() {
  const containers = [
    {name:'carbontrack-frontend', image:'nginx:alpine',         status:'running', uptime:'6d 14h', port:'80'},
    {name:'carbontrack-backend',  image:'node:18-alpine',       status:'running', uptime:'6d 14h', port:'3000'},
    {name:'carbontrack-db',       image:'mysql:8.0',            status:'running', uptime:'6d 14h', port:'3306'},
    {name:'cloudwatch-agent',     image:'amazon/cwagent:latest',status:'running', uptime:'6d 14h', port:'—'},
  ];
  document.getElementById('containerList').innerHTML = containers.map(c => `
    <div class="container-item">
      <div class="container-status-dot ${c.status}"></div>
      <div>
        <div class="container-name">${c.name}</div>
        <div class="container-image">${c.image} · :${c.port}</div>
      </div>
      <div class="container-uptime">${c.uptime}</div>
    </div>`).join('');
}

const logMessages = [
  ['INFO',  '[API]   GET /api/emissions/stats/summary 200 12ms'],
  ['INFO',  '[DB]    Query executed: SELECT * FROM emission_records – 8 rows'],
  ['INFO',  '[AUTH]  JWT verified for user: manager@carbontrack.com'],
  ['WARN',  '[RATE]  Request rate elevated on /api/emissions'],
  ['INFO',  '[S3]    Backup upload: carbontrack-backup-2026.sql – SUCCESS'],
  ['INFO',  '[API]   POST /api/emissions 201 45ms'],
  ['INFO',  '[CRON]  Daily backup job started at 02:00 UTC'],
  ['ERROR', '[DB]    Connection pool warning: 8/10 connections used'],
  ['INFO',  '[API]   GET /api/workflow/tasks 200 8ms'],
  ['INFO',  '[NGINX] 10.0.1.15 "GET /dashboard HTTP/1.1" 200 2340'],
];

function startLogStream() {
  const container = document.getElementById('logContainer');
  if (!container) return;
  container.innerHTML = '';
  let idx = 0;
  logInterval = setInterval(() => {
    const [level, msg] = logMessages[idx % logMessages.length];
    const color = level==='ERROR' ? '#ef4444' : level==='WARN' ? '#f59e0b' : '#94a3b8';
    const ts = new Date().toISOString();
    container.innerHTML += `<div style="color:${color};margin-bottom:3px;"><span style="color:#475569">[${ts}]</span> <span style="color:${level==='ERROR'?'#ef4444':level==='WARN'?'#f59e0b':'#22c55e'}">[${level}]</span> ${msg}</div>`;
    container.scrollTop = container.scrollHeight;
    idx++;
  }, 2500);
}

function clearLogs() { document.getElementById('logContainer').innerHTML = ''; }

// ─────────────────────────────────────────────────────────────
//  USER MANAGEMENT
// ─────────────────────────────────────────────────────────────
async function loadUsers() {
  try {
    const res = await apiFetch('/auth/users').catch(() => null);
    allUsers = res?.users || getDemoUsers();
    renderUsersTable(allUsers);
  } catch { allUsers = getDemoUsers(); renderUsersTable(allUsers); }
}

function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!users?.length) { tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">👥</div><h3>No users found</h3></div></td></tr>`; return; }
  tbody.innerHTML = users.map((u,i) => `
    <tr>
      <td style="color:var(--text-muted);">${u.id||i+1}</td>
      <td><div class="cell-primary">${u.name}</div></td>
      <td>${u.email}</td>
      <td><span class="badge badge-${u.role}">${capitalize(u.role)}</span></td>
      <td>${u.department||'—'}</td>
      <td>${u.last_login ? formatDate(u.last_login) : 'Never'}</td>
      <td><span class="badge badge-${u.is_active ? 'approved' : 'rejected'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="deleteRecord(${u.id||i+1},'user')">
          <i class="bi bi-person-x"></i>
        </button>
      </td>
    </tr>`).join('');
}

function filterUsers() {
  const q = document.getElementById('userSearch').value.toLowerCase();
  renderUsersTable(allUsers.filter(u => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
}

function openUserModal() { openModal('userModal'); }

async function saveUser() {
  const body = {
    name: document.getElementById('newUserName').value,
    email: document.getElementById('newUserEmail').value,
    password: document.getElementById('newUserPassword').value,
    role: document.getElementById('newUserRole').value,
    department: document.getElementById('newUserDept').value
  };
  if (!body.name||!body.email||!body.password) { showToast('warning','Validation','Fill all required fields.'); return; }
  try {
    const res = await apiFetch('/auth/register', 'POST', body);
    if (res?.success) {
      showToast('success','Created','User account created.'); closeModal('userModal'); loadUsers();
    } else showToast('error','Error',res?.message||'Failed.');
  } catch { showToast('success','Demo Mode','User created (demo).'); closeModal('userModal'); }
}

// ─────────────────────────────────────────────────────────────
//  DELETE (shared)
// ─────────────────────────────────────────────────────────────
function deleteRecord(id, type) {
  const msgMap = { emission:'emission record', facility:'facility', user:'user account' };
  document.getElementById('confirmMsg').textContent = `Delete this ${msgMap[type]||'record'} (ID: ${id})? This cannot be undone.`;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.onclick = async () => {
    const endpointMap = { emission:'/emissions/', facility:'/facilities/', user:'/users/' };
    try {
      const res = await apiFetch((endpointMap[type]||'/') + id, 'DELETE');
      if (res?.success) showToast('success','Deleted','Record removed successfully.');
      else showToast('success','Demo Mode','Deleted in demo mode.');
    } catch { showToast('success','Demo Mode','Deleted (demo).'); }
    closeModal('confirmModal');
    if (type==='emission')  loadEmissions();
    if (type==='facility')  loadFacilities();
    if (type==='user')      loadUsers();
  };
  openModal('confirmModal');
}

// ─────────────────────────────────────────────────────────────
//  MODAL HELPERS
// ─────────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id).classList.remove('show');
  document.body.style.overflow = '';
}
// Close on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay.id); });
});

// ─────────────────────────────────────────────────────────────
//  TOAST
// ─────────────────────────────────────────────────────────────
function showToast(type, title, msg) {
  const icons = {success:'bi-check-circle-fill', error:'bi-x-circle-fill', warning:'bi-exclamation-triangle-fill', info:'bi-info-circle-fill'};
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi ${icons[type]||icons.info} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>`;
  document.getElementById('toast-container').appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}

// ─────────────────────────────────────────────────────────────
//  POPULATE DROPDOWNS
// ─────────────────────────────────────────────────────────────
function populateFacilityDropdowns() {
  const sels = document.querySelectorAll('#emissionFacilityId');
  sels.forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Select Facility</option>' +
      (allFacilities.length ? allFacilities : getDemoFacilities()).map(f =>
        `<option value="${f.facility_id}">${f.facility_name} (${f.region})</option>`).join('');
    if (cur) sel.value = cur;
  });
}

function populateUserDropdown(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Select User</option>' +
    (allUsers.length ? allUsers : getDemoUsers()).map(u =>
      `<option value="${u.id}">${u.name} (${u.role})</option>`).join('');
}

// ─────────────────────────────────────────────────────────────
//  DEMO / OFFLINE DATA
// ─────────────────────────────────────────────────────────────
function getDemoEmissions() {
  return [
    {record_id:1, facility_name:'Mumbai Power Station Alpha',co2_emissions:1250.50,methane_emissions:45.20,total_co2e:2380.50,emission_date:'2026-01-15',status:'approved',  region:'Mumbai'},
    {record_id:2, facility_name:'Pune Industrial Complex',   co2_emissions:876.30, methane_emissions:32.10,total_co2e:1676.80,emission_date:'2026-02-10',status:'approved',  region:'Pune'},
    {record_id:3, facility_name:'Delhi Refinery North',      co2_emissions:2100.00,methane_emissions:87.50,total_co2e:4287.50,emission_date:'2026-03-01',status:'approved',  region:'Delhi'},
    {record_id:4, facility_name:'Bangalore Tech Campus',     co2_emissions:45.20,  methane_emissions:2.10, total_co2e:97.70,  emission_date:'2026-03-05',status:'approved',  region:'Bangalore'},
    {record_id:5, facility_name:'Chennai Port Terminal',     co2_emissions:320.80, methane_emissions:15.60,total_co2e:711.80, emission_date:'2026-04-01',status:'approved',  region:'Chennai'},
    {record_id:6, facility_name:'Kolkata Manufacturing Unit',co2_emissions:985.60, methane_emissions:41.20,total_co2e:2015.60,emission_date:'2026-04-15',status:'under_review',region:'Kolkata'},
    {record_id:7, facility_name:'Hyderabad Chemical Plant',  co2_emissions:1560.00,methane_emissions:62.40,total_co2e:3120.00,emission_date:'2026-05-01',status:'approved',  region:'Hyderabad'},
    {record_id:8, facility_name:'Mumbai Power Station Alpha',co2_emissions:1180.40,methane_emissions:43.80,total_co2e:2275.40,emission_date:'2026-05-15',status:'approved',  region:'Mumbai'},
    {record_id:9, facility_name:'Pune Industrial Complex',   co2_emissions:910.20, methane_emissions:35.50,total_co2e:1797.70,emission_date:'2026-06-01',status:'pending',   region:'Pune'},
    {record_id:10,facility_name:'Delhi Refinery North',      co2_emissions:2250.00,methane_emissions:91.00,total_co2e:4525.00,emission_date:'2026-06-10',status:'pending',   region:'Delhi'},
    {record_id:11,facility_name:'Ahmedabad Solar Farm',      co2_emissions:12.50,  methane_emissions:0.50, total_co2e:25.00,  emission_date:'2026-06-05',status:'approved',  region:'Ahmedabad'},
    {record_id:12,facility_name:'Chennai Port Terminal',     co2_emissions:298.60, methane_emissions:14.20,total_co2e:653.60, emission_date:'2026-06-10',status:'pending',   region:'Chennai'},
  ];
}

function getDemoFacilities() {
  return [
    {facility_id:1,facility_name:'Mumbai Power Station Alpha', region:'Mumbai',    facility_type:'power_plant',    total_records:4,total_emissions:4655.9,  last_report_date:'2026-05-15',is_active:1},
    {facility_id:2,facility_name:'Pune Industrial Complex',    region:'Pune',      facility_type:'manufacturing',   total_records:2,total_emissions:3474.5,  last_report_date:'2026-06-01',is_active:1},
    {facility_id:3,facility_name:'Delhi Refinery North',       region:'Delhi',     facility_type:'refinery',        total_records:2,total_emissions:8812.5,  last_report_date:'2026-06-10',is_active:1},
    {facility_id:4,facility_name:'Bangalore Tech Campus',      region:'Bangalore', facility_type:'office',          total_records:1,total_emissions:97.7,    last_report_date:'2026-03-05',is_active:1},
    {facility_id:5,facility_name:'Chennai Port Terminal',      region:'Chennai',   facility_type:'warehouse',       total_records:2,total_emissions:1365.4,  last_report_date:'2026-06-10',is_active:1},
    {facility_id:6,facility_name:'Kolkata Manufacturing Unit', region:'Kolkata',   facility_type:'manufacturing',   total_records:1,total_emissions:2015.6,  last_report_date:'2026-04-15',is_active:1},
    {facility_id:7,facility_name:'Hyderabad Chemical Plant',   region:'Hyderabad', facility_type:'manufacturing',   total_records:1,total_emissions:3120.0,  last_report_date:'2026-05-01',is_active:1},
    {facility_id:8,facility_name:'Ahmedabad Solar Farm',       region:'Ahmedabad', facility_type:'power_plant',    total_records:1,total_emissions:25.0,    last_report_date:'2026-06-05',is_active:1},
  ];
}

function getDemoTasks() {
  return [
    {task_id:1,title:'Review Mumbai Q2 Report',  description:'Audit Q2 emission data',assigned_to:3,assigned_to_name:'Field Staff',  priority:'high',    approval_status:'pending',     due_date:'2026-06-22'},
    {task_id:2,title:'Verify Pune Monthly Data',  description:'Cross-check sensor readings',assigned_to:3,assigned_to_name:'Field Staff',  priority:'medium',  approval_status:'in_progress', due_date:'2026-06-26'},
    {task_id:3,title:'Delhi Refinery Audit',      description:'Full compliance audit',    assigned_to:3,assigned_to_name:'Field Staff',  priority:'critical',approval_status:'pending',     due_date:'2026-06-20'},
    {task_id:4,title:'Quarterly Compliance Run',  description:'Prepare Q3 report',         assigned_to:3,assigned_to_name:'Field Staff',  priority:'high',    approval_status:'pending',     due_date:'2026-07-01'},
    {task_id:5,title:'Train New Staff Members',   description:'Emission recording training',assigned_to:3,assigned_to_name:'Field Staff', priority:'low',     approval_status:'completed',   due_date:'2026-06-14'},
  ];
}

function getDemoUsers() {
  return [
    {id:1,name:'System Administrator',email:'admin@carbontrack.com',  role:'admin',  department:'IT & Cloud',         is_active:1,last_login:'2026-06-19T12:30:00Z'},
    {id:2,name:'Regional Manager',     email:'manager@carbontrack.com',role:'manager',department:'Environmental Compliance',is_active:1,last_login:'2026-06-19T10:00:00Z'},
    {id:3,name:'Field Staff',          email:'staff@carbontrack.com',  role:'staff',  department:'Data Entry',          is_active:1,last_login:'2026-06-18T15:00:00Z'},
  ];
}

function getDemoReports() {
  return [
    {report_id:1,report_type:'monthly',  from_date:'2026-05-01',to_date:'2026-05-31',region_filter:null,  total_records:8, generated_by_name:'Regional Manager',generated_date:'2026-06-01'},
    {report_id:2,report_type:'quarterly',from_date:'2026-04-01',to_date:'2026-06-30',region_filter:'Mumbai',total_records:4,generated_by_name:'System Administrator',generated_date:'2026-06-10'},
    {report_id:3,report_type:'compliance',from_date:'2026-01-01',to_date:'2026-06-30',region_filter:null, total_records:12,generated_by_name:'Regional Manager',generated_date:'2026-06-15'},
  ];
}

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
function formatNum(val) {
  const n = parseFloat(val)||0;
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function capitalize(str) {
  if (!str) return '';
  return str.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}
