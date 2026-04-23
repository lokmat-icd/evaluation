// ==================== REGISTRATION FUNCTIONS ====================
var currentRegistrationEmpCode = null;
var currentRegistrationEmpData = null;

async function loadEmployeeFromMaster() {
  var empCode = document.getElementById('emp_code_input').value.trim();
  if (!empCode) { showToast('Please enter employee code', 'error'); return; }
  showToast('Loading employee data...', 'info');
  try {
    var result = await callServer("getEmployeeFromMaster", { empCode: empCode });
    if (result.success && result.employee) {
      var emp = result.employee;
      var employeeInfoHtml = `<div class="panel panel-default"><div class="panel-heading" style="background-color: #1e3c72; color: white;"><strong><i class="fa fa-info-circle"></i> Employee Information (from Master Data)</strong></div><div class="panel-body"><div class="row"><div class="col-md-6"><div class="form-group"><label>Employee Code</label><input type="text" class="form-control readonly-field" id="emp_code_display" value="${escapeHtml(emp.code)}" readonly></div></div><div class="col-md-6"><div class="form-group"><label>Full Name</label><input type="text" class="form-control readonly-field" id="full_name_display" value="${escapeHtml(emp.name)}" readonly></div></div></div><div class="row"><div class="col-md-6"><div class="form-group"><label>Designation</label><input type="text" class="form-control readonly-field" id="designation_display" value="${escapeHtml(emp.designation)}" readonly></div></div><div class="col-md-6"><div class="form-group"><label>Mobile No.</label><input type="text" class="form-control readonly-field" id="mobile_display" value="${escapeHtml(emp.mobile)}" readonly></div></div></div><div class="row"><div class="col-md-6"><div class="form-group"><label>Unit (Centre)</label><input type="text" class="form-control readonly-field" id="unit_display" value="${escapeHtml(emp.unit)}" readonly></div></div><div class="col-md-6"><div class="form-group"><label>Work Place (Sub-Centre)</label><input type="text" class="form-control readonly-field" id="workplace_display" value="${escapeHtml(emp.workplace)}" readonly></div></div></div><div class="row"><div class="col-md-12"><div class="form-group"><label>Reporting Authority</label><input type="text" class="form-control readonly-field" id="reporting_auth_display" value="${escapeHtml(emp.reporting_authority)}" readonly></div></div></div></div></div>`;
      document.getElementById('employeeInfoSection').innerHTML = employeeInfoHtml;
      document.getElementById('employeeInfoSection').style.display = 'block';
      var icdStatus = await callServer("checkIfICDUserWithStatus", { empCode: empCode });
      if (icdStatus.isICD === true) {
        if (icdStatus.teamWorkloadSaved === 'Yes') {
          document.getElementById('teamWorkloadSection').style.display = 'none';
          showToast('ICD user with existing team workload configuration.', 'info');
        } else {
          document.getElementById('teamWorkloadSection').style.display = 'block';
          generateTeamWorkloadForms(icdStatus.editions);
        }
      } else document.getElementById('teamWorkloadSection').style.display = 'none';
      document.getElementById('registrationActions').style.display = 'block';
    } else showToast(result.message || 'Employee not found', 'error');
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}

function generateTeamWorkloadForms(editionsList) {
  if (!editionsList || editionsList.length === 0) { document.getElementById('teamWorkloadFormsContainer').innerHTML = '<p class="text-muted">No editions configured for this ICD user.</p>'; return; }
  var html = '';
  for (var i = 0; i < editionsList.length; i++) {
    var edition = editionsList[i].trim();
    if (edition === '') continue;
    var safeKey = edition.replace(/[^a-zA-Z0-9]/g, '_');
    var helloPagesLabel = getHelloPagesLabel(edition);
    html += `<div class="subcentre-workload-box"><div class="subcentre-title"><i class="fa fa-newspaper-o"></i> Edition: ${escapeHtml(edition)}</div><div class="row"><div class="col-md-6"><div class="form-group"><span class="edition-label"><i class="fa fa-file-text-o"></i> Main Pages:</span><input type="number" class="form-control page-input workload-input" id="main_pages_${safeKey}" min="0" max="99" value="0" placeholder="00"></div></div><div class="col-md-6"><div class="form-group"><span class="edition-label"><i class="fa fa-file-image-o"></i> ${helloPagesLabel}:</span><input type="number" class="form-control page-input workload-input" id="hello_pages_${safeKey}" min="0" max="99" value="0" placeholder="00"></div></div></div></div>`;
  }
  document.getElementById('teamWorkloadFormsContainer').innerHTML = html;
  var workloadInputs = document.querySelectorAll('.workload-input');
  for (var i = 0; i < workloadInputs.length; i++) { workloadInputs[i].addEventListener('focus', function() { this.select(); }); workloadInputs[i].addEventListener('click', function() { this.select(); }); }
}

async function registerEmployee() {
  var empCode = document.getElementById('emp_code_display').value;
  if (!empCode) { showToast('Please load employee data first', 'error'); return; }
  var teamWorkloads = null;
  var isICD = document.getElementById('teamWorkloadSection').style.display === 'block';
  if (isICD) {
    teamWorkloads = {};
    var editionBoxes = document.querySelectorAll('#teamWorkloadFormsContainer .subcentre-workload-box');
    for (var i = 0; i < editionBoxes.length; i++) {
      var box = editionBoxes[i];
      var titleElem = box.querySelector('.subcentre-title');
      var edition = titleElem.innerText.replace('Edition:', '').trim();
      var safeKey = edition.replace(/[^a-zA-Z0-9]/g, '_');
      var mainPages = parseInt(document.getElementById('main_pages_' + safeKey).value) || 0;
      var helloPages = parseInt(document.getElementById('hello_pages_' + safeKey).value) || 0;
      teamWorkloads[edition] = { main_pages: mainPages, hello_pages: helloPages };
    }
  }
  showToast('Registering...', 'info');
  try {
    var result = await callServer("registerEmployeeFromMaster", { emp_code: empCode, team_workloads: teamWorkloads });
    if (result.success) {
      showToast(result.message, 'success');
      var msgDiv = document.getElementById('regMessage');
      msgDiv.className = 'alert alert-success';
      msgDiv.style.display = 'block';
      msgDiv.innerHTML = '<i class="fa fa-check-circle"></i> ' + result.message;
      setTimeout(function() {
        document.getElementById('registrationTabLi').style.display = 'none';
        $('.nav-pills a[href="#self"]').tab('show');
        document.getElementById('self_emp_code').value = empCode;
        setTimeout(function() { openSelfEvaluationFromSelfTab(); }, 500);
        setTimeout(function() { msgDiv.style.display = 'none'; }, 3000);
      }, 1500);
    } else showToast(result.message, 'error');
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}

function showRegistrationModal(empCode) {
  currentRegistrationEmpCode = empCode;
  document.getElementById('registrationModalBody').innerHTML = '<div class="loading"><i class="fa fa-spinner fa-spin"></i> Loading employee data...</div>';
  $('#registrationModal').modal('show');
  Promise.all([callServer("getEmployeeFromMaster", { empCode: empCode }), callServer("checkIfICDUser", { empCode: empCode })])
    .then(function(results) {
      var empResult = results[0];
      var icdResult = results[1];
      if (empResult.success && empResult.employee) {
        currentRegistrationEmpData = empResult.employee;
        if (icdResult.isICD && icdResult.editions) renderRegistrationModalContent(empResult.employee, icdResult.editions);
        else renderRegistrationModalContent(empResult.employee, []);
      } else document.getElementById('registrationModalBody').innerHTML = '<div class="alert alert-danger">Error loading employee data: ' + (empResult.message || 'Unknown error') + '</div>';
    })
    .catch(function(error) { document.getElementById('registrationModalBody').innerHTML = '<div class="alert alert-danger">Error: ' + error.message + '</div>'; });
}

function renderRegistrationModalContent(employee, editionsList) {
  var disabledAttr = 'readonly';
  var teamWorkloadHtml = '';
  if (editionsList && editionsList.length > 0) {
    teamWorkloadHtml = `<div class="panel panel-default"><div class="panel-heading" style="background-color: #ff9800; color: white;"><strong><i class="fa fa-calendar"></i> Team Workload Configuration (Required for ICD)</strong></div><div class="panel-body" id="regModalTeamWorkloadContainer">`;
    for (var i = 0; i < editionsList.length; i++) {
      var edition = editionsList[i].trim();
      if (edition === '') continue;
      var safeKey = edition.replace(/[^a-zA-Z0-9]/g, '_');
      var helloPagesLabel = getHelloPagesLabel(edition);
      teamWorkloadHtml += `<div class="subcentre-workload-box" style="background: #fff3e0; padding: 15px; margin-bottom: 15px; border-radius: 8px; border-left: 4px solid #ff9800;"><div class="subcentre-title" style="font-size: 16px; font-weight: bold; color: #e68a00; margin-bottom: 15px;"><i class="fa fa-newspaper-o"></i> Edition: ${escapeHtml(edition)}</div><div class="row"><div class="col-md-6"><div class="form-group"><label><i class="fa fa-file-text-o"></i> Main Pages (per day):</label><input type="number" class="form-control page-input workload-input" id="reg_main_pages_${safeKey}" min="0" max="99" value="0" placeholder="00" onfocus="this.select()"></div></div><div class="col-md-6"><div class="form-group"><label><i class="fa fa-file-image-o"></i> ${helloPagesLabel} (per day):</label><input type="number" class="form-control page-input workload-input" id="reg_hello_pages_${safeKey}" min="0" max="99" value="0" placeholder="00" onfocus="this.select()"></div></div></div></div>`;
    }
    teamWorkloadHtml += `</div></div>`;
  } else teamWorkloadHtml = '<div class="alert alert-info">No editions configured. Please contact administrator.</div>';
  var modalHtml = `<div class="employee-info-card" style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1e3c72;"><div class="row"><div class="col-md-6"><div class="form-group"><label>Employee Code</label><input type="text" class="form-control" value="${escapeHtml(employee.code || '')}" ${disabledAttr}></div></div><div class="col-md-6"><div class="form-group"><label>Full Name</label><input type="text" class="form-control" value="${escapeHtml(employee.name || '')}" ${disabledAttr}></div></div></div><div class="row"><div class="col-md-6"><div class="form-group"><label>Designation</label><input type="text" class="form-control" value="${escapeHtml(employee.designation || '')}" ${disabledAttr}></div></div><div class="col-md-6"><div class="form-group"><label>Unit (Centre)</label><input type="text" class="form-control" value="${escapeHtml(employee.unit || '')}" ${disabledAttr}></div></div></div><div class="row"><div class="col-md-6"><div class="form-group"><label>Work Place</label><input type="text" class="form-control" value="${escapeHtml(employee.workplace || '')}" ${disabledAttr}></div></div><div class="col-md-6"><div class="form-group"><label>Reporting Authority</label><input type="text" class="form-control" value="${escapeHtml(employee.reporting_authority || '')}" ${disabledAttr}></div></div></div></div><div class="alert alert-info"><i class="fa fa-info-circle"></i> As an ICD user, you need to configure team workload targets for each edition before proceeding to Self Evaluation.</div>${teamWorkloadHtml}`;
  document.getElementById('registrationModalBody').innerHTML = modalHtml;
}

async function saveRegistrationFromModal() {
  if (!currentRegistrationEmpCode) return;
  var teamWorkloads = {};
  var editionBoxes = document.querySelectorAll('#regModalTeamWorkloadContainer .subcentre-workload-box');
  for (var i = 0; i < editionBoxes.length; i++) {
    var box = editionBoxes[i];
    var titleElem = box.querySelector('.subcentre-title');
    var editionText = titleElem.innerText;
    var edition = editionText.replace('Edition:', '').trim();
    var safeKey = edition.replace(/[^a-zA-Z0-9]/g, '_');
    var mainPages = parseInt(document.getElementById('reg_main_pages_' + safeKey).value) || 0;
    var helloPages = parseInt(document.getElementById('reg_hello_pages_' + safeKey).value) || 0;
    teamWorkloads[edition] = { main_pages: mainPages, hello_pages: helloPages };
  }
  showToast('Registering...', 'info');
  try {
    var result = await callServer("registerEmployeeFromMaster", { emp_code: currentRegistrationEmpCode, team_workloads: teamWorkloads });
    if (result.success) {
      showToast(result.message, 'success');
      $('#registrationModal').modal('hide');
      setTimeout(function() { openSelfEvaluationModal(currentRegistrationEmpCode, currentRegistrationEmpData ? currentRegistrationEmpData.name : currentRegistrationEmpCode, true, false); }, 500);
    } else showToast('Registration failed: ' + result.message, 'error');
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}