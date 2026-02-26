import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    original = content

    replacements = {
        r'bg-white\b': 'bg-[var(--bg-card)]',
        r'text-\[\#1d1d1f\]': 'text-[var(--text-primary)]',
        r'text-\[\#6e6e73\]': 'text-[var(--text-secondary)]',
        r'text-\[\#86868b\]': 'text-[var(--text-muted)]',
        r'bg-\[\#f5f5f7\]': 'bg-[var(--bg-secondary)]',
        r'style=\{\{\s*background:\s*"#f5f5f7".*?\}\}': 'style={{ background: "var(--bg-secondary)" }}',
        r'style=\{\{\s*background:\s*"#ffffff".*?\}\}': 'style={{ background: "var(--bg-card)" }}',
        r'text-slate-800\b': 'text-[var(--text-primary)]',
        r'text-slate-700\b': 'text-[var(--text-secondary)]',
        r'text-slate-600\b': 'text-[var(--text-secondary)]',
        r'text-slate-500\b': 'text-[var(--text-secondary)]',
        r'text-slate-400\b': 'text-[var(--text-muted)]',
        r'text-slate-300\b': 'text-[var(--text-faint)]',
        r'bg-slate-900\b': 'bg-[var(--bg-primary)]',
        r'bg-slate-800\b': 'bg-[var(--bg-secondary)]',
        r'bg-slate-50\b': 'bg-[var(--bg-secondary)]',
        r'text-white\b(?!\/|\])': 'text-[var(--bg-primary)]', # wait text-white on buttons should stay text-white. Let's not do text-white blindly!
    }

    # Custom handling for text-white
    # It's risky to replace text-white everywhere. I'll omit it from regex to be safe.
    del replacements[r'text-white\b(?!\/|\])']

    for pattern, rep in replacements.items():
        content = re.sub(pattern, rep, content)

    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Updated {filepath}")

for root, dirs, files in os.walk('app'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts') or file.endswith('.js') or file.endswith('.jsx'):
            process_file(os.path.join(root, file))

for root, dirs, files in os.walk('components'):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts') or file.endswith('.js') or file.endswith('.jsx'):
            process_file(os.path.join(root, file))

print("Done")
