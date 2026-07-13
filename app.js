"use strict";

// Exact, study-specified mappings. These values drive CSS variables on each avatar.
const HR_STATES = {
  H1: { label: "low activation", pulseDuration: 1800, glowStrength: 0.25, haloScale: 1.03, brightness: 0.65 },
  H2: { label: "focused activation", pulseDuration: 1250, glowStrength: 0.45, haloScale: 1.07, brightness: 0.80 },
  H3: { label: "high activation", pulseDuration: 850, glowStrength: 0.70, haloScale: 1.12, brightness: 1.00 },
  H4: { label: "overdrive activation", pulseDuration: 550, glowStrength: 1.00, haloScale: 1.18, brightness: 1.25 }
};

const HRV_STATES = {
  V1: { label: "high coherence", ringType: "smooth", segments: 1, jitterAmount: 0, fragmentation: 0, opacityIrregularity: 0, wobbleDuration: 0 },
  V2: { label: "stable variability", ringType: "dotted", segments: 24, jitterAmount: 1, fragmentation: 0.10, opacityIrregularity: 0.05, wobbleDuration: 4000 },
  V3: { label: "reduced variability", ringType: "segmented", segments: 36, jitterAmount: 3, fragmentation: 0.30, opacityIrregularity: 0.18, wobbleDuration: 1800 },
  V4: { label: "suppressed / fragmented variability", ringType: "broken", segments: 48, jitterAmount: 7, fragmentation: 0.55, opacityIrregularity: 0.35, wobbleDuration: 900 }
};

const CONDITIONS = buildConditions();
const PHASE_A_CONDITIONS = ["H1_V1", "H2_V2", "H3_V3", "H4_V4"];
const ECG_PATHS = {
  H1: "M8 40 L40 40 L48 35 L56 47 L66 27 L76 51 L86 37 L94 40 L152 40",
  H2: "M8 40 L36 40 L45 30 L54 50 L65 20 L77 57 L88 33 L98 40 L152 40",
  H3: "M8 40 L32 40 L43 25 L53 53 L65 13 L78 63 L90 28 L101 40 L152 40",
  H4: "M8 40 L28 40 L40 20 L51 57 L65 7 L79 68 L92 22 L104 43 L114 31 L122 40 L152 40"
};
const DATA_COLUMNS = [
  "participant_id", "study_start_time", "study_end_time", "timestamp", "record_type", "phase", "trial_number", "condition_id", "hr_state", "hrv_state", "randomized_order", "stimulus_start_time", "response_start_time", "response_submit_time", "response_time_ms",
  "age_range", "gaming_experience", "wearable_experience", "hr_hrv_familiarity", "visual_accessibility", "device_type",
  "phaseA_free_text_interpretation", "phaseA_confidence", "phaseA_best_match", "phaseA_perceived_activation", "phaseA_perceived_stability",
  "phaseB_hr_recognition", "phaseB_hrv_recognition", "phaseB_clarity", "phaseB_urgency", "phaseB_stability", "phaseB_coordination_usefulness", "phaseB_support_intention", "phaseB_sam_valence", "phaseB_sam_arousal", "phaseB_sam_dominance",
  "final_feature_helped_most", "final_confusing_states", "final_useful_or_invasive", "final_would_use_in_game", "final_improvement_suggestion", "nasa_mental_demand", "nasa_effort", "nasa_frustration", "nasa_confidence", "visual_comfort",
  "user_agent", "screen_width", "screen_height"
];
const STORAGE_KEY = "sbiv-study-state-v1";
// Paste the Apps Script Web App "exec" URL here. See GOOGLE_SHEETS_SETUP.md for full setup steps.
// IMPORTANT: every time the Apps Script project is edited, it must be redeployed (Deploy > Manage deployments > Edit > New version)
// or this URL keeps running the old code.
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxc4aRVR4C7JcPxaNC8PQo33gx0RZKsXBNCI5xKkThgACZZ_AR98Hk-mO_jLKUq6Zvh2w/exec";
const GOOGLE_SCRIPT_PLACEHOLDER = "PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE";
const CURRENT_CONSENT_VERSION = 2;
// Temporary testing switch. Change to false before collecting real participant data.
const ALLOW_REPEAT_SUBMISSIONS_FOR_TESTING = true;
const PAGE_PROGRESS = { landing: 0, consent: 4, demographics: 8, phaseAIntro: 12, phaseA: 14, training: 32, phaseBIntro: 36, phaseB: 38, break: 64, final: 91, results: 100 };
const app = document.getElementById("app");
let timers = [];

let studyState = createInitialState();

function createInitialState() {
  return {
    participantId: "",
    studyStartTime: "",
    studyEndTime: "",
    currentPage: "landing",
    consent: false,
    consentVersion: 0,
    resumeAfterConsent: "",
    demographics: {},
    phaseAOrder: [],
    phaseBOrder: [],
    phaseAIndex: 0,
    phaseBIndex: 0,
    phaseA: [],
    phaseB: [],
    finalQuestionnaire: {},
    exportRows: [],
    onlineSubmission: { status: "not_submitted", submittedAt: "", error: "" },
    deviceInfo: getDeviceInfo(),
    activeTrial: null
  };
}

// Every refresh starts a brand-new attempt at the landing page; nothing resumes from localStorage.
function initStudy() {
  localStorage.removeItem(STORAGE_KEY);
  studyState = createInitialState();
  renderPage();
}

function generateParticipantId() {
  const now = new Date();
  const pad = value => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const random = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `P-${date}-${time}-${random}`;
}

function buildConditions() {
  return Object.keys(HR_STATES).flatMap(hr => Object.keys(HRV_STATES).map(hrv => ({
    id: `${hr}_${hrv}`, hr, hrv, hrState: HR_STATES[hr], hrvState: HRV_STATES[hrv]
  })));
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function renderPage() {
  clearTimers();
  app.setAttribute("aria-busy", "false");
  const renderers = {
    landing: renderLandingPage,
    consent: renderConsentPage,
    demographics: renderDemographicsPage,
    phaseAIntro: renderPhaseAIntro,
    phaseA: startPhaseA,
    training: renderTrainingPage,
    phaseBIntro: renderPhaseBIntro,
    phaseB: startPhaseB,
    break: renderBreakPage,
    final: renderFinalQuestionnaire,
    results: renderResultsPage
  };
  (renderers[studyState.currentPage] || renderLandingPage)();
  updateProgress();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setPage(page) {
  studyState.currentPage = page;
  saveProgress();
  renderPage();
}

function renderLandingPage() {
  app.innerHTML = `
    <div class="page">
      <header class="thesis-header">
        <img src="assets/sfu-logo.png" alt="Simon Fraser University" class="thesis-logo">
        <div class="thesis-meta">
          <p class="thesis-kicker">Master's Thesis Research Study</p>
          <p class="thesis-title">Physiological Legibility in Multiplayer Games: An STS Perspective on Visualizing Biosignals for Cooperative Play</p>
          <p class="thesis-byline">Roman Jahandideh &middot; School of Interactive Arts &amp; Technology, Simon Fraser University</p>
          <p class="thesis-advisor">Senior Supervisor: Prof. Steve DiPaola</p>
        </div>
      </header>
      <div class="landing">
        <p class="eyebrow">Interface perception experiment</p>
        <h1>Simulated Biofeedback Icon Validation Study</h1>
        <p class="subtitle">An online study of animated avatar icons for simulated HR and HRV interface states.</p>
        <p class="body-copy">This study evaluates how people interpret animated teammate-status icons. You will view short animated icons and answer questions about their clarity, perceived activation, stability, and usefulness for coordination.</p>
        <div class="meta-row" aria-label="Study details"><span class="meta-pill">15–20 minutes</span><span class="meta-pill">20 icon trials</span><span class="meta-pill">No sensors</span><span class="meta-pill">Simulated states only</span></div>
        <div class="page-actions start"><button class="btn btn-primary" id="begin-study">Begin Study <span class="arrow" aria-hidden="true">→</span></button></div>
      </div>
    </div>`;
  document.getElementById("begin-study").addEventListener("click", () => {
    if (!studyState.participantId) {
      studyState.participantId = generateParticipantId();
      studyState.studyStartTime = new Date().toISOString();
      studyState.deviceInfo = getDeviceInfo();
      updateParticipantChip();
    }
    setPage("consent");
  });
}

function renderConsentPage() {
  const hasCurrentConsent = studyState.consent && studyState.consentVersion === CURRENT_CONSENT_VERSION;
  app.innerHTML = `
    <div class="page">
      <p class="eyebrow">Step 1 of 2 · Enrollment</p><h2>Consent to participate</h2>
      <p class="body-copy">Please review the following before continuing.</p>
      <ul class="consent-list">
        <li>Participation is voluntary and takes about 15–20 minutes.</li>
        <li>No real health data is collected. All physiological states shown are simulated.</li>
        <li>No webcam, microphone, Apple Watch, or sensors are used.</li>
        <li>You may stop at any time by closing the browser.</li>
        <li>This study evaluates icon design and interpretation.</li>
        <li>The icons are not medical indicators or emotional diagnoses.</li>
        <li>After completion, responses are sent to a researcher-controlled Google Sheet for analysis.</li>
        <li>Manual CSV, Excel-compatible, and JSON exports remain available as a backup.</li>
      </ul>
      <label class="consent-box"><input id="consent-check" type="checkbox" ${hasCurrentConsent ? "checked" : ""}><span>I understand and agree to participate, including the online response submission described above.</span></label>
      <div class="page-actions"><button class="btn btn-primary" id="consent-next" ${hasCurrentConsent ? "" : "disabled"}>Continue <span class="arrow" aria-hidden="true">→</span></button></div>
    </div>`;
  const check = document.getElementById("consent-check");
  const next = document.getElementById("consent-next");
  check.addEventListener("change", () => { next.disabled = !check.checked; });
  next.addEventListener("click", () => {
    studyState.consent = check.checked;
    studyState.consentVersion = CURRENT_CONSENT_VERSION;
    const destination = studyState.resumeAfterConsent || "demographics";
    studyState.resumeAfterConsent = "";
    setPage(destination);
  });
}

function renderDemographicsPage() {
  const fields = [
    ["age_range", "Age range", ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+", "Prefer not to say"]],
    ["gaming_experience", "Gaming experience", ["None", "Casual", "Regular", "Frequent", "Expert / competitive"]],
    ["wearable_experience", "Experience with wearable health data", ["None", "Rarely", "Sometimes", "Often", "Very often"]],
    ["hr_hrv_familiarity", "Familiarity with HR or HRV", ["Not familiar", "Slightly familiar", "Moderately familiar", "Very familiar"]],
    ["visual_accessibility", "Visual accessibility", ["No known visual accessibility issue", "Color vision difficulty", "Motion sensitivity", "Low vision", "Other / prefer not to say"]],
    ["device_type", "Device type", ["Desktop / laptop", "Tablet", "Phone"]]
  ];
  app.innerHTML = `<div class="page"><p class="eyebrow">Step 2 of 2 · Enrollment</p><h2>About you</h2><p class="body-copy">These questions help us understand how prior experience may shape icon interpretation.</p><form id="demographics-form"><div class="form-grid">${fields.map(([name, label, options]) => radioField(name, label, options, studyState.demographics[name])).join("")}</div><p class="validation-note" id="demographics-error" role="alert"></p><div class="page-actions"><button class="btn btn-primary" id="demographics-next" type="submit" disabled>Start Phase A <span class="arrow" aria-hidden="true">→</span></button></div></form></div>`;
  const demographicsForm = document.getElementById("demographics-form");
  bindRequiredGate(demographicsForm);
  demographicsForm.addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!fields.every(([name]) => form.get(name))) {
      document.getElementById("demographics-error").textContent = "Please answer all six questions to continue.";
      return;
    }
    studyState.demographics = Object.fromEntries(fields.map(([name]) => [name, form.get(name)]));
    setPage("phaseAIntro");
  });
}

function renderPhaseAIntro() {
  app.innerHTML = `<div class="page instruction-hero"><div><p class="eyebrow">Phase A · Unaided interpretation</p><h2>Interpret before explanation</h2><p class="subtitle">You will see four animated avatar icons. Please interpret them without any explanation. There are no right or wrong answers in this phase.</p><div class="notice">Each trial begins with a brief fixation, followed by a 6-second icon animation. Questions appear after the animation.</div><div class="page-actions start"><button class="btn btn-primary" id="phase-a-start">Begin 4 trials <span class="arrow" aria-hidden="true">→</span></button></div></div><div class="instruction-orbit" aria-hidden="true"><span></span></div></div>`;
  document.getElementById("phase-a-start").addEventListener("click", () => {
    if (!studyState.phaseAOrder.length) studyState.phaseAOrder = shuffleArray(PHASE_A_CONDITIONS);
    studyState.phaseAIndex = studyState.phaseA.length;
    setPage("phaseA");
  });
}

function startPhaseA() {
  if (studyState.phaseAIndex >= 4) return setPage("training");
  runTrial("A", studyState.phaseAIndex, studyState.phaseAOrder[studyState.phaseAIndex]);
}

function renderTrainingPage() {
  const examples = ["H1_V1", "H2_V2", "H3_V3", "H4_V4"];
  const labels = ["Low activation / high coherence", "Focused activation / stable variability", "High activation / reduced variability", "Overdrive activation / fragmented variability"];
  app.innerHTML = `<div class="page"><p class="eyebrow">Training · Visual legend</p><h2>How to read the icon</h2><p class="body-copy">The icon combines two simulated interface dimensions. It does not diagnose emotion or display real health data.</p><div class="mapping-grid"><section class="mapping"><h3>Activation cues</h3><ul><li>Faster pulse = higher simulated HR activation.</li><li>Stronger glow = higher simulated HR activation.</li><li>Larger halo expansion = higher simulated HR activation.</li></ul></section><section class="mapping"><h3>Stability cues</h3><ul><li>Smoother ring = higher simulated HRV coherence.</li><li>Dotted or segmented ring = moderate HRV change.</li><li>Broken or jittering ring = lower simulated HRV stability.</li></ul></section></div><div class="legend-grid">${examples.map((id, i) => `<div class="legend-card"><div data-avatar="${id}"></div><p>${labels[i]}</p></div>`).join("")}</div><p class="notice">Treat the icon as ambient teammate-status information in a cooperative game—not as a medical indicator or emotional diagnosis.</p><div class="page-actions"><button class="btn btn-primary" id="training-next">Start Phase B <span class="arrow" aria-hidden="true">→</span></button></div></div>`;
  examples.forEach(id => renderAvatarIcon(getCondition(id), document.querySelector(`[data-avatar="${id}"]`), "mini"));
  document.getElementById("training-next").addEventListener("click", () => setPage("phaseBIntro"));
}

function renderPhaseBIntro() {
  app.innerHTML = `<div class="page instruction-hero"><div><p class="eyebrow">Phase B · Recognition</p><h2>Identify and rate the cues</h2><p class="subtitle">You will now see 16 animated icons. After each icon, identify the simulated HR and HRV state and rate its clarity and perceived effect.</p><div class="notice">You will receive a short break after trial 8. All 16 conditions are shown once in a randomized order.</div><div class="page-actions start"><button class="btn btn-primary" id="phase-b-start">Begin 16 trials <span class="arrow" aria-hidden="true">→</span></button></div></div><div class="instruction-orbit" aria-hidden="true"><span></span></div></div>`;
  document.getElementById("phase-b-start").addEventListener("click", () => {
    if (!studyState.phaseBOrder.length) studyState.phaseBOrder = shuffleArray(CONDITIONS.map(c => c.id));
    studyState.phaseBIndex = studyState.phaseB.length;
    setPage("phaseB");
  });
}

function startPhaseB() {
  if (studyState.phaseBIndex >= 16) return setPage("final");
  runTrial("B", studyState.phaseBIndex, studyState.phaseBOrder[studyState.phaseBIndex]);
}

function runTrial(phase, index, conditionId) {
  const condition = getCondition(conditionId);
  const activeTrial = {
    phase,
    trialNumber: index + 1,
    conditionId,
    randomizedOrder: phase === "A" ? [...studyState.phaseAOrder] : [...studyState.phaseBOrder],
    stimulusStartTime: "",
    responseStartTime: ""
  };
  studyState.activeTrial = activeTrial;
  saveProgress();
  showFixation(phase, index, condition);
}

function showFixation(phase, index, condition) {
  app.setAttribute("aria-busy", "true");
  app.innerHTML = `<div class="page trial-stage"><div class="trial-status">Phase ${phase}, Trial ${index + 1} of ${phase === "A" ? 4 : 16} · Fixation</div><div class="fixation" aria-label="Fixation point"></div></div>`;
  timers.push(setTimeout(() => showStimulus(phase, index, condition), 1000));
}

function showStimulus(phase, index, condition) {
  studyState.activeTrial.stimulusStartTime = new Date().toISOString();
  saveProgress();
  app.innerHTML = `<div class="page trial-stage"><div class="trial-status">Phase ${phase}, Trial ${index + 1} of ${phase === "A" ? 4 : 16} · Observe</div><div><div id="trial-avatar"></div><p class="stimulus-copy">Observe the interface signal</p><div class="timer-track" aria-hidden="true"><div class="timer-fill"></div></div></div></div>`;
  renderAvatarIcon(condition, document.getElementById("trial-avatar"));
  timers.push(setTimeout(() => showQuestions(phase, index, condition), 6000));
}

function showQuestions(phase, index, condition) {
  app.setAttribute("aria-busy", "false");
  studyState.activeTrial.responseStartTime = new Date().toISOString();
  saveProgress();
  const title = phase === "A" ? "Describe what you perceived" : "Identify and rate the signal";
  app.innerHTML = `<div class="page question-layout"><aside class="question-stimulus" aria-label="Observed icon, paused"><div id="question-avatar"></div><p>OBSERVED SIGNAL · PAUSED</p></aside><form id="trial-form" class="question-form"><p class="eyebrow">Phase ${phase}, Trial ${index + 1} of ${phase === "A" ? 4 : 16}</p><h2>${title}</h2><div class="questions">${phase === "A" ? phaseAQuestions() : phaseBQuestions()}</div><p class="validation-note" id="trial-error" role="alert"></p><div class="page-actions"><button class="btn btn-primary" type="submit">Next <span class="arrow" aria-hidden="true">→</span></button></div></form></div>`;
  renderAvatarIcon(condition, document.getElementById("question-avatar"), "small paused");
  const form = document.getElementById("trial-form");
  bindRequiredGate(form);
  form.addEventListener("input", () => {
    if (validateAnswers(form, false)) document.getElementById("trial-error").textContent = "";
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!validateAnswers(form, true)) return;
    collectAnswers(phase, index, condition, form);
  });
}

function phaseAQuestions() {
  return [
    textQuestion("interpretation", "What do you think this icon is communicating?"),
    scaleQuestion("confidence", "How confident are you in your interpretation?", "not confident at all", "very confident"),
    radioQuestion("best_match", "Which state best matches this icon?", ["Stable / calm", "Focused / engaged", "High activation", "Unstable / overloaded", "Not sure"]),
    scaleQuestion("perceived_activation", "How activated does the icon feel?", "very low activation", "very high activation"),
    scaleQuestion("perceived_stability", "How stable or coherent does the icon feel?", "very unstable", "very stable")
  ].join("");
}

function phaseBQuestions() {
  return [
    radioQuestion("hr_recognition", "What HR activation level does this icon suggest?", ["H1: low activation", "H2: focused activation", "H3: high activation", "H4: overdrive activation"]),
    radioQuestion("hrv_recognition", "What HRV stability level does this icon suggest?", ["V1: high coherence", "V2: stable variability", "V3: reduced variability", "V4: suppressed / fragmented variability"]),
    scaleQuestion("clarity", "How clear was this icon?", "very unclear", "very clear"),
    scaleQuestion("urgency", "How urgent did this icon feel?", "not urgent", "very urgent"),
    scaleQuestion("stability", "How stable or coherent did this icon feel?", "very unstable", "very stable"),
    scaleQuestion("coordination_usefulness", "Would this icon help you coordinate with a teammate?", "not helpful", "very helpful"),
    scaleQuestion("support_intention", "Would this icon make you check on or support this teammate?", "definitely not", "definitely yes"),
    scaleQuestion("valence", "How pleasant or unpleasant did the icon feel?", "very unpleasant", "very pleasant"),
    scaleQuestion("arousal", "How calm or activated did the icon feel?", "very calm", "very activated"),
    scaleQuestion("dominance_control", "How much control did the teammate seem to have?", "overwhelmed / low control", "in control / high control")
  ].join("");
}

function collectAnswers(phase, index, condition, formElement) {
  const responseSubmitTime = new Date().toISOString();
  const responseStart = new Date(studyState.activeTrial.responseStartTime).getTime();
  const record = {
    participant_id: studyState.participantId,
    study_start_time: studyState.studyStartTime,
    timestamp: responseSubmitTime,
    phase: `Phase ${phase}`,
    trial_number: index + 1,
    condition_id: condition.id,
    hr_state: condition.hr,
    hrv_state: condition.hrv,
    randomized_order: studyState.activeTrial.randomizedOrder.join("|"),
    stimulus_start_time: studyState.activeTrial.stimulusStartTime,
    response_start_time: studyState.activeTrial.responseStartTime,
    response_submit_time: responseSubmitTime,
    response_time_ms: Math.max(0, Date.now() - responseStart),
    answers: Object.fromEntries(new FormData(formElement).entries())
  };
  if (phase === "A") {
    studyState.phaseA.push(record);
    studyState.phaseAIndex += 1;
    studyState.currentPage = studyState.phaseAIndex >= 4 ? "training" : "phaseA";
  } else {
    studyState.phaseB.push(record);
    studyState.phaseBIndex += 1;
    if (studyState.phaseBIndex === 8) studyState.currentPage = "break";
    else studyState.currentPage = studyState.phaseBIndex >= 16 ? "final" : "phaseB";
  }
  studyState.activeTrial = null;
  saveProgress();
  renderPage();
}

function validateAnswers(form, showError) {
  const required = [...form.querySelectorAll("[required]")];
  const valid = required.every(input => {
    if (input.type === "radio") return form.querySelector(`[name="${CSS.escape(input.name)}"]:checked`);
    return input.value.trim() !== "";
  });
  if (!valid && showError) {
    document.getElementById("trial-error").textContent = "Please answer every question before continuing.";
    const firstInvalid = required.find(input => input.type === "radio" ? !form.querySelector(`[name="${CSS.escape(input.name)}"]:checked`) : !input.value.trim());
    firstInvalid?.focus();
  }
  return valid;
}

// Required-response gating keeps participants from skipping questions or trials.
function bindRequiredGate(form) {
  const button = form.querySelector('button[type="submit"]');
  const update = () => { button.disabled = !validateAnswers(form, false); };
  form.addEventListener("input", update);
  form.addEventListener("change", update);
  update();
}

function renderBreakPage() {
  app.innerHTML = `<div class="page break-page"><div class="break-icon" aria-hidden="true">Ⅱ</div><p class="eyebrow" style="justify-content:center">Phase B · Halfway point</p><h2>You are halfway through Phase B.</h2><p class="subtitle" style="margin-inline:auto">You may rest briefly before continuing.</p><div class="page-actions"><button class="btn btn-primary" id="break-next">Continue <span class="arrow" aria-hidden="true">→</span></button></div></div>`;
  document.getElementById("break-next").addEventListener("click", () => setPage("phaseB"));
}

function renderFinalQuestionnaire() {
  const openQuestions = [
    ["feature_helped", "Which visual feature helped you most?"],
    ["confusing_states", "Which icon states were most confusing?"],
    ["useful_or_invasive", "Did the icon feel useful or invasive as teammate information?"],
    ["game_preference", "Would you want this kind of interface in a cooperative multiplayer game? Why or why not?"],
    ["improvements", "What would you improve in the icon design?"]
  ];
  const ratings = [
    ["mental_demand", "How mentally demanding was the study?", "very low", "very high"],
    ["effort", "How much effort did it take to interpret the icons?", "very low", "very high"],
    ["frustration", "How frustrating was the study?", "not frustrating", "very frustrating"],
    ["overall_confidence", "How confident are you in your overall responses?", "not confident", "very confident"],
    ["visual_comfort", "How visually comfortable were the animations?", "very uncomfortable", "very comfortable"]
  ];
  app.innerHTML = `<div class="page"><p class="eyebrow">Final questionnaire</p><h2>Reflect on the icon system</h2><p class="body-copy">Your comments help identify what worked and what should change.</p><form id="final-form"><div class="questions">${openQuestions.map(q => textQuestion(...q)).join("")}${ratings.map(q => scaleQuestion(...q)).join("")}</div><p class="validation-note" id="final-error" role="alert"></p><div class="page-actions"><button class="btn btn-primary" type="submit" disabled>Complete Study <span class="arrow" aria-hidden="true">→</span></button></div></form></div>`;
  const finalForm = document.getElementById("final-form");
  bindRequiredGate(finalForm);
  finalForm.addEventListener("submit", event => {
    event.preventDefault();
    if (!validateAnswers(event.currentTarget, false)) {
      document.getElementById("final-error").textContent = "Please answer every question before completing the study.";
      return;
    }
    studyState.finalQuestionnaire = Object.fromEntries(new FormData(event.currentTarget).entries());
    studyState.studyEndTime = new Date().toISOString();
    studyState.exportRows = buildFlatDataRows();
    setPage("results");
  });
}

function renderResultsPage() {
  const completed = studyState.phaseA.length + studyState.phaseB.length;
  const ready = isExportReady();
  const rows = buildFlatDataRows();
  studyState.exportRows = rows;
  saveProgress();
  app.innerHTML = `<div class="page results-page"><div class="success-icon" aria-hidden="true">✓</div><p class="eyebrow" style="justify-content:center">Study complete</p><h2>Thank you for participating.</h2><p class="body-copy" style="margin-inline:auto">Your responses are submitted to the researcher automatically. Downloading a backup copy is still recommended.</p><div class="results-id">${escapeHTML(studyState.participantId)}</div><div class="results-stats"><div class="stat"><strong>${completed}</strong><span>Trials completed</span></div><div class="stat"><strong>${rows.length}</strong><span>Rows ready</span></div></div><div class="submission-panel" id="submission-panel" role="status" aria-live="polite">${onlineSubmissionMarkup()}</div><div class="data-preview"><h3>Export preview</h3><table><tbody><tr><th>Participant ID</th><td>${escapeHTML(studyState.participantId)}</td></tr><tr><th>Phase A trials completed</th><td>${studyState.phaseA.length} / 4</td></tr><tr><th>Phase B trials completed</th><td>${studyState.phaseB.length} / 16</td></tr><tr><th>Final questionnaire completed</th><td>${Object.keys(studyState.finalQuestionnaire).length ? "Yes" : "No"}</td></tr><tr><th>Total rows ready for export</th><td>${rows.length}</td></tr></tbody></table></div>${ready ? "" : '<p class="export-warning" role="alert">Some study data is incomplete. Please complete the study before exporting.</p>'}<p class="copy-status" id="copy-status" role="status"></p><div class="page-actions"><button class="btn" id="export-csv" ${ready ? "" : "disabled"}>Export CSV</button><button class="btn" id="export-excel" ${ready ? "" : "disabled"}>Export Excel-Compatible File</button><button class="btn" id="export-json" ${ready ? "" : "disabled"}>Export JSON</button><button class="btn" id="copy-id">Copy Participant ID</button><button class="btn btn-danger" id="restart-study">Restart Study</button></div>${troubleshootingMarkup()}${devTestMarkup()}</div>`;
  document.getElementById("export-csv").addEventListener("click", () => downloadCSV(rows, participantFilename("csv")));
  document.getElementById("export-excel").addEventListener("click", () => downloadExcelCompatibleFile(studyState));
  document.getElementById("export-json").addEventListener("click", () => downloadJSON());
  document.getElementById("copy-id").addEventListener("click", copyParticipantId);
  document.getElementById("restart-study").addEventListener("click", restartStudy);
  bindSubmissionActions();
  document.getElementById("send-test-row")?.addEventListener("click", () => sendTestRowToGoogleSheet());
  if (ready && !["sending", "sent"].includes(getOnlineSubmission().status)) submitResultsToGoogleSheet();
}

function troubleshootingMarkup() {
  const failed = getOnlineSubmission().status === "failed";
  return `<details class="troubleshooting" id="troubleshooting-panel" ${failed ? "open" : ""}>
    <summary>Results not appearing in your Google Sheet? Check this list</summary>
    <ul>
      <li>Is <code>GOOGLE_SCRIPT_URL</code> in app.js pasted correctly, with no missing quotes or extra spaces?</li>
      <li>Is the Apps Script deployed as a <strong>Web App</strong> (Deploy → New deployment → Web app)?</li>
      <li>Is access set to <strong>Anyone</strong>?</li>
      <li>Did you redeploy (Deploy → Manage deployments → Edit → New version) after the most recent Apps Script edit?</li>
      <li>Is the destination tab named exactly <strong>Responses</strong>?</li>
      <li>Open the browser console (F12) — are there errors logged after clicking "Send Results to Google Sheet"?</li>
    </ul>
    <p>Full setup instructions: <strong>GOOGLE_SHEETS_SETUP.md</strong>.</p>
  </details>`;
}

function devTestMarkup() {
  return `<details class="dev-test-panel" id="dev-test-panel">
    <summary>Developer test (safe to remove before real data collection)</summary>
    <p class="body-copy">Sends a small fixed test payload to verify the Google Sheet connection without using real participant data.</p>
    <button class="btn" id="send-test-row" type="button">Send Test Row to Google Sheet</button>
    <p class="copy-status" id="test-row-status" role="status"></p>
  </details>`;
}

function renderAvatarIcon(condition, container, sizeClass = "") {
  const hrv = condition.hrvState;
  const structureClass = hrv.ringType === "smooth" ? "smooth" : `${hrv.ringType} segmented`;
  container.innerHTML = `<div class="signal-core ${structureClass} ${sizeClass}" role="img" aria-label="Animated simulated teammate status signal"><div class="core-glow"></div><div class="outer-ring"></div><div class="middle-ring"></div><div class="inner-ring"></div><div class="ring-segments"></div><div class="orbit-nodes"></div><svg class="ecg-waveform" viewBox="0 0 160 80" aria-hidden="true"><path class="ecg-baseline" d="M8 40 H152"></path><path class="ecg-line" d="${ECG_PATHS[condition.hr]}"></path></svg></div>`;
  const signalCore = container.firstElementChild;
  applyConditionStyles(condition, signalCore);
  const radius = sizeClass.includes("mini") ? 49 : sizeClass.includes("small") ? 66 : 116;
  generateRingSegments(hrv, signalCore.querySelector(".ring-segments"), radius);
  generateOrbitNodes(hrv, signalCore.querySelector(".orbit-nodes"));
}

function applyConditionStyles(condition, signalCore) {
  const hr = condition.hrState;
  const hrv = condition.hrvState;
  const ecgEnergy = { H1: 0.78, H2: 0.94, H3: 1.10, H4: 1.24 }[condition.hr];
  signalCore.style.setProperty("--pulse-duration", `${hr.pulseDuration}ms`);
  signalCore.style.setProperty("--glow-strength", hr.glowStrength);
  signalCore.style.setProperty("--halo-scale", hr.haloScale);
  signalCore.style.setProperty("--brightness", hr.brightness);
  signalCore.style.setProperty("--jitter-amount", hrv.jitterAmount);
  signalCore.style.setProperty("--wobble-duration", `${hrv.wobbleDuration || 999999}ms`);
  signalCore.style.setProperty("--segment-opacity", Math.max(.4, 1 - hrv.opacityIrregularity));
  signalCore.style.setProperty("--ecg-energy", ecgEnergy);
}

function generateRingSegments(hrvState, ring, radius) {
  if (hrvState.ringType === "smooth") return;
  for (let i = 0; i < hrvState.segments; i += 1) {
    const segment = document.createElement("i");
    segment.className = "signal-segment";
    const angle = (360 / hrvState.segments) * i;
    const deterministic = ((i * 37 + hrvState.segments * 11) % 100) / 100;
    const hidden = deterministic < hrvState.fragmentation;
    const opacityShift = (((i * 23) % 100) / 100) * hrvState.opacityIrregularity;
    const radialJitter = (((i * 17) % 9) - 4) * hrvState.jitterAmount * 0.12;
    segment.style.transform = `rotate(${angle}deg) translateY(-${radius + radialJitter}px)`;
    segment.style.opacity = hidden ? "0" : String(Math.max(.15, 1 - opacityShift));
    if (hrvState.ringType === "broken") segment.style.height = `${5 + (i * 7) % 8}px`;
    ring.appendChild(segment);
  }
}

function generateOrbitNodes(hrvState, orbit) {
  const nodeCount = { smooth: 2, dotted: 3, segmented: 4, broken: 5 }[hrvState.ringType];
  for (let i = 0; i < nodeCount; i += 1) {
    const node = document.createElement("i");
    node.className = "orbit-node";
    const irregularOffset = hrvState.jitterAmount ? ((i * 13) % 9 - 4) * hrvState.jitterAmount * .35 : 0;
    node.style.setProperty("--node-angle", `${(360 / nodeCount) * i + 28 + irregularOffset}deg`);
    node.style.opacity = String(Math.max(.25, 1 - (((i * 31) % 10) / 10) * hrvState.opacityIrregularity));
    orbit.appendChild(node);
  }
}

function radioField(name, label, options, selected = "") {
  return `<div class="field"><fieldset><legend>${label} <span class="required" aria-hidden="true">*</span></legend><div class="option-stack">${options.map((option, i) => `<label class="radio-option"><input type="radio" name="${name}" value="${escapeHTML(option)}" ${selected === option ? "checked" : ""} ${i === 0 ? "required" : ""}><span>${option}</span></label>`).join("")}</div></fieldset></div>`;
}

function radioQuestion(name, label, options) {
  return `<section class="question-block"><fieldset><legend>${label} <span class="required" aria-hidden="true">*</span></legend><div class="option-stack">${options.map((option, i) => `<label class="radio-option"><input type="radio" name="${name}" value="${escapeHTML(option)}" ${i === 0 ? "required" : ""}><span>${option}</span></label>`).join("")}</div></fieldset></section>`;
}

function scaleQuestion(name, label, low, high) {
  return `<section class="question-block"><fieldset><legend>${label} <span class="required" aria-hidden="true">*</span></legend><div class="scale">${[1,2,3,4,5,6,7].map((n, i) => `<label><input type="radio" name="${name}" value="${n}" ${i === 0 ? "required" : ""}><span>${n}</span></label>`).join("")}</div><div class="scale-anchors"><span>1 · ${low}</span><span>7 · ${high}</span></div></fieldset></section>`;
}

function textQuestion(name, label) {
  return `<section class="question-block"><label class="field-label" for="${name}">${label} <span class="required" aria-hidden="true">*</span></label><textarea id="${name}" name="${name}" required maxlength="2000"></textarea></section>`;
}

function updateProgress() {
  const region = document.getElementById("progress-region");
  const page = studyState.currentPage;
  if (page === "landing") { region.hidden = true; return; }
  region.hidden = false;
  let value = PAGE_PROGRESS[page] ?? 0;
  let label = "Study progress";
  if (["phaseA", "fixation", "stimulus", "questions"].includes(page) && (studyState.activeTrial?.phase === "A" || page === "phaseA")) {
    value = 14 + (studyState.phaseAIndex / 4) * 16;
    label = `Phase A · Trial ${Math.min(studyState.phaseAIndex + 1, 4)} of 4`;
  } else if (["phaseB", "break"].includes(page) || studyState.activeTrial?.phase === "B") {
    value = 38 + (studyState.phaseBIndex / 16) * 50;
    label = page === "break" ? "Phase B · Halfway break" : `Phase B · Trial ${Math.min(studyState.phaseBIndex + 1, 16)} of 16`;
  }
  const rounded = Math.round(value);
  document.getElementById("progress-label").textContent = label;
  document.getElementById("progress-percent").textContent = `${rounded}%`;
  document.getElementById("progress-fill").style.width = `${rounded}%`;
  region.querySelector("[role=progressbar]").setAttribute("aria-valuenow", rounded);
}

function updateParticipantChip() {
  const chip = document.getElementById("participant-chip");
  chip.hidden = false;
  document.getElementById("participant-chip-text").textContent = studyState.participantId;
}

function getCondition(id) { return CONDITIONS.find(condition => condition.id === id); }
function getDeviceInfo() { return { userAgent: navigator.userAgent, screenWidth: window.screen.width, screenHeight: window.screen.height }; }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }

function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(studyState)); }
  catch (error) { console.warn("Study progress could not be saved locally.", error); }
}

function buildFlatDataRows() {
  const blankRow = () => Object.fromEntries(DATA_COLUMNS.map(column => [column, ""]));
  const common = () => ({
    participant_id: studyState.participantId,
    study_start_time: studyState.studyStartTime,
    study_end_time: studyState.studyEndTime,
    user_agent: studyState.deviceInfo.userAgent,
    screen_width: studyState.deviceInfo.screenWidth,
    screen_height: studyState.deviceInfo.screenHeight
  });
  const rows = [];

  rows.push({
    ...blankRow(), ...common(), timestamp: studyState.studyStartTime, record_type: "demographics",
    age_range: studyState.demographics.age_range || "",
    gaming_experience: studyState.demographics.gaming_experience || "",
    wearable_experience: studyState.demographics.wearable_experience || "",
    hr_hrv_familiarity: studyState.demographics.hr_hrv_familiarity || "",
    visual_accessibility: studyState.demographics.visual_accessibility || "",
    device_type: studyState.demographics.device_type || ""
  });

  [...studyState.phaseA, ...studyState.phaseB].forEach(record => {
    const row = {
      ...blankRow(), ...common(), timestamp: record.timestamp, record_type: "trial", phase: record.phase,
      trial_number: record.trial_number, condition_id: record.condition_id, hr_state: record.hr_state,
      hrv_state: record.hrv_state, randomized_order: record.randomized_order,
      stimulus_start_time: record.stimulus_start_time, response_start_time: record.response_start_time,
      response_submit_time: record.response_submit_time, response_time_ms: record.response_time_ms
    };
    if (record.phase === "Phase A") {
      Object.assign(row, {
        phaseA_free_text_interpretation: record.answers.interpretation || "",
        phaseA_confidence: record.answers.confidence || "",
        phaseA_best_match: record.answers.best_match || "",
        phaseA_perceived_activation: record.answers.perceived_activation || "",
        phaseA_perceived_stability: record.answers.perceived_stability || ""
      });
    } else {
      Object.assign(row, {
        phaseB_hr_recognition: record.answers.hr_recognition || "",
        phaseB_hrv_recognition: record.answers.hrv_recognition || "",
        phaseB_clarity: record.answers.clarity || "",
        phaseB_urgency: record.answers.urgency || "",
        phaseB_stability: record.answers.stability || "",
        phaseB_coordination_usefulness: record.answers.coordination_usefulness || "",
        phaseB_support_intention: record.answers.support_intention || "",
        phaseB_sam_valence: record.answers.valence || "",
        phaseB_sam_arousal: record.answers.arousal || "",
        phaseB_sam_dominance: record.answers.dominance_control || ""
      });
    }
    rows.push(row);
  });

  rows.push({
    ...blankRow(), ...common(), timestamp: studyState.studyEndTime, record_type: "final_questionnaire",
    final_feature_helped_most: studyState.finalQuestionnaire.feature_helped || "",
    final_confusing_states: studyState.finalQuestionnaire.confusing_states || "",
    final_useful_or_invasive: studyState.finalQuestionnaire.useful_or_invasive || "",
    final_would_use_in_game: studyState.finalQuestionnaire.game_preference || "",
    final_improvement_suggestion: studyState.finalQuestionnaire.improvements || "",
    nasa_mental_demand: studyState.finalQuestionnaire.mental_demand || "",
    nasa_effort: studyState.finalQuestionnaire.effort || "",
    nasa_frustration: studyState.finalQuestionnaire.frustration || "",
    nasa_confidence: studyState.finalQuestionnaire.overall_confidence || "",
    visual_comfort: studyState.finalQuestionnaire.visual_comfort || ""
  });
  return rows;
}

function isExportReady() {
  const demographicFields = ["age_range", "gaming_experience", "wearable_experience", "hr_hrv_familiarity", "visual_accessibility", "device_type"];
  const finalFields = ["feature_helped", "confusing_states", "useful_or_invasive", "game_preference", "improvements", "mental_demand", "effort", "frustration", "overall_confidence", "visual_comfort"];
  return demographicFields.every(field => studyState.demographics[field]) && studyState.phaseA.length === 4 && studyState.phaseB.length === 16 && finalFields.every(field => studyState.finalQuestionnaire[field]);
}

function getOnlineSubmission() {
  if (!studyState.onlineSubmission) studyState.onlineSubmission = { status: "not_submitted", submittedAt: "", error: "" };
  return studyState.onlineSubmission;
}

function isGoogleScriptConfigured() {
  return typeof GOOGLE_SCRIPT_URL === "string" && GOOGLE_SCRIPT_URL.trim() !== "" && GOOGLE_SCRIPT_URL !== GOOGLE_SCRIPT_PLACEHOLDER;
}

// Builds the single object the Apps Script web app expects. Shared by the Google Sheet
// submission and the JSON export so both stay in sync with studyState.
function buildParticipantDataObject() {
  return {
    participantId: studyState.participantId,
    studyStartTime: studyState.studyStartTime,
    studyEndTime: studyState.studyEndTime,
    demographics: studyState.demographics,
    phaseA: studyState.phaseA,
    phaseB: studyState.phaseB,
    finalQuestionnaire: studyState.finalQuestionnaire,
    deviceInfo: studyState.deviceInfo
  };
}

function onlineSubmissionMarkup() {
  const submission = getOnlineSubmission();
  const sendLabel = submission.status === "sent" ? "Send Results to Google Sheet Again" : "Send Results to Google Sheet";
  const sendButton = `<button class="btn submission-retry" id="send-to-sheet" type="button">${sendLabel}</button>`;
  if (!isGoogleScriptConfigured()) {
    return `<span class="submission-indicator failed" aria-hidden="true">!</span><div><strong>Google Sheet submission is not configured yet.</strong><span>Paste your Apps Script Web App URL into GOOGLE_SCRIPT_URL in app.js, then redeploy. See GOOGLE_SHEETS_SETUP.md.</span></div>`;
  }
  if (submission.status === "sending") {
    return `<span class="submission-indicator sending" aria-hidden="true"></span><div><strong>Sending results...</strong><span>Please keep this page open briefly.</span></div>`;
  }
  if (submission.status === "sent") {
    return `<span class="submission-indicator sent" aria-hidden="true">✓</span><div><strong>Results successfully sent to Google Sheet.</strong><span>Sent${submission.submittedAt ? ` at ${escapeHTML(new Date(submission.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}` : ""}. The browser cannot confirm Google Apps Script wrote the row (no-cors mode) — please verify a new row appears in the "Responses" tab.${ALLOW_REPEAT_SUBMISSIONS_FOR_TESTING ? " Test mode currently permits repeat submissions." : ""}</span></div>${sendButton}`;
  }
  if (submission.status === "failed") {
    return `<span class="submission-indicator failed" aria-hidden="true">!</span><div><strong>Google Sheet submission failed. Please export CSV/JSON as backup.</strong><span>${escapeHTML(submission.error || "Check your connection and the browser console, then retry.")}</span></div>${sendButton}`;
  }
  return `<span class="submission-indicator" aria-hidden="true">↗</span><div><strong>Preparing submission</strong><span>Your completed responses will be sent automatically.</span></div>${sendButton}`;
}

function updateOnlineSubmissionPanel() {
  const panel = document.getElementById("submission-panel");
  if (panel) panel.innerHTML = onlineSubmissionMarkup();
  const troubleshooting = document.getElementById("troubleshooting-panel");
  if (troubleshooting) troubleshooting.open = getOnlineSubmission().status === "failed";
  bindSubmissionActions();
}

function bindSubmissionActions() {
  const sendButton = document.getElementById("send-to-sheet");
  if (sendButton) sendButton.addEventListener("click", () => submitResultsToGoogleSheet(true));
}

async function submitResultsToGoogleSheet(forceRepeat = false) {
  if (!isExportReady() || !studyState.consent || studyState.consentVersion !== CURRENT_CONSENT_VERSION) return;
  if (!isGoogleScriptConfigured()) {
    console.error("Google Sheet submission skipped: GOOGLE_SCRIPT_URL is missing or still the placeholder value. Paste your Apps Script Web App URL into app.js.");
    studyState.onlineSubmission = { status: "not_configured", submittedAt: "", error: "GOOGLE_SCRIPT_URL is not configured." };
    saveProgress();
    updateOnlineSubmissionPanel();
    return;
  }
  const submission = getOnlineSubmission();
  if (submission.status === "sending") return;
  if (submission.status === "sent" && !forceRepeat) return;
  studyState.onlineSubmission = { status: "sending", submittedAt: "", error: "" };
  saveProgress();
  updateOnlineSubmissionPanel();
  // The temporary test key lets the same participant resend during development without
  // colliding with a prior row. Code.gs expects { participantId, columns, rows }.
  const submissionId = forceRepeat || ALLOW_REPEAT_SUBMISSIONS_FOR_TESTING ? `${studyState.participantId}-${Date.now()}` : studyState.participantId;
  const payload = { participantId: submissionId, columns: DATA_COLUMNS, rows: buildFlatDataRows() };
  console.log("Submitting study data to Google Sheet:", payload);
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    // mode:"no-cors" makes the response opaque (status is always 0, body unreadable).
    // No thrown error here only means the request reached the network; verify the sheet manually.
    console.log("Google Sheet response:", response, "(opaque response under no-cors — verify the Responses tab manually)");
    studyState.onlineSubmission = { status: "sent", submittedAt: new Date().toISOString(), error: "" };
  } catch (error) {
    console.error("Google Sheet submission failed:", error);
    studyState.onlineSubmission = { status: "failed", submittedAt: "", error: String(error?.message || "Network request failed") };
  }
  saveProgress();
  updateOnlineSubmissionPanel();
}

async function sendTestRowToGoogleSheet() {
  const statusEl = document.getElementById("test-row-status");
  if (!isGoogleScriptConfigured()) {
    console.error("Google Sheet submission skipped: GOOGLE_SCRIPT_URL is missing or still the placeholder value.");
    if (statusEl) statusEl.textContent = "Google Sheet submission is not configured yet.";
    return;
  }
  const testId = `TEST-${Date.now()}`;
  const blankRow = Object.fromEntries(DATA_COLUMNS.map(column => [column, ""]));
  const payload = {
    participantId: testId,
    columns: DATA_COLUMNS,
    rows: [{ ...blankRow, participant_id: testId, record_type: "test", timestamp: new Date().toISOString() }]
  };
  console.log("Submitting study data to Google Sheet:", payload);
  if (statusEl) statusEl.textContent = "Sending test row...";
  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    console.log("Google Sheet response:", response, "(opaque response under no-cors — verify the Responses tab manually)");
    if (statusEl) statusEl.textContent = "Test row sent. Check the Responses tab in your Google Sheet.";
  } catch (error) {
    console.error("Google Sheet submission failed:", error);
    if (statusEl) statusEl.textContent = `Test row failed: ${error?.message || "network error"}.`;
  }
}

function downloadCSV(rows, filename) {
  const csv = [DATA_COLUMNS.map(escapeCSVValue).join(","), ...rows.map(row => DATA_COLUMNS.map(column => escapeCSVValue(row[column] ?? "")).join(","))].join("\r\n");
  downloadFile(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function downloadExcelCompatibleFile(state) {
  if (!isExportReady()) return;
  const rows = buildFlatDataRows();
  const phaseAColumns = ["trial_number", "condition_id", "hr_state", "hrv_state", "randomized_order", "stimulus_start_time", "response_start_time", "response_submit_time", "response_time_ms", "phaseA_free_text_interpretation", "phaseA_confidence", "phaseA_best_match", "phaseA_perceived_activation", "phaseA_perceived_stability"];
  const phaseBColumns = ["trial_number", "condition_id", "hr_state", "hrv_state", "randomized_order", "stimulus_start_time", "response_start_time", "response_submit_time", "response_time_ms", "phaseB_hr_recognition", "phaseB_hrv_recognition", "phaseB_clarity", "phaseB_urgency", "phaseB_stability", "phaseB_coordination_usefulness", "phaseB_support_intention", "phaseB_sam_valence", "phaseB_sam_arousal", "phaseB_sam_dominance"];
  const table = (columns, tableRows) => `<table><thead><tr>${columns.map(column => `<th>${escapeHTML(column)}</th>`).join("")}</tr></thead><tbody>${tableRows.map(row => `<tr>${columns.map(column => `<td>${escapeHTML(row[column] ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const keyValueTable = object => `<table><tbody>${Object.entries(object).map(([key, value]) => `<tr><th>${escapeHTML(key)}</th><td>${escapeHTML(value)}</td></tr>`).join("")}</tbody></table>`;
  const finalRow = rows.find(row => row.record_type === "final_questionnaire");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#111}h1{font-size:20px}h2{margin-top:28px;font-size:16px;background:#dff7fb;padding:7px}table{border-collapse:collapse;margin-bottom:20px}th,td{border:1px solid #8ea4aa;padding:6px;vertical-align:top}th{background:#eef7f9;font-weight:bold}</style></head><body><h1>Simulated Biofeedback Icon Validation Study</h1><h2>Participant Summary</h2>${keyValueTable({ participant_id: state.participantId, study_start_time: state.studyStartTime, study_end_time: state.studyEndTime, phase_a_trials: state.phaseA.length, phase_b_trials: state.phaseB.length })}<h2>Demographics</h2>${keyValueTable(state.demographics)}<h2>Phase A Trial Data</h2>${table(phaseAColumns, rows.filter(row => row.phase === "Phase A"))}<h2>Phase B Trial Data</h2>${table(phaseBColumns, rows.filter(row => row.phase === "Phase B"))}<h2>Final Questionnaire</h2>${keyValueTable(Object.fromEntries(DATA_COLUMNS.filter(column => column.startsWith("final_") || column.startsWith("nasa_") || column === "visual_comfort").map(column => [column, finalRow[column]])))}</body></html>`;
  downloadFile(participantFilename("xls"), `\uFEFF${html}`, "application/vnd.ms-excel;charset=utf-8");
}

function downloadJSON() {
  downloadFile(participantFilename("json"), JSON.stringify(buildParticipantDataObject(), null, 2), "application/json;charset=utf-8");
}

function escapeCSVValue(value) {
  const normalized = String(value ?? "").replace(/\r\n?|\n/g, "\\n");
  return `"${normalized.replace(/"/g, '""')}"`;
}

function participantFilename(extension) { return `participant_${studyState.participantId}_results.${extension}`; }

async function copyParticipantId() {
  const status = document.getElementById("copy-status");
  try {
    await navigator.clipboard.writeText(studyState.participantId);
    status.textContent = "Participant ID copied.";
  } catch (error) {
    const field = document.createElement("textarea");
    field.value = studyState.participantId; field.setAttribute("readonly", ""); field.style.position = "fixed"; field.style.opacity = "0";
    document.body.appendChild(field); field.select(); document.execCommand("copy"); field.remove();
    status.textContent = "Participant ID copied.";
  }
}
function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function restartStudy() {
  if (!window.confirm("Restart the study? This will permanently clear all saved responses on this device.")) return;
  clearTimers();
  localStorage.removeItem(STORAGE_KEY);
  studyState = createInitialState();
  document.getElementById("participant-chip").hidden = true;
  renderPage();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

document.addEventListener("DOMContentLoaded", initStudy);

