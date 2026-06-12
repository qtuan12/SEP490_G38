import re

with open('src/pages/UserManagement/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

imports = '''import { CreateUserModal } from './modals/CreateUserModal';
import { EditUserModal } from './modals/EditUserModal';
import { ConfirmDialog } from '../components/ui';'''
content = content.replace("import { Modal } from '../components/ui/Modal';", imports)

content = re.sub(r'\{/\* CREATE MODAL \*/\}.*?</Modal>', '', content, flags=re.DOTALL)
content = re.sub(r'\{/\* EDIT MODAL \*/\}.*?</Modal>', '', content, flags=re.DOTALL)
content = re.sub(r'\{/\* DELETE MODAL \*/\}.*?</Modal>', '', content, flags=re.DOTALL)

new_modals = '''
      <CreateUserModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(msg) => {
          showSuccess(msg);
          loadUsers();
        }}
      />

      <EditUserModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        user={selectedUser}
        onSuccess={(msg) => {
          showSuccess(msg);
          setSelectedUser(null);
          loadUsers();
        }}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteSubmit}
        title="Xóa tài khoản thành viên"
        message={`Bạn có chắc chắn muốn xóa tài khoản của thành viên ${selectedUser?.name || ''} (${selectedUser?.email || ''}) khỏi hệ thống? Hành động này không thể hoàn tác.`}
        confirmText="Đồng ý xóa"
      />
    </div>
  );
};
'''
content = content.replace('    </div>\n  );\n};', new_modals)

content = re.sub(r'const \[formData, setFormData\].*?\}\);', '', content, flags=re.DOTALL)
content = re.sub(r'const handleCreateSubmit = async.*?catch \(err: any\) \{.*?\}\n  \};', '', content, flags=re.DOTALL)
content = re.sub(r'const handleEditSubmit = async.*?catch \(err: any\) \{.*?\}\n  \};', '', content, flags=re.DOTALL)

content = content.replace('    setFormData({\n      name: user.name,\n      email: user.email,\n      role: user.role\n    });\n', '')
content = content.replace("    setError(null);\n            setFormData({ name: '', email: '', role: 'siteengineer' });\n", "    setError(null);\n")

with open('src/pages/UserManagement/index.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
