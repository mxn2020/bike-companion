import os

# Exclusions
excluded_filenames = ['globals.css', 'favicon.ico', '_layout.tsx', '_loading.tsx', '_page.tsx', 'example.txt', 'ignoreme.md', 'tag-manager.tsx', '.DS_Store','prompt.json','prompt2.json','prompt2 implementation.json', 'directory_contents.md', 'directory_contents copy.md']  # filenames to exclude
excluded_folders = ['fonts', '_components', 'accounts', 'node_modules', 'test_directory','.DS_Store','data','prompt-settings-', 'response', 'exercise-form']  # folders to exclude
excluded_prefixes = ['temp', 'backup_', 'team-account']  # file prefixes to exclude
excluded_types = ['.jsx', '.temp']  # file extensions to exclude

# Filenames for the context and SQL context Markdown files
output_filename = 'directory_contents.md'
output_filename2 = 'directory_contents copy.md'
output_filename3 = 'directory_contents copy 2.md'
script = 'filemaker.py'
context_filename = 'prompt_writer-context.md'
sql_context_filename = 'prompt_writer-sql.md'
instructions_filename = 'prompt_writer-instructions.md'
additional_files_filename = 'prompt_writer-additional_files.md'

excluded_files = ['prompt_writer.py', script, context_filename, sql_context_filename, output_filename, output_filename2, output_filename3, instructions_filename, additional_files_filename]

excluded_filenames.extend(excluded_files)

# Function to read the content of a Markdown file with error handling
def read_md_file(filename):
    if os.path.exists(filename):
        with open(filename, 'r') as file:
            return file.read().strip()
    else:
        print(f"Warning: {filename} does not exist. Skipping.")
        return ""  # or return a default message like "File not found."

# Load context and SQL context from respective files
context = read_md_file(context_filename)
sql_context = read_md_file(sql_context_filename)
instructions = read_md_file(instructions_filename)
additional_files = read_md_file(additional_files_filename)

# User-defined key-value pairs
user_defined_content = {
    'Context': [context],
    'Current Section File and Folder Structure': [],
    'Instructions': [instructions],
    'SQL Setup': [sql_context]
}

# Function to determine if a file should be excluded based on the exclusions
def should_exclude(file_path, filename):
    # Check if the file is in an excluded folder
    for folder in excluded_folders:
        if folder in file_path:
            return True

    # Check if the filename is directly excluded
    if filename in excluded_filenames:
        return True

    # Check for excluded prefixes
    for prefix in excluded_prefixes:
        if filename.startswith(prefix):
            return True

    # Check for excluded file types
    ext = os.path.splitext(filename)[1]
    if ext in excluded_types:
        return True

    return False

# Get all files in the current directory and subdirectories
files = []
folder_structure = {}
for root, dirs, filenames in os.walk('.'):
    # Populate the folder structure dictionary
    folder_structure[root] = filenames
    for filename in filenames:
        file_path = os.path.join(root, filename)
        if not should_exclude(file_path, filename):
            files.append(file_path)

# Add the folder structure to the user-defined content
for folder, filenames in folder_structure.items():
    user_defined_content['Current Section File and Folder Structure'].append(f"{folder}/")
    for index, filename in enumerate(filenames):
        if index == len(filenames) - 1:
            if filename not in excluded_filenames:
                user_defined_content['Current Section File and Folder Structure'].append(f"└-- {filename}")
        else:
            if filename not in excluded_filenames:
                user_defined_content['Current Section File and Folder Structure'].append(f"├-- {filename}")

with open(output_filename, 'w') as output_file:
    # Write the user-defined content first
    for key, value in user_defined_content.items():
        # Skip empty values (None, empty strings, empty lists)
        print ('### ', key, value)
        if not value or value == ['']:
            continue
        
        output_file.write(f'## {key}:\n')
        if isinstance(value, list):
            for item in value:
                output_file.write(f'{item}\n')
        else:
            output_file.write(f'{value}\n')
        output_file.write('\n')

    # Iterate through each filtered file
    for file_path in files:
        filename = os.path.basename(file_path)
        # Write the filename as a Markdown header
        output_file.write(f'## {filename}:\n')

        # Open and read the content of the file
        with open(file_path, 'r') as file:
            print(file_path)
            content = file.read()

        # Write the content to the Markdown file
        output_file.write(content + '\n\n')  # Add a newline for spacing
    
    if additional_files != '':
        output_file.write('## Additional Files:\n')
        output_file.write(f'{additional_files}\n')

print(f'Markdown file "{output_filename}" has been created with the content of relevant files and custom information.')