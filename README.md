# Task Goblin #

Task Goblin is a cross-platform browser extension designed to assist the user get back on track to what the should be doing. 
The browser is a common center for distractions in the digital age, so developing a browser extension that limits said distractions may prove beneficial to some users.


## PLANNED FEATURES ##

- Does the extension allow users to create and manage tasks with time limits?

- Do motivational reminders appear at appropriate intervals?

- Can users define distraction websites for warnings or restrictions?

- Does the extension support multiple intervention intensity levels?

- Is the user interface intuitive and easy to navigate?

- Do anti-distraction features activate correctly when conditions are met

- Can users modify or disable features without breaking functionality?

- Does the extension operate without noticeable performance issues?



## UPDATES ##
_9/19/26:_

Added cross-browser extension popup that features basic task creation entry field and a list to display them

- stores tasks locally (with added feature this saves through extension, so user can swap browsers and tasks will be saved - needs further testing)
- added task deletion and completion buttons elements that currently have no function

Extension currently only runs locally through browser's developer mode

\
_9/27/26:_

Completed Core functionality of task creation and management
- Added functionality to 'task completion status' button
  - If task is currently incomplete, pressing button sets to complete - and vice versa
- Added functionality to 'delete task' button
- Added 'due date' option on tasks
- Added 'edit task' button
  - When pressed, allows the user to edit the name of the selected task and add a due date to task
  - When pressed, creates a 'save changes' and 'cancel changes' button

\
_10/9/26:_

Created settings menu that includes intervention intensity and distraction site features
- Added input that allows user to select between a "General Ruleset" and an "Individual Ruleset"
  - General Ruleset: applies selected intensity level to all defined distraction sites
  - Individual Ruleset: each selected distraction site can apply their own intensity level
- Added input that allows user to select between 4 intervention levels
  - Gentle Reminder: "Display a small reminder when opening a distracting website."
  - Pause and Reflect: "Ask whether the visit is intentional before continuing."
  - Forced Break: "Continuation of level 2 and creates a short waiting period before allowing the user to continue after a certain period of time has passed."
  - Block Access: Restrict access to site.
  - _(Description of intervention levels can be find when hovering over highlighted names)_
  - This section is only visible when the general ruleset is applied
- Added distraction site creation, display, and removal of individual sites
  - Distraction sites are added via a provided URL to said site

_All features listed above do not currently have actual functionality beyond what has already been described_
\
Added a "save changes" button
\
Added gear icon in popup page to go to settings menu and added a green x that sends user back to main popup page
