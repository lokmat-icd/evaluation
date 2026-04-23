// ==================== CONFIGURATION ====================
// IMPORTANT: Replace this URL with your ACTUAL deployed Apps Script URL
// After deploying your GS-Code.txt as a Web App, copy the URL here
const API_URL = "https://script.google.com/macros/s/AKfycbxCFBlUYHXH9PCULNbP4q1glat-_zr5oE40aRycebZ_hxYhP4doKd9AaP7wqN8Of-Op/exec";

// ==================== GLOBAL VARIABLES ====================
let authenticatedUser = null;      // For ICD/Head/Vertical Head
let authenticatedUnitHead = null;  // For Unit Head
let currentEvalEmp = null;
let currentSelectedCentre = null;
let currentSelectedWorkplace = null;
let currentSelectedHODWorkplace = null;
let currentSelectedUnitHeadWorkplace = null;
let currentSelfEvalEmpCode = null;
let currentSelfEvalIsEditable = true;
let currentSelfEvalIsSubmitted = false;
let currentHODEvalEmpCode = null;
let currentHODEvalIsEditable = true;
let currentUnitHeadEvalEmpCode = null;
let currentUnitHeadEvalIsEditable = true;
let unitHeadEmployeesCache = null;

// KRA Definitions (shared across modules)
const kraDefinitions = [
  { id: "page_layout", name: "Page Layout & Editorial Design", kpi: "Design, Layout, Visual Appeal, Readability, Brand guidelines", target: "100% adherence to typography, grid structures, color profiles" },
  { id: "deadline_adherence", name: "Deadline Adherence & Speed", kpi: "Punctuality in sending pages to press", target: "Streamlining Processes for Better Deadline Management" },
  { id: "quality_accuracy", name: "Quality, Accuracy & Print Readiness", kpi: "Error‑free output, proper formatting, proper photo scanning", target: "Error free ready to print PDF" },
  { id: "advertising_integration", name: "Advertising & Content Integration", kpi: "Designing various kinds of advertisements, Ad Placement", target: "100% accuracy making advertisements within schedule" },
  { id: "platform_adaptation", name: "Various Platforms / E‑Paper Adaptation", kpi: "Convert Print Assets for digital or vice versa", target: "Timely delivery for web/mobile/print formats" },
  { id: "collaboration", name: "Collaboration & Communication", kpi: "Teamwork with Vertical/Unit Heads/Editors/Reporters & Team", target: "Proactive communication" }
];
const ratingOptions = [1, 2, 3, 3.5, 4, 4.5, 5];
const defaultRating = 2;
const CENTRES = ['Akola', 'Nagpur(LS)','Nagpur(LM)','Nagpur(LT)','Chh. Sambhajinagar(LM)', 'Chh. Sambhajinagar(LS)', 'Goa', 'Jalgaon', 'Kolhapur', 'Mumbai', 'Nashik', 'Pune', 'Solapur'];

// ==================== API HELPER ====================
async function callServer(action, params) {
  // Show loading indicator (optional)
  console.log(`Calling ${action} with params:`, params);
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      mode: "cors",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: action, params: params || {} })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`Response from ${action}:`, result);
    return result;
    
  } catch (error) {
    console.error(`API call failed for ${action}:`, error);
    
    // Show user-friendly error message
    let errorMessage = error.message;
    if (error.message === "Failed to fetch") {
      errorMessage = "Cannot connect to server. Please check:\n1. Your internet connection\n2. The Apps Script is deployed\n3. CORS is enabled";
    }
    
    showToast(`Connection error: ${errorMessage}`, 'error');
    throw error;
  }
}

// ==================== HELPER FUNCTIONS ====================
function getHelloPagesLabel(editionName) {
  if (!editionName) return "Hello Pages";
  const lowerEdition = editionName.toLowerCase();
  if (lowerEdition.indexOf("samachar") !== -1) return "Apna Pages";
  if (lowerEdition.indexOf("times") !== -1) return "FIRST Pages";
  return "Hello Pages";
}

function showToast(message, type) {
  const existingToast = document.querySelector('.custom-toast');
  if (existingToast) existingToast.remove();
  const toast = document.createElement('div');
  toast.className = `custom-toast toast-${type}`;
  const icon = type === 'success' ? '✓' : (type === 'error' ? '✗' : (type === 'warning' ? '⚠' : 'ℹ'));
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'fadeOutCenter 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatTeamWorkloadDisplay(teamWorkload) {
  if (!teamWorkload || Object.keys(teamWorkload).length === 0) return '';
  const parts = [];
  let grandTotal = 0;
  for (const edition in teamWorkload) {
    const wl = teamWorkload[edition];
    if (wl && (wl.main_pages || wl.hello_pages)) {
      const mainPages = wl.main_pages || 0;
      const helloPages = wl.hello_pages || 0;
      const editionTotal = mainPages + helloPages;
      grandTotal += editionTotal;
      const helloLabel = getHelloPagesLabel(edition);
      parts.push(`${edition}: Main(${mainPages})+${helloLabel}(${helloPages})=${editionTotal}`);
    }
  }
  return parts.length ? `📊 Team Workload: ${parts.join(' | ')} | <strong>Total: ${grandTotal} pages</strong>` : '';
}

function generateDailyWorkloadHTML(dailyWorkload) {
  if (!dailyWorkload || Object.keys(dailyWorkload).length === 0) {
    return '<div style="background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 6px;"><strong><i class="fa fa-calendar"></i> 📋 Daily Workload:</strong><div>No data</div></div>';
  }
  const items = [];
  if (dailyWorkload.main_full_page_design) items.push(`${dailyWorkload.main_full_page_design} Full Page Design (Main)`);
  if (dailyWorkload.main_page_alter_ad_schedule) items.push(`${dailyWorkload.main_page_alter_ad_schedule} Page Alter - Ad Schedule (Main)`);
  if (dailyWorkload.main_page_alter_news_update) items.push(`${dailyWorkload.main_page_alter_news_update} Page Alter - News Update (Main)`);
  if (dailyWorkload.main_infographic) items.push(`${dailyWorkload.main_infographic} Infographic/Info-Story (Main)`);
  if (dailyWorkload.hello_full_page_design) items.push(`${dailyWorkload.hello_full_page_design} Full Page Design (Hello)`);
  if (dailyWorkload.hello_page_alter_ad_schedule) items.push(`${dailyWorkload.hello_page_alter_ad_schedule} Page Alter - Ad Schedule (Hello)`);
  if (dailyWorkload.hello_page_alter_news_update) items.push(`${dailyWorkload.hello_page_alter_news_update} Page Alter - News Update (Hello)`);
  if (dailyWorkload.hello_infographic) items.push(`${dailyWorkload.hello_infographic} Infographic/Info-Story (Hello)`);
  if (dailyWorkload.display_ad_design) items.push(`${dailyWorkload.display_ad_design} Display Ad Design`);
  if (dailyWorkload.event_creative) items.push(`${dailyWorkload.event_creative} Event Creative`);
  if (dailyWorkload.supplement_design) items.push(`${dailyWorkload.supplement_design} Supplement Design`);
  if (dailyWorkload.ai_image) items.push(`${dailyWorkload.ai_image} AI Image`);
  if (dailyWorkload.photo_correction) items.push(`${dailyWorkload.photo_correction} Photo Correction`);
  if (dailyWorkload.pdf_quality_check) items.push(`${dailyWorkload.pdf_quality_check} PDF Quality Check`);
  if (dailyWorkload.epaper_page_upload) items.push(`${dailyWorkload.epaper_page_upload} Epaper Page Upload`);
  if (dailyWorkload.news_article_typing) items.push(`${dailyWorkload.news_article_typing} Words-News/Article Typing`);
  if (items.length === 0) return '<div style="background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 6px;"><strong><i class="fa fa-calendar"></i> 📋 Daily Workload:</strong><div>No data</div></div>';
  let itemsHtml = '<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 5px 15px; margin-top: 5px;">';
  for (const item of items) itemsHtml += `<div><i class="fa fa-check-circle-o" style="color: #1e3c72; font-size: 12px;"></i> ${item}</div>`;
  itemsHtml += '</div>';
  return `<div style="background: #f8f9fa; padding: 10px; margin: 10px 0; border-radius: 6px;"><strong><i class="fa fa-calendar"></i> 📋 Daily Workload:</strong>${itemsHtml}</div>`;
}

function calculatePaginationScore(dailyWorkload) {
  if (!dailyWorkload) return 0;
  let score = 0;
  score += (parseInt(dailyWorkload.main_full_page_design) || 0) * 1;
  score += (parseInt(dailyWorkload.main_page_alter_ad_schedule) || 0) * 0.5;
  score += (parseInt(dailyWorkload.main_page_alter_news_update) || 0) * 0.5;
  score += (parseInt(dailyWorkload.hello_full_page_design) || 0) * 1;
  score += (parseInt(dailyWorkload.hello_page_alter_ad_schedule) || 0) * 0.5;
  score += (parseInt(dailyWorkload.hello_page_alter_news_update) || 0) * 0.5;
  score += (parseInt(dailyWorkload.supplement_design) || 0) * 0.14;
  return score;
}

function calculateOtherWorkScore(dailyWorkload) {
  if (!dailyWorkload) return 0;
  let score = 0;
  score += (parseInt(dailyWorkload.main_infographic) || 0) * 0.2;
  score += (parseInt(dailyWorkload.hello_infographic) || 0) * 0.2;
  score += (parseInt(dailyWorkload.display_ad_design) || 0) * 0.3;
  score += (parseInt(dailyWorkload.event_creative) || 0) * 0.4;
  score += (parseInt(dailyWorkload.ai_image) || 0) * 0.2;
  score += (parseInt(dailyWorkload.photo_correction) || 0) * 0.01;
  score += (parseInt(dailyWorkload.pdf_quality_check) || 0) * 0.1;
  score += (parseInt(dailyWorkload.epaper_page_upload) || 0) * 0.05;
  score += (parseInt(dailyWorkload.news_article_typing) || 0) * 0.002;
  return score;
}

function updateLogoutButton() {
  const logoutBtn = document.getElementById('globalLogoutBtn');
  if (logoutBtn) {
    logoutBtn.style.display = (authenticatedUser || authenticatedUnitHead) ? 'inline-block' : 'none';
  }
}

// Global logout function
async function logoutCurrentUser() {
  authenticatedUser = null;
  authenticatedUnitHead = null;
  showToast('Logged out successfully', 'success');
  
  // Reset UI
  const hodAuthSection = document.getElementById('hodAuthSection');
  const hodProtected = document.getElementById('hodProtectedContent');
  const unitHeadAuth = document.getElementById('unitHeadAuthSection');
  const unitHeadProtected = document.getElementById('unitHeadProtectedContent');
  const vhAuth = document.getElementById('vhAuthSection');
  const vhProtected = document.getElementById('vhProtectedContent');
  
  if (hodAuthSection) hodAuthSection.style.display = 'block';
  if (hodProtected) hodProtected.style.display = 'none';
  if (unitHeadAuth) unitHeadAuth.style.display = 'block';
  if (unitHeadProtected) unitHeadProtected.style.display = 'none';
  if (vhAuth) vhAuth.style.display = 'block';
  if (vhProtected) vhProtected.style.display = 'none';
  
  // Clear displayed data
  const hodTeamList = document.getElementById('hodTeamList');
  const unitHeadTeamList = document.getElementById('unitHeadTeamList');
  const employeeList = document.getElementById('employeeList');
  if (hodTeamList) hodTeamList.innerHTML = '';
  if (unitHeadTeamList) unitHeadTeamList.innerHTML = '';
  if (employeeList) employeeList.innerHTML = '';
  
  // Clear auth inputs
  const hodEmail = document.getElementById('hod_email');
  const hodSecret = document.getElementById('hod_secret_code');
  const unitEmail = document.getElementById('unithead_email');
  const unitSecret = document.getElementById('unithead_secret_code');
  const vhEmail = document.getElementById('vh_email');
  const vhSecret = document.getElementById('vh_secret_code');
  
  if (hodEmail) hodEmail.value = '';
  if (hodSecret) hodSecret.value = '';
  if (unitEmail) unitEmail.value = '';
  if (unitSecret) unitSecret.value = '';
  if (vhEmail) vhEmail.value = '';
  if (vhSecret) vhSecret.value = '';
  
  updateLogoutButton();
  // Switch to self tab
  $('.nav-pills a[href="#self"]').tab('show');
}