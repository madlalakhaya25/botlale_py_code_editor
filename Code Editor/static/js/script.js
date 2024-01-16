// Editor is in the global scope if accessed by other functions
let editor;


let currentPage = 1; // first page
const perPage = 10; 


// Parses the code in the editor to find and display function names.
// It updates the 'function-list' DOM element with the names of the functions.

function parseAndDisplayFunctions() {
    const code = editor.getValue();
    const functionPattern = /def\s+(\w+)\s*\(/g; // Corrected regex pattern
    let matches;
    const functionsList = document.getElementById('function-list');
    functionsList.innerHTML = ''; 

    // Loop through all matches and append them as list items to the function list
    while ((matches = functionPattern.exec(code)) !== null) {
        let li = document.createElement('li');
        li.textContent = matches[1]; // matches[1] contains the function name
        functionsList.appendChild(li);
    }
}

// Loads and displays the list of files from the server.
// It makes a fetch request to '/list-files' endpoint and updates the 'file-list' DOM element.

function loadFileList() {
    const fileList = document.getElementById('file-list'); // Define fileList here

    fetch('/list-files') // endpoint as per server implementation
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json(); // Parse JSON only if the response is ok
        })
        .then(data => {
            if (Array.isArray(data.files)) { // Check if data.files is an array
                // Populate the file list
                data.files.forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = file;
                    li.addEventListener('click', () => openFile(file)); // Add a click event to open the file
                    fileList.appendChild(li);
                });
            } else {
                console.error('Data.files is not an array:', data.files);
            }
        })
        .catch(error => {
            console.error('Error loading files:', error);
        });
}



// Opens a file and loads its content into the editor.
// It takes a filePath as a parameter and makes a fetch request to the '/open-file' endpoint.
function openFile(filePath) {
    fetch(`/open-file?path=${encodeURIComponent(filePath)}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                editor.setValue(data.content); // Load file content into the editor
            } else {
                console.error('Open file error:', data.message);
            }
        })
        .catch(error => {
            console.error('Open file error:', error);
        });
}

// Call loadFileList when the page loads



// Handles pagination by incrementing/decrementing the current page.
// Calls loadFileList with the new page number.
function goToNextPage() {
    currentPage++;
    loadFileList(currentPage);
}
// Function to handle going to the previous page
function goToPreviousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadFileList(currentPage);
    }
}



// Executes Python code from the editor.
// It sends the code to the '/execute' endpoint and handles the response.
function executePythonCode(code) {
    fetch('/execute', {
        method: 'POST',
        body: JSON.stringify({ code: code }),
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        const result = data.result;
        const lintingResult = data.lintingResult; // Extract linting results
        document.getElementById('output-area').textContent = result;

        // Display linting results in the 'linting-results' div
        const lintingResultsDiv = document.getElementById('linting-results');
        lintingResultsDiv.innerHTML = ''; // Clear existing content

        // Check if lintingResult is defined and an array before looping through it
        if (Array.isArray(lintingResult)) {
            // Format and display linting results
            lintingResult.forEach(item => {
                const resultItem = document.createElement('div');
                resultItem.className = item.type === 'error' ? 'linting-error' : 'linting-warning';
                resultItem.textContent = item.message;
                lintingResultsDiv.appendChild(resultItem);
            });
        } else if (lintingResult !== undefined) {
            console.error('Linting results are not an array:', lintingResult);
        }
    })
    .catch(error => {
        console.error('Execution error:', error);
        document.getElementById('output-area').textContent = 'Error executing code.';
    });
}



// Saves the current code to a file on the server.
// It takes the code and filePath as parameters and sends them to the '/save-file' endpoint.
function saveFile(code, fileName) {
    // Create a Blob from the code
    var blob = new Blob([code], { type: 'text/plain' });

    // Create an object URL for the Blob
    var url = window.URL.createObjectURL(blob);

    // Create a new anchor element
    var a = document.createElement('a');

    // Set the href to the object URL
    a.href = url;

    // Set the download attribute to the desired file name
    a.download = fileName || 'default.txt';

    // Append the anchor to the body
    document.body.appendChild(a);

    // Trigger the download by simulating a click on the anchor
    a.click();

    // Clean up by revoking the object URL and removing the anchor
    window.URL.revokeObjectURL(url); // Fix the missing ( here
    document.body.removeChild(a);
}

// Example usage:
document.getElementById('save-btn').addEventListener('click', function() {
    var code = editor.getValue(); // Assuming 'editor' is the code editor instance
    var fileName = 'my_document.txt'; 
    saveFile(code, fileName);
});


document.getElementById('save-btn').addEventListener('click', function() { 
    // 'editor' is the code editor instance
    var code = editor.getValue(); 
    var filePath = 'C:\\Users\\KM\\venv\\Code Editor'; // actual file path

    saveFile(code, filePath); 
});


// Toggles comment state for the selected range in the editor.
// Checks if the editor instance has necessary methods before performing the action.

function toggleComment() {
  
    if (editor && typeof editor.getCursor === "function" && typeof editor.toggleComment === "function") {
        var range = { from: editor.getCursor(true), to: editor.getCursor(false) };
        editor.toggleComment(range.from, range.to);
    } else {
        console.error('toggleComment function is not available on the editor instance.');
    }
}

// Sets up the event listener for the 'Run Code' button.
// On click, it executes the Python code currently in the editor.
function setupRunButton() {
    const runButton = document.getElementById('run-code-btn');
    if (runButton) {
        runButton.addEventListener('click', function() {
            executePythonCode(editor.getValue()); // Get code from CodeMirror editor
        });
    } else {
        console.error('Run button not found');
    }
}

// Extracts function names from the given Python code.
// Returns an array of function names found in the code.
function extractFunctionNames(code) {
    const functionPattern = /def\s+(\w+)\s*\(/g;
    const matches = [];
    let match;
    while ((match = functionPattern.exec(code))) {
        matches.push(match[1]);
    }
    return matches;
}

    // Call loadFileList when the page loads
    function initializeApp() {
        // Load file list
        loadFileList();
    
        // Set up function list click events
        const functionList = document.getElementById('function-list');
        functionList.addEventListener('click', function(e) {
            if (e.target && e.target.nodeName === "LI") {
                const functionName = e.target.textContent;
    
                switch (functionName) {
                    case 'lint_python':
                        lintPythonCode(editor.getValue());
                        break;
                    case 'is_safe_path':
                        checkSafePath();
                        break;
                    case 'save_file':
                        // Call your save file logic here
                        break;
                    // Handle other function names as needed
                    default:
                        console.error(`Unknown function: ${functionName}`);
                        break;
                }
            }
        });

    }

    function openFileOrFolder(path) {
        fetch(`/open-file-or-folder?path=${encodeURIComponent(path)}`)
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    if (data.type === 'file') {
                        // It's a file, load its content into the editor
                        editor.setValue(data.content);
                    } else if (data.type === 'folder') {
                        // It's a folder, update the file explorer with its contents
                        updateFileExplorer(data.contents);
                    } else {
                        console.error('Unknown type:', data.type);
                    }
                } else {
                    console.error('Open file/folder error:', data.message);
                }
            })
            .catch(error => {
                console.error('Open file/folder error:', error);
            });
    }
    function updateFileExplorer(contents) {
        
        
        const fileExplorer = document.getElementById('file-explorer'); // Get the file explorer container
    
        // Clear the existing contents of the file explorer
        fileExplorer.innerHTML = '';
    
        contents.forEach(item => {
            const listItem = document.createElement('li');
            listItem.textContent = item.name;
            
            if (item.type === 'folder') {
                // If it's a folder, add a folder icon or any other styling you prefer
                listItem.classList.add('folder-item');
            } else if (item.type === 'file') {
                // If it's a file, add a file icon or any other styling you prefer
                listItem.classList.add('file-item');
            }
    
            // Attach a click event listener to handle opening files or folders
            listItem.addEventListener('click', () => {
                openFileOrFolder(item.name); // Assuming 'openFileOrFolder' handles opening files or folders
            });
    
            // Append the list item to the file explorer
            fileExplorer.appendChild(listItem);
        });
    }
    

document.addEventListener('DOMContentLoaded', function() {
    // Initialize CodeMirror editor
    editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
        lineNumbers: true,
        mode: "python",
        theme: "monokai",
        autoCloseBrackets: true,
        matchBrackets: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        smartIndent: true,
        lint: true,
        indentUnit: 4,
        lintMode: "python",
        fullScreen: false,
        viewportMargin: Infinity,
        extraKeys: {
            "Ctrl-Q": function (cm) {
                cm.foldCode(cm.getCursor());
            },
            "Ctrl-F": "findPersistent",
            "Ctrl-R": "replace",
            "Shift-Ctrl-R": "replaceAll",
            "Ctrl-Space": "autocomplete", 
            "Ctrl-/": function (cm) {
                cm.toggleComment();
            },
        },
        styleActiveLine: true,
        placeholder: "Write your Python code here",
        hintOptions: {
            hint: (cm, options) => {
                const cursor = cm.getCursor(); // Gets the cursor position
                const token = cm.getTokenAt(cursor); // Gets the token at the cursor position
                const start = token.start;
                const end = cursor.ch; // End of the current word
    
                // Use the 'anyword' hint function with a custom list of words
                const wordList = ['function1', 'function2', 'variable1', 'variable2']; // Customize this list
                const matchedWords = wordList.filter(word => word.startsWith(token.string));
    
                return {
                    list: matchedWords,
                    from: CodeMirror.Pos(cursor.line, start),
                    to: CodeMirror.Pos(cursor.line, end),
                };
            },
            // ... (other hint options)
        },
    });


    // Set up a single DOMContentLoaded event listener
    document.addEventListener('DOMContentLoaded', initializeApp);

    // Existing autocomplete function
    CodeMirror.commands.autocomplete = function(cm) {
        cm.showHint({ hint: CodeMirror.hint.anyword });
    };


    // Handle the insertion of selected suggestions when Enter or Tab is pressed
    editor.on('keydown', (cm, event) => {
        const selectedSuggestion = cm.state.completionActive?.data;
        if (selectedSuggestion && (event.key === 'Enter' || event.key === 'Tab')) {
            event.preventDefault();
            cm.replaceRange(selectedSuggestion, cm.getCursor(), cm.getCursor(), '+input');
        }
    });

    editor.setOption("extraKeys", {
        "Ctrl-Shift-S": function(cm) {
          // Logic to open or focus the snippet dropdown
          document.getElementById('snippet-dropdown').focus();
        }
      });


      // Update function list when the code changes
      editor.on("change", () => {
    const code = editor.getValue();
    const functionList = extractFunctionNames(code);
    const functionListContainer = document.getElementById("function-list");

    // Clear existing list
    functionListContainer.innerHTML = "";

    // Populate the function list
    functionList.forEach((func) => {
        const listItem = document.createElement("li");
        listItem.textContent = func;
   
        functionListContainer.appendChild(listItem);
    });
});

// Inserts a selected code snippet at the cursor position in the editor.
// Takes the editor instance and the snippet string as parameters.
    function insertSnippet(editor, snippet) {
        var doc = editor.getDoc();
        var cursor = doc.getCursor(); // Gets the line number in the cursor position
        doc.replaceRange(snippet, cursor);
    }

    const snippets = {
        'Print Statement': 'print("Hello, world!")',
        'For Loop': 'for i in range(10):\n\tprint(i)',
        'While Loop': 'while condition:\n\t# Do something',
        'If Statement': 'if condition:\n\t# Do something',
        'Function Definition': 'def function_name(parameters):\n\t# Do something',
        'Class Definition': 'class ClassName:\n\tdef __init__(self):\n\t\t# Constructor',
        'Try Except': 'try:\n\t# Try to do something\nexcept Exception as e:\n\t# Handle exception',
        'List Comprehension': '[x for x in iterable]',
        'Dictionary Comprehension': '{key: value for key, value in iterable}',
        'Set Comprehension': '{expression for item in iterable}',
     
      };

      
      const snippetDropdown = document.getElementById('snippet-dropdown');
      Object.keys(snippets).forEach(key => {
        let option = document.createElement('option');
        option.value = key;
        option.textContent = key;
        snippetDropdown.appendChild(option);
      });

      
      snippetDropdown.addEventListener('change', () => {
        const selectedSnippet = snippets[snippetDropdown.value];
        if (selectedSnippet) {
          insertSnippet(editor, selectedSnippet);
        }
      });


      function updateContextualSnippets() {
        const codeContext = determineCodeContext(editor); 
        // Filter and update the snippet dropdown
        // For example, showing only 'For Loop' in a certain context
        if (codeContext === 'loop') {
          snippetDropdown.value = 'For Loop';
        }
      }
      editor.on("change", updateContextualSnippets);
      
    
    // Example usage
    insertSnippet(editor, "for (var i=0; i<10; i++) {\n\t// code\n}");

    // Attach event listener for 'change' on the editor
    editor.on("change", parseAndDisplayFunctions);
    // setupPagination();
    setupRunButton();

    // Add event listener for the toggle comment button
    document.getElementById ('toggle-comment-btn').addEventListener('click', toggleComment);
    loadFileList(currentPage); // Load the initial page of files


// Load the first page of files
loadFileList(1);

// Setup run button event listener
setupRunButton();

// Setup comment and uncomment button event listeners
document.getElementById('toggle-comment-btn').addEventListener('click', toggleComment);

});


// Function to set up the run button event listener
function setupRunButton() {
const runButton = document.getElementById('run-code-btn');
if (runButton) {
runButton.addEventListener('click', function() {
executePythonCode(editor.getValue()); // Gets code from CodeMirror editor
});
} else {
console.error('Run button not found');
}
}

document.getElementById('feedback-btn').addEventListener('click', () => {
    // Open feedback form or modal
  });
  
  function determineCodeContext(editor) {

    var cursor = editor.getCursor();
    var token = editor.getTokenAt(cursor);
    
    // Placeholder logic to determine the context
    if (token.string === 'def') {
        return 'function';
    } else if (token.string === 'for' || token.string === 'while') {
        return 'loop';
    }
    
    // Return a default context if no specific context is found
    return 'default';
}

// Implement the actual logic to determine the coding context based on your application's needs

function updateContextualSnippets() {
    var currentContext = determineCodeContext(editor); // Call the function to determine the context
    // Logic to filter and update the snippet dropdown based on the current context
    // For example:
    snippetDropdown.options.forEach((option) => {
        if (currentContext === 'function' && option.value === 'Function Snippet') {
            // Show or highlight the option
            option.style.display = '';
        } else if (currentContext === 'loop' && option.value === 'Loop Snippet') {
            // Show or highlight the option
            option.style.display = '';
        } else {
            // Hide or de-emphasize the option
            option.style.display = 'none';
        }
    });
}

document.getElementById('load-btn').addEventListener('click', function() {
    document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Assuming 'editor' is the variable for your code editor instance
            editor.setValue(e.target.result);
        };
        reader.readAsText(file);
    }
});

const functionDetails = {
    'lint_python': 'Lints Python code to check for errors.',
    'is_safe_path': 'Checks if a file path is safe and confined within a base directory.',
};

document.querySelectorAll('#function-list li').forEach(function(item) {
    item.addEventListener('click', function() {
        const functionName = this.textContent;
        const infoDiv = document.getElementById('function-info');
        const nameElem = document.getElementById('function-name');
        const descElem = document.getElementById('function-description');

        nameElem.textContent = functionName;
        descElem.textContent = functionDetails[functionName] || 'No description available.';
        infoDiv.style.display = 'block';
    });
});
// Declare the linting function
function lintPythonCode(code) {
    // Split the code into lines
    const lines = code.split('\n');
    
    // Initialize an array to store linting messages
    const lintingResults = [];

    // Example linting logic: Check for lines longer than 80 characters
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.length > 80) {
          
            lintingResults.push({
                type: 'error', // 'error' or 'warning'
                message: `Line ${i + 1} is longer than 80 characters.`,
            });
        }
    }


    // Return the linting results
    return lintingResults;
}
const lintButton = document.getElementById('lint-button');
const lintingResultsDiv = document.getElementById('linting-results');

if (lintButton && lintingResultsDiv) {
    lintButton.addEventListener('click', function() {
        // Call the linting function with the correct name
        const lintingResults = lintPythonCode(editor.getValue());

        // Clear existing linting results
        lintingResultsDiv.innerHTML = '';

        // Display linting results in the 'linting-results' div
        lintingResults.forEach(item => {
            const resultItem = document.createElement('div');
            resultItem.className = item.type === 'error' ? 'linting-error' : 'linting-warning';
            resultItem.textContent = item.message;
            lintingResultsDiv.appendChild(resultItem);
        });

        // Show linting results
        lintingResultsDiv.style.display = 'block';

        // Add a click event listener to the document body to hide linting results when clicked outside
        document.body.addEventListener('click', function(event) {
            if (!lintingResultsDiv.contains(event.target) && event.target !== lintButton) {
                // Clicked outside the linting results and lint button, hide linting results
                lintingResultsDiv.style.display = 'none';
            }
        });
    });
}

const pythonCode = "print('Hello, world!')\n# This line is longer than 80 characters, so it should trigger a linting error";
const lintingResults = lintPythonCode(pythonCode);
console.log(lintingResults); // Display linting results in the console



// Get a reference to the home button element
const homeButton = document.getElementById('home-btn');

// Add a click event listener to the home button
homeButton.addEventListener('click', function() {
    // Refresh the page
    location.reload();
});