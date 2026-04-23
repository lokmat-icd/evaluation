// ==================== SELF EVALUATION MODAL ====================

function openSelfEvaluationModal(empCode, empName, isEditable, isSubmitted) {
  currentSelfEvalEmpCode = empCode;
  currentSelfEvalIsEditable = isEditable && !isSubmitted;
  currentSelfEvalIsSubmitted = isSubmitted;

  window.currentUserRole = authenticatedUser ? authenticatedUser.position : null;

  document.getElementById('selfEvalModalTitle').innerHTML = `Self Evaluation - ${escapeHtml(empName)}`;
  document.getElementById('selfEvalModalBody').innerHTML = '<div class="loading"><i class="fa fa-spinner fa-spin"></i> Loading self evaluation data...</div>';

  const saveBtn = document.getElementById('selfEvalSaveBtn');
  if (saveBtn) saveBtn.style.display = currentSelfEvalIsEditable ? 'inline-block' : 'none';

  $('#selfEvalModal').modal('show');

  Promise.all([
    callServer("getSelfEvaluation", { empCode: empCode }),
    callServer("getEmployeeFromMaster", { empCode: empCode })
  ]).then(([dataResult, masterResult]) => {
    const latest = (dataResult.evaluations && dataResult.evaluations.length) ? dataResult.evaluations[dataResult.evaluations.length - 1] : null;
    const employeeMaster = masterResult.success ? masterResult.employee : null;
    renderSelfEvalModalContent(latest, employeeMaster);
  }).catch(error => {
    console.error('Error loading self evaluation data:', error);
    renderSelfEvalModalContent(null, null);
  });
}

function renderSelfEvalModalContent(evalData, employeeMasterData) {
  const disabledAttr = currentSelfEvalIsEditable ? '' : 'disabled';
  const isDraftMode = (evalData && evalData.status === 'Draft');
  if (isDraftMode && !currentSelfEvalIsEditable) {
    currentSelfEvalIsEditable = true;
    // We'll re-render with enabled fields, but for simplicity just use disabledAttr as empty.
    // The function will be called again after state change? Better to re-call openSelfEvaluationModal.
    // But here we just adjust the attribute.
  }

  const empName = employeeMasterData ? employeeMasterData.name : '';
  const empCode = employeeMasterData ? employeeMasterData.code : currentSelfEvalEmpCode;
  const empDesignation = employeeMasterData ? employeeMasterData.designation : '';
  const empMobile = employeeMasterData ? employeeMasterData.mobile : '';
  const empUnit = employeeMasterData ? employeeMasterData.unit : '';
  const empWorkplace = employeeMasterData ? employeeMasterData.workplace : '';
  const empEmail = employeeMasterData ? employeeMasterData.email : '';
  const empDutyTimings = employeeMasterData ? employeeMasterData.duty_timings : '';

  let jobDescription = '', specialProjectsText = '';
  if (evalData && evalData.specialProjectsText) {
    try {
      const mColumnData = JSON.parse(evalData.specialProjectsText);
      jobDescription = mColumnData.job_description || '';
      specialProjectsText = mColumnData.special_projects || '';
    } catch(e) {
      specialProjectsText = evalData.specialProjectsText || '';
    }
  }

  let kraHtml = '';
  for (const kra of kraDefinitions) {
    const ratingValue = (evalData && evalData.kraRatings && evalData.kraRatings[kra.id]) ? evalData.kraRatings[kra.id] : defaultRating;
    let optionsHtml = '';
    ratingOptions.forEach(opt => {
      optionsHtml += `<option value="${opt}" ${opt == ratingValue ? 'selected' : ''}>${opt}</option>`;
    });
    kraHtml += `
      <div class="col-md-6">
        <div class="kra-box">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <h5 style="margin: 0;"><strong>${kra.name}</strong></h5>
            <select id="modal_kra_${kra.id}" class="form-control rating-select" style="width: 65px;" ${disabledAttr} onchange="updateSelfModalLiveScore()" onfocus="this.select()">
              ${optionsHtml}
            </select>
          </div>
          <div style="font-size: 11px; color: #666; margin-top: 8px;">
            <div><strong>KPI:</strong> ${kra.kpi}</div>
            <div><strong>Target:</strong> ${kra.target}</div>
          </div>
        </div>
      </div>
    `;
  }

  const dw = (evalData && evalData.dailyWorkload) ? evalData.dailyWorkload : {};
  let dutyHour = '', dutyMinute = '', dutyAmpm = 'PM';
  if (empDutyTimings) {
    const dutyMatch = empDutyTimings.toString().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (dutyMatch) {
      dutyHour = dutyMatch[1];
      dutyMinute = dutyMatch[2];
      dutyAmpm = dutyMatch[3].toUpperCase();
    }
  }

  const modalHtml = `
    <div class="employee-info-card" style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #1e3c72;">
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 15px;">
        <div><span class="info-label"><i class="fa fa-user"></i> Name:</span> <span class="info-value">${escapeHtml(empName)}</span></div>
        <div><span class="info-label"><i class="fa fa-id-card"></i> Employee Code:</span> <span class="info-value">${escapeHtml(empCode)}</span></div>
        <div><span class="info-label"><i class="fa fa-briefcase"></i> Designation:</span> <span class="info-value">${escapeHtml(empDesignation)}</span></div>
        <div><span class="info-label"><i class="fa fa-phone"></i> Mobile No.:</span> <span class="info-value">${escapeHtml(empMobile)}</span></div>
        <div><span class="info-label"><i class="fa fa-building"></i> Unit (Centre):</span> <span class="info-value">${escapeHtml(empUnit)}</span></div>
        <div><span class="info-label"><i class="fa fa-map-marker"></i> Work Place:</span> <span class="info-value">${escapeHtml(empWorkplace)}</span></div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; padding-top: 10px; border-top: 1px dashed #cce5ff;">
        <div>
          <span class="info-label"><i class="fa fa-envelope"></i> Email *:</span>
          <input type="email" class="form-control" id="modal_self_email" style="width: 100%; margin-top: 5px;" placeholder="Enter your email" value="${escapeHtml(empEmail)}" ${disabledAttr} onfocus="this.select()">
        </div>
        <div>
          <span class="info-label"><i class="fa fa-clock-o"></i> Duty In Time *:</span>
          <div class="duty-time-group" style="display: flex; align-items: center; gap: 5px; margin-top: 5px; flex-wrap: wrap;">
            <input type="text" class="form-control time-input" id="modal_self_duty_hour" placeholder="HH" maxlength="2" value="${dutyHour}" style="width: 70px;" ${disabledAttr} onfocus="this.select()">
            <span>:</span>
            <input type="text" class="form-control time-input" id="modal_self_duty_minute" placeholder="MM" maxlength="2" value="${dutyMinute}" style="width: 70px;" ${disabledAttr} onfocus="this.select()">
            <select class="form-control ampm-select" id="modal_self_duty_ampm" style="width: 85px;" ${disabledAttr} onfocus="this.select()">
              <option value="AM" ${dutyAmpm === 'AM' ? 'selected' : ''}>AM</option>
              <option value="PM" ${dutyAmpm === 'PM' ? 'selected' : ''}>PM</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    <div class="panel panel-default">
      <div class="panel-heading" style="background-color: #1e3c72; color: white; display: flex; justify-content: space-between; align-items: center;">
        <strong><i class="fa fa-star"></i> KRA Performance Ratings (1-5 Scale)</strong>
        <div>
          <span id="modalSelfLiveScoreDisplay" style="background: #ffc107; color: #1e3c72; padding: 3px 10px; border-radius: 15px; font-size: 12px;">Score: 0.0/10</span>
          <span id="modalSelfLiveLevelDisplay" style="background: #6c757d; color: white; padding: 3px 10px; border-radius: 15px; font-size: 12px; margin-left: 5px;">Level: Not Assessed</span>
        </div>
      </div>
      <div class="panel-body"><div class="row">${kraHtml}</div></div>
    </div>
    <div class="panel panel-default">
      <div class="panel-heading" style="background-color: #1e3c72; color: white;"><strong><i class="fa fa-calendar"></i> 📊 Daily Workload</strong></div>
      <div class="panel-body">
        <!-- Main Edition -->
        <div class="panel panel-default"><div class="panel-heading" style="background-color: #2a5298; color: white;"><strong><i class="fa fa-newspaper-o"></i> 1. Main Edition</strong></div>
        <div class="panel-body"><div class="row">
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Full Page Design</label><input type="number" class="form-control" id="modal_main_full_page_design" value="${dw.main_full_page_design || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Page Alter (Ad Schedule)</label><input type="number" class="form-control" id="modal_main_page_alter_ad_schedule" value="${dw.main_page_alter_ad_schedule || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Page Alter (News Update)</label><input type="number" class="form-control" id="modal_main_page_alter_news_update" value="${dw.main_page_alter_news_update || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Infographic/Info-Story</label><input type="number" class="form-control" id="modal_main_infographic" value="${dw.main_infographic || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
        </div></div></div>
        <!-- Hello Edition -->
        <div class="panel panel-default"><div class="panel-heading" style="background-color: #2a5298; color: white;"><strong><i class="fa fa-file-text-o"></i> 2. Hello Edition</strong></div>
        <div class="panel-body"><div class="row">
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Full Page Design</label><input type="number" class="form-control" id="modal_hello_full_page_design" value="${dw.hello_full_page_design || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Page Alter (Ad Schedule)</label><input type="number" class="form-control" id="modal_hello_page_alter_ad_schedule" value="${dw.hello_page_alter_ad_schedule || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Page Alter (News Update)</label><input type="number" class="form-control" id="modal_hello_page_alter_news_update" value="${dw.hello_page_alter_news_update || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Infographic/Info-Story</label><input type="number" class="form-control" id="modal_hello_infographic" value="${dw.hello_infographic || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
        </div></div></div>
        <!-- Other Tasks -->
        <div class="panel panel-default"><div class="panel-heading" style="background-color: #2a5298; color: white;"><strong><i class="fa fa-tasks"></i> 3. Common Tasks & Projects</strong></div>
        <div class="panel-body"><div class="row">
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Notice/Display Ad Design</label><input type="number" class="form-control" id="modal_display_ad_design" value="${dw.display_ad_design || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Event Creative</label><input type="number" class="form-control" id="modal_event_creative" value="${dw.event_creative || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Supplement Design</label><input type="number" class="form-control" id="modal_supplement_design" value="${dw.supplement_design || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>AI Image</label><input type="number" class="form-control" id="modal_ai_image" value="${dw.ai_image || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Photo Correction</label><input type="number" class="form-control" id="modal_photo_correction" value="${dw.photo_correction || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>PDF Quality Check</label><input type="number" class="form-control" id="modal_pdf_quality_check" value="${dw.pdf_quality_check || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Epaper Page Upload</label><input type="number" class="form-control" id="modal_epaper_page_upload" value="${dw.epaper_page_upload || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
          <div class="col-xs-12 col-sm-6 col-md-3"><label>Text Typing (Total words)</label><input type="number" class="form-control" id="modal_news_article_typing" value="${dw.news_article_typing || 0}" min="0" ${disabledAttr} onfocus="this.select()"></div>
        </div></div></div>
      </div>
    </div>
    <div class="panel panel-default">
      <div class="panel-heading" style="background-color: #1e3c72; color: white;"><strong><i class="fa fa-file-text"></i> Job Description</strong></div>
      <div class="panel-body"><textarea class="form-control" id="modal_job_description" rows="3" ${disabledAttr} placeholder="Describe your job responsibilities, key duties, and daily tasks..." onfocus="this.select()">${escapeHtml(jobDescription)}</textarea></div>
    </div>
    <div class="panel panel-default">
      <div class="panel-heading" style="background-color: #1e3c72; color: white;"><strong><i class="fa fa-rocket"></i> Special Projects & Initiatives</strong></div>
      <div class="panel-body"><textarea class="form-control" id="modal_special_projects" rows="3" ${disabledAttr} placeholder="Describe any special projects, achievements, or initiatives..." onfocus="this.select()">${escapeHtml(specialProjectsText)}</textarea></div>
    </div>
  `;

  document.getElementById('selfEvalModalBody').innerHTML = modalHtml;
  updateSelfModalLiveScore();
}

function updateSelfModalLiveScore() {
  const kraIds = ['page_layout','deadline_adherence','quality_accuracy','advertising_integration','platform_adaptation','collaboration'];
  let selfTotal = 0;
  for (const id of kraIds) {
    const select = document.getElementById(`modal_kra_${id}`);
    selfTotal += select ? parseFloat(select.value) || 0 : 0;
  }
  const percentage = (selfTotal / 30) * 100;
  const scoreOutOf10 = Math.round((percentage / 100) * 10 * 10) / 10;
  let assessmentLevel = '', levelCode = '', levelColor = '', textColor = '';
  if (percentage >= 80) { assessmentLevel = 'DE - Distinguished Expert'; levelCode = 'DE'; levelColor = '#28a745'; textColor = 'white'; }
  else if (percentage >= 50) { assessmentLevel = 'ME - Meets Expectations'; levelCode = 'ME'; levelColor = '#ffc107'; textColor = '#1e3c72'; }
  else { assessmentLevel = 'NI - Needs Improvement'; levelCode = 'NI'; levelColor = '#dc3545'; textColor = 'white'; }

  const scoreDisplay = document.getElementById('modalSelfLiveScoreDisplay');
  if (scoreDisplay) { scoreDisplay.innerHTML = `⭐ Score: ${scoreOutOf10}/10`; scoreDisplay.style.background = levelColor; scoreDisplay.style.color = textColor; }
  const levelDisplay = document.getElementById('modalSelfLiveLevelDisplay');
  if (levelDisplay) { levelDisplay.innerHTML = `📊 Level: ${assessmentLevel}`; levelDisplay.style.background = levelColor; levelDisplay.style.color = textColor; }
}

async function saveSelfEvaluationFromModal(isDraft) {
  if (!currentSelfEvalIsEditable) {
    showToast('This evaluation is locked and cannot be edited.', 'warning');
    return;
  }
  if (!currentSelfEvalEmpCode) return;

  const kraValues = {};
  for (const kra of kraDefinitions) {
    const select = document.getElementById(`modal_kra_${kra.id}`);
    kraValues[kra.id] = select ? parseFloat(select.value) || 0 : 0;
  }

  const email = document.getElementById('modal_self_email')?.value || '';
  const dutyHour = document.getElementById('modal_self_duty_hour')?.value || '';
  const dutyMinute = document.getElementById('modal_self_duty_minute')?.value || '';
  const dutyAmpm = document.getElementById('modal_self_duty_ampm')?.value || 'PM';
  let dutyTimings = '';
  if (dutyHour && dutyMinute) {
    dutyTimings = `${dutyHour}:${dutyMinute.padStart(2, '0')} ${dutyAmpm}`;
  }

  const jobDescription = document.getElementById('modal_job_description')?.value || '';
  const specialProjectsText = document.getElementById('modal_special_projects')?.value || '';
  const mColumnData = JSON.stringify({ job_description: jobDescription, special_projects: specialProjectsText });

  const isFromSelfTab = (!authenticatedUser && !authenticatedUnitHead);
  if (!isDraft && isFromSelfTab && !email) {
    showToast('Please enter your email address', 'error');
    return;
  }
  if (!isDraft && (!dutyHour || !dutyMinute)) {
    showToast('Please enter duty timings (HH:MM)', 'error');
    return;
  }

  if (!isDraft) {
    let allValid = true;
    for (const val of Object.values(kraValues)) {
      if (val < 1 || val > 5) { allValid = false; break; }
    }
    if (!allValid) {
      showToast('Please provide self ratings (1-5) for all 6 KRAs', 'error');
      return;
    }
  }

  const userRole = window.currentUserRole || (authenticatedUser ? authenticatedUser.position : null);
  const isFromVH = (userRole === 'Vertical Head');
  const status = isDraft ? "Draft" : (isFromVH ? null : "Pending");

  const formObject = {
    emp_code: currentSelfEvalEmpCode,
    email: email,
    duty_timings: dutyTimings,
    status: status,
    comments: "",
    m_column_data: mColumnData,
    ...kraValues,
    main_full_page_design: parseInt(document.getElementById('modal_main_full_page_design')?.value) || 0,
    main_page_alter_ad_schedule: parseInt(document.getElementById('modal_main_page_alter_ad_schedule')?.value) || 0,
    main_page_alter_news_update: parseInt(document.getElementById('modal_main_page_alter_news_update')?.value) || 0,
    main_infographic: parseInt(document.getElementById('modal_main_infographic')?.value) || 0,
    hello_full_page_design: parseInt(document.getElementById('modal_hello_full_page_design')?.value) || 0,
    hello_page_alter_ad_schedule: parseInt(document.getElementById('modal_hello_page_alter_ad_schedule')?.value) || 0,
    hello_page_alter_news_update: parseInt(document.getElementById('modal_hello_page_alter_news_update')?.value) || 0,
    hello_infographic: parseInt(document.getElementById('modal_hello_infographic')?.value) || 0,
    display_ad_design: parseInt(document.getElementById('modal_display_ad_design')?.value) || 0,
    event_creative: parseInt(document.getElementById('modal_event_creative')?.value) || 0,
    supplement_design: parseInt(document.getElementById('modal_supplement_design')?.value) || 0,
    ai_image: parseInt(document.getElementById('modal_ai_image')?.value) || 0,
    photo_correction: parseInt(document.getElementById('modal_photo_correction')?.value) || 0,
    pdf_quality_check: parseInt(document.getElementById('modal_pdf_quality_check')?.value) || 0,
    epaper_page_upload: parseInt(document.getElementById('modal_epaper_page_upload')?.value) || 0,
    news_article_typing: parseInt(document.getElementById('modal_news_article_typing')?.value) || 0
  };

  const action = isFromVH ? 'updateSelfEvaluation' : 'saveSelfEvaluation';
  if (action === 'updateSelfEvaluation') delete formObject.status;

  try {
    const result = await callServer(action, formObject);
    if (result.success) {
      showToast(result.message, 'success');
      $('#selfEvalModal').modal('hide');
      if (!isDraft) {
        currentSelfEvalIsSubmitted = true;
        currentSelfEvalIsEditable = false;
      }
      if (currentSelectedCentre) {
        loadEmployeesByCentre(currentSelectedCentre, currentSelectedWorkplace || '');
      }
    } else {
      showToast(`Error: ${result.message}`, 'error');
    }
  } catch(error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

// For self tab – load data and open modal
async function openSelfEvaluationFromSelfTab() {
  const empCode = document.getElementById('self_emp_code').value.trim();
  if (!empCode) {
    showToast('Please enter employee code', 'error');
    return;
  }
  showToast('Loading employee data...', 'info');
  try {
    const checkResult = await callServer("checkEmployeeExists", { empCode: empCode });
    if (checkResult.exists) {
      const icdStatus = await callServer("checkIfICDUserWithStatus", { empCode: empCode });
      if (icdStatus.isICD && icdStatus.teamWorkloadSaved !== 'Yes') {
        showRegistrationModal(empCode);
      } else {
        const isCompleted = checkResult.completion === 'Yes';
        const empInfo = await callServer("getEmployeeBasicInfo", { empCode: empCode });
        const empName = empInfo.success ? empInfo.name : empCode;
        openSelfEvaluationModal(empCode, empName, true, isCompleted);
      }
    } else {
      showToast('Employee code not found. Please contact HR.', 'warning');
    }
  } catch(error) {
    showToast(`Error checking employee: ${error.message}`, 'error');
  }
}