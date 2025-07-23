
document.querySelectorAll("form").forEach(form => {
    form.addEventListener("submit", e => e.preventDefault());
});

// Global variable to store the conversation history
let context;
try {
    context = JSON.parse(getCookie("context") || "[]");
    if (!Array.isArray(context)) context = [];
} catch (e) {
    console.error("Failed to parse context cookie:", e);
    context = [];
}


async function displayMessageOutput(message, role, feedbackAdded = false) {
   const chatbox = document.getElementById('chatbox');
   const messageElem = document.createElement('div');
   messageElem.className = `message ${role}`;
   chatbox.appendChild(messageElem);


   async function printStringByLetter(message, index = 0) {
       if (index < message.length) {
           if (message.slice(index, index + 3) === '```') {
               index += 3;
               let codeEndIndex = message.indexOf('```', index);
               if (codeEndIndex === -1) codeEndIndex = message.length;
               const codeContent = message.slice(index, codeEndIndex);
               const codeElem = document.createElement('pre');
               codeElem.innerHTML = `<code>${codeContent}</code>`;
               messageElem.appendChild(codeElem);
               index = codeEndIndex + 3;
               await printStringByLetter(message, index);
           } else {
               if (message.slice(index, index + 2) === '**') {
                   index += 2;
                   const endBold = message.indexOf('**', index);
                   const boldContent = message.slice(index, endBold);
                   messageElem.innerHTML += `<b>${boldContent}</b>`;
                   index = endBold + 2;
                   messageElem.innerHTML += ' '; // Add a space after the bold text
               } else if (message.slice(index, index + 1) === '*') {
                   index += 1;
                   const endItalic = message.indexOf('*', index);
                   const italicContent = message.slice(index, endItalic);
                   messageElem.innerHTML += `<i>${italicContent}</i>`;
                   index = endItalic + 1;
                   messageElem.innerHTML += ' '; // Add a space after the italic text
               } else if (message.charAt(index) === '\n'){
                   messageElem.innerHTML += '<br>';
                   index++;
               } else if (message.charAt(index) === '$') {
                   let mathEndIndex = message.indexOf('$', index + 1);
                   if (mathEndIndex === -1) mathEndIndex = message.length;
                   const mathContent = message.slice(index + 1, mathEndIndex);
                   const mathElem = document.createElement('span');
                   mathElem.innerHTML = `\\(${mathContent}\\)`;
                   messageElem.appendChild(mathElem);
                   index = mathEndIndex + 1;
                   try {
                        await MathJax.typesetPromise([messageElem]);
                    } catch (err) {
                    console.error("MathJax rendering error:", err);
                    }
               } else {
                   messageElem.innerHTML += message.charAt(index);
                   index++;
               }


               let delay = 5;
               if (message.charAt(index - 1) === ' ') {
                   delay = 15;
               } else if (isPunctuation(message.charAt(index - 1))) {
                   delay = 25 + Math.random() * 200;
               }


               await new Promise(resolve => setTimeout(resolve, delay));
               await printStringByLetter(message, index);
           }
       } else {
           chatbox.scrollTop = chatbox.scrollHeight;
           if (!feedbackAdded) {
               addFeedbackButtons(messageElem);
               feedbackAdded = true;
           }
           try {
            await MathJax.typesetPromise([messageElem]);
            } catch (err) {
                console.error("Inline MathJax rendering error:", err);
            }
       }
   }


   function isPunctuation(char) {
       const punctuationMarks = /[!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~]/;
       return punctuationMarks.test(char);
   }


   await printStringByLetter(message);
}


async function sendMessage(feedbackAdded = false) {
   const userInput = document.getElementById('userInput').value;
   const sendingStatus = document.getElementById('sendingStatus');
   sendingStatus.style.display = 'block';


   try {
       // const location = "https://furmancs.com/tabot/chatTA";
       // const location = "http://localhost:5000/tabot/chatTA";
       const location = "http://127.0.0.1:5000/tabot/chatTA";

        // Set timeout to 10 

       const settings = {
           method: 'POST',
           headers: {
               'Accept': 'application/json',
               'Content-Type': 'application/json',
               
              
           },
           body: JSON.stringify({ 'message': userInput, "context": context })
       };

       console.log("Before response");
       const fetchResponse = await fetch(location, settings);
       if (!fetchResponse.ok) {
           throw new Error(`HTTP error! Status: ${fetchResponse.status}`);
       }
       const data = await fetchResponse.json();
       console.log("After response");
       console.log(typeof data)
       console.log("data", data);

       context.push({ role: "user", content: userInput });
       context.push({ role: "assistant", content: data.message["answer"]});
    //    context += "AI:" + (data.message["answer"] || '') + "\n";
       setCookie("context", JSON.stringify(context), 1);


       displayMessage(userInput, 'user');


       if (data.message) {
           await displayMessageOutput(data.message["answer"], 'bot', feedbackAdded);
       } else {
           console.error('Error: No response received from server.');
       }


       if (data.message["urls"] && data.message["urls"].length > 0) {
           await displayUrls(data.message["urls"]);
       }


   } catch (error) {
       console.error('Error sending message:', error);
   } finally {
       sendingStatus.style.display = 'none';
       document.getElementById('userInput').value = '';
   }
}
  
function displayMessage(message, role) {
   const chatbox = document.getElementById('chatbox');
   const messageElem = document.createElement('div');
   messageElem.className = `message ${role}`;
   messageElem.innerText = message;
   chatbox.appendChild(messageElem);
   chatbox.scrollTop = chatbox.scrollHeight;
}


function addFeedbackButtons(messageElem) {
   const thumbsContainer = document.createElement('div');
   thumbsContainer.className = 'thumbs';
   const thumbsUp = document.createElement('button');
   thumbsUp.innerText = '👍';
   thumbsUp.onclick = () => sendFeedback(messageElem.innerText, 'thumbs-up');
   thumbsUp.textContent = '👍';
   thumbsUp.className = 'feedback-button thumbs-up';
   thumbsUp.onclick = () => handleFeedback('up');


   const thumbsDown = document.createElement('button');
   thumbsDown.innerText = '👎';
   thumbsDown.onclick = () => sendFeedback(messageElem.innerText, 'thumbs-down');
   thumbsContainer.appendChild(thumbsUp);
   thumbsContainer.appendChild(thumbsDown);
   thumbsDown.textContent = '👎';
   thumbsDown.className = 'feedback-button thumbs-down';
   thumbsDown.onclick = () => handleFeedback('down');


   const feedbackContainer = document.createElement('div');
   feedbackContainer.className = 'feedback-buttons';
   feedbackContainer.appendChild(thumbsUp);
   feedbackContainer.appendChild(thumbsDown);


   messageElem.appendChild(thumbsContainer);
   messageElem.appendChild(feedbackContainer);
}


async function sendFeedback(message, feedbackType) {
   try {
       const location = "http://64.225.111.177:5000/feedback";
       const settings = {
           method: 'POST',
           headers: {
               'Accept': 'application/json',
               'Content-Type': 'application/json',
           },
           body: JSON.stringify({ message, feedbackType })
       };

       console.log("Context being sent to backend", context);

       const response = await fetch(location, settings);
       if (!response.ok) {
           throw new Error(`HTTP error! Status: ${response.status}`);
       }
       const data = await response.json();
       console.log('Feedback sent:', data);
   } catch (error) {
       console.error('Error sending feedback:', error);
   }
}


async function displayUrls(urls) {
   // revisit this 
   const chatbox = document.getElementById('chatbox');
   const urlsContainer = document.createElement('div');
   urlsContainer.classList.add('message', 'urls', 'bot');


   const heading = document.createElement('p');
   heading.textContent = 'Please check the below links for additional information:';
   urlsContainer.appendChild(heading);


   const ul = document.createElement('ul');


   for (const url of urls.slice(0, 5)) {
       const title = await fetchTitle(url);
       const li = document.createElement('li');
       const a = document.createElement('a');
       a.href = url;
       a.textContent = title || 'Link';
       a.target = '_blank';
       li.appendChild(a);
       ul.appendChild(li);


       urlsContainer.appendChild(ul);
       chatbox.appendChild(urlsContainer);
       chatbox.scrollTop = chatbox.scrollHeight;


       await new Promise(resolve => setTimeout(resolve, 100000));
   }
}


async function fetchTitle(url) {
   try {
       const response = await fetch(url);
       if (!response.ok) {
           console.error('Failed to fetch URL:', response.status);
           return 'Link';
       }


       const text = await response.text();
       const doc = new DOMParser().parseFromString(text, 'text/html');
       const title = doc.querySelector('title').innerText;
       return title;
   } catch (error) {
       console.error('Error fetching title:', error);
       return 'Link';
   }
}


function setCookie(name, value, days) {
   const date = new Date();
   date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
   const expires = "expires=" + date.toUTCString();
   document.cookie = encodeURIComponent(name) + "=" + encodeURIComponent(value) + ";" + expires + ";path=/";
}


function getCookie(name) {
   const nameEQ = encodeURIComponent(name) + "=";
   const ca = document.cookie.split(';');
   for (let i = 0; i < ca.length; i++) {
       let c = ca[i];
       while (c.charAt(0) === ' ') c = c.substring(1, c.length);
       if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
   }
   return null;
}


function eraseMemory() {
   context = []
   setCookie("context", context, -1);
   const chatbox = document.getElementById('chatbox');
   chatbox.innerHTML = '';
}


function setPhoto() {
   const max = 17;
   var randint = Math.floor(Math.random() * max) + 1;
   var url = "mister/"+ randint + ".jpg";
   console.log(url);
   document.getElementById("mister").src = url;


  
}

function submitUsername(){
    const newUsername = document.getElementById('usernameInput').value.trim();
    const existingUsername = document.getElementById('existingUserInput').value.trim();

    let username = existingUsername || newUsername;
    let existing = existingUsername !== '';
    if (username === '') {
         alert('Please enter a valid username.');
         return;
    }
    // setCookie("username", username, 1);
    // document.getElementById('usernameForm').style.display = 'none';
    // document.getElementById('chatContainer').style.display = 'block';
    // initialize();

    // hide welcome popup
    initialize(username, existing);
}

// Remove later
initialize("Greyson", true);


function initialize(username, existing=false){

    document.getElementById('welcomePopup').setAttribute("visibility", "hidden");
    document.getElementById('welcomePopup').style.display = 'none';
    console.log("is initialized?");


   $("a.query").click(function() {
       $("#userInput")[0].value = this.text;
       $("#sendBtn")[0].click();
   });

   var input = document.getElementById("userInput");
      
   input.addEventListener("keypress", function(event) {
       if (event.key === "Enter") {
            event.preventDefault();
            document.getElementById("sendBtn").click();
       }
   });

   setPhoto();
   let openingMessageNew = "hallo "+username+" 🐾 I am Mister Cat GPTA.\n\nI am the TA for this course. \
   I can answer questions such as \n\n \
   'What is the deadline for the assignment?' or \n \
   'What is the grading policy?' or \n \
   'How can I make a scatter plot?'  \n \n \
   I can also provide you with links to resources. \
                       How can I help today?"

    let openingMessageExisting = "Welcome back "+username+" 🐾 I am Mister Cat GPTA.\n\nI am the TA for this course. \
    I can answer questions such as \n\n \
    'What is the deadline for the assignment?' or \n \
    'What is the grading policy?' or \n \
    'How can I make a scatter plot?'  \n \n \
    I can also provide you with links to resources. \
                        How can I help today?"

    let openingMessage = existing ? openingMessageExisting : openingMessageNew;
    displayMessageOutput(openingMessage, 'bot', true);

    var popup = document.getElementById("welcomePopup");
    popup.setAttribute("visibility", "visible");
}

async function switchTabs(mode){
    switch (mode) {
        case 'learn':
            document.getElementById('learnTab').classList.add('selected-tab');
            document.getElementById('chatTab').classList.remove('selected-tab');
            document.getElementById('practiceTab').classList.remove('selected-tab');
            document.getElementById("chatMode").style.display = "none";
            document.getElementById("learnMode").style.display = "block";
            document.getElementById("practiceMode").style.display = "none";
            // switchMode('Advisor');
            break;
        case 'practice':
            console.log("Practice tab selected");
            document.getElementById('learnTab').classList.remove('selected-tab');
            document.getElementById('chatTab').classList.remove('selected-tab');
            document.getElementById('practiceTab').classList.add('selected-tab');
            document.getElementById("chatMode").style.display = "none";
            document.getElementById("learnMode").style.display = "none";
            document.getElementById("practiceMode").style.display = "block";
            // await fetch('http://127.0.0.1:5000/tabot/pdftest', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({ mode: 'practice' })
            // });
            break;
        default:
            document.getElementById('learnTab').classList.remove('selected-tab');
            document.getElementById('chatTab').classList.add('selected-tab');
            document.getElementById('practiceTab').classList.remove('selected-tab');
            document.getElementById("chatMode").style.display = "block";
            document.getElementById("learnMode").style.display = "none";
            document.getElementById("practiceMode").style.display = "none";
            // switchMode('chat')
    }

}

function showUploadPopup() {
    document.getElementById('uploadPopup').style.display = 'block';
}

function hideUploadPopup() {
    document.getElementById('uploadPopup').style.display = 'none';
}

async function onUploadDocument(event){

    // Get the file input element
    const fileInput = document.getElementById('pdfInput');
    // Get the selected file
    const file = fileInput.files[0];
    // Check if a file is selected
    if (!file) {
        alert('Please select a PDF file to upload.');
        return;
    }
        
    // Get filename
    const filename = file.name;

    // Add to sidebar documentList
    const documentList = document.getElementById('documentList');
    const listItem = document.createElement('li');
    listItem.textContent = filename;
    listItem.className = 'document-item';

    //What the sidebar documents do when clicked
    listItem.onclick = () => {
        if (document.getElementById('chatTab').classList.contains('selected-tab')){
            document.getElementById('userInput').value = `Read ${filename}`;
        }
        else if (document.getElementById('learnTab').classList.contains('selected-tab')){
            //flashcard generation logic MOVE HERE (done)
            //Problem: want to save first instance of gen'd questions per PDF, don't regen every time
            doFlashcards(formData);
        }
        else if (document.getElementById('practiceTab').classList.contains('selected-tab')) {
            // Practice mode logic here
            doQuiz(formData);
        }
    };
    documentList.appendChild(listItem);
    // Clear the file input
    fileInput.value = '';
    // Hide the upload popup
    hideUploadPopup();
    // Create a FormData object to send the file
    const formData = new FormData();
    formData.append('pdf', file);


}

async function doFlashcards(formData) {
    const settings = {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json',
        }
    };
    try {
        // const response = await fetch('http://127.0.0.1:5000/tabot/upload_pdf', settings);
        const response = await fetch('http://127.0.0.1:5000/tabot/pdftest', settings);
        flashcards.length = 0;
        console.log('Purged flashcards');
        const newCards = await response.json();

        //Handling unexpected incoming data formats (i.e., nested arrays)
        if (newCards.flashcards && Array.isArray(newCards.flashcards)) {
            flashcards.push(...newCards.flashcards);
        } else if (Array.isArray(newCards)) {
            flashcards.push(...newCards);
        } else {
            console.error("Unexpected flashcard data format:", newCards);
        }
        
        console.log("new cards", newCards);

        currentCardIndex = 0;
        showFlashcard(currentCardIndex);


    } catch (err) {
        console.error(err);
        alert("Something went wrong generating flashcards");
    }
}

async function doQuiz(formData){
    const settings = {
        method: 'POST',
        body: formData,
        headers: {
            'Accept': 'application/json',
        }
    };
    try {
        // const response = await fetch('http://127.0.0.1:5000/tabot/upload_pdf', settings);
        const response = await fetch('http://127.0.0.1:5000/tabot/testmaker', settings);
        return;

    } catch (err) {
        console.error(err);
        alert("Something went wrong generating quiz");
    }
}

async function injectQuiz(){
    const placeholder = [
  {
    type: "mcq",
    question: "What is the capital of France?",
    options: {
      A: "Berlin",
      B: "Paris",
      C: "Rome",
      D: "Madrid"
    },
    correct: "B"
  },
  {
    type: "frq",
    question: "Explain the water cycle.",
    idealAnswer: "..."
  },
  {
    type: "match",
    question: "Match the terms to definitions.",
    pairs: {
      "Evaporation": "Water turning into vapor",
      "Condensation": "Vapor forming clouds",
      "Precipitation": "Rainfall"
    }
  }
];


}

// User input example (chatGPT helped)
// {
//   "userAnswers": [
//     { "type": "mcq", "response": "B" },
//     { "type": "frq", "response": "It's how plants make food from sunlight." },
//     { "type": "match", "response": {
//       "Osmosis": "Movement of water across a membrane",
//       "Mitosis": "Cell division process",
//       "Photosynthesis": "Conversion of sunlight into energy"
//     }}
//   ]
// }