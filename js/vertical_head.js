// ==================== VERTICAL HEAD AUTHENTICATION ====================
async function authenticateVerticalHead() {
  var email = document.getElementById('vh_email').value;
  var secretCode = document.getElementById('vh_secret_code').value;
  if(!email || !secretCode) { showToast('Please enter email and secret code', 'error'); return; }
  try {
    var result = await callServer("authenticateUser", { email: email, secretCode: secretCode });
    if(result.success && result.position === 'Vertical Head') {
      authenticatedUser = result;
      document.getElementById('vhProtectedContent').style.display = 'block';
      document.getElementById('vhAuthSection').style.display = 'none';
      showToast(result.message, 'success');
      updateLogoutButton();
      generateCentreButtons();
    } else { showToast('Access denied. Only Vertical Head can access this tab.', 'error'); document.getElementById('vhAuthSection').style.display = 'block'; document.getElementById('vhProtectedContent').style.display = 'none'; }
  } catch(error) { showToast('Authentication failed: ' + error.message, 'error'); }
}

async function generateCentreButtons() {
  var container = document.getElementById('centreButtonsContainer');
  container.innerHTML = '<div class="loading"><i class="fa fa-spinner fa-spin"></i> Loading centres...</div>';
  var centresWithCounts = [];
  for (var c = 0; c < CENTRES.length; c++) {
    var centre = CENTRES[c];
    try {
      var result = await callServer("getCentreEmployeeCountsWithTotal", { centre: centre });
      var total = result.totalCount || 0;
      var completed = result.completedCount || 0;
      centresWithCounts.push({ centre: centre, total: total, completed: completed });
    } catch(err) { centresWithCounts.push({ centre: centre, total: 0, completed: 0 }); }
  }
  renderCentreButtons(centresWithCounts);
}

function renderCentreButtons(centresWithCounts) {
  var container = document.getElementById('centreButtonsContainer');
  var html = '';
  for (var i = 0; i < centresWithCounts.length; i++) {
    var item = centresWithCounts[i];
    var centre = item.centre;
    var total = item.total;
    var completed = item.completed;
    var displayText = total > 0 ? centre + ' (' + completed + '/' + total + ')' : centre;
    html += '<button class="btn btn-default filter-btn centre-btn" onclick="selectCentre(\'' + centre.replace(/'/g, "\\'") + '\')"><i class="fa fa-building"></i> ' + displayText + '</button>';
  }
  container.innerHTML = html;
}

async function selectCentre(centre) {
  currentSelectedCentre = centre;
  currentSelectedWorkplace = null;
  var buttons = document.querySelectorAll('.centre-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('active-filter');
    if (buttons[i].innerText.trim().startsWith(centre)) buttons[i].classList.add('active-filter');
  }
  try {
    var result = await callServer("getWorkplacesByUnitWithTotal", { unit: centre });
    if (result.success && result.workplaces && result.workplaces.length > 0) {
      var filterDiv = document.getElementById('vhWorkplaceFilters');
      filterDiv.style.display = 'flex';
      var totalCompleted = 0, totalEmployees = 0;
      for (var i = 0; i < result.workplaces.length; i++) { totalCompleted += result.workplaces[i].completed; totalEmployees += result.workplaces[i].total; }
      var filterHtml = '<button class="btn btn-default filter-btn active-filter" onclick="filterVHByWorkplace(\'\')"><i class="fa fa-list"></i> All Workplaces (' + totalCompleted + '/' + totalEmployees + ')</button>';
      for (var i = 0; i < result.workplaces.length; i++) {
        var wp = result.workplaces[i];
        filterHtml += '<button class="btn btn-default filter-btn" onclick="filterVHByWorkplace(\'' + wp.name.replace(/'/g, "\\'") + '\')"><i class="fa fa-location-arrow"></i> ' + wp.name + ' (' + wp.completed + '/' + wp.total + ')</button>';
      }
      filterDiv.innerHTML = filterHtml;
      currentSelectedWorkplace = '';
    } else document.getElementById('vhWorkplaceFilters').style.display = 'none';
    loadEmployeesByCentre(centre, '');
  } catch(error) { showToast('Error loading workplaces: ' + error.message, 'error'); }
}

function filterVHByWorkplace(workplace) {
  currentSelectedWorkplace = workplace;
  var buttons = document.querySelectorAll('#vhWorkplaceFilters .filter-btn');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove('active-filter');
    var btnText = buttons[i].innerText.trim();
    if (workplace === '' && btnText.startsWith('All Workplaces')) buttons[i].classList.add('active-filter');
    else if (workplace !== '' && btnText.startsWith(workplace)) buttons[i].classList.add('active-filter');
  }
  if (currentSelectedCentre) loadEmployeesByCentre(currentSelectedCentre, workplace);
}

async function loadEmployeesByCentre(centre, workplaceFilter) {
  var employeeListDiv = document.getElementById('employeeList');
  employeeListDiv.innerHTML = '<div class="loading"><i class="fa fa-spinner fa-spin"></i> Loading employees...</div>';
  try {
    var result = await callServer("getEmployeesByCentre", { centre: centre });
    if (result.success && result.employees && result.employees.length > 0) {
      var countsResult = await callServer("getWorkplaceEmployeeCountsWithTotal", { centre: centre });
      var workplaceCounts = countsResult.workplaceCounts || {};
      var totalCompleted = countsResult.totalCompleted || 0;
      var totalEmployees = countsResult.totalEmployees || 0;
      var filterDiv = document.getElementById('vhWorkplaceFilters');
      if (filterDiv.style.display === 'flex') {
        var filterHtml = '<button class="btn btn-default filter-btn ' + (currentSelectedWorkplace === '' ? 'active-filter' : '') + '" onclick="filterVHByWorkplace(\'\')"><i class="fa fa-list"></i> All Workplaces (' + totalCompleted + '/' + totalEmployees + ')</button>';
        var workplaces = Object.keys(workplaceCounts);
        for (var i = 0; i < workplaces.length; i++) {
          var wp = workplaces[i];
          var completed = workplaceCounts[wp].completed;
          var total = workplaceCounts[wp].total;
          filterHtml += '<button class="btn btn-default filter-btn ' + (currentSelectedWorkplace === wp ? 'active-filter' : '') + '" onclick="filterVHByWorkplace(\'' + wp.replace(/'/g, "\\'") + '\')"><i class="fa fa-location-arrow"></i> ' + wp + ' (' + completed + '/' + total + ')</button>';
        }
        filterDiv.innerHTML = filterHtml;
      }
      displayVHEmployeeCards(result.employees, workplaceFilter);
    } else employeeListDiv.innerHTML = '<div class="alert alert-info">No employees have submitted self evaluation for centre: ' + centre + '</div>';
  } catch(error) { employeeListDiv.innerHTML = '<div class="alert alert-danger">Error loading employees: ' + error.message + '</div>'; }
}

function displayVHEmployeeCards(employees, workplaceFilter) {
  var filteredByWorkplace = employees;
  if (workplaceFilter && workplaceFilter !== '') filteredByWorkplace = employees.filter(function(emp) { return emp.workplace === workplaceFilter; });
  var completeEmployees = filteredByWorkplace.filter(function(emp) { return emp.status === "Assessed-UH"; });
  var totalEmployees = filteredByWorkplace.length;
  var workplaceDisplay = workplaceFilter ? 'Workplace: ' + workplaceFilter : 'All Workplaces';
  var teamPaginationScore = 0, teamOtherWorkScore = 0, employeeScores = [];
  for (var i = 0; i < completeEmployees.length; i++) {
    var emp = completeEmployees[i];
    var pagScore = calculatePaginationScore(emp.dailyWorkload);
    var othScore = calculateOtherWorkScore(emp.dailyWorkload);
    employeeScores.push({ emp: emp, paginationScore: pagScore, otherWorkScore: othScore });
    teamPaginationScore += pagScore;
    teamOtherWorkScore += othScore;
  }
  if (completeEmployees.length === 0) {
    document.getElementById('employeeList').innerHTML = '<div class="alert alert-info">No employees with completed evaluation (Assessed-UH) found for ' + workplaceDisplay + ' (Total: ' + totalEmployees + ' employees have submitted self evaluation).</div>';
    return;
  }
  var html = '<div class="panel panel-default"><div class="panel-heading"><strong><i class="fa fa-building"></i> Centre: ' + currentSelectedCentre + '</strong> - ' + workplaceDisplay + ' <span class="badge pull-right">Completed: ' + completeEmployees.length + ' / ' + totalEmployees + '</span></div><div class="panel-body">';
  for (var i = 0; i < employeeScores.length; i++) {
    var item = employeeScores[i];
    var emp = item.emp;
    var pagScore = item.paginationScore;
    var othScore = item.otherWorkScore;
    var pagPercent = teamPaginationScore > 0 ? Math.round((pagScore / teamPaginationScore) * 100) : 0;
    var othPercent = teamOtherWorkScore > 0 ? Math.round((othScore / teamOtherWorkScore) * 100) : 0;
    var pagDeg = Math.round((pagPercent / 100) * 360);
    var pagGrad = pagPercent > 0 ? 'conic-gradient(#1e3c72 0deg ' + pagDeg + 'deg, #e0e0e0 ' + pagDeg + 'deg 360deg)' : 'conic-gradient(#e0e0e0 0deg 360deg)';
    var othDeg = Math.round((othPercent / 100) * 360);
    var othGrad = othPercent > 0 ? 'conic-gradient(#ff9800 0deg ' + othDeg + 'deg, #e0e0e0 ' + othDeg + 'deg 360deg)' : 'conic-gradient(#e0e0e0 0deg 360deg)';
    var hodTotal = (emp.hodRatings.page_layout||0)+(emp.hodRatings.deadline_adherence||0)+(emp.hodRatings.quality_accuracy||0)+(emp.hodRatings.advertising_integration||0)+(emp.hodRatings.platform_adaptation||0)+(emp.hodRatings.collaboration||0);
    var performanceOutOf10 = Math.round((hodTotal / 30) * 10 * 10) / 10;
    var levelText = '', levelColor = '';
    if (emp.hodOverallLevel === 'DE') { levelText = 'DE - Distinguished Expert'; levelColor = '#28a745'; }
    else if (emp.hodOverallLevel === 'ME') { levelText = 'ME - Meets Expectations'; levelColor = '#ffc107'; }
    else if (emp.hodOverallLevel === 'NI') { levelText = 'NI - Needs Improvement'; levelColor = '#dc3545'; }
    else { levelText = emp.hodOverallLevel || 'Not Assessed'; levelColor = '#6c757d'; }
    var vhPerformanceRating = emp.vhEvaluation ? (emp.vhEvaluation.performance_rating || '') : '';
    var vhOverallLevel = emp.vhEvaluation ? (emp.vhEvaluation.overall_level_text || '') : '';
    var vhRemark = emp.vhEvaluation ? (emp.vhEvaluation.remark || '') : '';
    var perfOptions = '';
    for (var p = 1; p <= 10; p++) { perfOptions += '<option value="' + p + '" ' + (vhPerformanceRating == p ? 'selected' : '') + '>' + p + '</option>'; }
    var workloadDisplay = formatTeamWorkloadDisplay(emp.teamWorkload);
    var workloadHtml = workloadDisplay ? '<div class="workload-line" style="margin-top: 8px;"><i class="fa fa-tasks"></i> ' + workloadDisplay + '</div>' : '';
    var workloadItems = [];
    var dw = emp.dailyWorkload || {};
    if (dw.main_full_page_design) workloadItems.push(dw.main_full_page_design + ' Main Full');
    if (dw.main_page_alter_ad_schedule) workloadItems.push(dw.main_page_alter_ad_schedule + ' Main Alter Ad');
    if (dw.main_page_alter_news_update) workloadItems.push(dw.main_page_alter_news_update + ' Main Alter News');
    if (dw.hello_full_page_design) workloadItems.push(dw.hello_full_page_design + ' Hello Full');
    if (dw.display_ad_design) workloadItems.push(dw.display_ad_design + ' Display Ad');
    if (dw.supplement_design) workloadItems.push(dw.supplement_design + ' Supplement');
    var workloadChips = '';
    for (var w = 0; w < Math.min(workloadItems.length, 5); w++) workloadChips += '<span class="workload-chip" style="background:#eef2ff; padding:4px 10px; border-radius:20px; font-size:11px; display:inline-block; margin:2px;">📄 ' + workloadItems[w] + '</span>';
    var specialText = '';
    if (typeof emp.specialProjects === 'string') specialText = emp.specialProjects;
    else if (emp.specialProjects && typeof emp.specialProjects === 'object') {
      if (emp.specialProjects.completed) specialText += emp.specialProjects.completed;
      if (emp.specialProjects.upcoming) specialText += ' ' + emp.specialProjects.upcoming;
      if (emp.specialProjects.achievements) specialText += ' ' + emp.specialProjects.achievements;
    }
    var specialShort = specialText ? (specialText.length > 70 ? specialText.substring(0, 70) + '...' : specialText) : '';
    html += `<div class="employee-card" style="background: white; border: 1px solid #e0e0e0; border-radius: 12px; margin-bottom: 24px; padding: 18px;"><div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #eee;"><div><strong style="font-size: 16px; color: #1e3c72;"><i class="fa fa-user-circle"></i> ${escapeHtml(emp.name)}</strong><span style="font-size: 12px; color: #888; margin-left: 5px;">(${escapeHtml(emp.designation || 'N/A')})</span><br><small><i class="fa fa-map-marker"></i> ${escapeHtml(emp.workplace || 'N/A')} | <i class="fa fa-id-card"></i> ${escapeHtml(emp.code)}</small>${workloadHtml}</div><div style="text-align: right;"><button class="btn btn-sm btn-info" onclick="openSelfEvaluationModal('${emp.code}', '${escapeHtml(emp.name)}', true, false)" style="margin-right: 5px;"><i class="fa fa-star"></i> Self-Evaluation</button><button class="btn btn-sm btn-primary" onclick="openHODEvalForVerticalHead('${emp.code}', '${escapeHtml(emp.name)}')"><i class="fa fa-users"></i> HOD-Evaluation</button></div></div><div style="background: #f1f5f9; border-radius: 12px; padding: 10px 14px; margin-bottom: 18px;"><div><i class="fa fa-tasks"></i> <strong>Workload:</strong> ${workloadChips || '—'}</div>${specialShort ? '<div style="margin-top: 6px;"><i class="fa fa-rocket"></i> <strong>Special:</strong> ' + escapeHtml(specialShort) + '</div>' : ''}</div><div style="display: flex; flex-wrap: wrap; gap: 20px;"><div style="flex: 1; min-width: 250px; display: flex; flex-direction: column; gap: 20px;"><div style="background: #f8fafc; border-radius: 16px; padding: 16px; border: 1px solid #e2e8f0; flex: 1; display: flex; flex-direction: column;"><div><i class="fa fa-star" style="color:#1e3c72;"></i> <strong>📋 Evaluation by ICD/Branch Head</strong></div><div style="margin: 10px 0;"><span>⭐ Score: <strong>${performanceOutOf10}/10</strong></span><span style="margin-left: 12px; background: ${levelColor}; color: ${levelColor === '#ffc107' ? '#333' : 'white'}; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: bold;">${levelText}</span></div><div style="background: white; padding: 8px 12px; border-radius: 12px; font-size: 12px; color: #2c3e50; border-left: 3px solid #1e3c72; margin-top: 4px;">💬 ${emp.hodComments ? escapeHtml(emp.hodComments) : 'No comments yet'}</div></div><div style="background: #f8fafc; border-radius: 16px; padding: 16px; border: 1px solid #e2e8f0; flex: 1; display: flex; flex-direction: column;"><div><i class="fa fa-flag" style="color:#e68a00;"></i> <strong>🚩 Vertical Head Evaluation</strong></div><div style="margin-top: 10px;"><div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;"><div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 12px; font-weight: 500;">🎯 Rating:</span><select id="vh_performance_${emp.code}" class="form-control" style="width: 65px; display: inline-block; font-size: 12px; padding: 3px 5px;" onchange="updateAssessmentLevel('${emp.code}')"><option value="">--</option>${perfOptions}</select></div><div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 12px; font-weight: 500;">📊 Level:</span><input type="text" id="vh_level_display_${emp.code}" class="form-control" value="${escapeHtml(vhOverallLevel)}" readonly style="width: 160px; background-color: #eef2ff; font-size: 11px; padding: 3px 8px;"><input type="hidden" id="vh_level_${emp.code}" value="${escapeHtml(vhOverallLevel)}"></div></div><textarea id="vh_remark_${emp.code}" class="form-control" rows="2" style="resize: vertical; font-size: 12px; margin-bottom: 10px;" placeholder="Enter your remark...">${escapeHtml(vhRemark)}</textarea><div style="text-align: right;"><button class="btn btn-sm btn-success" onclick="saveVHEvaluation('${emp.code}')" style="padding: 3px 12px; font-size: 12px;"><i class="fa fa-save"></i> Save</button><button class="btn btn-sm btn-default" onclick="clearVHEvaluation('${emp.code}')" style="padding: 3px 12px; font-size: 12px; margin-left: 5px;"><i class="fa fa-undo"></i> Clear</button></div></div></div></div></div><div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 12px;"><div style="background: #f8fafc; border-radius: 14px; padding: 10px 12px; border: 1px solid #e2e8f0; flex: 1; text-align: center;"><div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">📄 Pagination Contribution Out of Total Pages</div><div style="display: flex; align-items: center; justify-content: center; gap: 12px;"><div style="width: 120px; height: 120px; border-radius: 50%; background: ${pagGrad}; position: relative; flex-shrink: 0;"><span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: #1e3c72;">${pagPercent}%</span></div><div style="font-size: 13px; font-weight: 500; color: #1e3c72;">${pagScore.toFixed(1)} <span style="font-size: 10px; font-weight: normal; color: #666;">points</span></div></div></div><div style="background: #f8fafc; border-radius: 14px; padding: 10px 12px; border: 1px solid #e2e8f0; flex: 1; text-align: center;"><div style="font-weight: 600; font-size: 13px; margin-bottom: 6px;">🎨 Ad Design, Event Creative, Photo, PDF etc.</div><div style="display: flex; align-items: center; justify-content: center; gap: 12px;"><div style="width: 120px; height: 120px; border-radius: 50%; background: ${othGrad}; position: relative; flex-shrink: 0;"><span style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; width: 72px; height: 72px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; color: #e68a00;">${othPercent}%</span></div><div style="font-size: 13px; font-weight: 500; color: #e68a00;">${othScore.toFixed(1)} <span style="font-size: 10px; font-weight: normal; color: #666;">points</span></div></div></div></div></div></div>`;
  }
  html += '</div></div>';
  document.getElementById('employeeList').innerHTML = html;
}

async function openHODEvalForVerticalHead(empCode, empName) {
  window.currentUserRole = 'Vertical Head';
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
    }
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}

function updateAssessmentLevel(empCode) {
  var ratingSelect = document.getElementById('vh_performance_' + empCode);
  var levelDisplay = document.getElementById('vh_level_display_' + empCode);
  var levelHidden = document.getElementById('vh_level_' + empCode);
  if (!ratingSelect || !levelDisplay || !levelHidden) return;
  var rating = ratingSelect.value;
  var level = '';
  if (rating && rating !== '') {
    var numRating = parseInt(rating);
    if (numRating >= 8 && numRating <= 10) level = 'DE - Distinguished Expert';
    else if (numRating >= 5 && numRating <= 7) level = 'ME - Meets Expectations';
    else if (numRating >= 1 && numRating <= 4) level = 'NI - Needs Improvement';
  }
  levelDisplay.value = level;
  levelHidden.value = level;
}

async function saveVHEvaluation(empCode) {
  var performanceSelect = document.getElementById('vh_performance_' + empCode);
  var performanceRating = performanceSelect ? performanceSelect.value : '';
  var levelHidden = document.getElementById('vh_level_' + empCode);
  var overallLevel = levelHidden ? levelHidden.value : '';
  var remarkTextarea = document.getElementById('vh_remark_' + empCode);
  var remark = remarkTextarea ? remarkTextarea.value : '';
  if (!performanceRating) { showToast('Please select Performance Rating (1-10) before saving.', 'error'); return; }
  if (!remark || remark.trim() === '') { showToast('Please enter a remark before saving.', 'error'); return; }
  var vhEvaluation = { performance_rating: parseInt(performanceRating), overall_level_text: overallLevel, remark: remark, evaluated_date: new Date().toISOString() };
  try {
    var result = await callServer("saveVHEvaluation", { emp_code: empCode, vh_evaluation: vhEvaluation });
    if (result.success) { showToast(result.message, 'success'); if (currentSelectedCentre) loadEmployeesByCentre(currentSelectedCentre, currentSelectedWorkplace || ''); }
    else showToast(result.message, 'error');
  } catch(error) { showToast('Error: ' + error.message, 'error'); }
}

function clearVHEvaluation(empCode) {
  var performanceSelect = document.getElementById('vh_performance_' + empCode);
  var levelDisplay = document.getElementById('vh_level_display_' + empCode);
  var levelHidden = document.getElementById('vh_level_' + empCode);
  var remarkTextarea = document.getElementById('vh_remark_' + empCode);
  if (performanceSelect) performanceSelect.value = '';
  if (levelDisplay) levelDisplay.value = '';
  if (levelHidden) levelHidden.value = '';
  if (remarkTextarea) remarkTextarea.value = '';
  showToast('Form cleared', 'info');
}