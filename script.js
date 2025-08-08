// ===== Global Exam Settings =====
const settings = {
  numberOfItems: 20,
  passingScorePercentage: 75,
  timeInMinutes: 10,
  remedial: {
    numberOfItems: 20,
    passingScorePercentage: 75,
    timeInMinutes: 10
  },
  enableQuarters: true,
  enabledQuarters: {
    quarter1: true,
    quarter2: false,
    quarter3: false,
    quarter4: false,
    remedial: false
  }
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
let lastResultPassed = null; // NEW: remember pass/fail for the stamp

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  toggleElementDisplay("reviewSection", "block");

  // Buttons
  document.getElementById("loadReviewButton").addEventListener("click", loadReview);
  document.getElementById("proceedToNameButton").addEventListener("click", proceedToName);
  document.getElementById("startButton").addEventListener("click", startExam);
  document.getElementById("prevButton").addEventListener("click", prevQuestion);
  document.getElementById("nextButton").addEventListener("click", nextQuestion);
  document.getElementById("submitButton").addEventListener("click", calculateScore);
  document.getElementById("retakeButton").addEventListener("click", retakeExam);

  // Repurpose share button to "Save Result Image"
  const saveImgBtn = document.getElementById("shareResultBtn");
  if (saveImgBtn) saveImgBtn.addEventListener("click", generateAndSaveResultImage);

  // Enable/disable quarters
  if (!settings.enableQuarters) {
    document.getElementById("quarter").disabled = true;
  } else {
    for (const quarter in settings.enabledQuarters) {
      if (!settings.enabledQuarters[quarter]) {
        const opt = document.getElementById(quarter);
        if (opt) opt.disabled = true;
      }
    }
  }

  // Banner
  createExamBanner();
});

// ===== Fetch helpers =====
async function fetchQuestions(fileName) {
  return fetchFromGitHub(fileName, "json");
}
async function fetchReview(fileName) {
  return fetchFromGitHub(fileName, "text");
}
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
function toggleElementDisplay(id, style) {
  const el = document.getElementById(id);
  if (el) el.style.display = style;
}
function handleVideoPlay(videoId) {
  const video = document.getElementById(videoId);
  if (!video) return;
  video.pause();
  video.currentTime = 0;
  video.style.display = "block";
  video.play().catch(() => console.log(`Playback failed: ${videoId}`));
}
function displayFormattedDate() {
  const ts = document.getElementById("timestamp");
  if (ts) ts.textContent = `Date and Time: ${new Date().toLocaleString()}`;
}

// ===== Review flow =====
async function loadReview() {
  const grade = document.getElementById("reviewGradeLevel").value;
  const quarter = document.getElementById("reviewQuarter").value;
  const fileName = `${grade}_${quarter}_review.txt`;
  document.getElementById("reviewContent").textContent = await fetchReview(fileName);
  toggleElementDisplay("proceedToNameButton", "block");
}
function proceedToName() {
  toggleElementDisplay("reviewSection", "none");
  toggleElementDisplay("nameSection", "block");
}

// ===== Exam flow =====
async function startExam() {
  selectedGradeLevel = document.getElementById("gradeLevel").value;
  selectedQuarter = document.getElementById("quarter").value;
  examTakerName = document.getElementById("fullName").value.trim();

  if (!examTakerName) {
    alert("Please enter your full name. Example: Dan B. Penaflor");
    return;
  }
  if (!settings.enabledQuarters[selectedQuarter]) {
    alert("This quarter is disabled.");
    return;
  }

  if (selectedQuarter === "remedial") {
    await fetchRemedialQuestions();
  } else {
    await loadQuarterQuestions();
  }

  toggleElementDisplay("nameSection", "none");
  toggleElementDisplay("examSection", "block");

  const minutes = selectedQuarter === "remedial" ? settings.remedial.timeInMinutes : settings.timeInMinutes;
  startTimer(minutes * 60, document.querySelector("#countdown"));

  examActive = true;
  showExamBanner();
  displayQuestion();
}

async function loadQuarterQuestions() {
  const fileName = `${selectedGradeLevel}_${selectedQuarter}.json`;
  const allQuestions = await fetchQuestions(fileName);
  if (allQuestions.length === 0) {
    alert("No questions available.");
    return;
  }
  shuffleArray(allQuestions);
  if (allQuestions.length < settings.numberOfItems) {
    alert(`Warning: Only ${allQuestions.length} questions available, but ${settings.numberOfItems} were requested.`);
  }
  selectedQuestions = allQuestions.slice(0, settings.numberOfItems);
}
async function fetchRemedialQuestions() {
  const quarters = ["quarter1", "quarter2", "quarter3", "quarter4"];
  let allQuestions = [];
  for (const q of quarters) {
    const fileName = `${selectedGradeLevel}_${q}.json`;
    const questions = await fetchQuestions(fileName);
    if (questions.length) {
      shuffleArray(questions);
      allQuestions.push(...questions.slice(0, 10));
    }
  }
  shuffleArray(allQuestions);
  selectedQuestions = allQuestions.slice(0, settings.remedial.numberOfItems);
}

// ===== Timer =====
function startTimer(duration, display) {
  let timer = duration;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const minutes = String(Math.floor(timer / 60)).padStart(2, "0");
    const seconds = String(timer % 60).padStart(2, "0");
    if (display) display.textContent = `${minutes}:${seconds}`;
    if (--timer < 0) {
      clearInterval(timerInterval);
      calculateScore();
    }
  }, 1000);
}

// ===== Questions =====
function displayQuestion() {
  const questionObj = selectedQuestions[currentQuestionIndex];
  const shuffledChoices = shuffleArray([...questionObj.choices]);
  document.getElementById("questionContainer").innerHTML = `
    <h3>${questionObj.question}</h3>
    ${shuffledChoices.map(choice => `
      <label style="font-size: 1.2em;">
        <input type="radio" name="question" value="${choice}" style="transform: scale(1.1); margin-right: 10px;"
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
function nextQuestion() {
  saveAnswer();
  if (currentQuestionIndex < selectedQuestions.length - 1) {
    currentQuestionIndex++;
    displayQuestion();
  }
}
function prevQuestion() {
  saveAnswer();
  if (currentQuestionIndex > 0) {
    currentQuestionIndex--;
    displayQuestion();
  }
}
function saveAnswer() {
  const selected = document.querySelector('input[name="question"]:checked');
  if (selected) userAnswers[currentQuestionIndex] = selected.value;
}

// ===== Score =====
function calculateScore() {
  clearInterval(timerInterval);
  saveAnswer();

  let score = 0;
  const incorrect = [];
  selectedQuestions.forEach((q, i) => {
    if (userAnswers[i] === q.answer) score++;
    else incorrect.push(q.question);
  });

  const percentage = (score / selectedQuestions.length) * 100;
  const gradeText = selectedGradeLevel.replace("grade", "Grade ");
  const quarterText = selectedQuarter === "remedial" ? "REMEDIAL EXAM" : selectedQuarter.replace("quarter", "Quarter ");

  const scoreEl = document.getElementById("score");
  if (scoreEl) {
    scoreEl.textContent =
      `${examTakerName}, you scored: ${score} out of ${selectedQuestions.length} (${percentage.toFixed(2)}%) in ${gradeText} ${quarterText}.`;
  }

  displayFormattedDate();

  const passingScore = selectedQuarter === "remedial" ? settings.remedial.passingScorePercentage : settings.passingScorePercentage;
  lastResultPassed = percentage >= passingScore;

  let messageHTML = "";
  if (lastResultPassed) {
    messageHTML = `<h3>Congratulations, ${examTakerName}!</h3><p>You passed the exam in ${gradeText} ${quarterText}.</p>`;
    handleVideoPlay("passVideo");
  } else {
    messageHTML = `<h3>Hi ${examTakerName}, here are the questions you missed in ${gradeText} ${quarterText}:</h3><ul>${incorrect.map(q => `<li>${q}</li>`).join("")}</ul>`;
    handleVideoPlay("failVideo");
  }
  document.getElementById("message").innerHTML = messageHTML;

  toggleElementDisplay("results", "block");
  toggleElementDisplay("examSection", "none");

  examActive = false;
  hideExamBanner();
}

// ===== Save Result as Image (with PASSED/FAILED stamp) =====
async function generateAndSaveResultImage() {
  // Ensure html2canvas is present (fallback: dynamic load)
  if (typeof html2canvas === "undefined") {
    await loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
  }

  const resultsEl = document.getElementById("results");
  if (!resultsEl) {
    alert("Results are not visible yet.");
    return;
  }

  // Temporarily ensure results are visible for capture
  const prevDisplay = resultsEl.style.display;
  resultsEl.style.display = "block";

  // Render to canvas
  const canvas = await html2canvas(resultsEl, {
    scale: window.devicePixelRatio > 1 ? 2 : 1,
    backgroundColor: "#ffffff",
    useCORS: true
  });

  // Overlay PASSED/FAILED
  const ctx = canvas.getContext("2d");
  const label = lastResultPassed ? "PASSED" : "FAILED";
  const color = lastResultPassed ? "rgba(0, 128, 0, 0.75)" : "rgba(200, 0, 0, 0.75)";

  // Dynamic font size relative to width
  const base = canvas.width;
  const fontSize = Math.max(36, Math.floor(base * 0.07));
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 8); // slight diagonal
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Arial`;
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(6, Math.floor(fontSize * 0.12));
  ctx.strokeText(label, 0, 0);
  ctx.fillText(label, 0, 0);
  ctx.restore();

  // Add small footer watermark with date
  ctx.save();
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.font = `500 ${Math.max(14, Math.floor(fontSize * 0.35))}px system-ui, Arial`;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  const dateStr = new Date().toLocaleString();
  ctx.fillText(`TTVHS TLE | ${dateStr}`, canvas.width - 16, canvas.height - 12);
  ctx.restore();

  // Restore visibility state
  resultsEl.style.display = prevDisplay || "block";

  // Save / open image
  const dataURL = canvas.toDataURL("image/png");
  downloadDataURL(dataURL, makeResultFilename());
}

function makeResultFilename() {
  const safeName = (examTakerName || "Exam_Result")
    .replace(/[^a-z0-9_\-]+/gi, "_")
    .replace(/_{2,}/g, "_");
  return `${safeName}_TLE_Result_${Date.now()}.png`;
}

function downloadDataURL(dataURL, filename) {
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = filename;

  // Some iOS/Android browsers ignore a.download. Fallback: open the image so user can long-press/save.
  const supportsDownload = "download" in a;
  if (supportsDownload) {
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${dataURL}" frameborder="0" style="border:0; top:0; left:0; bottom:0; right:0; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
      // Worst case: prompt the raw URL
      prompt("Copy this image URL to save:", dataURL);
    }
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ===== Misc =====
function retakeExam() { location.reload(); }
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== Banner =====
let examBannerEl = null;
function createExamBanner() {
  examBannerEl = document.createElement("div");
  examBannerEl.id = "examBanner";
  examBannerEl.setAttribute("aria-live", "polite");
  Object.assign(examBannerEl.style, {
    position: "fixed",
    top: "0", left: "0", right: "0",
    zIndex: "9999",
    padding: "10px 16px",
    textAlign: "center",
    fontWeight: "600",
    fontFamily: "system-ui, Arial, sans-serif",
    boxShadow: "0 2px 8px rgba(0,0,0,.1)",
    background: "#fff3cd",
    borderBottom: "1px solid #f1d58a",
    display: "none"
  });
  examBannerEl.textContent = "Exam in progress — please do not switch tabs or apps. Switching will reset your exam.";
  document.body.appendChild(examBannerEl);

  // Spacer to avoid layout jump (optional)
  const spacer = document.createElement("div");
  spacer.id = "examBannerSpacer";
  spacer.style.height = "0px";
  document.body.prepend(spacer);
}
function showExamBanner() {
  if (!examBannerEl) return;
  examBannerEl.style.display = "block";
  const spacer = document.getElementById("examBannerSpacer");
  if (spacer) spacer.style.height = examBannerEl.offsetHeight + "px";
}
function hideExamBanner() {
  if (!examBannerEl) return;
  examBannerEl.style.display = "none";
  const spacer = document.getElementById("examBannerSpacer");
  if (spacer) spacer.style.height = "0px";
}

// ===== Restrictions: only while exam is active =====
document.addEventListener("visibilitychange", () => {
  if (!examActive) return;
  if (document.visibilityState === "hidden") {
    alert("You have switched away from the exam. The exam will now reset.");
    location.reload();
  }
});
window.addEventListener("beforeunload", (e) => {
  if (!examActive) return;
  e.preventDefault();
  e.returnValue = "";
});
