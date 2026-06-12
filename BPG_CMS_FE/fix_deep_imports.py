import os
import re

files_one_level_deeper = [
    'src/pages/Auth/Login.tsx',
    'src/pages/Auth/ForgotPassword.tsx',
    'src/pages/Auth/ResetPassword.tsx',
    'src/pages/Dashboard/index.tsx',
    'src/pages/PhaseAcceptance/index.tsx',
    'src/pages/TaskIncidents/index.tsx',
    'src/pages/MaterialRequests/index.tsx',
    'src/components/ui/Modal.tsx',
    'src/components/layout/MainLayout.tsx'
]

for fpath in files_one_level_deeper:
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        matches = re.findall(r"from ['\"](\.\./[^'\"]+)['\"]", content)
        if matches:
            print(f'{fpath} has relative imports to fix: {matches}')
            content = re.sub(r"from (['\"])\.\./", r"from \g<1>../../", content)
            
        matches_current_dir = re.findall(r"from ['\"](\./[^'\"]+)['\"]", content)
        if matches_current_dir:
            print(f'{fpath} has sibling imports to fix: {matches_current_dir}')
            content = re.sub(r"from (['\"])\./", r"from \g<1>../", content)
                 
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
    except Exception as e:
        print(f"Error processing {fpath}: {e}")
