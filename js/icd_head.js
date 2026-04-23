// ==================== HOD / ICD AUTHENTICATION ====================
async function authenticateHOD() {
  var email = document.getElementById('hod_email').value;
  var secretCode = document.getElementById('hod_secret_code').value;
  if(!email || !secretCode) { showToast('Please enter email and secret code', 'error'); return; }
  try {
    var result = await callServer("authenticateUser", { email: email, secretCode: secretCode });
    if(result.success) {
      authenticatedUser = result;
      document.getElementById('hodProtectedContent').style.display = 'block';
      document.getElementById('hodAuthSection').style.display = 'none';
      showToast(result.message, 'success');
      updateLogoutButton();
      if(result.position === 'ICD') loadEmployeesForICD(result.unit, result.editions);
      else if(result.position === 'Head') loadTeamMembersForHead(result.name);
      else { showToast('Access denied. Only ICD and Head can access this tab.', 'error'); document.getElementById('hodProtectedContent').style.display = 'none'; document.getElementById('hodAuthSection').style.display = 'block'; }
    } else showToast(result.message, 'error');
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}

async function loadEmployeesForICD(unit, editionsList) {
  var teamListDiv = document.getElementById('hodTeamList');
  teamListDiv.innerHTML = '<div class="loading"><i class="fa fa-spinner fa-spin"></i> Loading employees...</div>';
  var icdEmpCode = authenticatedUser ? authenticatedUser.empCode : null;
  try {
    var workplacesResult = await callServer("getWorkplacesByUnitWithTotal", { unit: unit });
    if(workplacesResult.success && workplacesResult.workplaces.length > 0) {
      var filterDiv = document.getElementById('hodWorkplaceFilters');
      filterDiv.style.display = 'flex';
      var totalCompleted=0, totalEmployees=0;
      for(var i=0;i<workplacesResult.workplaces.length;i++) { totalCompleted+=workplacesResult.workplaces[i].completed; totalEmployees+=workplacesResult.workplaces[i].total; }
      var filterHtml = '<button class="btn btn-default filter-btn active-filter" onclick="filterHODByWorkplace(\'\')"><i class="fa fa-list"></i> All Workplaces ('+totalCompleted+'/'+totalEmployees+')</button>';
      for(var i=0;i<workplacesResult.workplaces.length;i++) { var wp=workplacesResult.workplaces[i]; filterHtml += '<button class="btn btn-default filter-btn" onclick="filterHODByWorkplace(\''+wp.name.replace(/'/g, "\\'")+'\')"><i class="fa fa-location-arrow"></i> '+wp.name+' ('+wp.completed+'/'+wp.total+')</button>'; }
      filterDiv.innerHTML = filterHtml;
      currentSelectedHODWorkplace = '';
    } else document.getElementById('hodWorkplaceFilters').style.display = 'none';
    
    var employeesResult = await callServer("getEmployeesByUnit", { unit: unit, excludeEmpCode: icdEmpCode });
    if(employeesResult.success && employeesResult.employees.length > 0) displayHODEmployeeCards(employeesResult.employees, '');
    else teamListDiv.innerHTML = '<div class="alert alert-info">No employees have submitted self evaluation yet for unit: '+unit+'</div>';
  } catch(error) { teamListDiv.innerHTML = '<div class="alert alert-danger">Error loading employees: '+error.message+'</div>'; }
}

async function loadTeamMembersForHead(headName) {
  var teamListDiv = document.getElementById('hodTeamList');
  teamListDiv.innerHTML = '<div class="loading"><i class="fa fa-spinner fa-spin"></i> Loading team members...</div>';
  document.getElementById('hodWorkplaceFilters').style.display = 'none';
  try {
    var result = await callServer("getTeamMembersByReportingAuthority", { reportingAuth: headName });
    if(result.success && result.team && result.team.length > 0) displayHODEmployeeCards(result.team, '');
    else teamListDiv.innerHTML = '<div class="alert alert-info">No team members have submitted self evaluation yet reporting to '+headName+'</div>';
  } catch(error) { teamListDiv.innerHTML = '<div class="alert alert-danger">Error loading team: '+error.message+'</div>'; }
}

async function filterHODByWorkplace(workplace) {
  currentSelectedHODWorkplace = workplace;
  var buttons = document.querySelectorAll('#hodWorkplaceFilters .filter-btn');
  for(var i=0;i<buttons.length;i++) {
    buttons[i].classList.remove('active-filter');
    var btnText = buttons[i].innerText.trim();
    if(workplace === '' && btnText.startsWith('All Workplaces')) buttons[i].classList.add('active-filter');
    else if(workplace !== '' && btnText.startsWith(workplace)) buttons[i].classList.add('active-filter');
  }
  if(authenticatedUser && authenticatedUser.unit) {
    try {
      var result = await callServer("getEmployeesByUnit", { unit: authenticatedUser.unit, excludeEmpCode: authenticatedUser.empCode });
      if(result.success && result.employees) displayHODEmployeeCards(result.employees, workplace);
    } catch(error) { console.error(error); }
  }
}

function displayHODEmployeeCards(employees, workplaceFilter) {
  var teamListDiv = document.getElementById('hodTeamList');
  var filteredEmployees = employees;
  if(workplaceFilter && workplaceFilter !== '') filteredEmployees = employees.filter(function(emp) { return emp.workplace === workplaceFilter; });
  var loggedInEmpCode = authenticatedUser ? authenticatedUser.empCode : null;
  var isICDUser = (authenticatedUser && authenticatedUser.position === 'ICD');
  var icdInList = filteredEmployees.some(function(emp) { return emp.code === loggedInEmpCode; });
  if(isICDUser && loggedInEmpCode && !icdInList) {
    callServer("getEmployeeRowData", { empCode: loggedInEmpCode }).then(function(icdData) {
      if(icdData.success && icdData.employee) {
        var icdEmployee = icdData.employee;
        icdEmployee.isICD = true;
        icdEmployee.isSelfCard = true;
        filteredEmployees.unshift(icdEmployee);
      }
      renderHODEmployeeCards(filteredEmployees, workplaceFilter, teamListDiv);
    }).catch(function(err) { renderHODEmployeeCards(filteredEmployees, workplaceFilter, teamListDiv); });
  } else renderHODEmployeeCards(filteredEmployees, workplaceFilter, teamListDiv);
}

function renderHODEmployeeCards(employees, workplaceFilter, teamListDiv) {
  if(employees.length === 0) { teamListDiv.innerHTML = '<div class="alert alert-info">No employees found' + (workplaceFilter ? ' for workplace: ' + workplaceFilter : '') + '</div>'; return; }
  var html = '<h4>Team Members <span class="badge">' + employees.length + '</span></h4>';
  var loggedInEmpCode = authenticatedUser ? authenticatedUser.empCode : null;
  var isICDUser = (authenticatedUser && authenticatedUser.position === 'ICD');
  for(var i=0;i<employees.length;i++) {
    var member = employees[i];
    var statusClass = member.completion === 'Yes' ? 'status-submitted' : 'status-pending';
    var statusText = member.completion === 'Yes' ? '✓ Self Evaluation Submitted' : '📝 Draft';
    var isSelfCard = (isICDUser && loggedInEmpCode === member.code);
    var workloadDisplay = formatTeamWorkloadDisplay(member.teamWorkload);
    var workloadHtml = workloadDisplay ? '<div class="workload-line"><i class="fa fa-tasks"></i> ' + workloadDisplay + '</div>' : '';
    var dailyWorkloadHtml = generateDailyWorkloadHTML(member.dailyWorkload);
    var jobDescription = '', specialProjectsText = '';
    if(member.specialProjects) {
      if(typeof member.specialProjects === 'object') { jobDescription = member.specialProjects.job_description || ''; specialProjectsText = member.specialProjects.special_projects || ''; }
      else if(typeof member.specialProjects === 'string') { try { var parsed = JSON.parse(member.specialProjects); jobDescription = parsed.job_description || ''; specialProjectsText = parsed.special_projects || ''; } catch(e) { specialProjectsText = member.specialProjects; } }
    }
    var jobDescriptionHtml = jobDescription && jobDescription.trim() !== '' ? '<div style="background: #f0f7ff; padding: 10px; margin: 10px 0; border-radius: 6px; border-left: 3px solid #1e3c72;"><strong><i class="fa fa-file-text"></i> 📋 Job Description:</strong><div style="white-space: pre-wrap; margin-top: 5px; font-size: 13px; color: #333;">'+escapeHtml(jobDescription)+'</div></div>' : '';
    var specialProjectsHtml = specialProjectsText && specialProjectsText.trim() !== '' ? '<div style="background: #e8f4fd; padding: 10px; margin: 10px 0; border-radius: 6px; border-left: 3px solid #ff9800;"><strong><i class="fa fa-rocket"></i> 🚀 Special Projects & Initiatives:</strong><div style="white-space: pre-wrap; margin-top: 5px; font-size: 13px;">'+escapeHtml(specialProjectsText)+'</div></div>' : '';
    var hodComplete = member.hodRatings && member.hodRatings.page_layout > 0 && member.hodRatings.deadline_adherence > 0 && member.hodRatings.quality_accuracy > 0 && member.hodRatings.advertising_integration > 0 && member.hodRatings.platform_adaptation > 0 && member.hodRatings.collaboration > 0;
    var unitHeadApproved = (member.status === "Assessed-UH");
    var unitHeadStatusText = unitHeadApproved ? '✓ Approved' : '⏳ Pending';
    var unitHeadStatusClass = unitHeadApproved ? 'status-complete' : 'status-pending';
    var vhComplete = member.vhEvaluation && member.vhEvaluation.performance_rating && member.vhEvaluation.performance_rating !== '';
    var canPrintPdf = vhComplete;
    var buttonHtml = isSelfCard ? '<button class="btn btn-sm btn-info" onclick="openHODEvalForHODTab(\''+escapeHtml(member.code)+'\', \''+escapeHtml(member.name)+'\', true)"><i class="fa fa-eye"></i> View My Evaluation</button>' : '<button class="btn btn-sm btn-primary" onclick="openHODEvalForHODTab(\''+escapeHtml(member.code)+'\', \''+escapeHtml(member.name)+'\', false)"><i class="fa fa-star"></i> Evaluate</button>';
    html += '<div class="team-member-card" '+(isSelfCard ? 'style="background: #f0f7ff; border-left: 4px solid #ff9800;"' : '')+'><div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; margin-bottom: 10px;"><div style="flex: 1;"><strong style="font-size: 16px;"><i class="fa fa-user"></i> '+escapeHtml(member.name)+'</strong>'+(isSelfCard ? '<span class="label label-warning" style="margin-left: 10px;"><i class="fa fa-user-circle"></i> You (ICD)</span>' : '')+(!isSelfCard && member.isICD ? '<span class="label label-info" style="margin-left: 10px; background-color: #ff9800;"><i class="fa fa-users"></i> ICD</span>' : '')+'<br><small><i class="fa fa-briefcase"></i> '+escapeHtml(member.designation || 'N/A')+' | <i class="fa fa-building"></i> '+escapeHtml(member.unit)+'</small><br><small><i class="fa fa-map-marker"></i> Workplace: '+escapeHtml(member.workplace || 'N/A')+' | <i class="fa fa-id-card"></i> Code: '+escapeHtml(member.code)+'</small>'+workloadHtml+'</div><div style="text-align: right;"><span class="remark-badge '+statusClass+'">'+statusText+'</span><span class="remark-badge '+(hodComplete ? 'status-complete' : 'status-pending')+'">HOD: '+(hodComplete ? '✓ Complete' : '⏳ Pending')+'</span><span class="remark-badge '+unitHeadStatusClass+'">Unit Head: '+unitHeadStatusText+'</span><span class="remark-badge '+(vhComplete ? 'status-complete' : 'status-pending')+'">VH: '+(vhComplete ? '✓ Complete' : '⏳ Pending')+'</span></div></div>'+dailyWorkloadHtml+jobDescriptionHtml+specialProjectsHtml+'<div style="margin-top: 15px; text-align: right; border-top: 1px solid #eee; padding-top: 12px;">'+buttonHtml+(canPrintPdf ? '<button class="btn btn-sm btn-info" onclick="printEvaluationReport(\''+escapeHtml(member.code)+'\', \''+escapeHtml(member.name)+'\')"><i class="fa fa-print"></i> PDF Report</button>' : '<button class="btn btn-sm btn-default" disabled style="opacity: 0.5;" title="VH evaluation required first">PDF Report</button>')+'</div></div>';
  }
  teamListDiv.innerHTML = html;
}

async function openHODEvalForHODTab(empCode, empName, isReadOnly) {
  currentEvalEmp = empCode;
  var isICDUser = (authenticatedUser && authenticatedUser.position === 'ICD');
  var loggedInEmpCode = authenticatedUser ? authenticatedUser.empCode : null;
  var isSelfCard = (isICDUser && loggedInEmpCode === empCode);
  var viewOnly = isReadOnly || isSelfCard;
  window.currentUserRole = authenticatedUser ? authenticatedUser.position : null;
  try {
    var empData = await callServer("getEmployeeForHODEval", { empCode: empCode });
    if (empData.exists) {
      var overallStatus = empData.overallStatus || "Pending";
      var hodComplete = empData.hodComplete || false;
      var canEdit = false;
      var isHeadUser = (authenticatedUser && authenticatedUser.position !== 'ICD');
      if (isHeadUser) canEdit = !hodComplete && !viewOnly;
      else if (isICDUser && !isSelfCard) canEdit = (overallStatus !== "Complete") && !viewOnly;
      else if (isICDUser && isSelfCard) canEdit = false;
      var hodResult = await callServer("getHODEvaluation", { empCode: empCode });
      var existingRatings = {}, existingComments = '', existingOverallLevel = '';
      if (hodResult.evaluations && hodResult.evaluations.length > 0) {
        existingRatings = hodResult.evaluations[0].kraRatings || {};
        existingComments = hodResult.evaluations[0].comments || '';
        existingOverallLevel = hodResult.evaluations[0].overallLevel || '';
      }
      openHODEvaluationModal(empCode, empName, canEdit, existingRatings, existingComments, existingOverallLevel, empData.selfRatings, viewOnly);
    }
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}

function openHODEvaluationModal(empCode, empName, isEditable, existingRatings, existingComments, existingOverallLevel, selfRatings, isViewOnly) {
  currentHODEvalEmpCode = empCode;
  currentHODEvalIsEditable = isEditable;
  if (isViewOnly) currentHODEvalIsEditable = false;
  var userRole = window.currentUserRole || (authenticatedUser ? authenticatedUser.position : null);
  var modalTitle = (userRole === 'Unit Head') ? 'Unit Head Evaluation' : 'Evaluation by ICD/Branch Head';
  if (isViewOnly) modalTitle = 'View Evaluation by ICD/Branch Head - ' + escapeHtml(empName) + ' (Read Only)';
  else modalTitle = modalTitle + ' - ' + escapeHtml(empName);
  document.getElementById('hodEvalModalTitle').innerHTML = modalTitle;
  var disabledAttr = currentHODEvalIsEditable ? '' : 'disabled';
  var selfRatingsHtml = selfRatings ? `<div style="background: #e8f4fd; padding: 12px; margin-bottom: 15px; border-radius: 8px;"><strong><i class="fa fa-info-circle"></i> Self Evaluation Ratings (Reference)</strong><div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; font-size: 12px;"><div>📄 Page Layout: ${selfRatings.page_layout || 0}/5</div><div>⏱️ Deadline Adherence: ${selfRatings.deadline_adherence || 0}/5</div><div>✅ Quality & Accuracy: ${selfRatings.quality_accuracy || 0}/5</div><div>📢 Advertising: ${selfRatings.advertising_integration || 0}/5</div><div>💻 Platform Adaptation: ${selfRatings.platform_adaptation || 0}/5</div><div>🤝 Collaboration: ${selfRatings.collaboration || 0}/5</div></div></div>` : '';
  var kraHtml = '';
  for (var i = 0; i < kraDefinitions.length; i++) {
    var kra = kraDefinitions[i];
    var ratingValue = existingRatings[kra.id] ? existingRatings[kra.id] : defaultRating;
    var optionsHtml = '';
    ratingOptions.forEach(function(opt) { optionsHtml += '<option value="' + opt + '" ' + (opt == ratingValue ? 'selected' : '') + '>' + opt + '</option>'; });
    kraHtml += `<div class="col-md-6"><div class="kra-box"><div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;"><h5 style="margin: 0;"><strong>${kra.name}</strong></h5><select id="modal_hod_kra_${kra.id}" class="form-control rating-select" style="width: 65px;" ${disabledAttr} onchange="updateHODModalLiveScore()" onfocus="this.select()">${optionsHtml}</select></div><div style="font-size: 11px; color: #666; margin-top: 8px;"><div><strong>KPI:</strong> ${kra.kpi}</div><div><strong>Target:</strong> ${kra.target}</div></div></div></div>`;
  }
  var viewOnlyWarning = isViewOnly ? '<div class="alert alert-info"><i class="fa fa-info-circle"></i> <strong>View Only Mode:</strong> You are viewing your own evaluation. No changes can be made.</div>' : '';
  var modalHtml = viewOnlyWarning + selfRatingsHtml + `<div class="panel panel-default"><div class="panel-heading" style="background-color: #1e3c72; color: white; display: flex; justify-content: space-between; align-items: center;"><strong><i class="fa fa-star"></i> KRA Performance Ratings (1-5 Scale)</strong><div><span id="modalHodLiveScoreDisplay" style="background: #ffc107; color: #1e3c72; padding: 3px 10px; border-radius: 15px; font-size: 12px;">Score: 0.0/10</span><span id="modalHodLiveLevelDisplay" style="background: #6c757d; color: white; padding: 3px 10px; border-radius: 15px; font-size: 12px; margin-left: 5px;">Level: Not Assessed</span></div></div><div class="panel-body"><div class="row">${kraHtml}</div></div></div><div class="form-group"><label>Comments</label><textarea id="modal_hod_comments" class="form-control" rows="3" ${disabledAttr} onfocus="this.select()">${escapeHtml(existingComments || '')}</textarea></div><input type="hidden" id="modal_hod_overall_level" value="${escapeHtml(existingOverallLevel || '')}">`;
  document.getElementById('hodEvalModalBody').innerHTML = modalHtml;
  var saveBtn = document.getElementById('hodEvalSaveBtn');
  if (saveBtn) saveBtn.style.display = (currentHODEvalIsEditable && !isViewOnly) ? 'inline-block' : 'none';
  updateHODModalLiveScore();
  $('#hodEvalModal').modal('show');
}

function updateHODModalLiveScore() {
  var kraIds = ['page_layout','deadline_adherence','quality_accuracy','advertising_integration','platform_adaptation','collaboration'];
  var hodTotal = 0;
  for (var i = 0; i < kraIds.length; i++) {
    var select = document.getElementById('modal_hod_kra_' + kraIds[i]);
    hodTotal += select ? parseFloat(select.value) || 0 : 0;
  }
  var percentage = (hodTotal / 30) * 100;
  var scoreOutOf10 = Math.round((percentage / 100) * 10 * 10) / 10;
  var assessmentLevel = '', levelCode = '', levelColor = '', textColor = '';
  if (percentage >= 80) { assessmentLevel = 'DE - Distinguished Expert'; levelCode = 'DE'; levelColor = '#28a745'; textColor = 'white'; }
  else if (percentage >= 50) { assessmentLevel = 'ME - Meets Expectations'; levelCode = 'ME'; levelColor = '#ffc107'; textColor = '#1e3c72'; }
  else { assessmentLevel = 'NI - Needs Improvement'; levelCode = 'NI'; levelColor = '#525252'; textColor = 'white'; }
  var scoreDisplay = document.getElementById('modalHodLiveScoreDisplay');
  if (scoreDisplay) { scoreDisplay.innerHTML = '⭐ Score: ' + scoreOutOf10 + '/10'; scoreDisplay.style.background = levelColor; scoreDisplay.style.color = textColor; }
  var levelDisplay = document.getElementById('modalHodLiveLevelDisplay');
  if (levelDisplay) { levelDisplay.innerHTML = '📊 Level: ' + assessmentLevel; levelDisplay.style.background = levelColor; levelDisplay.style.color = textColor; }
  var overallLevelInput = document.getElementById('modal_hod_overall_level');
  if (overallLevelInput) overallLevelInput.value = levelCode;
}

async function saveHODEvaluationFromModal() {
  if (!currentHODEvalIsEditable) { showToast('This evaluation is locked and cannot be edited.', 'warning'); return; }
  if (!currentHODEvalEmpCode) return;
  var kraIds = ['page_layout','deadline_adherence','quality_accuracy','advertising_integration','platform_adaptation','collaboration'];
  var allValid = true;
  for (var i = 0; i < kraIds.length; i++) {
    var val = parseFloat(document.getElementById('modal_hod_kra_' + kraIds[i]).value) || 0;
    if (val < 1 || val > 5) allValid = false;
  }
  if (!allValid) { showToast('Please provide ratings for all 6 KRAs', 'error'); return; }
  var comments = document.getElementById('modal_hod_comments').value;
  if (!comments.trim()) { showToast('Please enter comments', 'error'); return; }
  var overallLevel = document.getElementById('modal_hod_overall_level') ? document.getElementById('modal_hod_overall_level').value : '';
  var formObject = { emp_code: currentHODEvalEmpCode, comments: comments, overall_level: overallLevel };
  kraDefinitions.forEach(function(kra) { formObject[kra.id] = parseFloat(document.getElementById('modal_hod_kra_' + kra.id).value) || 0; });
  var userRole = window.currentUserRole || (authenticatedUser ? authenticatedUser.position : null);
  var action = 'saveHODEvaluation';
  if (userRole === 'Vertical Head') action = 'updateHODEvaluation';
  if (userRole === 'Unit Head') action = 'saveUnitHeadEvaluation';
  try {
    var result = await callServer(action, formObject);
    if (result.success) {
      showToast(result.message, 'success');
      $('#hodEvalModal').modal('hide');
      if (userRole === 'ICD' && authenticatedUser && authenticatedUser.unit) loadEmployeesForICD(authenticatedUser.unit, authenticatedUser.editions);
      else if (userRole === 'Head' && authenticatedUser && authenticatedUser.name) loadTeamMembersForHead(authenticatedUser.name);
      else if (userRole === 'Unit Head' && authenticatedUnitHead && authenticatedUnitHead.unit) loadEmployeesForUnitHead(authenticatedUnitHead.unit);
      else if (currentSelectedCentre) loadEmployeesByCentre(currentSelectedCentre, currentSelectedWorkplace || '');
    } else showToast('Error: ' + result.message, 'error');
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}

async function printEvaluationReport(empCode, empName) {
  var loadingDiv = document.createElement('div');
  loadingDiv.id = 'printLoading';
  loadingDiv.innerHTML = '<div style="position:fixed;top:50%;left:50%;background:white;padding:20px;border-radius:10px;z-index:10000;"><i class="fa fa-spinner fa-spin"></i> Generating report...</div>';
  document.body.appendChild(loadingDiv);
  try {
    var result = await callServer("generateEvaluationReport", { empCode: empCode });
    var loadingElem = document.getElementById('printLoading');
    if (loadingElem) loadingElem.remove();
    if (result.success) {
      var printWindow = window.open('', '_blank');
      printWindow.document.write(result.html);
      printWindow.document.close();
      printWindow.onload = function() { setTimeout(function() { printWindow.print(); }, 500); };
    } else showToast('Error: ' + result.message, 'error');
  } catch(error) {
    var loadingElem = document.getElementById('printLoading');
    if (loadingElem) loadingElem.remove();
    showToast('Error: ' + error.message, 'error');
  }
}