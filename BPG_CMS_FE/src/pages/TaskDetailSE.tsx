import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';

export const TaskDetailSE: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAndRedirect = async () => {
      if (!taskId) return;
      try {
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5160';
        const response = await fetch(`${apiUrl}/api/tasks/${taskId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('bpg_token')}`
          }
        });
        
        if (!response.ok) throw new Error('Task not found');
        
        const data = await response.json();
        const task = data.data;
        
        if (task && task.phaseId) {
            const projectId = task.projectId || task.phase?.projectId;
            if (projectId) {
                navigate(`/projects/${projectId}?tab=wbs&taskId=${taskId}`, { replace: true });
                return;
            }
            
            const phaseRes = await fetch(`${apiUrl}/api/phases/${task.phaseId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('bpg_token')}` }
            });
            if (phaseRes.ok) {
                const phaseData = await phaseRes.json();
                if (phaseData.data && phaseData.data.projectId) {
                    navigate(`/projects/${phaseData.data.projectId}?tab=wbs&taskId=${taskId}`, { replace: true });
                    return;
                }
            }
            throw new Error('Không tìm thấy thông tin dự án của công việc này.');
        } else {
            setError('Không tìm thấy thông tin của công việc này.');
        }
      } catch (err: any) {
        setError(err.message || 'Lỗi khi chuyển hướng đến công việc.');
      }
    };

    fetchAndRedirect();
  }, [taskId, navigate]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-4 text-slate-600 dark:text-slate-400">
        <AlertCircle size={48} className="text-red-500 mb-2" />
        <p className="text-lg font-semibold">{error}</p>
        <button 
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-100px)] gap-4 text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      <p>Đang tải thông tin chi tiết công việc...</p>
    </div>
  );
};
