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

// ===== Global Variables =====
let selectedQuestions = [];
let currentQuestionIndex = 0;
let timerInterval;
let selectedGradeLevel = "";
let selectedQuarter = "";
let userAnswers = {};
let examTakerName = "";
let examActive = false; // NEW: controls anti-switch and close warning

// ===== Initialization =====
document.addEventListener("DOMContentLoaded", () => {
    toggleElementDisplay("reviewSection", "block");

    // Main buttons
    document.getElementById("loadReviewButton").addEventListener("click", loadReview);
    document.getElementById("proceedToNameButton").addEventListener("click", proceedToName);
    document.getElementById("startButton").addEventListener("click", startExam);
    document.getElementById("prevButton").addEventListener("click", prevQuestion);
    document.getElementById("nextButton").addEventListener("click", nextQuestion);
    document.getElementById("submitButton").addEventListener("click", calculateScore);
    document.getElementById("retakeButton").addEventListener("click", retakeExam);

    // Facebook share
    const shareBtn = document.getElementById("shareResultBtn");
    if (shareBtn) shareBtn.addEventListener("click", shareResultOnFacebook);

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

    // Create the "Exam in progress" banner
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

    // Start timer
    const minutes = selectedQuarter === "remedial" ? settings.remedial.timeInMinutes : settings.timeInMinutes;
    startTimer(minutes * 60, document.querySelector("#countdown"));

    // Mark active & show banner
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
                <input type="radio" name="question" value="${choice}" 
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
    document.getElementById("score").textContent =
        `${examTakerName}, you scored: ${score} out of ${selectedQuestions.length} (${percentage.toFixed(2)}%) in ${gradeText} ${quarterText}.`;
    displayFormattedDate();
    const passingScore = selectedQuarter === "remedial" ? settings.remedial.passingScorePercentage : settings.passingScorePercentage;
    if (percentage >= passingScore) {
        document.getElementById("message").innerHTML = `<h3>Congratulations, ${examTakerName}!</h3><p>You passed.</p>`;
        handleVideoPlay("passVideo");
    } else {
        document.getElementById("message").innerHTML =
            `<h3>Hi ${examTakerName}, here are the questions you missed:</h3><ul>${incorrect.map(q => `<li>${q}</li>`).join("")}</ul>`;
        handleVideoPlay("failVideo");
    }
    toggleElementDisplay("results", "block");
    toggleElementDisplay("examSection", "none");

    // Exam over: disable protections
    examActive = false;
    hideExamBanner();
}

// ===== Misc =====
function retakeExam() {
    location.reload();
}
function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}
function shareResultOnFacebook() {
    const name = examTakerName || "Someone";
    const score = document.getElementById("score")?.textContent || "";
    const gradeText = selectedGradeLevel.replace("grade", "Grade ");
    const quarterText = selectedQuarter === "remedial" ? "REMEDIAL EXAM" : selectedQuarter.replace("quarter", "Quarter ");
    const shareMessage = `${name} just completed the exam! ${score} (${gradeText} ${quarterText}). Try it yourself!`;
    const fbSharer = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(shareMessage)}`;
    window.open(fbSharer, "_blank");
}

// ===== Banner =====
let examBannerEl = null;
function createExamBanner() {
    examBannerEl = document.createElement("div");
    examBannerEl.id = "examBanner";
    examBannerEl.style.position = "fixed";
    examBannerEl.style.top = "0";
    examBannerEl.style.left = "0";
    examBannerEl.style.right = "0";
    examBannerEl.style.zIndex = "9999";
    examBannerEl.style.padding = "10px 16px";
    examBannerEl.style.textAlign = "center";
    examBannerEl.style.fontWeight = "600";
    examBannerEl.style.fontFamily = "system-ui, Arial, sans-serif";
    examBannerEl.style.background = "#fff3cd";
    examBannerEl.style.borderBottom = "1px solid #f1d58a";
    examBannerEl.style.display = "none";
    examBannerEl.textContent = "Exam in progress — please do not switch tabs or apps. Switching will reset your exam.";
    document.body.appendChild(examBannerEl);
}
function showExamBanner() {
    if (examBannerEl) examBannerEl.style.display = "block";
}
function hideExamBanner() {
    if (examBannerEl) examBannerEl.style.display = "none";
}

// ===== Restrictions =====
document.addEventListener("visibilitychange", () => {
    if (!examActive) return;
    if (document.visibilityState === "hidden") {
        alert("You have switched away from the exam. The exam will now reset.");
        location.reload();
    }
});
// Warn on tab close/reload while exam is active
window.addEventListener("beforeunload", (e) => {
    if (!examActive) return;
    e.preventDefault();
    e.returnValue = "";
});
