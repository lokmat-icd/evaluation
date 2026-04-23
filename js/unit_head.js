// ==================== UNIT HEAD AUTHENTICATION ====================
async function authenticateUnitHead() {
  var email = document.getElementById('unithead_email').value;
  var secretCode = document.getElementById('unithead_secret_code').value;
  if(!email || !secretCode) { showToast('Please enter email and secret code', 'error'); return; }
  try {
    var result = await callServer("authenticateUser", { email: email, secretCode: secretCode });
    if(result.success && result.position === 'Unit Head') {
      authenticatedUnitHead = result;
      document.getElementById('unitHeadProtectedContent').style.display = 'block';
      document.getElementById('unitHeadAuthSection').style.display = 'none';
      showToast(result.message, 'success');
      updateLogoutButton();
      loadEmployeesForUnitHead(result.unit);
    } else showToast(result.success ? 'Access denied. Unit Head access only.' : result.message, 'error');
  } catch(error) { showToast('Authentication failed: ' + error.message, 'error'); }
}

async function loadEmployeesForUnitHead(unitPrefix) {
  var teamListDiv = document.getElementById('unitHeadTeamList');
  teamListDiv.innerHTML = '<div class="loading"><i class="fa fa-spinner fa-spin"></i> Loading employees...</div>';
  var unitHeadName = authenticatedUnitHead ? authenticatedUnitHead.name : '';
  try {
    var result = await callServer("getEmployeesByUnitPrefix", { unitPrefix: unitPrefix, unitHeadName: unitHeadName });
    if(result.success && result.employees && result.employees.length > 0) {
      var workplaceCounts = {}, totalAssessed = 0, totalApproved = 0, totalEmployees = 0;
      for (var i = 0; i < result.employees.length; i++) {
        var emp = result.employees[i];
        var workplace = emp.workplace || 'Unknown';
        if (!workplaceCounts[workplace]) workplaceCounts[workplace] = { total: 0, hodCompleted: 0, unitHeadApproved: 0 };
        workplaceCounts[workplace].total++;
        totalEmployees++;
        var hodComplete = emp.hodRatings && emp.hodRatings.page_layout > 0 && emp.hodRatings.deadline_adherence > 0 && emp.hodRatings.quality_accuracy > 0 && emp.hodRatings.advertising_integration > 0 && emp.hodRatings.platform_adaptation > 0 && emp.hodRatings.collaboration > 0;
        if (hodComplete) { workplaceCounts[workplace].hodCompleted++; totalAssessed++; }
        if (emp.status === 'Assessed-UH') { workplaceCounts[workplace].unitHeadApproved++; totalApproved++; }
      }
      var filterDiv = document.getElementById('unitHeadWorkplaceFilters');
      if (Object.keys(workplaceCounts).length > 0) {
        filterDiv.style.display = 'flex';
        var filterHtml = '<button class="btn btn-default filter-btn active-filter" onclick="filterUnitHeadByWorkplace(\'\')"><i class="fa fa-list"></i> All Workplaces (Approved: ' + totalApproved + '/' + totalAssessed + ' HOD Completed)</button>';
        for (var wp in workplaceCounts) {
          filterHtml += '<button class="btn btn-default filter-btn" onclick="filterUnitHeadByWorkplace(\'' + wp.replace(/'/g, "\\'") + '\')"><i class="fa fa-location-arrow"></i> ' + wp + ' (' + workplaceCounts[wp].unitHeadApproved + '/' + workplaceCounts[wp].hodCompleted + ')</button>';
        }
        filterDiv.innerHTML = filterHtml;
      } else filterDiv.style.display = 'none';
      unitHeadEmployeesCache = result.employees;
      displayUnitHeadEmployeeCards(result.employees, '');
    } else teamListDiv.innerHTML = '<div class="alert alert-info">No employees found reporting to you in unit: ' + unitPrefix + '</div>';
  } catch(error) { teamListDiv.innerHTML = '<div class="alert alert-danger">Error loading employees: ' + error.message + '</div>'; }
}

function filterUnitHeadByWorkplace(workplace) {
  currentSelectedUnitHeadWorkplace = workplace;
  var buttons = document.querySelectorAll('#unitHeadWorkplaceFilters .filter-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('active-filter');
    var btnText = buttons[i].innerText.trim();
    if (workplace === '' && btnText.startsWith('All Workplaces')) buttons[i].classList.add('active-filter');
    else if (workplace !== '' && btnText.startsWith(workplace)) buttons[i].classList.add('active-filter');
  }
  if (unitHeadEmployeesCache) displayUnitHeadEmployeeCards(unitHeadEmployeesCache, workplace);
}

function displayUnitHeadEmployeeCards(employees, workplaceFilter) {
  var teamListDiv = document.getElementById('unitHeadTeamList');
  var filteredEmployees = employees;
  if (workplaceFilter && workplaceFilter !== '') filteredEmployees = employees.filter(function(emp) { return emp.workplace === workplaceFilter; });
  if (filteredEmployees.length === 0) { teamListDiv.innerHTML = '<div class="alert alert-info">No employees found' + (workplaceFilter ? ' for workplace: ' + workplaceFilter : '') + '</div>'; return; }
  var html = '<h4>Team Members <span class="badge">' + filteredEmployees.length + '</span></h4>';
  for (var i = 0; i < filteredEmployees.length; i++) {
    var member = filteredEmployees[i];
    var isICDEmployee = member.isICD === true;
    var statusClass = member.completion === 'Yes' ? 'status-submitted' : 'status-pending';
    var statusText = member.completion === 'Yes' ? '✓ Self Evaluation Submitted' : '📝 Draft';
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
    var hodComplete = !isICDEmployee && member.hodRatings && member.hodRatings.page_layout > 0 && member.hodRatings.deadline_adherence > 0 && member.hodRatings.quality_accuracy > 0 && member.hodRatings.advertising_integration > 0 && member.hodRatings.platform_adaptation > 0 && member.hodRatings.collaboration > 0;
    var hodEvaluationHtml = '';
    if (hodComplete && !isICDEmployee) {
      var hodTotal = (member.hodRatings.page_layout||0)+(member.hodRatings.deadline_adherence||0)+(member.hodRatings.quality_accuracy||0)+(member.hodRatings.advertising_integration||0)+(member.hodRatings.platform_adaptation||0)+(member.hodRatings.collaboration||0);
      var hodPercentage = (hodTotal/30)*100;
      var hodScoreOutOf10 = Math.round((hodPercentage/100)*10*10)/10;
      var levelText = '', levelColor = '', textColor = '';
      if (hodPercentage >= 80) { levelText = 'DE - Distinguished Expert'; levelColor = '#28a745'; textColor = 'white'; }
      else if (hodPercentage >= 50) { levelText = 'ME - Meets Expectations'; levelColor = '#ffc107'; textColor = '#1e3c72'; }
      else { levelText = 'NI - Needs Improvement'; levelColor = '#dc3545'; textColor = 'white'; }
      hodEvaluationHtml = `<div style="background: #f8fafc; border-radius: 16px; padding: 12px 16px; margin: 12px 0; border: 1px solid #e2e8f0;"><div><i class="fa fa-star" style="color:#1e3c72;"></i> <strong>📋 Evaluation by ICD/Branch Head</strong></div><div style="margin: 8px 0;"><span>⭐ Score: <strong>${hodScoreOutOf10}/10</strong></span><span style="margin-left: 12px; background: ${levelColor}; color: ${textColor}; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: bold;">${levelText}</span></div><div style="background: white; padding: 8px 12px; border-radius: 12px; font-size: 12px; color: #2c3e50; border-left: 3px solid #1e3c72; margin-top: 8px;">💬 ${member.hodComments ? escapeHtml(member.hodComments) : 'No comments yet'}</div></div>`;
    }
    var vhComplete = member.vhEvaluation && member.vhEvaluation.performance_rating && member.vhEvaluation.performance_rating !== '';
    var canPrintPdf = vhComplete;
    var buttonHtml = '';
    if (isICDEmployee) {
      if (member.status === "Pending") buttonHtml = '<button class="btn btn-sm btn-primary" onclick="openUnitHeadEval(\'' + member.code + '\', \'' + escapeHtml(member.name) + '\')"><i class="fa fa-pencil-square-o"></i> Evaluate</button>';
      else if (member.status === "Assessed") buttonHtml = '<button class="btn btn-sm btn-success" onclick="approveUnitHeadEvaluation(\'' + member.code + '\', \'' + escapeHtml(member.name) + '\')" style="margin-right: 8px;"><i class="fa fa-check-circle"></i> Approve</button><button class="btn btn-sm btn-warning" onclick="openUnitHeadEval(\'' + member.code + '\', \'' + escapeHtml(member.name) + '\')"><i class="fa fa-pencil-square-o"></i> Modify Rating</button>';
      else if (member.status === "Assessed-UH") buttonHtml = '<button class="btn btn-sm btn-warning" onclick="openUnitHeadEval(\'' + member.code + '\', \'' + escapeHtml(member.name) + '\')"><i class="fa fa-pencil-square-o"></i> Modify Rating</button>';
    } else {
      if (member.status === "Assessed") buttonHtml = '<button class="btn btn-sm btn-success" onclick="approveUnitHeadEvaluation(\'' + member.code + '\', \'' + escapeHtml(member.name) + '\')" style="margin-right: 8px;"><i class="fa fa-check-circle"></i> Approve</button><button class="btn btn-sm btn-warning" onclick="openUnitHeadEval(\'' + member.code + '\', \'' + escapeHtml(member.name) + '\')"><i class="fa fa-pencil-square-o"></i> Modify Rating</button>';
      else if (member.status === "Assessed-UH") buttonHtml = '<button class="btn btn-sm btn-warning" onclick="openUnitHeadEval(\'' + member.code + '\', \'' + escapeHtml(member.name) + '\')"><i class="fa fa-pencil-square-o"></i> Modify Rating</button>';
    }
    var icdBadge = isICDEmployee ? '<span class="label label-info" style="margin-left: 10px; background-color: #ff9800;"><i class="fa fa-users"></i> ICD</span>' : '';
    var hodStatusText = isICDEmployee ? (member.status === "Assessed" || member.status === "Assessed-UH" ? '✓ Complete' : '⏳ Pending') : (hodComplete ? '✓ Complete' : '⏳ Pending');
    var hodStatusClass = (hodStatusText === '✓ Complete') ? 'status-complete' : 'status-pending';
    var unitHeadStatusText = (member.status === "Assessed-UH") ? '✓ Approved' : ((member.status === "Assessed") ? '⏳ Pending Approval' : '⏳ Pending');
    var unitHeadStatusClass = (member.status === "Assessed-UH") ? 'status-complete' : 'status-pending';
    html += `<div class="team-member-card" style="${member.status === 'Assessed-UH' ? 'background: #e8f8e8; border-left: 4px solid #28a745;' : ''}"><div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; margin-bottom: 10px;"><div style="flex: 1;"><strong style="font-size: 16px;"><i class="fa fa-user"></i> ${escapeHtml(member.name)}</strong>${icdBadge}<br><small><i class="fa fa-briefcase"></i> ${escapeHtml(member.designation || 'N/A')} | <i class="fa fa-building"></i> ${escapeHtml(member.unit)}</small><br><small><i class="fa fa-map-marker"></i> Workplace: ${escapeHtml(member.workplace || 'N/A')} | <i class="fa fa-id-card"></i> Code: ${escapeHtml(member.code)}</small>${workloadHtml}</div><div style="text-align: right;"><span class="remark-badge ${statusClass}">${statusText}</span><span class="remark-badge ${hodStatusClass}">HOD: ${hodStatusText}</span><span class="remark-badge ${unitHeadStatusClass}">Unit Head: ${unitHeadStatusText}</span><span class="remark-badge ${vhComplete ? 'status-complete' : 'status-pending'}">VH: ${vhComplete ? '✓ Complete' : '⏳ Pending'}</span></div></div>${dailyWorkloadHtml}${jobDescriptionHtml}${specialProjectsHtml}${hodEvaluationHtml}<div style="margin-top: 15px; text-align: right; border-top: 1px solid #eee; padding-top: 12px;">${buttonHtml}${canPrintPdf ? '<button class="btn btn-sm btn-info" onclick="printEvaluationReport(\'' + escapeHtml(member.code) + '\', \'' + escapeHtml(member.name) + '\')"><i class="fa fa-print"></i> PDF Report</button>' : '<button class="btn btn-sm btn-default" disabled style="opacity: 0.5;" title="VH evaluation required first">PDF Report</button>'}</div></div>`;
  }
  teamListDiv.innerHTML = html;
}

async function openUnitHeadEval(empCode, empName) {
  window.currentUserRole = 'Unit Head';
  try {
    var empData = await callServer("getEmployeeForHODEval", { empCode: empCode });
    if (empData.exists) {
      var hodResult = await callServer("getHODEvaluation", { empCode: empCode });
      var existingRatings = {}, existingComments = '', existingOverallLevel = '';
      if (hodResult.evaluations && hodResult.evaluations.length > 0) {
        existingRatings = hodResult.evaluations[0].kraRatings || {};
        existingComments = hodResult.evaluations[0].comments || '';
        existingOverallLevel = hodResult.evaluations[0].overallLevel || '';
      }
      openHODEvaluationModal(empCode, empName, true, existingRatings, existingComments, existingOverallLevel, empData.selfRatings, false);
    } else showToast('Employee data not found', 'error');
  } catch(error) { showToast('Error loading employee data: ' + error.message, 'error'); }
}

async function approveUnitHeadEvaluation(empCode, empName) {
  showToast('Approving...', 'info');
  try {
    var result = await callServer("saveUnitHeadApproval", { emp_code: empCode });
    if (result.success) {
      showToast(result.message, 'success');
      if (authenticatedUnitHead && authenticatedUnitHead.unit) loadEmployeesForUnitHead(authenticatedUnitHead.unit);
    } else showToast('Error: ' + result.message, 'error');
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}