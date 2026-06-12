import re

with open('src/pages/ProjectList/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("case 'draft': return 'secondary';", "case 'draft': return 'default';")
content = content.replace("default: return 'secondary';", "default: return 'default';")

with open('src/pages/ProjectList/index.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

with open('src/pages/UserManagement/index.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("default: return 'secondary';", "default: return 'default';")
content = content.replace("accessor:", "render:")
content = content.replace("{ header: 'Tên thành viên', render:", "{ key: 'name', header: 'Tên thành viên', render:")
content = content.replace("{\n      header: 'Email tài khoản',\n      render:", "{\n      key: 'email',\n      header: 'Email tài khoản',\n      render:")
content = content.replace("{\n      header: 'Vai trò',\n      render:", "{\n      key: 'role',\n      header: 'Vai trò',\n      render:")
content = content.replace("{\n      header: 'Trạng thái',\n      render:", "{\n      key: 'status',\n      header: 'Trạng thái',\n      render:")
content = content.replace("{\n      header: 'Hành động',\n      render:", "{\n      key: 'actions',\n      header: 'Hành động',\n      render:")
content = content.replace("align: 'right' as const", "")
content = content.replace("emptyMessage=", "keyExtractor={(item) => item.id}\n            emptyMessage=")

with open('src/pages/UserManagement/index.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
