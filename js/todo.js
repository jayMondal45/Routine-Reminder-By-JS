document.addEventListener("DOMContentLoaded", async () => {
    let todoList = JSON.parse(localStorage.getItem('todoList')) || [];
    let alarmTimers = [];
    let audioContext = null;
    let alarmBuffer = null;

    const inputElement = document.querySelector("#todo_task");
    const timeElement = document.querySelector("#todo_time");
    const addButton = document.querySelector("#add_button");
    const containerElement = document.querySelector(".todo_container");

    // ✅ Request Notification Permission Immediately After User Interaction
    function requestNotificationPermission() {
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission().then(permission => {
                if (permission !== "granted") {
                    console.warn("Notifications denied by user.");
                }
            });
        }
    }

    // ✅ Initialize Audio System
    async function initializeAudio() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
            const response = await fetch('alarm.mp3');
            const arrayBuffer = await response.arrayBuffer();
            alarmBuffer = await audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error('Audio initialization failed:', error);
        }
    }

    async function addTodo() {
        const taskName = inputElement.value.trim();
        const todoTime = timeElement.value.trim();

        if (!taskName || !todoTime) {
            alert("Please enter a valid task and time!");
            return;
        }

        if (todoList.length === 0) {
            await initializeAudio();
            requestNotificationPermission(); // 🔥 Ask for permission here
        }

        const alarmControl = {
            timer: null,
            source: null,
            stop: function () {
                clearTimeout(this.timer);
                if (this.source) {
                    this.source.stop();
                    this.source.disconnect();
                }
            }
        };

        todoList.push({ item: taskName, dueTime: todoTime });
        alarmTimers.push(alarmControl);
        localStorage.setItem('todoList', JSON.stringify(todoList));

        inputElement.value = "";
        timeElement.value = "";

        renderTodoList();
        setAlarm(todoTime, taskName, alarmControl);
    }

    function renderTodoList() {
        containerElement.innerHTML = todoList.map((todo, index) => `
            <div class="container">
                <div class="row">
                    <div class="col-5 todo_item">
                        <input type="text" value="${todo.item}" readonly>
                    </div>
                    <div class="col-5 todo_item">
                        <input type="text" value="${todo.dueTime}" readonly>
                    </div>
                    <div class="col-2 todo_btn">
                        <button class="btn btn-danger btn-sm" onclick="removeTodo(${index})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('') || `<p class="empty-message text-center">No tasks available.</p>`;
    }

    window.removeTodo = function (index) {
        if (alarmTimers[index]) {
            alarmTimers[index].stop();
        }
        todoList.splice(index, 1);
        alarmTimers.splice(index, 1);
        localStorage.setItem('todoList', JSON.stringify(todoList));
        renderTodoList();
    };

    function setAlarm(todoTime, taskName, alarmControl) {
        const [hours, minutes] = todoTime.split(':').map(Number);
        const now = new Date();
        let targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

        if (targetTime < now) targetTime.setDate(targetTime.getDate() + 1);
        const delay = targetTime - now;

        if (alarmControl.timer) clearTimeout(alarmControl.timer);

        alarmControl.timer = setTimeout(() => {
            if (!audioContext) {
                console.error("AudioContext is not initialized.");
                return;
            }

            // ✅ Resume AudioContext for Mobile
            audioContext.resume().then(() => {
                if (alarmBuffer) {
                    alarmControl.source = audioContext.createBufferSource();
                    alarmControl.source.buffer = alarmBuffer;
                    alarmControl.source.connect(audioContext.destination);
                    alarmControl.source.loop = true;
                    alarmControl.source.start(0);
                } else {
                    console.warn("Alarm buffer is missing, sound will not play.");
                }
            }).catch(error => {
                console.error("AudioContext resume failed:", error);
            });

            // ✅ Show Notification & Play Sound at the Same Time
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification(`⏰ Time for: ${taskName}`, {
                    body: "Your scheduled task is due!",
                    icon: "alarm-icon.png",
                    requireInteraction: true
                });
            } else {
                console.warn("Notifications not supported or permission denied.");
            }
        }, delay);
    }

    // Restore previous alarms
    todoList.forEach(task => {
        const alarmControl = {
            timer: null,
            source: null,
            stop: function () {
                clearTimeout(this.timer);
                if (this.source) {
                    this.source.stop();
                    this.source.disconnect();
                }
            }
        };
        alarmTimers.push(alarmControl);
        setAlarm(task.dueTime, task.item, alarmControl);
    });

    addButton.addEventListener("click", addTodo);
    renderTodoList();
});
