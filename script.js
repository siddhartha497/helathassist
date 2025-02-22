let medications = [];

// Handle file input
document.getElementById('fileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        if (file.name.endsWith('.txt')) {
            reader.onload = function(e) {
                document.getElementById('prescriptionInput').value = e.target.result;
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.docx')) {
            reader.readAsArrayBuffer(file);
            reader.onload = function(event) {
                let arrayBuffer = reader.result;
                mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                    .then(function(result) {
                        document.getElementById('prescriptionInput').value = result.value;
                    })
                    .catch(function(err) {
                        console.error("Error reading DOCX:", err);
                    });
            };
        } else if (file.name.endsWith('.pdf')) {
            let fileReader = new FileReader();
            fileReader.onload = function() {
                let typedArray = new Uint8Array(this.result);
                pdfjsLib.getDocument(typedArray).promise.then(pdf => {
                    let text = '';
                    let count = pdf.numPages;
                    for (let i = 1; i <= count; i++) {
                        pdf.getPage(i).then(page => {
                            page.getTextContent().then(textContent => {
                                text += textContent.items.map(item => item.str).join(' ') + '\n';
                                if (i === count) {
                                    document.getElementById('prescriptionInput').value = text;
                                }
                            });
                        });
                    }
                });
            };
            fileReader.readAsArrayBuffer(file);
        } else {
            alert("Unsupported file format! Please upload a .txt, .docx, or .pdf file.");
        }
    }
});

function parsePrescription() {
    const prescriptionText = document.getElementById('prescriptionInput').value;

    const medRegex = /([\w\s'-]+)\s+(\d+\s*(?:mg|ml|mcg|units|tablets?))\s+(?:take\s*)?(\d+)?\s*(tablets?|units?|ml)?\s*(every|once|daily|at)?\s*(\d+)?\s*(hours|days|AM|PM|before breakfast|morning|night|at \d{1,2}:\d{2} (?:AM|PM))?/gi;

    let matches;
    medications = [];

    while ((matches = medRegex.exec(prescriptionText)) !== null) {
        let [ , name, dosage, quantity, unit, frequencyType, frequency, interval] = matches;

        let timeMatch = prescriptionText.match(/at (\d{1,2}:\d{2} (?:AM|PM))/);
        let scheduleTimes = timeMatch ? [timeMatch[1]] : calculateTimes(frequencyType, frequency, interval);

        let dosageText = quantity ? `${quantity} ${unit}` : dosage;

        medications.push({
            name: name.trim(),
            dosage: dosageText.trim(),
            schedule: timeMatch ? timeMatch[1] : interval || frequencyType,
            times: scheduleTimes,
            taken: false
        });
    }

    displaySchedule();
    scheduleReminders();
}

function calculateTimes(frequencyType, frequency, interval) {
    let times = [];
    if (interval) {
        times.push(interval);
    } else if (frequencyType === "every" && frequency) {
        let now = new Date();
        for (let i = 0; i < 24 / frequency; i++) {
            let time = new Date(now.getTime() + i * (frequency * 60 * 60 * 1000));
            times.push(time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
        }
    } else {
        times.push("08:00 AM", "12:00 PM", "08:00 PM");
    }
    return times;
}

function displaySchedule() {
    const scheduleDiv = document.getElementById('scheduleDisplay');
    scheduleDiv.innerHTML = '';

    medications.forEach((med, index) => {
        const card = document.createElement('div');
        card.className = 'medication-card';
        card.innerHTML = `
            <div class="medication-logo">💊</div>
            <div class="medication-details">
                <h3>Medicine: ${med.name}</h3>
                <p>Dosage: ${med.dosage}</p>
                <p>Schedule: ${med.times.join(', ')}</p>
                <button onclick="markTaken(${index})">${med.taken ? '✅ Taken' : 'Mark as Taken'}</button>
            </div>
        `;
        scheduleDiv.appendChild(card);
    });
}

function markTaken(index) {
    medications[index].taken = !medications[index].taken;
    displaySchedule();
}

function scheduleReminders() {
    medications.forEach(med => {
        med.times.forEach(time => {
            let reminderTime = new Date();
            let [hour, minute, period] = time.match(/(\d+):(\d+) (AM|PM)/).slice(1);
            hour = period === "PM" && hour !== "12" ? parseInt(hour) + 12 : parseInt(hour);
            minute = parseInt(minute);
            reminderTime.setHours(hour, minute, 0);
            
            let now = new Date();
            let delay = reminderTime.getTime() - now.getTime();
            
            if (delay > 0) {
                setTimeout(() => {
                    showNotification(`Time to take ${med.name} - ${med.dosage}`);
                    playSoundNotification();
                    speakReminder(`Reminder: Time to take ${med.name}, ${med.dosage}`);
                }, delay);
            }
        });
    });
}

function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 10000);
}

function playSoundNotification() {
    let audio = new Audio('notification.mp3'); // Ensure you have a 'notification.mp3' file
    audio.play().catch(error => console.error("Audio play failed:", error));
}

function speakReminder(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    }
}

window.addEventListener('beforeunload', () => {
    localStorage.setItem('medications', JSON.stringify(medications));
});
