// Editor is in the global scope if accessed by other functions
let editor;

let currentPage = 1; // first page
const perPage = 10; 

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

document.getElementById('load-btn').addEventListener('click', function() {
    document.getElementById('file-input').click();
});


// Function to open a file and load its content into the editor
function openFile(filePath) {
    fetch(`/open-file?path=${encodeURIComponent(filePath)}`)
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                editor.setValue(data.content);
            } else {
                console.error('Open file error:', data.message);
            }
        })
        .catch(error => {
            console.error('Open file error:', error);
        });
}

// Define a function to handle the file input change event
function handleFileInputChange(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            editor.setValue(e.target.result);
        };
        reader.readAsText(file);
    }
}


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


document.getElementById('save-btn').addEventListener('click', function() {
    var code = editor.getValue(); // Assuming 'editor' is the code editor instance
    var fileName = 'my_document.txt'; 
    saveFile(code, fileName);
});



// Toggles comment state for the selected range in the editor.
// Checks if the editor instance has necessary methods before performing the action.

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

document.addEventListener('DOMContentLoaded', function () {

    // Initialize CodeMirror editor
    editor = CodeMirror.fromTextArea(document.getElementById("code-editor"), {
        lineNumbers: true,
        mode: "python",
        theme: "monokai",
        autoCloseBrackets: true, // Auto bracketing
        matchBrackets: true,
        foldGutter: true,       // Code folding/gutter
        gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
        smartIndent: true,
        lint: true,
        indentUnit: 4,
        lintMode: "python",
        fullScreen: false,
        viewportMargin: Infinity,
        styleActiveLine: true,
        placeholder: "Write your Python code here",
        hintOptions: {
            hint: (cm, options) => {
                const cursor = cm.getCursor(); // Gets the cursor position
                const token = cm.getTokenAt(cursor); // Gets the token at the cursor position
                const start = token.start;
                const end = cursor.ch; // End of the current word

                // Filter the autocomplete words that start with the token string
                const matchedWords = autocompleteWords.filter(word => word.startsWith(token.string));

                return {
                    list: matchedWords,
                    from: CodeMirror.Pos(cursor.line, start),
                    to: CodeMirror.Pos(cursor.line, end),
                };

            },
            completeSingle: false, // Enable autocomplete while typing
        },
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

    // Add event listener for linting
    document.getElementById('lint-btn').addEventListener('click', function () {
        const lintResults = lintPythonCode(editor.getValue());
        displayLintResults(lintResults);
    });

    function displayLintResults(lintResults) {
        const resultsContainer = document.getElementById('lint-results');
        resultsContainer.innerHTML = ''; // Clear previous results

        if (lintResults.length === 0) {
            resultsContainer.innerHTML = '<p>No linting errors or warnings found.</p>';
            return;
        }

        lintResults.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'lint-result-item';
            resultItem.classList.add(result.type === 'error' ? 'lint-error' : 'lint-warning');
            resultItem.textContent = `${result.type.toUpperCase()}: Line ${result.line}: ${result.message}`;
            resultsContainer.appendChild(resultItem);
        });
    }

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

document.getElementById('feedback-btn').addEventListener('click', () => {
    // 
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

    // Event listener for loading a file
    document.getElementById('file-input').addEventListener('change', function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function (e) {
                editor.setValue(e.target.result);
            };
            reader.readAsText(file);
        }
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

function lintPythonCode(code) {
    const lintingResults = [];

    // Check for lines longer than 79 characters (PEP 8 recommendation)
    const lines = code.split('\n');
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
    });

    return lintingResults;
}


    // Event listener for the home button
    document.getElementById('home-btn').addEventListener('click', function () {
        location.reload();
    });


    document.addEventListener('DOMContentLoaded', initializeApp);