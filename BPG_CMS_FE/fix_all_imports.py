import os
import re

files_one_level_deeper = [
    'src/pages/WBSWorkspace/index.tsx'
]

# 1. Fix the files that moved 1 level deeper
for fpath in files_one_level_deeper:
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        matches = re.findall(r"from ['\"](\.\./[^'\"]+)['\"]", content)
        if matches:
            content = re.sub(r"from (['\"])\.\./", r"from \g<1>../../", content)
            
        matches_current_dir = re.findall(r"from ['\"](\./[^'\"]+)['\"]", content)
        if matches_current_dir:
            content = re.sub(r"from (['\"])\./", r"from \g<1>../", content)
                 
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Fixed depths in {fpath}")
    except Exception as e:
        print(f"Error processing {fpath}: {e}")

# 2. Fix 'components/Modal' -> 'components/ui/Modal' globally
# 3. Fix WBS Workspace internal imports from WBSModalsContainer
# 4. Fix WBSWorkspace.tsx -> WBSWorkspace/index.tsx internal paths
def fix_global_imports(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        
        # Replace components/Modal with components/ui/Modal
        new_content = new_content.replace('components/Modal', 'components/ui/Modal')
        
        # Fix WBSWorkspace internal imports
        # They were ./WBSWorkspace/WBSContext -> now they are ./components/WBSContext inside WBSWorkspace/index.tsx
        if path.replace('\\\\', '/').endswith('src/pages/WBSWorkspace/index.tsx'):
            new_content = new_content.replace('./WBSWorkspace/WBSContext', './components/WBSContext')
            new_content = new_content.replace('./WBSWorkspace/WBSTree', './components/WBSTree')
            new_content = new_content.replace('./WBSWorkspace/WBSModalsContainer', './components/WBSModalsContainer')
            
        # WBSModalsContainer imports:
        if path.replace('\\\\', '/').endswith('WBSModalsContainer.tsx'):
            new_content = new_content.replace('../../pages/MaterialRequests', '../../MaterialRequests')
            new_content = new_content.replace('../../pages/Incidents', '../../TaskIncidents')
            
        # WBSTree and WBSContext imports:
        if path.replace('\\\\', '/').endswith('WBSContext.tsx') or path.replace('\\\\', '/').endswith('WBSTree.tsx'):
            new_content = new_content.replace('../../types/common', '../../../types/common')

        if new_content != content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Fixed specific imports in {path}')
    except Exception as e:
        print(e)

for root, _, files in os.walk('src'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            fix_global_imports(os.path.join(root, f))
