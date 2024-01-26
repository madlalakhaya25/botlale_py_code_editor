from flask import Flask, render_template, request, jsonify
import os
import subprocess
import pathlib
import shlex
import tempfile  # Import tempfile module

app = Flask(__name__)

@app.route('/delete-file', methods=['POST'])
def delete_file():
    data = request.json
    file_path = pathlib.Path(DIRECTORY_PATH / data['filename'])
    
    # Ensure the file path is safe to manipulate
    if is_safe_path(DIRECTORY_PATH, file_path):
        try:
            # Remove the file if it exists
            if file_path.is_file():
                file_path.unlink()
                return jsonify({'status': 'success', 'message': f'File {data["filename"]} deleted successfully.'})
            else:
                return jsonify({'status': 'error', 'message': 'File does not exist.'}), 404
        except Exception as e:
            # Return a server error response if something goes wrong
            return jsonify({'status': 'error', 'message': str(e)}), 500
    else:
        # Return a client error response if the path is not safe
        return jsonify({'status': 'error', 'message': 'Unsafe file path'}), 400

@app.route('/lint', methods=['POST'])
def lint_code():
    code = request.data.decode('utf-8')
    lint_results = run_unified_linter(code)
    return jsonify(lint_results)

def run_unified_linter(code):
    # Assuming you choose flake8
    with tempfile.NamedTemporaryFile(mode='w+', delete=False) as tmp:
        tmp.write(code)
        tmp_path = tmp.name

    result = subprocess.run(['flake8', tmp_path], capture_output=True, text=True)
    
    lint_issues = []
    for line in result.stdout.splitlines():
        parts = line.split(':')
        if len(parts) >= 4:
            filename, line_number, column, message = parts[0], int(parts[1]), int(parts[2]), ':'.join(parts[3:])
            lint_issues.append({
                'line': line_number,
                'column': column,
                'message': message.strip()
            })

    return lint_issues


# Configurable directory path
DIRECTORY_PATH = pathlib.Path(os.getenv('DIRECTORY_PATH', 'C:\\Users\\KM\\venv\\Code Editor'))

def is_safe_path(basedir, path, follow_symlinks=True):
    # Check if the path is safe and confined within the basedir
    return pathlib.Path(path).resolve(follow_symlinks).is_relative_to(basedir)

def save_code_to_temp_file(code):
    try:
        # Create a temporary directory to store the script
        temp_dir = tempfile.mkdtemp()

        # Define the temporary file path
        temp_file_path = os.path.join(temp_dir, 'script.py')

        # Write the code to the temporary file
        with open(temp_file_path, 'w') as temp_file:
            temp_file.write(code)

        return temp_file_path
    except Exception as e:
        raise Exception(f"Error while saving code to a temporary file: {str(e)}")

def run_python_code(code):
    try:
        temp_file_path = save_code_to_temp_file(code)
        print(f"Temporary file path: {temp_file_path}")  # Debugging line

        # Check if the file exists
        if os.path.exists(temp_file_path):
            print("File exists, proceeding to execute.")  # Debugging line
        else:
            print("File does not exist, check the temp file creation process.")  # Debugging line

        python_command = f"python {shlex.quote(temp_file_path)}"
        args = shlex.split(python_command)
        process = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

        # Print outputs for debugging
        print(f"STDOUT: {process.stdout}")
        print(f"STDERR: {process.stderr}")

        return process.stdout or process.stderr
    except Exception as e:
        print(f"Exception during execution: {e}")  # Debugging line
        raise Exception(f"Error while running Python code: {str(e)}")


@app.route('/list-files', methods=['GET'])
def list_files():
    page = request.args.get('page', default=1, type=int)
    per_page = request.args.get('per_page', default=10, type=int)
    all_files = os.listdir(DIRECTORY_PATH)
    files = all_files[(page - 1) * per_page: page * per_page]
    return jsonify({'files': files, 'total': len(all_files)})

@app.route('/execute', methods=['POST'])
def execute_code():
    data = request.json
    code = data['code']

    try:
        output = run_python_code(code)  # Fixed function name
        return jsonify({'status': 'success', 'result': output})
    except Exception as e:
        return jsonify({'status': 'error', 'result': f'Error: {e}'})

@app.route('/')
def home():
    return render_template('editor.html')

@app.route('/save-file', methods=['POST'])
def save_file():
    data = request.json
    file_path = pathlib.Path(DIRECTORY_PATH / data['path'])
    if is_safe_path(DIRECTORY_PATH, file_path):
        try:
            with file_path.open('w') as file:
                file.write(data['code'])
            return jsonify({'status': 'success'})
        except IOError as e:
            return jsonify({'status': 'error', 'message': str(e)})
    else:
        return jsonify({'status': 'error', 'message': 'Unsafe file path'}), 400

@app.route('/open-file', methods=['GET'])
def open_file():
    file_path = pathlib.Path(DIRECTORY_PATH / request.args.get('path'))
    if is_safe_path(DIRECTORY_PATH, file_path):
        try:
            with file_path.open('r') as file:
                content = file.read()
            # Include the filename in the response
            return jsonify({'status': 'success', 'content': content, 'filename': file_path.name})
        except IOError as e:
            return jsonify({'status': 'error', 'message': str(e)})
    else:
        return jsonify({'status': 'error', 'message': 'Unsafe file path'}), 400


if __name__ == '__main__':
    app.run(debug=True)

    