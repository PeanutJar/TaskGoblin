const ExtensionAPI = typeof browser !== "undefined" ? browser : chrome;
//ExtensionAPI is set to type of current browser API (if available), else, use chrome API

const TaskInput = document.getElementById("tasktextinput");
const AddTask = document.getElementById("addtask");
const TaskDisplay = document.getElementById("taskdisplay");


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
        completed: false
    };
    tasks.push(newTask); //add task object to task array
    //save the updated array
    await ExtensionAPI.storage.local.set({
        tasks: tasks
    });

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
    DisplayTasks(tasks);
}

//display all tasks
function DisplayTasks(tasks) {

    //clear the current list
    TaskDisplay.innerHTML = "";

    //display a message if there are no tasks
    if (tasks.length === 0) {

        TaskDisplay.textContent = "No tasks yet.";
        return;
    }


    //create an element for every task
    tasks.forEach((task) => {

        const taskelement = document.createElement("li");

        taskelement.classList.add("task");

        taskelement.innerHTML = `
            <h3>${task.title}</h3>
            
            <button class="completedbutton">
                ${task.completed ? "Undo" : "Complete"} 
            </button>

            <button class="delete-button">
                Delete
            </button>
        `;
        //"${task.completed ? "Undo" : "Complete"}" -> when pressed, if task completeness is undon, set back to false, else set task as completed
        //***IMPORTANT*** -> the buttons don't actualy do anything yet, still needs to be developed
        TaskDisplay.appendChild(taskelement);
    });
}
