from flask import Flask, render_template, request, jsonify
import os
import subprocess
import pathlib
import shlex
import tempfile  # Import tempfile module

app = Flask(__name__)

@app.route('/lint-python', methods=['POST'])
def lint_python():
    code = request.json.get('code')
    if code is None:
        return jsonify({'error': 'Code not provided'}), 400

    try:
        result = subprocess.check_output(['pyflakes', '-'], input=code, text=True, stderr=subprocess.STDOUT)
        return jsonify({'result': result})
    except subprocess.CalledProcessError as e:
        return jsonify({'error': e.output}), 400

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
            return jsonify({'status': 'success', 'content': content})
        except IOError as e:
            return jsonify({'status': 'error', 'message': str(e)})
    else:
        return jsonify({'status': 'error', 'message': 'Unsafe file path'}), 400

if __name__ == '__main__':
    app.run(debug=True)
