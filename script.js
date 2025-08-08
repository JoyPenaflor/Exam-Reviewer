// Global settings for the exam



const settings = {


    numberOfItems: 20, // Number of questions to display in the exam (change to test!)


    passingScorePercentage: 75, // Percentage score required to pass the exam


    timeInMinutes: 10, // Time allowed for the exam


    remedial: {


        numberOfItems: 20, // Number of questions for the remedial exam


        passingScorePercentage: 75, // Percentage score required to pass the remedial exam


        timeInMinutes: 10 // Time allowed for the remedial exam


    },


    enableQuarters: true, // Enable or disable the exam quarter selection


    enabledQuarters: { // Enable or disable specific quarters


        quarter1: true,


        quarter2: false,


        quarter3: false,


        quarter4: false,


        remedial: false


    }


};





let selectedQuestions = [];


let currentQuestionIndex = 0;


let timerInterval;


let selectedGradeLevel = "";


let selectedQuarter = "";


let userAnswers = {}; 


let examTakerName = "";





document.getElementById("loadReviewButton").addEventListener("click", loadReview);


document.getElementById("proceedToNameButton").addEventListener("click", proceedToName);


document.getElementById("startButton").addEventListener("click", startExam);


document.getElementById("prevButton").addEventListener("click", prevQuestion);


document.getElementById("nextButton").addEventListener("click", nextQuestion);


document.getElementById("submitButton").addEventListener("click", calculateScore);


document.getElementById("retakeButton").addEventListener("click", retakeExam);





if (!settings.enableQuarters) {


    document.getElementById("quarter").disabled = true;


} else {


    for (const quarter in settings.enabledQuarters) {


        if (!settings.enabledQuarters[quarter]) {


            document.getElementById(quarter).disabled = true;


        }


    }


}





async function fetchQuestions(fileName) {


    try {


        const response = await fetch(`https://raw.githubusercontent.com/JoyPenaflor/Exam-Reviewer/main/${fileName}`);


        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);


        return await response.json();


    } catch (error) {


        console.error("Failed to load questions:", error);


        alert("Failed to load exam data. Please check your GitHub link or file permissions and try again.");


        return [];


    }


}





async function fetchReview(fileName) {


    try {


        const response = await fetch(`https://raw.githubusercontent.com/JoyPenaflor/Exam-Reviewer/main/${fileName}`);


        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);


        return await response.text();


    } catch (error) {


        console.error("Failed to load review content:", error);


        alert("Failed to load review content. Please check your GitHub link or file permissions and try again.");


        return "";


    }


}





function toggleElementDisplay(element, displayStyle) {


    document.getElementById(element).style.display = displayStyle;


}





function handleVideoPlay(videoId) {


    const video = document.getElementById(videoId);


    video.pause();


    video.currentTime = 0;


    video.style.display = "block";


    video.play().catch(() => console.log(`${videoId} playback failed.`));


}





function displayFormattedDate() {


    const dateTime = new Date();


    const formattedDateTime = dateTime.toLocaleString();


    document.getElementById("timestamp").textContent = `Date and Time: ${formattedDateTime}`;


}





async function loadReview() {


    const gradeLevel = document.getElementById("reviewGradeLevel").value;


    const quarter = document.getElementById("reviewQuarter").value;


    const fileName = `${gradeLevel}_${quarter}_review.txt`;


    const reviewContent = await fetchReview(fileName);


    document.getElementById("reviewContent").textContent = reviewContent;


    toggleElementDisplay("proceedToNameButton", "block");


}





function proceedToName() {


    toggleElementDisplay("reviewSection", "none");


    toggleElementDisplay("nameSection", "block");


}





// MAIN EXAM START LOGIC WITH DEBUGGING


async function startExam() {


    console.log("Start Exam function triggered");


    


    selectedGradeLevel = document.getElementById("gradeLevel").value;


    selectedQuarter = document.getElementById("quarter").value;


    examTakerName = document.getElementById("fullName").value.trim();





    if (examTakerName === "") {


        alert("Please enter your full name. Example: Dan B. Penaflor");


        return;


    }





    if (!settings.enabledQuarters[selectedQuarter]) {


        alert("This quarter is disabled and cannot be selected for the exam.");


        return;


    }





    if (selectedQuarter === "remedial") {


        await fetchRemedialQuestions();


    } else {


        const fileName = `${selectedGradeLevel}_${selectedQuarter}.json`;


        const allQuestions = await fetchQuestions(fileName);





        if (allQuestions.length === 0) {


            alert("No questions available. Please check the source file.");


            return;


        }





        console.log(`[DEBUG] settings.numberOfItems: ${settings.numberOfItems}`);


        console.log(`[DEBUG] allQuestions.length: ${allQuestions.length}`);





        shuffleArray(allQuestions);





        // Warn if not enough questions


        if (allQuestions.length < settings.numberOfItems) {


            alert(`Warning: Only ${allQuestions.length} questions available, but you requested ${settings.numberOfItems}.`);


        }





        selectedQuestions = allQuestions.slice(0, settings.numberOfItems);





        console.log(`[DEBUG] selectedQuestions.length (after slice): ${selectedQuestions.length}`);


    }





    toggleElementDisplay("nameSection", "none");


    toggleElementDisplay("examSection", "block");





    const display = document.querySelector("#countdown");


    const timeLimit = selectedQuarter === "remedial" ? settings.remedial.timeInMinutes : settings.timeInMinutes;


    startTimer(timeLimit * 60, display);





    displayQuestion();


}





// REMEDIAL EXAM LOGIC WITH DEBUGGING


async function fetchRemedialQuestions() {


    const quarters = ["quarter1", "quarter2", "quarter3", "quarter4"];


    const allQuestions = [];





    for (const quarter of quarters) {


        const fileName = `${selectedGradeLevel}_${quarter}.json`;


        const questions = await fetchQuestions(fileName);


        console.log(`[DEBUG] Fetched ${questions.length} questions from ${fileName}`);


        if (questions.length > 0) {


            shuffleArray(questions);


            allQuestions.push(...questions.slice(0, 10));


        }


    }





    shuffleArray(allQuestions);


    selectedQuestions = allQuestions.slice(0, settings.remedial.numberOfItems);


    console.log(`[DEBUG] Total selected remedial questions: ${selectedQuestions.length}`);


}





function startTimer(duration, display) {


    let timer = duration;


    timerInterval = setInterval(() => {


        const minutes = Math.floor(timer / 60).toString().padStart(2, "0");


        const seconds = (timer % 60).toString().padStart(2, "0");





        display.textContent = `${minutes}:${seconds}`;





        if (--timer < 0) {


            clearInterval(timerInterval);


            calculateScore();


        }


    }, 1000);


}





function displayQuestion() {


    const questionContainer = document.getElementById("questionContainer");


    const questionObj = selectedQuestions[currentQuestionIndex];





    const shuffledChoices = [...questionObj.choices];


    shuffleArray(shuffledChoices);





    questionContainer.innerHTML = `


        <h3>${questionObj.question}</h3>


        ${shuffledChoices.map(choice => `


            <label style="font-size: 1.2em;">


                <input type="radio" name="question" value="${choice}" style="transform: scale(1.1); margin-right: 10px;" ${userAnswers[currentQuestionIndex] === choice ? "checked" : ""}>


                ${choice}


            </label><br>


        `).join("")}


    `;





    document.getElementById("prevButton").disabled = currentQuestionIndex === 0;


    document.getElementById("nextButton").disabled = currentQuestionIndex === selectedQuestions.length - 1;


    document.getElementById("submitContainer").style.display = currentQuestionIndex === selectedQuestions.length - 1 ? "block" : "none";


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


    const selectedAnswer = document.querySelector('input[name="question"]:checked');


    if (selectedAnswer) {


        userAnswers[currentQuestionIndex] = selectedAnswer.value;


    }


}





function calculateScore() {


    clearInterval(timerInterval);


    saveAnswer();


    let score = 0;


    const incorrectQuestions = [];





    selectedQuestions.forEach((question, index) => {


        if (userAnswers[index] === question.answer) {


            score++;


        } else {


            incorrectQuestions.push(question.question);


        }


    });





    const gradeText = selectedGradeLevel.replace("grade", "Grade ");


    const quarterText = selectedQuarter === "remedial" ? "REMEDIAL EXAM" : selectedQuarter.replace("quarter", "Quarter ");


    const scorePercentage = (score / selectedQuestions.length) * 100;


    const scoreDisplay = document.getElementById("score");


    const messageDisplay = document.getElementById("message");


    const incorrectDisplay = document.createElement("div");





    scoreDisplay.textContent = `${examTakerName}, you scored: ${score} out of ${selectedQuestions.length} (${scorePercentage.toFixed(2)}%) in ${gradeText} ${quarterText}.`;





    displayFormattedDate();





    const passingScore = selectedQuarter === "remedial" ? settings.remedial.passingScorePercentage : settings.passingScorePercentage;





    if (scorePercentage >= passingScore) {


        incorrectDisplay.innerHTML = `


            <h3>Congratulations, ${examTakerName}!</h3>


            <p>You passed the exam in ${gradeText} ${quarterText}.</p>


        `;


        handleVideoPlay("passVideo");


// Messenger + Mobile Share Button Logic


document.getElementById('shareResultBtn').addEventListener('click', function() {


    // Get the score details


    const name = examTakerName;


    const score = document.getElementById('score').textContent;


    const url = window.location.href;





    const shareText = `${score} Try the TTVHS REMEDIAL EXAM FOR TLE here:\n${url}`;





    if (navigator.share) {


        // Mobile/web native share


        navigator.share({


            title: 'Exam Result',


            text: shareText,


            url: url


        });

    } else {


        incorrectDisplay.innerHTML = `


            <h3>Hi ${examTakerName}, here are the questions you missed in ${gradeText} ${quarterText}:</h3>


            <ul>


                ${incorrectQuestions.map(q => `<li>${q}</li>`).join("")}


            </ul>


        `;


        handleVideoPlay("failVideo");


    }





    messageDisplay.innerHTML = "";


    messageDisplay.appendChild(incorrectDisplay);





    toggleElementDisplay("results", "block");


    toggleElementDisplay("examSection", "none");


}





async function retakeExam() {


    location.reload(); // Reload the page to bring the user back to the main page


}





function shuffleArray(array) {


    for (let i = array.length - 1; i > 0; i--) {


        const j = Math.floor(Math.random() * (i + 1));


        [array[i], array[j]] = [array[j], array[i]];


    }


    return array;


}





// Initialize the page by showing the review section


document.addEventListener("DOMContentLoaded", () => {


    toggleElementDisplay("reviewSection", "block");


});





// Visibility change handling to reset the exam if the user switches away


document.addEventListener("visibilitychange", () => {


    if (document.visibilityState === 'hidden') {


        alert('You have switched away from the exam. The exam will now reset.');


        location.reload(); // Reload the page to reset the exam


        // Facebook Messenger Share Dialog fallback


        // Replace YOUR_FACEBOOK_APP_ID with your real Facebook App ID!


        const app_id = 'YOUR_FACEBOOK_APP_ID';


        const fbUrl =


          `https://www.facebook.com/dialog/send?app_id=${app_id}` +


          `&link=${encodeURIComponent(url)}` +


          `&redirect_uri=${encodeURIComponent(url)}` +


          `&display=popup`;





        window.open(fbUrl, '_blank');

    }

});
