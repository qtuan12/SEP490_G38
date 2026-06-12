import os

replacements = {
    "from './components/Layout'": "from './components/layout/MainLayout'",
    "from '../components/Layout'": "from '../../components/layout/MainLayout'",
    "from './pages/Login'": "from './pages/Auth/Login'",
    "from './pages/ForgotPassword'": "from './pages/Auth/ForgotPassword'",
    "from './pages/ResetPassword'": "from './pages/Auth/ResetPassword'",
    "from './pages/PhaseMaterialRequests'": "from './pages/MaterialRequests'",
    "from '../components/Modal'": "from '../components/ui/Modal'",
    "from '../../components/Modal'": "from '../../components/ui/Modal'",
    "from '../../../components/Modal'": "from '../../../components/ui/Modal'",
    "from '../components/WBSWorkspace'": "from './WBSWorkspace'",
    "from '../../components/WBSWorkspace'": "from '../WBSWorkspace'",
    "from './components/WBSWorkspace/WBSModalsContainer'": "from './components/WBSModalsContainer'",
    "from '../../pages/WBSWorkspace/modals/": "from '../modals/"
}

# Special handling for Login, ForgotPassword, ResetPassword which were moved one level deeper
# So any imports inside them starting with '../' need to become '../../'
# But let's check specifically what they import:
# They import:
# import { AuthProvider, useAuth } from '../context/AuthContext';
# import { Layout } from '../components/Layout'; (handled by replacement above but to '../../components/layout/MainLayout')

auth_files = [
    'src/pages/Auth/Login.tsx',
    'src/pages/Auth/ForgotPassword.tsx',
    'src/pages/Auth/ResetPassword.tsx'
]

def update_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        new_content = content
        
        for k, v in replacements.items():
            new_content = new_content.replace(k, v)
            
        # Fix Auth files depth
        path_normalized = path.replace('\\', '/')
        if path_normalized in auth_files:
            new_content = new_content.replace("from '../context/AuthContext'", "from '../../context/AuthContext'")
            new_content = new_content.replace("from '../components/Layout'", "from '../../components/layout/MainLayout'")
            new_content = new_content.replace("from '../services/apiClient'", "from '../../services/apiClient'")

        if new_content != content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f'Updated {path}')
    except Exception as e:
        print(f'Error {path}: {e}')

for root, _, files in os.walk('src'):
    for f in files:
        if f.endswith('.tsx') or f.endswith('.ts'):
            update_file(os.path.join(root, f))
