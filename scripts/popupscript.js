const ExtensionAPI = typeof browser !== "undefined" ? browser : chrome;
//ExtensionAPI is set to type of current browser API (if available), else, use chrome API

const TaskInput = document.getElementById("tasktextinput");
const AddTask = document.getElementById("addtask");
const TaskDisplay = document.getElementById("taskdisplay");

let CurrentTasks = []; //adding this so extension doesn't ask for tasks info every single seconds from storage


//load saved tasks when popupopen
LoadTasks();

//add a new task
AddTask.addEventListener("click", async () => {
    const newtasktext = TaskInput.value;
    //no empty task
    if(newtasktext.trim() === "") {
        return;
    }

    //get existing tasks
    const result = await ExtensionAPI.storage.local.get("tasks");
    const tasks = result.tasks || []; //tasks holds the stored object(s) or is set to any empty array

    //create a new task
    const newTask = {
        id: Date.now(), //"A number representing the timestamp, in milliseconds, of the current time." 
                        //-> lazy way of creating unique id 
        title: newtasktext,
        completed: false,
        duedate: null
    };

    tasks.push(newTask); //add task object to task array
    //save the updated array
    await ExtensionAPI.storage.local.set({
        tasks: tasks
    });

    CurrentTasks = tasks; //update the in-memory task list (so countdown is immediently displayed)

    TaskInput.value = ""; //clear input just incase
    DisplayTasks(tasks);

    /*
    //here is an example of how it should look when stored: 
        tasks: [
            {
                id: 123456789,
                title: "Finish homework",
                completed: false
            },
            {
                id: 123456790,
                title: "Study for exam",
                completed: false
            }
        ]
    //maybe in future I could write this to a txt or json file for users to view locally??
    */

});

//load tasks from storage (async function to prep load while getting storage)
async function LoadTasks() {
    const result = await ExtensionAPI.storage.local.get("tasks");
    const tasks = result.tasks || [];
    CurrentTasks = tasks; //keep a copy of the tasks in memory
    DisplayTasks(tasks);
}

//display all tasks
function DisplayTasks(tasks) {
    TaskDisplay.innerHTML = ""; //clear the current list

    //display a message if there are no tasks
    if (tasks.length === 0) {

        TaskDisplay.textContent = "No tasks yet.";
        return;
    }

    //create an element for every task
    tasks.forEach((task) => {

        const taskelement = document.createElement("li");

        taskelement.classList.add("task");
        taskelement.dataset.taskId = task.id;

        taskelement.innerHTML = `
            <h3>${task.title}</h3>

            <p class="duedate">
            ${
                task.duedate
                ? `Due: ${new Date(task.duedate).toLocaleString()}`
                : "No due date"
            }
            </p>

            <p class="countdown" data-countdown-id="${task.id}">
                ${GetTimeRemaining(task.duedate)}
            </p>
            
            <button class="completedbutton" data-task-id="${task.id}">
                ${task.completed ? "Set Incomplete" : "Set Complete"} 
            </button>

            <button class="editbutton" data-task-id="${task.id}">
                Edit
            </button>

            <button class="removebutton" data-task-id="${task.id}">
                Delete
            </button>
        `;
        //"${task.completed ? "Undo" : "Complete"}" -> when pressed, if task is complete, button reads as "Incomplete"
        //else if task is not complete, read as "Complete" (if false -> complete, if true -> incomplete))
        //#if tasks still needs to be set to incomplete vs if tasks needs to be set as complete
        //(adds "$" to evaluate task.completed before it is put onto html)

        //"data-task-id" means that each button will carry the corresponding task id
        //"data-" is part of an html feature called "data attributes", which allow us to access them in javascript
        //through ".dataset"
        //note that the following of the identifer is transformed into camelCase
        //so data-task-id needs to be referenced as ".dataset.taskId"
        TaskDisplay.appendChild(taskelement);
    });
    const CompleteButtons = TaskDisplay.querySelectorAll(".completedbutton");

    CompleteButtons.forEach((button) => {
        button.addEventListener("click", () => {
            UpdateTask(button.dataset.taskId, "completestatus");
        });
    });

    const EditButtons = TaskDisplay.querySelectorAll(".editbutton");

    EditButtons.forEach((button) => {
        button.addEventListener("click", () => {
            UpdateTask(button.dataset.taskId, "taskedit");
        });
    });

    const RemoveButtons = TaskDisplay.querySelectorAll(".removebutton");

    RemoveButtons.forEach((button) => {
        button.addEventListener("click", () => {
            RemoveTask(button.dataset.taskId);
        });
    });
}

async function UpdateTask(taskId, type) {
    //get saved tasks
    const result = await ExtensionAPI.storage.local.get("tasks");
    const tasks = result.tasks || [];

    //find the task that was clicked
    const task = tasks.find((task) => task.id == taskId);

    //if the task doesn't exist, stop
    if (!task) {
        return;
    }

    if (type == "completestatus") {

        //toggle completion status
        task.completed = !task.completed;

        //save the updated tasks
        await ExtensionAPI.storage.local.set({
            tasks: tasks
        });

        CurrentTasks = tasks; //update the in-memory task list (so countdown is immediently displayed)

        //refresh the displayed tasks
        DisplayTasks(tasks);
    }
    else if (type == "taskedit") {
        //find the task element with the associated identifier
        const taskelement = TaskDisplay.querySelector(
            `.task[data-task-id="${taskId}"]`
        );

        //find the title
        const titleelement = taskelement.querySelector("h3");

        /////////////////////TASK NAME INPUT

        //create input field
        const editinputfield = document.createElement("input");

        editinputfield.type = "text";
        editinputfield.value = task.title;
        editinputfield.placeholder = "New task name...";


        ////////////////////////DUE DATE INPUT
        const duedateinput = document.createElement("input");
        duedateinput.type = "datetime-local";

        //if the task already has a due date, put that date into the input field
        if (task.duedate) {
            duedateinput.value = FormatDateForInput(task.duedate);
        }

        /////////////////////////////////////SAVE BUTTON
        //create save button
        const savebutton = document.createElement("button");
        savebutton.textContent = "Save";
        
        ////////////////////////////////////////CANCEL BUTTON
        const cancelbutton = document.createElement("button");
        cancelbutton.textContent = "Cancel";

        ///////////////////////
        titleelement.replaceWith(editinputfield); //replace title with input field
        taskelement.appendChild(duedateinput); //add date input
        taskelement.appendChild(savebutton); //add save button
        taskelement.appendChild(cancelbutton); //add cancel button

        ////////////////////////////////////////SAVE CHANGES
        //save when button is clicked
        savebutton.addEventListener("click", async () => {

            const newtitle = editinputfield.value.trim();

            //don't allow empty titles
            if (newtitle === "") {
                return;
            }

            task.title = newtitle; //change task title

            //change task due date
            if (duedateinput.value === "") {
                task.duedate = null; //empty input means no due date
            }
            else {
                task.duedate = duedateinput.value; //save the selected date
            }

            //save tasks
            await ExtensionAPI.storage.local.set({
                tasks: tasks
            });

            CurrentTasks = tasks; //update the in-memory task list (so countdown is immediently displayed)

            DisplayTasks(tasks); //refresh display
        });

        ////////////////////////CANCEL CHAGES
        cancelbutton.addEventListener("click", () => {
            DisplayTasks(tasks); //redraw the tasks without saving changes
        });
    }
}

async function RemoveTask(taskId) {
    //get saved tasks
    const result = await ExtensionAPI.storage.local.get("tasks");
    const tasks = result.tasks || [];

    //remove the task with the matching ID
    //creates variable whose value is every task other than the one we want to remove
    const updatedtasks = tasks.filter((task) => task.id != taskId);

    //save the updated task list
    await ExtensionAPI.storage.local.set({
        tasks: updatedtasks
    });

    CurrentTasks = tasks; //update the in-memory task list (so countdown is immediently displayed)

    //refresh the displayed tasks
    DisplayTasks(updatedtasks);
}

///////////////////////////////////////////////////////////
//TIME-DATE RELATED FUNCTIONS (I should probably split this into its own file)
///////////////////////////////////////////////////////////

function GetTimeRemaining(duedate) {

    //if there is no due date
    if (!duedate) {
        return "No deadline";
    }

    const currenttime = new Date(); //get the current time

    //convert the due date into a Date object
    const deadline = new Date(duedate);

    const difference = deadline - currenttime; //calculate the difference between the deadline and current time

    //if the deadline has already passed
    if (difference <= 0) {
        return "OVERDUE";
    }

    const totalseconds = Math.floor(difference / 1000); //convert milliseconds into seconds

    const days = Math.floor(totalseconds / 86400); //calculate days

    //calculate hours
    const hours = Math.floor(
        (totalseconds % 86400) / 3600
    );

    //calculate minutes
    const minutes = Math.floor(
        (totalseconds % 3600) / 60
    );

    const seconds = totalseconds % 60; //calculate seconds

    return `${days}d ${hours}h ${minutes}m ${seconds}s remaining`; //return days | hours | minutes| seconds remaining
}

function UpdateCountdowns() {
    const countdowns = TaskDisplay.querySelectorAll(".countdown"); //find all countdown elements

    countdowns.forEach((countdown) => {
        const taskId = countdown.dataset.countdownId;

        //find the matching task
        const task = CurrentTasks.find(
            (task) => task.id == taskId
        );

        //if the task doesn't exist, stop
        if (!task) {
            return;
        }
        countdown.textContent = GetTimeRemaining(task.duedate); //update the countdown
    });
}

//if you already have date and click the edit button, the date section will already be included
function FormatDateForInput(duedate) {
    const date = new Date(duedate);
    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    const hours = String(
        date.getHours()
    ).padStart(2, "0");

    const minutes = String(
        date.getMinutes()
    ).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}

setInterval(UpdateCountdowns, 1000); //update countdowns once every second
