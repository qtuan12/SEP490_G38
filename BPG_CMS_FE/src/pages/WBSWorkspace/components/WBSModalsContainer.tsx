import { useWBS } from './WBSContext';

import { CreatePhaseModal } from '../modals/CreatePhaseModal';
import { EditPhaseModal } from '../modals/EditPhaseModal';
import { CreateTaskModal } from '../modals/CreateTaskModal';
import { EditTaskModal } from '../modals/EditTaskModal';
import { AssignEngineerModal } from '../modals/AssignEngineerModal';
import { AdjustDeadlineModal } from '../modals/AdjustDeadlineModal';
import { LeaderApprovalModal } from '../modals/LeaderApprovalModal';
import { CreateMaterialRequestModal } from '../../MaterialRequests/modals/CreateMaterialRequestModal';
import { ResubmitMaterialRequestModal } from '../../MaterialRequests/modals/ResubmitMaterialRequestModal';
import { TaskDetailModal } from '../modals/TaskDetailModal';
import { ObsoleteTaskModal } from '../modals/ObsoleteTaskModal';
import { DailyLogFormModal } from '../../ProjectDailyLogs/modals/DailyLogFormModal';
import { AdjustProgressModal } from '../modals/AdjustProgressModal';
import { ReportIncidentModal } from '../../Incidents/modals/ReportIncidentModal';
import { ReportInventoryIncidentModal } from '../modals/ReportInventoryIncidentModal';
import { canCreateDailyLog } from '../../../utils/taskPermissions';


export const WBSModalsContainer = () => {
  const {
    projectId, user, isPL, isTPKT, materialRequests, tasks, members,
    isDetailOpen, setIsDetailOpen, project, isTPKTOrPL, handleDeleteTask, setCreateMatReqType, isAssignOpen, setIsAssignOpen,
    isLogOpen, setIsLogOpen,
    isCreateMatReqOpen, setIsCreateMatReqOpen, createMatReqType,
    isCreatePhaseOpen, setIsCreatePhaseOpen,
    isEditPhaseOpen, setIsEditPhaseOpen, selectedPhaseForEdit, setSelectedPhaseForEdit,
    isLeaderApprovalOpen, setIsLeaderApprovalOpen, selectedPhaseForMatReq, setSelectedPhaseForMatReq,
    isResubmitOpen, setIsResubmitOpen, selectedResubmitRequest, setSelectedResubmitRequest,
    isPhaseMatReqOpen, setIsPhaseMatReqOpen,
    isCreateTaskOpen, setIsCreateTaskOpen, selectedPhaseForTask, parentTaskForNew, parentDeadlineForNew,
    isEditTaskOpen, setIsEditTaskOpen, selectedTaskForEdit, setSelectedTaskForEdit,
    isObsoleteOpen, setIsObsoleteOpen,
    isAdjustDeadlineOpen, setIsAdjustDeadlineOpen, adjustingTask, setAdjustingTask,
    isAdjustProgressOpen, setIsAdjustProgressOpen,
    isReportInventoryIncidentOpen, setIsReportInventoryIncidentOpen,
    selectedPhaseForInventoryIncident,
    isReportIncidentOpen, setIsReportIncidentOpen,
    selectedTaskId, phases, handleSuccess, handleError, loadWBSData
  } = useWBS();

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;
  const selectedTaskPhase = selectedTask ? phases.find(p => String(p.id).replace('ph-', '') === String(selectedTask.phaseId).replace('ph-', '')) || null : null;
  const selectedTaskHasChildren = !!selectedTask && tasks.some(t => t.parentTaskId === selectedTask.id && t.status !== 'obsolete');
  const canOpenDailyLogForm = !!selectedTask && !!user && !selectedTaskHasChildren && canCreateDailyLog(selectedTask, user, isPL);

  return (
    <>

      {isDetailOpen && selectedTask && (
        <TaskDetailModal
          isOpen={isDetailOpen}
          onClose={() => setIsDetailOpen(false)}
          selectedTask={selectedTask}
          selectedTaskPhase={selectedTaskPhase}
          project={project}
          tasks={tasks}
          user={user}
          materialRequests={materialRequests}
          isTPKTOrPL={isTPKTOrPL}
          isTPKT={isTPKT}
          isPL={isPL}
          onCreateMatReqOpen={(type) => { setIsDetailOpen(false); setCreateMatReqType(type); setIsCreateMatReqOpen(true); }}
          onObsolete={() => {
            setIsDetailOpen(false);
            if (selectedTask.progress > 0) {
              setIsObsoleteOpen(true);
            } else {
              handleDeleteTask && handleDeleteTask(selectedTask.id, selectedTask.name);
            }
          }}
          onReportIncidentOpen={() => {
            setIsDetailOpen(false);
            setIsReportIncidentOpen(true);
          }}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {isReportIncidentOpen && selectedTask && project && (
        <ReportIncidentModal
          isOpen={isReportIncidentOpen}
          onClose={() => setIsReportIncidentOpen(false)}
          projectId={project.id.toString()}
          taskId={selectedTask.id.toString()}
          taskName={selectedTask.name}
          user={user}
          onSuccess={(msg) => {
            setIsReportIncidentOpen(false);
            handleSuccess(msg || 'Đã báo cáo sự cố thành công.');
            loadWBSData(); // Refresh to update incident count and status
          }}
          onError={handleError}
        />
      )}

      {isObsoleteOpen && selectedTask && (
        <ObsoleteTaskModal
          isOpen={isObsoleteOpen}
          onClose={() => setIsObsoleteOpen(false)}
          task={selectedTask}
          onSuccess={(msg) => {
            handleSuccess(msg);
            // Refresh data might be needed, but WBSWorkspace should handle it if handleSuccess doesn't. We can reload by reloading page or context.
          }}
        />
      )}

      {isAssignOpen && selectedTask && (
        <AssignEngineerModal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} taskId={selectedTask.id} taskName={selectedTask.name} projectId={projectId} onSuccess={handleSuccess} onError={handleError} />
      )}


      {isLogOpen && selectedTask && user && canOpenDailyLogForm && (
        <DailyLogFormModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} task={selectedTask} engineerId={user.id} engineerName={user.name} isPL={isPL} canManageTechnical={isTPKT} onSuccess={handleSuccess} onError={handleError} />
      )}

      {isCreateMatReqOpen && selectedTask && (
        <CreateMaterialRequestModal
          isOpen={isCreateMatReqOpen}
          onClose={() => setIsCreateMatReqOpen(false)}
          task={selectedTask}
          phase={selectedTaskPhase || undefined}
          projectId={projectId}
          user={user}
          allMaterialRequests={materialRequests}
          requestType={createMatReqType}
          onSuccess={(msg) => {
            handleSuccess(msg);
            // Mở rộng sau: fetch lại data
          }}
          onError={handleError}
        />
      )}

      {isCreatePhaseOpen && (
        <CreatePhaseModal
          isOpen={isCreatePhaseOpen}
          onClose={() => setIsCreatePhaseOpen(false)}
          projectId={projectId}
          maxPhaseOrder={phases.length + 1}
          project={project}
          phases={phases}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {isEditPhaseOpen && selectedPhaseForEdit && (
        <EditPhaseModal
          isOpen={isEditPhaseOpen}
          onClose={() => {
            setIsEditPhaseOpen(false);
            setSelectedPhaseForEdit(null);
          }}
          phase={selectedPhaseForEdit}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {isLeaderApprovalOpen && selectedPhaseForMatReq && (
        <LeaderApprovalModal
          isOpen={isLeaderApprovalOpen}
          onClose={() => {
            setIsLeaderApprovalOpen(false);
            setSelectedPhaseForMatReq(null);
          }}
          phase={selectedPhaseForMatReq}
          projectId={projectId}
          user={user}
          allMaterialRequests={materialRequests}
          onSuccess={(msg) => {
            handleSuccess(msg);
            // Mở rộng sau: fetch lại data
          }}
          onError={handleError}
        />
      )}



      {isResubmitOpen && selectedResubmitRequest && (
        <ResubmitMaterialRequestModal
          isOpen={isResubmitOpen}
          onClose={() => {
            setIsResubmitOpen(false);
            setSelectedResubmitRequest(null);
          }}
          request={selectedResubmitRequest}
          projectId={projectId}
          onSuccess={(msg) => {
            handleSuccess(msg);
            // Mở rộng sau: fetch lại data
          }}
          onError={handleError}
          allMaterialRequests={materialRequests}
          phases={phases}
          user={user}
        />
      )}
      {/* Create Phase Material Request Modal */}

      {/* Create Phase Material Request Modal */}
      {selectedPhaseForMatReq && (
        <CreateMaterialRequestModal
          isOpen={isPhaseMatReqOpen}
          onClose={() => { setIsPhaseMatReqOpen(false); setSelectedPhaseForMatReq(null); }}
          phase={selectedPhaseForMatReq}
          projectId={projectId}
          user={user}
          allMaterialRequests={materialRequests}
          requestType={createMatReqType}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}



      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        phaseId={selectedPhaseForTask}
        parentTaskId={parentTaskForNew}
        parentDeadline={parentDeadlineForNew}
        maxTaskOrder={tasks.filter(t => t.phaseId === selectedPhaseForTask && t.parentTaskId === parentTaskForNew).length + 1}
        members={members}
        tasks={tasks}
        phase={phases.find(p => p.id === selectedPhaseForTask)}
        project={project}
        onSuccess={handleSuccess}
        onError={handleError}
      />

      {/* Edit Task Modal */}
      {isEditTaskOpen && selectedTaskForEdit && (
        <EditTaskModal
          isOpen={isEditTaskOpen}
          onClose={() => {
            setIsEditTaskOpen(false);
            setSelectedTaskForEdit(null);
          }}
          task={selectedTaskForEdit}
          parentDeadline={selectedTaskForEdit.parentTaskId ? tasks.find(t => t.id === selectedTaskForEdit.parentTaskId)?.deadline : undefined}
          members={members}
          tasks={tasks}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* Adjust Deadline Modal */}
      {adjustingTask && (
        <AdjustDeadlineModal
          isOpen={isAdjustDeadlineOpen}
          onClose={() => { setIsAdjustDeadlineOpen(false); setAdjustingTask(null); }}
          taskId={adjustingTask.id}
          taskName={adjustingTask.name}
          currentDeadline={adjustingTask.deadline}
          user={user?.name || 'User'}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* Adjust Progress Modal */}
      {selectedTask && (
        <AdjustProgressModal
          isOpen={isAdjustProgressOpen}
          onClose={() => setIsAdjustProgressOpen(false)}
          task={selectedTask}
          onSuccess={(msg) => {
            handleSuccess(msg);
            loadWBSData();
            setIsDetailOpen(true);
          }}
          onError={handleError}
        />
      )}

      {/* Report Inventory Incident Modal */}
      {isReportInventoryIncidentOpen && selectedPhaseForInventoryIncident && project && (
        <ReportInventoryIncidentModal
          isOpen={isReportInventoryIncidentOpen}
          onClose={() => setIsReportInventoryIncidentOpen(false)}
          projectId={project.id.toString()}
          phaseId={selectedPhaseForInventoryIncident.id}
          phaseName={selectedPhaseForInventoryIncident.name}
          user={user}
          onSuccess={(msg) => {
            setIsReportInventoryIncidentOpen(false);
            handleSuccess(msg || 'Đã báo cáo sự cố vật tư thành công.');
            loadWBSData();
          }}
          onError={handleError}
        />
      )}
    </>
  );
};
