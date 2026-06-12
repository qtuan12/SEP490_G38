import os
import shutil

dirs = [
    'src/pages/Auth',
    'src/pages/Dashboard/components',
    'src/pages/WBSWorkspace/components',
    'src/pages/WBSWorkspace/modals',
    'src/pages/PhaseAcceptance/components',
    'src/pages/TaskIncidents/modals',
    'src/pages/MaterialRequests/modals',
    'src/components/ui',
    'src/components/layout',
    'src/components/common',
    'src/services'
]

for d in dirs:
    os.makedirs(d, exist_ok=True)

moves = {
    'src/pages/Login.tsx': 'src/pages/Auth/Login.tsx',
    'src/pages/ForgotPassword.tsx': 'src/pages/Auth/ForgotPassword.tsx',
    'src/pages/ResetPassword.tsx': 'src/pages/Auth/ResetPassword.tsx',
    'src/pages/Dashboard.tsx': 'src/pages/Dashboard/index.tsx',
    'src/components/WBSWorkspace.tsx': 'src/pages/WBSWorkspace/index.tsx',
    'src/pages/PhaseAcceptance.tsx': 'src/pages/PhaseAcceptance/index.tsx',
    'src/pages/TaskIncidents.tsx': 'src/pages/TaskIncidents/index.tsx',
    'src/pages/PhaseMaterialRequests.tsx': 'src/pages/MaterialRequests/index.tsx',
    'src/components/Layout.tsx': 'src/components/layout/MainLayout.tsx',
    'src/components/Modal.tsx': 'src/components/ui/Modal.tsx'
}

for src, dst in moves.items():
    if os.path.exists(src) and not os.path.exists(dst):
        print(f"Moving {src} to {dst}")
        shutil.move(src, dst)
    elif os.path.exists(dst):
        print(f"{dst} already exists.")
    else:
        print(f"{src} does not exist.")
