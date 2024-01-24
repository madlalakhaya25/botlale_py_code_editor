// Editor is in the global scope if accessed by other functions
let editor;
let currentPage = 1; // first page
const perPage = 10; 
let lastSearchTerm = null;
let searchCursor = null;
let lintingEnabled = false; // Initialize linting as enabled by default
let snippetDropdown; // Declare the snippetDropdown variable
let tabs = [];



// Function to parse and display functions
function parseAndDisplayFunctions() {
    const code = editor.getValue();
    const functionPattern = /def\s+(\w+)\s*\(/g;
    let matches;
    const functionsList = document.getElementById('function-list');
    functionsList.innerHTML = '';

    // Clear any existing markers
    editor.getAllMarks().forEach(mark => mark.clear());

    // We need to handle click events on individual list items, not on the entire list
    functionsList.onclick = function(event) {
        let target = event.target; // Where was the click?
        if (target.tagName !== 'LI') return; // Not on LI? Then we're not interested
        
        highlightFunction(target);
    };

    while ((matches = functionPattern.exec(code)) !== null) {
        const startPos = editor.posFromIndex(matches.index); // Convert index to line and ch
        // We need to find the end of the function, which is a bit more complex than lastIndex
        let li = document.createElement('li');
        li.textContent = matches[1];
        li.setAttribute('data-start-line', startPos.line); // Store the starting line number
        // We won't set the end line here because it's not trivial to find
        functionsList.appendChild(li);
    }
}


// Separate function to handle highlighting of the function name
function highlightFunction(listItem) {
    const startLine = parseInt(listItem.getAttribute('data-start-line'));
    const functionName = listItem.textContent; // Get the function name from the list item
    // Move cursor to the start of the function name
    editor.setCursor({line: startLine, ch: 0});

    // Remove existing highlights
    editor.getAllMarks().forEach(mark => mark.clear());

    // Highlight just the function name
    editor.markText(
        { line: startLine, ch: 0 },
        { line: startLine, ch: functionName.length },
        { className: 'highlight-line' }
    );


    // Scroll to the function's position
    editor.scrollIntoView({line: startLine, ch: 0});

    // Add an event listener to clear the highlight when Escape key is pressed
    const removeHighlightOnEscape = (event) => {
        if (event.key === 'Escape') {
            editor.getAllMarks().forEach(mark => mark.clear());
            document.removeEventListener('keydown', removeHighlightOnEscape);
        }
    };

    document.addEventListener('keydown', removeHighlightOnEscape);
}


const removeHighlightOnEscape = (event) => {
    if (event.key === 'Escape') {
        editor.getAllMarks().forEach(mark => mark.clear());
        document.removeEventListener('keydown', removeHighlightOnEscape);

        // Reset the 'function-list' selection
        const functionsList = document.getElementById('function-list');
        functionsList.querySelectorAll('li').forEach(item => {
            item.classList.remove('selected');
        });
    }
};

document.addEventListener('keydown', removeHighlightOnEscape);


// Function to load the list of files from the server
function loadFileList(page) {
    const fileList = document.getElementById('file-list');
    fetch(`/list-files?page=${page}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (Array.isArray(data.files)) {
                fileList.innerHTML = '';
                data.files.forEach(file => {
                    const li = document.createElement('li');
                    li.textContent = file;
                    li.addEventListener('click', () => openFile(file));
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
                // Use the filename from the response to update the active file display
                document.getElementById("active-filename").textContent = `Active File: ${data.filename}`;
            } else {
                console.error('Open file error:', data.message);
            }
        })
        .catch(error => {
            console.error('Open file error:', error);
        });
}



// Bind the "Ctrl+Shift+E" keyboard shortcut to open the file dialog
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.shiftKey && (event.key === 'E' || event.key === 'e')) { // Check for Ctrl+Shift+E (upper or lower case)
        event.preventDefault(); // Prevent the browser's default behavior (e.g., opening bookmarks)

        // Trigger the file dialog by clicking the hidden file input element
        const fileInput = document.getElementById('file-input');
        fileInput.click();
    }
});

// Bind the "Load File" button click event
document.getElementById('load-btn').addEventListener('click', function() {
    document.getElementById('file-input').click();
});


// Function to execute Python code from the editor
function executePythonCode(code) {
    fetch('/execute', {
        method: 'POST',
        body: JSON.stringify({ code: code }),
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            const result = data.result;
            const lintingResult = data.lintingResult;
            document.getElementById('output-area').textContent = result;

            const lintingResultsDiv = document.getElementById('linting-results');
            lintingResultsDiv.innerHTML = '';

            if (Array.isArray(lintingResult)) {
                lintingResult.forEach(error => {
                    const errorDiv = document.createElement('div');
                    errorDiv.classList.add('linting-error');
                    errorDiv.textContent = `${error.row}:${error.column} - ${error.message}`;
                    lintingResultsDiv.appendChild(errorDiv);
                });
            }
        })
        .catch(error => {
            console.error('Execution error:', error);
        });
}

// Saves the current code to a file on the server.
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

document.getElementById('save-btn').addEventListener('click', function() {
    var code = editor.getValue(); // Assuming 'editor' is the code editor instance
    var fileName = 'my_document.txt'; 
    saveFile(code, fileName);
});


// Function to toggle comment state for the selected range in the editor
function toggleComment() {
    const selections = editor.listSelections();
    editor.operation(() => {
        for (const selection of selections) {
            const { anchor, head } = selection;
            editor.toggleComment({
                from: anchor,
                to: head,
            });
        }
    });
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
    functionList.addEventListener('click', function (e) {
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

document.getElementById('file-input').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();

        reader.onload = function(e) {
            const contents = e.target.result;
            editor.setValue(contents);
            document.getElementById("active-filename").textContent = `Active File: ${file.name}`;
        };

        reader.readAsText(file);
    }
});


    
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
    
   import { autocompleteWords } from './autocompletewords.js';

    // Now you can use the autocompleteWords array in your main script
    console.log(autocompleteWords); // Example usage

// Wrap your event listener code in a function
function attachEditorEventListeners() {
    // Attach event listeners to the editor object
    if (editor) {
        // Attach your event listeners here
        editor.on('change', parseAndDisplayFunctions);
        // ...other event listeners
    } else {
        console.error('Editor is not initialized.');
    }
}

var customKeyMap = {
    "Ctrl-F": function(editor) {
        // Logic for Ctrl+F / Cmd+F
        triggerSearch(editor);
    },
    "Ctrl-H": function(editor) {
        // Logic for Ctrl+H / Cmd+H
        triggerReplace(editor);
    },

    "Ctrl-/": function(editor) {
        // Logic for Ctrl+/ / Cmd+/
        toggleComment(editor);

        
    },

    "Ctrl-I": function (editor) {
        // Toggle linting state
        toggleLinting(editor); // Call the toggleLinting function
    },

    "Ctrl-G": function(editor) {
        // Logic for Ctrl+/ / Cmd+/
        goToLine(editor);
    },

    "Cmd-G": function(editor) {
        // Logic for Ctrl+/ / Cmd+/
        goToLine(editor);
    },

    "Cmd-/": function(editor) {
        // Logic for Ctrl+/ / Cmd+/
        toggleComment(editor);
    },
    "Cmd-F": function(editor) { // For Mac users
        triggerSearch(editor);
    },
    "Cmd-H": function(editor) { // For Mac users
        triggerReplace(editor);
    },
    "Ctrl-Enter": function(editor) {
        executePythonCode(editor.getValue());
    },
    "Cmd-Enter": function(editor) { // For Mac users
        executePythonCode(editor.getValue());
    },
    "Ctrl-S": function(editor) {
        saveFile(editor.getValue(), 'filename.py'); // Replace 'filename.py' with your logic for file names
    },
    "Cmd-S": function(editor) { // For Mac users
        saveFile(editor.getValue(), 'filename.py');
    },
    "Ctrl-Shift-L": function(editor) {
        // Logic to trigger the load file functionality
        // This might require additional UI for the user to input a file path
        openFile(); // You need to define how to get the file path
    },
    "Cmd-O": function(editor) { // For Mac users
        openFile();

        
    }
};

// Define the go to line function
function goToLine(editor) {
    // Remove any existing line input
    var existingInput = document.getElementById('go-to-line-input');
    if (existingInput) {
        existingInput.remove();
    }

    // Create an input field for the line number
    var input = document.createElement("input");
    input.id = 'go-to-line-input';
    input.type = "text";
    input.style.position = "absolute";
    input.style.zIndex = "10";
    input.style.left = "50%";
    input.style.top = "40%";
    input.style.transform = "translate(-50%, -50%)";
    input.style.fontSize = "1.2em";
    input.style.padding = "5px";
    input.style.width = "200px";
    input.style.textAlign = "center";
    input.style.border = "1px solid #888";
    input.style.borderRadius = "4px";
    input.style.boxShadow = "0px 4px 5px rgba(0,0,0,0.2)";
    input.style.backgroundColor = "#fff";
    input.placeholder = "Go to line...";
    input.setAttribute("aria-label", "Go to line number");

    // Function to handle the "Enter" key in the input field
    input.onkeydown = function(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            var lineNum = parseInt(this.value, 10);
            if (!isNaN(lineNum) && lineNum > 0) {
                editor.setCursor(lineNum - 1);
                editor.focus();
                this.remove();
            } else {
                alert("Please enter a valid line number.");
            }
        }
    };

    // Add the input to the DOM and focus it
    document.body.appendChild(input);
    input.focus();

    // Function to remove the input field when it loses focus
    input.onblur = function() {
        this.remove();
    };
}

function triggerSearch(editor) {
    // Logic to open the search box or focus on it
    document.getElementById('search-box').focus();
}

function triggerReplace(editor) {
    // Logic to open the replace box or focus on it
    document.getElementById('replace-box').focus();
}

document.addEventListener('DOMContentLoaded', function () {


    // Initialize CodeMirror editor
    editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
        lineNumbers: true,
        mode: "python",
        theme: "solarized",
        autoCloseBrackets: true,
        matchBrackets: true,
        foldGutter: true,
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter", "CodeMirror-lint-markers"],
        smartIndent: true,
        indentUnit: 4,
        fullScreen: false,
        viewportMargin: Infinity,
        styleActiveLine: true,
        placeholder: "Write your Python code here",
        hintOptions: {
            hint: (cm, options) => {
                const cursor = cm.getCursor();
                const token = cm.getTokenAt(cursor);
                const start = token.start;
                const end = cursor.ch;
                const matchedWords = autocompleteWords.filter(word => word.startsWith(token.string));

                return {
                    list: matchedWords,
                    from: CodeMirror.Pos(cursor.line, start),
                    to: CodeMirror.Pos(cursor.line, end),
                };
            },
        },
        lint: {
            getAnnotations: (code) => {
                const lintingResults = lintPythonCode(code);
                return lintingResults.map((result) => ({
                    from: CodeMirror.Pos(result.row - 1, result.column),
                    to: CodeMirror.Pos(result.row - 1, result.column),
                    message: result.message,
                    severity: result.type === 'error' ? 'error' : 'warning',
                }));
            },
        },
    });

    // Add the custom key map to the editor
    editor.addKeyMap(customKeyMap);

    // Add the "change" event listener after initializing the editor
    editor.on("change", updateContextualSnippets);




    
    function findNext(editor, term) {
        if (!term) return; // No search term provided
        if (term !== lastSearchTerm) {
            // New search term, reset cursor
            searchCursor = editor.getSearchCursor(term);
            lastSearchTerm = term;
        }
        if (searchCursor.findNext()) {
            editor.setSelection(searchCursor.from(), searchCursor.to());
        } else {
            // Restart from the top
            searchCursor = editor.getSearchCursor(term);
            if (searchCursor.findNext()) {
                editor.setSelection(searchCursor.from(), searchCursor.to());
            }
        }
    }
    

    function replaceNext(editor, term, replacement) {
        if (!searchCursor || !term) return; // Ensure active search and term is provided
    
        if (searchCursor.from() && searchCursor.to()) {
            editor.replaceRange(replacement, searchCursor.from(), searchCursor.to());
            findNext(editor, term); // Move to next match after replacement
        } else {
            // If no active cursor or the term is not found, initialize search
            findNext(editor, term);
        }
    }
    

    function replaceAll(editor, term, replacement) {
        if (!term) return; // No search term provided
    
        let cursor = editor.getSearchCursor(term);
        while (cursor.findNext()) {
            editor.replaceRange(replacement, cursor.from(), cursor.to());
            // Reinitialize cursor after each replacement to continue the search
            cursor = editor.getSearchCursor(term, cursor.to());
        }
    }
    

document.getElementById('find-next-btn').addEventListener('click', () => {
    const searchTerm = document.getElementById('search-box').value;
    findNext(editor, searchTerm);
});

document.getElementById('replace-next-btn').addEventListener('click', () => {
    const searchTerm = document.getElementById('search-box').value;
    const replacement = document.getElementById('replace-box').value;
    replaceNext(editor, searchTerm, replacement);
});

document.getElementById('replace-all-btn').addEventListener('click', () => {
    const searchTerm = document.getElementById('search-box').value;
    const replacement = document.getElementById('replace-box').value;
    replaceAll(editor, searchTerm, replacement);
});

document.getElementById('search-btn').addEventListener('click', () => {
    const searchTerm = document.getElementById('search-box').value;
    if (searchTerm) {
        findNext(editor, searchTerm);
    }
});

document.getElementById('search-box').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent the default action
        const searchTerm = this.value;
        if (searchTerm) {
            findNext(editor, searchTerm);
        }
    }
});

document.getElementById('replace-box').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent the default action
        const searchTerm = document.getElementById('search-box').value;
        const replacement = this.value;
        if (searchTerm && replacement) {
            replaceNext(editor, searchTerm, replacement);
        }
    }
});


    // Call the function to attach event listeners
    attachEditorEventListeners();

    let autocompleteTimer = null;

    editor.on('inputRead', (cm, event) => {
        // Clear the previous timer (if any) to avoid multiple triggers
        if (autocompleteTimer) {
            clearTimeout(autocompleteTimer);
        }

        // Set a new timer to trigger autocomplete after a delay (e.g., 500 milliseconds)
        autocompleteTimer = setTimeout(() => {
            cm.showHint(); // Trigger autocomplete
        }, 500);
    });



   

    // Existing autocomplete function
    CodeMirror.commands.autocomplete = function (cm) {
        cm.showHint({ hint: CodeMirror.hint.anyword });
    };

    // Handle the insertion of selected suggestions when Enter or Tab is pressed
    editor.on('keydown', (cm, event) => {
        console.log('Key pressed:', event.key); // Add this line for debugging
        const selectedSuggestion = cm.state.completionActive?.data;

        if (selectedSuggestion && (event.key === 'Enter' || event.key === 'Tab')) {
            event.preventDefault(); // Prevent default behavior (e.g., line break)
            cm.replaceRange(selectedSuggestion, cm.getCursor(), cm.getCursor(), '+input');
        }
    });

    editor.setOption("extraKeys", {
        "Ctrl-Shift-S": function (cm) {
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
    function insertSnippet(editor, snippetText) {
        const doc = editor.getDoc();
        const cursor = doc.getCursor(); // Get the current cursor position
        let lineContent = doc.getLine(cursor.line); // Get the content of the current line
    
        // If the current line is not empty, prepend a newline character to the snippet
        if (lineContent.trim() !== '') {
            snippetText = '\n' + snippetText;
        }
    
        // Insert the snippet at the cursor position
        doc.replaceRange(snippetText, cursor);
    
        // Optionally, move the cursor to the end of the inserted snippet
        let endCursor = doc.getCursor(); // New cursor position after insertion
        doc.setCursor({line: endCursor.line, ch: endCursor.ch});
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

   // Existing event listener for snippet dropdown change
snippetDropdown.addEventListener('change', () => {
    const selectedSnippet = snippets[snippetDropdown.value];
    if (selectedSnippet) {
        insertSnippet(editor, selectedSnippet);
    }
});


    // Example usage
    insertSnippet(editor, "for (var i=0; i<10; i++) {\n\t// code\n}");

    // Attach event listener for 'change' on the editor
    editor.on("change", parseAndDisplayFunctions);
    // setupPagination();
    setupRunButton();

    // Add event listener for the toggle comment button
    document.getElementById('toggle-comment-btn').addEventListener('click', toggleComment);
    loadFileList(currentPage); // Load the initial page of files

    // Load the first page of files
    loadFileList(1);

    // Setup comment and uncomment button event listeners
    document.getElementById('toggle-comment-btn').addEventListener('click', toggleComment);
});

// Remove this extra closing parenthesis at the end of the code.


// Function to set up the 'Run Code' button event listener
function setupRunButton() {
    const runButton = document.getElementById('run-code-btn');
    if (runButton) {
        runButton.addEventListener('click', function () {
            executePythonCode(editor.getValue());
        });
    } else {
        console.error('Run button not found');
    }
}

  
  function updateContextualSnippets() {
    // Ensure snippetDropdown is defined in this function's scope
    if (snippetDropdown) {
        const currentContext = determineCodeContext(editor);

        snippetDropdown.options.forEach((option) => {
            if (
                (currentContext === 'function' && option.value === 'Function Snippet') ||
                (currentContext === 'loop' && option.value === 'Loop Snippet')
            ) {
                // Show or highlight the option
                option.style.display = '';
            } else {
                // Hide or de-emphasize the option
                option.style.display = 'none';
            }
        });
    }
}

function determineCodeContext(editor) {
    const cursor = editor.getCursor();
    const token = editor.getTokenAt(cursor);

    // Placeholder logic to determine the context
    if (token.string === 'def') {
        return 'function';
    } else if (token.string === 'for' || token.string === 'while') {
        return 'loop';
    }

    // Return a default context if no specific context is found
    return 'default';
}


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



    


    // Event listener for the home button
    document.getElementById('home-btn').addEventListener('click', function () {
        location.reload();
    });

    // Function to create a new document
function createNewDocument() {
    // Clear the editor content
    editor.setValue("");

    // Update the active filename to indicate it's a new untitled document
    document.getElementById("active-filename").textContent = "Active File: Untitled";
}

// Event listener for the "New File" button
document.getElementById("new-file-btn").addEventListener("click", createNewDocument);

// Function to change the editor's theme
function changeTheme(editor, theme) {
    editor.setOption("theme", theme);
}

// Event listener for the theme selector
document.getElementById('theme-selector').addEventListener('change', function() {
    changeTheme(editor, this.value);
});


function lintPythonCode(code) {
    if (!lintingEnabled) {
        return []; // Return an empty array if linting is disabled
    }
    
    const lintingResults = [];

    // Check for lines longer than 79 characters (PEP 8 recommendation)
    if (typeof code === 'string') {
        const lines = code.split('\n');
        // Rest of your code
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.length > 79) {
                lintingResults.push({
                    message: `Line ${i + 1} exceeds 79 characters (PEP 8 recommendation).`,
                    type: 'warning',
                    row: i + 1,
                    column: 80, // Suggested column limit
                });
            }
        }

        // Check for trailing whitespace
        for (let i = 0; i < lines.length; i++) {
            if (/\s+$/.test(lines[i])) {
                lintingResults.push({
                    message: `Trailing whitespace found on line ${i + 1}.`,
                    type: 'warning',
                    row: i + 1,
                    column: lines[i].length,
                });
            }
        }

        // Check for missing docstrings for functions and classes
        const functionPattern = /def\s+(\w+)\s*\(/g;
        const classPattern = /class\s+(\w+)\s*:/g;

        const functionMatches = code.match(functionPattern) || [];
        const classMatches = code.match(classPattern) || [];

        functionMatches.forEach((match, index) => {
            if (!/""".*?"""/s.test(match)) {
                // Docstring not found for function
                lintingResults.push({
                    message: `Missing docstring for function ${match.split(' ')[1]} on line ${functionMatches.index + index + 1}.`,
                    type: 'warning',
                    row: functionMatches.index + index + 1,
                    column: 0,
                });
            }
        });

        classMatches.forEach((match, index) => {
            if (!/""".*?"""/s.test(match)) {
                // Docstring not found for class
                lintingResults.push({
                    message: `Missing docstring for class ${match.split(' ')[1]} on line ${classMatches.index + index + 1}.`,
                    type: 'warning',
                    row: classMatches.index + index + 1,
                    column: 0,
                });
            }
        });

        // Check for incorrect indentation
        const indentationStack = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const indentationLevel = line.search(/\S/); // Find the first non-whitespace character's position

            if (indentationStack.length > 0) {
                const expectedIndentation = indentationStack[indentationStack.length - 1];

                if (indentationLevel !== expectedIndentation) {
                    lintingResults.push({
                        message: `Incorrect indentation on line ${i + 1}. Expected ${expectedIndentation} spaces, found ${indentationLevel}.`,
                        type: 'error',
                        row: i + 1,
                        column: indentationLevel,
                    });
                }
            }

            // Update the stack with the new indentation level
            indentationStack.push(indentationLevel);
        }

        // Check for unused variables
        const variablePattern = /\b(\w+)\s*=/g;
        const declaredVariables = new Set();

        let match;
        while ((match = variablePattern.exec(code))) {
            declaredVariables.add(match[1]);
        }

        // Analyze the code to find variable usages and mark unused variables
        declaredVariables.forEach((variable) => {
            const usagePattern = new RegExp(`\\b${variable}\\b`, 'g');
            const usages = code.match(usagePattern);

            if (usages && usages.length === 1) {
                // Only one usage (the declaration itself), consider it unused
                lintingResults.push({
                    message: `Unused variable: ${variable}.`,
                    type: 'warning',
                    row: code.substring(0, usages.index).split('\n').length,
                    column: usages.index,
                });
            }

// Check for unused imports
const importPattern = /import\s+(\w+)/g;
const usedImports = new Set();

let importMatch;
while ((importMatch = importPattern.exec(code))) {
    const moduleName = importMatch[1];
    usedImports.add(moduleName);
}

// Identify unused imports
const allImports = code.match(importPattern) || [];
allImports.forEach(importStatement => {
    const moduleName = importStatement.split(' ')[1];
    if (!usedImports.has(moduleName)) {
        lintingResults.push({
            message: `Unused import: ${moduleName}.`,
            type: 'warning',
            row: code.split('\n').indexOf(importStatement) + 1,
            column: 0,
        });
    }
});

// Check for missing 'return' statements in functions
const functionDefinitionPattern = /def\s+(\w+)\s*\(.+?\):/g;
const functionMatches = code.match(functionDefinitionPattern) || [];

functionMatches.forEach(match => {
    const functionName = match.split(' ')[1].split('(')[0];
    if (!/\breturn\b/.test(code.split(match)[1])) {
        lintingResults.push({
            message: `Missing 'return' statement in function: ${functionName}.`,
            type: 'warning',
            row: code.split('\n').indexOf(match) + 1,
            column: 0,
        });
    }

    // Check for unused functions
const functionDefinitions = code.match(/def\s+(\w+)\s*\(/g) || [];
const usedFunctions = new Set();

// Identify used functions (e.g., by checking if they are called)
// You can implement this logic as needed

functionDefinitions.forEach((functionDef) => {
    const functionName = functionDef.match(/def\s+(\w+)\s*\(/)[1];

    if (!usedFunctions.has(functionName)) {
        lintingResults.push({
            message: `Unused function: ${functionName}.`,
            type: 'warning',
            row: code.split('\n').findIndex((line) => line.includes(functionDef)) + 1,
            column: 0,
        });
    }
});

// Check for magic numbers
const magicNumberPattern = /\b\d+\b/g;
const magicNumbers = code.match(magicNumberPattern) || [];

magicNumbers.forEach((number) => {
    lintingResults.push({
        message: `Avoid magic number: ${number}.`,
        type: 'warning',
        row: code.split('\n').findIndex((line) => line.includes(number)) + 1,
        column: code.indexOf(number),
    });
});

// Check for unnecessary line breaks
for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i];
    const previousLine = lines[i - 1];

    if (currentLine.trim() === '' && previousLine.trim() === '') {
        lintingResults.push({
            message: `Unnecessary line break between lines ${i} and ${i + 1}.`,
            type: 'warning',
            row: i + 1,
            column: 0,
        });
    }
}

// Check for inconsistent line lengths
const maxLineLength = 100; // Adjust to your preferred maximum line length

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > maxLineLength) {
        lintingResults.push({
            message: `Line ${i + 1} exceeds the maximum line length of ${maxLineLength} characters.`,
            type: 'warning',
            row: i + 1,
            column: maxLineLength + 1, // Suggested column limit
        });
    }
}

});



        });
    } else {
        console.error('Invalid code: not a string');

        
    }

    return lintingResults;
}


// Function to toggle linting using the keyboard shortcut
// Function to toggle linting using the keyboard shortcut
document.addEventListener('keydown', function (event) {
    // Check for the Ctrl+I (Cmd+I for Mac) key combination
    if ((event.ctrlKey || event.metaKey) && event.key === 'I' ) {
        event.preventDefault(); // Prevent the default behavior of the key combination

        // Get the lint switch element
        const lintSwitch = document.getElementById('lint-switch');
        if (lintSwitch) {
            // Programmatically toggle the lint switch
            lintSwitch.checked = !lintSwitch.checked;
            // Call the toggleLinting function to apply the toggle effect
            toggleLinting();
        } else {
            console.error('Lint switch not found');
        }
    }
});

function toggleLinting() {
    // Get the checkbox element representing the lint switch
    const lintSwitch = document.getElementById('lint-switch');

    if (lintSwitch) {
        // Toggle linting state based on the switch's checked property
        lintingEnabled = lintSwitch.checked;

        // Update the aria-pressed attribute for accessibility
        lintSwitch.setAttribute('aria-pressed', String(lintingEnabled));

        // Call the linting function if it was enabled
        if (lintingEnabled) {
            lintCode(editor);
        }

        // Focus on the editor after toggling linting
        if (editor) {
            editor.focus();
        }
    } else {
        console.error('Lint switch not found');
    }
}

document.getElementById('lint-switch').addEventListener('change', toggleLinting);


// Custom linting function that checks the lintingEnabled flag
function lintCode(editor) {
    if (lintingEnabled) {
        const code = editor.getValue();
        const lintResults = lintPythonCode(code);
        displayLintResults(lintResults);
    } else {
        // Clear linting annotations if linting is disabled
        editor.clearGutter('CodeMirror-lint-markers');
    }
}

function displayLintResults(lintResults) {
    const gutterMarkers = [];

    lintResults.forEach(result => {
        const { row, column, message, type } = result;

        // Create a CSS class for the annotation based on the error type
        const annotationClass = type === 'error' ? 'lint-error' : 'lint-warning';

        // Add a gutter marker (icon) next to the line with the error/warning
        gutterMarkers.push({
            line: row - 1, // Adjust row to be zero-based
            text: type === 'error' ? '●' : '○', // Customizable marker symbols
            class: annotationClass,
        });

        // Add an inline annotation (tooltip) to highlight the issue
        try {
            // Add an inline annotation (tooltip) to highlight the issue
            editor.doc.markText(
                { line: row - 1, ch: column - 1 }, // Adjust column to be zero-based
                { line: row - 1, ch: column }, // Adjust column to highlight the character
                {
                    className: annotationClass,
                    title: message, // Display the error/warning message as a tooltip
                }
            );
        } catch (error) {
            console.error("An error occurred while marking text:", error);
        }
        
    });

    // Clear existing gutter markers before updating
    editor.clearGutter('CodeMirror-lint-markers');

    // Add new gutter markers with icons
    gutterMarkers.forEach(marker => {
        editor.setGutterMarker(marker.line, 'CodeMirror-lint-markers', createGutterMarker(marker));
    });
}

// Helper function to create a gutter marker element
function createGutterMarker(marker) {
    const markerElem = document.createElement('div');
    markerElem.classList.add('lint-gutter-marker', marker.class);
    markerElem.textContent = marker.text;
    return markerElem;
}

const lintSwitch = document.getElementById('lint-switch');

lintSwitch.addEventListener('change', function() {
    lintingEnabled = this.checked; // Toggle linting state based on switch

    // Call the linting function if it was enabled
    if (lintingEnabled) {
        lintCode(editor);
    }

    // Focus on the editor after toggling linting
    editor.focus();
});

    document.addEventListener('DOMContentLoaded', initializeApp);