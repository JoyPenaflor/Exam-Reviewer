// ===== Global Exam Settings =====
const settings = {
  numberOfItems: 10, // <- change here for regular quarters
  passingScorePercentage: 75,
  timeInMinutes: 10,
  remedial: { numberOfItems: 8, passingScorePercentage: 75, timeInMinutes: 10 }, // <- change here for remedial
  enableQuarters: true,
  enabledQuarters: { quarter1: true, quarter2: true, quarter3: true, quarter4: true, remedial: true }
};

// ===== Globals =====
let selectedQuestions = [];
let currentQuestionIndex = 0;
let timerInterval;
let selectedGradeLevel = "";
let selectedQuarter = "";
let userAnswers = {};
let examTakerName = "";
let examActive = false;
let lastResultPassed = null;
let violationHandled = false;

// ===== Toast =====
let toastEl = null;
function ensureToast() {
  if (toastEl) return toastEl;
  toastEl = document.createElement("div");
  Object.assign(toastEl.style, {
    position: "fixed", bottom: "16px", left: "50%", transform: "translateX(-50%)",
    maxWidth: "90%", padding: "10px 14px", background: "rgba(0,0,0,0.85)", color: "#fff",
    borderRadius: "10px", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    fontSize: "14px", zIndex: "10000", opacity: "0", transition: "opacity 160ms ease", pointerEvents: "none",
  });
  document.body.appendChild(toastEl);
  return toastEl;
}
let toastTimer = null;
function showToast(msg, duration = 1500) {
  const el = ensureToast(); el.textContent = msg; el.style.opacity = "1";
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.style.opacity = "0"; }, duration);
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  toggleElementDisplay("reviewSection", "block");

  document.getElementById("loadReviewButton").addEventListener("click", loadReview);
  document.getElementById("proceedToNameButton").addEventListener("click", proceedToName);
  document.getElementById("startButton").addEventListener("click", startExam);
  document.getElementById("prevButton").addEventListener("click", prevQuestion);
  document.getElementById("nextButton").addEventListener("click", nextQuestion);
  document.getElementById("submitButton").addEventListener("click", calculateScore);
  document.getElementById("retakeButton").addEventListener("click", retakeExam);

  const saveImgBtn = document.getElementById("shareResultBtn");
  if (saveImgBtn) saveImgBtn.addEventListener("click", generateAndSaveResultImage);

  // Enable/disable quarters from settings
  const quarterSelect = document.getElementById("quarter");
  if (quarterSelect) {
    for (const q of Array.from(quarterSelect.options)) {
      const key = q.value;
      if (settings.enabledQuarters[key] === false) q.disabled = true;
    }
  }

  createExamBanner();
});

// ===== Fetch helpers =====
async function fetchQuestions(fileName) { return fetchFromGitHub(fileName, "json"); }
async function fetchReview(fileName) { return fetchFromGitHub(fileName, "text"); }
async function fetchFromGitHub(fileName, type) {
  try {
    const url = `https://raw.githubusercontent.com/JoyPenaflor/Exam-Reviewer/main/${fileName}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return type === "json" ? await response.json() : await response.text();
  } catch (error) {
    console.error(`Failed to load ${fileName}:`, error);
    alert(`Failed to load ${fileName}. Please check the GitHub link or file permissions.`);
    return type === "json" ? [] : "";
  }
}

// ===== UI helpers =====
function toggleElementDisplay(id, style) { const el = document.getElementById(id); if (el) el.style.display = style; }
function handleVideoPlay(videoId) {
  const video = document.getElementById(videoId); if (!video) return;
  video.pause(); video.currentTime = 0; video.style.display = "block";
  video.play().catch(() => console.log(`Playback failed: ${videoId}`));
}
function displayFormattedDate() { const ts = document.getElementById("timestamp"); if (ts) ts.textContent = `Date and Time: ${new Date().toLocaleString()}`; }

// ===== Review flow =====
async function loadReview() {
  const grade = document.getElementById("reviewGradeLevel").value;
  const quarter = document.getElementById("reviewQuarter").value;
  const fileName = `${grade}_${quarter}_review.txt`;
  document.getElementById("reviewContent").textContent = await fetchReview(fileName);
  toggleElementDisplay("proceedToNameButton", "block");
}
function proceedToName() { toggleElementDisplay("reviewSection", "none"); toggleElementDisplay("nameSection", "block"); }

// ===== Exam flow =====
async function startExam() {
  selectedGradeLevel = document.getElementById("gradeLevel").value;
  selectedQuarter = document.getElementById("quarter").value;
  examTakerName = document.getElementById("fullName").value.trim();

  if (!examTakerName) { alert("Please enter your full name. Example: Dan B. Penaflor"); return; }
  if (settings.enabledQuarters[selectedQuarter] === false) { alert("This quarter is disabled."); return; }

  if (selectedQuarter === "remedial") { await fetchRemedialQuestions(); } else { await loadQuarterQuestions(); }

  toggleElementDisplay("nameSection", "none");
  toggleElementDisplay("examSection", "block");

  const minutes = selectedQuarter === "remedial" ? settings.remedial.timeInMinutes : settings.timeInMinutes;
  startTimer(minutes * 60, document.querySelector("#countdown"));

  examActive = true; violationHandled = false;
  showExamBanner();
  displayQuestion();
}

// Regular quarter questions
async function loadQuarterQuestions() {
  const fileName = `${selectedGradeLevel}_${selectedQuarter}.json`;
  let allQuestions = await fetchQuestions(fileName);
  console.log("[Exam] Loaded questions:", allQuestions.length, "requested:", settings.numberOfItems);
  if (allQuestions.length === 0) { alert("No questions available."); return; }
  shuffleArray(allQuestions);
  if (allQuestions.length < settings.numberOfItems) {
    alert(`Warning: Only ${allQuestions.length} questions available, but ${settings.numberOfItems} were requested.`);
  }
  selectedQuestions = allQuestions.slice(0, settings.numberOfItems);
  console.log("[Exam] Using", selectedQuestions.length, "questions for", selectedQuarter);
}

// Remedial mixes from all quarters
async function fetchRemedialQuestions() {
  const quarters = ["quarter1", "quarter2", "quarter3", "quarter4"];
  const desired = settings.remedial.numberOfItems;
  const perQuarter = Math.max(1, Math.ceil(desired / quarters.length));
  let pool = [];

  for (const q of quarters) {
    const fileName = `${selectedGradeLevel}_${q}.json`;
    const questions = await fetchQuestions(fileName);
    console.log(`[Remedial] ${q}: loaded ${questions.length}`);
    if (questions.length) {
      shuffleArray(questions);
      pool.push(...questions.slice(0, perQuarter));
    }
  }
  shuffleArray(pool);
  selectedQuestions = pool.slice(0, desired);
  console.log("[Remedial] Built pool:", pool.length, "Using:", selectedQuestions.length, "requested:", desired);
}

// ===== Timer =====
function startTimer(duration, display) {
  let timer = duration;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const minutes = String(Math.floor(timer / 60)).padStart(2, "0");
    const seconds = String(timer % 60).padStart(2, "0");
    if (display) display.textContent = `${minutes}:${seconds}`;
    if (--timer < 0) { clearInterval(timerInterval); calculateScore(); }
  }, 1000);
}

// ===== Questions =====
function displayQuestion() {
  const questionObj = selectedQuestions[currentQuestionIndex];
  const shuffledChoices = shuffleArray([...questionObj.choices]);
  const container = document.getElementById("questionContainer");
  container.innerHTML = `
    <div id="progress" style="margin:8px 0 6px; font-size:.95rem; opacity:.85;">
      Question ${currentQuestionIndex + 1} of ${selectedQuestions.length}
    </div>
    <h3 style="margin:6px 0 10px;">${questionObj.question}</h3>
    ${shuffledChoices.map(choice => `
      <label style="display:inline-flex; align-items:center; gap:8px; padding:6px 4px;">
        <input type="radio" name="question" value="${choice}" style="transform: scale(1.1); margin-right: 6px;"
          ${userAnswers[currentQuestionIndex] === choice ? "checked" : ""}>
        ${choice}
      </label><br>
    `).join("")}
  `;
  document.getElementById("prevButton").disabled = currentQuestionIndex === 0;
  document.getElementById("nextButton").disabled = currentQuestionIndex === selectedQuestions.length - 1;
  document.getElementById("submitContainer").style.display =
    currentQuestionIndex === selectedQuestions.length - 1 ? "block" : "none";
}
function nextQuestion() { saveAnswer(); if (currentQuestionIndex < selectedQuestions.length - 1) { currentQuestionIndex++; displayQuestion(); } }
function prevQuestion() { saveAnswer(); if (currentQuestionIndex > 0) { currentQuestionIndex--; displayQuestion(); } }
function saveAnswer() { const selected = document.querySelector('input[name="question"]:checked'); if (selected) userAnswers[currentQuestionIndex] = selected.value; }

// ===== Score =====
function calculateScore() {
  clearInterval(timerInterval);
  saveAnswer();

  let score = 0; const incorrect = [];
  selectedQuestions.forEach((q, i) => { if (userAnswers[i] === q.answer) score++; else incorrect.push(q.question); });

  const percentage = (score / selectedQuestions.length) * 100;
  const gradeText = selectedGradeLevel.replace("grade", "Grade ");
  const quarterText = selectedQuarter === "remedial" ? "REMEDIAL EXAM" : selectedQuarter.replace("quarter", "Quarter ");

  const scoreEl = document.getElementById("score");
  if (scoreEl) scoreEl.textContent = `${examTakerName}, you scored: ${score} out of ${selectedQuestions.length} (${percentage.toFixed(2)}%) in ${gradeText} ${quarterText}.`;

  displayFormattedDate();

  const passingScore = selectedQuarter === "remedial" ? settings.remedial.passingScorePercentage : settings.passingScorePercentage;
  lastResultPassed = percentage >= passingScore;

  let messageHTML = "";
  if (lastResultPassed) { messageHTML = `<h3>Congratulations, ${examTakerName}!</h3><p>You passed the exam in ${gradeText} ${quarterText}.</p>`; handleVideoPlay("passVideo"); }
  else { messageHTML = `<h3>Hi ${examTakerName}, here are the questions you missed in ${gradeText} ${quarterText}:</h3><ul>${incorrect.map(q => `<li>${q}</li>`).join("")}</ul>`; handleVideoPlay("failVideo"); }

  document.getElementById("message").innerHTML = messageHTML;
  toggleElementDisplay("results", "block"); toggleElementDisplay("examSection", "none");

  examActive = false; hideExamBanner();
}

// ===== Save Result Image =====
async function generateAndSaveResultImage() {
  if (typeof html2canvas === "undefined") await loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
  const resultsEl = document.getElementById("results"); if (!resultsEl) { alert("Results are not visible yet."); return; }
  showToast("Rendering image…", 1200);
  const prevDisplay = resultsEl.style.display; resultsEl.style.display = "block";
  const canvas = await html2canvas(resultsEl, { scale: window.devicePixelRatio > 1 ? 2 : 1, backgroundColor: "#ffffff", useCORS: true });

  const ctx = canvas.getContext("2d");
  const label = lastResultPassed ? "PASSED" : "FAILED";
  const color = lastResultPassed ? "rgba(0, 128, 0, 0.75)" : "rgba(200, 0, 0, 0.75)";
  const base = canvas.width; const fontSize = Math.max(36, Math.floor(base * 0.07));
  ctx.save(); ctx.translate(canvas.width/2, canvas.height/2); ctx.rotate(-Math.PI/8); ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`; ctx.fillStyle = color; ctx.strokeStyle="rgba(255,255,255,0.9)"; ctx.lineWidth = Math.max(6, Math.floor(fontSize*0.12));
  ctx.strokeText(label, 0, 0); ctx.fillText(label, 0, 0); ctx.restore();
  ctx.save(); ctx.textAlign="right"; ctx.textBaseline="bottom"; ctx.font = `500 ${Math.max(14, Math.floor(fontSize*0.35))}px system-ui, Arial`; ctx.fillStyle="rgba(0,0,0,0.6)";
  const dateStr = new Date().toLocaleString(); ctx.fillText(`TTVHS TLE | ${dateStr}`, canvas.width-16, canvas.height-12); ctx.restore();
  resultsEl.style.display = prevDisplay || "block";

  const dataURL = canvas.toDataURL("image/png"); showToast("Saving image…", 1200);
  await downloadDataURL(dataURL, makeResultFilename()); showToast("Saved to Downloads.", 1600);
}

function makeResultFilename() {
  const safeName = (examTakerName || "Exam_Result").replace(/[^a-z0-9_\-]+/gi, "_").replace(/_{2,}/g, "_");
  return `${safeName}_TLE_Result_${Date.now()}.png`;
}
async function downloadDataURL(dataURL, filename) {
  const response = await fetch(dataURL); const blob = await response.blob();
  if (window.showSaveFilePicker) { try {
      const handle = await window.showSaveFilePicker({ suggestedName: filename, types: [{ description: "PNG Image", accept: { "image/png": [".png"] } }] });
      const writable = await handle.createWritable(); await writable.write(blob); await writable.close(); return;
    } catch (err) { console.log("Save dialog canceled/blocked, falling back:", err); } }
  if (navigator.msSaveOrOpenBlob) { navigator.msSaveOrOpenBlob(blob, filename); return; }
  const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function loadScript(src) { return new Promise((resolve, reject) => { const s=document.createElement("script"); s.src=src; s.onload=resolve; s.onerror=reject; document.head.appendChild(s); }); }

// ===== Misc =====
function retakeExam() { location.reload(); }
function shuffleArray(arr) { for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }

// ===== Banner =====
let examBannerEl=null;
function createExamBanner(){
  examBannerEl=document.createElement("div");
  Object.assign(examBannerEl.style,{position:"fixed",top:"0",left:"0",right:"0",zIndex:"9999",padding:"10px 16px",textAlign:"center",fontWeight:"600",fontFamily:"system-ui, Arial, sans-serif",boxShadow:"0 2px 8px rgba(0,0,0,.1)",background:"#fff3cd",borderBottom:"1px solid #f1d58a",display:"none"});
  examBannerEl.textContent="Exam in progress — please do not switch tabs or apps. Switching will reset your exam.";
  document.body.appendChild(examBannerEl);
  const spacer=document.createElement("div"); spacer.id="examBannerSpacer"; spacer.style.height="0px"; document.body.prepend(spacer);
}
function showExamBanner(){ if(!examBannerEl) return; examBannerEl.style.display="block"; const spacer=document.getElementById("examBannerSpacer"); if(spacer) spacer.style.height=examBannerEl.offsetHeight+"px"; }
function hideExamBanner(){ if(!examBannerEl) return; examBannerEl.style.display="none"; const spacer=document.getElementById("examBannerSpacer"); if(spacer) spacer.style.height="0px"; }

// ===== Anti-switch enforcement =====
function handleFocusViolation(reason){
  if (!examActive || violationHandled) return;
  violationHandled = true;
  alert(`Exam reset: ${reason}`);
  location.reload();
}
document.addEventListener("visibilitychange", () => {
  if (!examActive) return;
  if (document.visibilityState !== "visible") handleFocusViolation("you left the exam screen");
});
window.addEventListener("blur", () => {
  if (!examActive) return;
  setTimeout(() => { if (!document.hasFocus()) handleFocusViolation("window lost focus"); }, 100);
});
window.addEventListener("pagehide", () => {
  if (!examActive) return;
  handleFocusViolation("page was hidden");
});
window.addEventListener("beforeunload", (e) => {
  if (!examActive) return;
  e.preventDefault(); e.returnValue = "";
});
