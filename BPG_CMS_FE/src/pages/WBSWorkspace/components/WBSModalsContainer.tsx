import { useWBS } from './WBSContext';

import { CreatePhaseModal } from '../modals/CreatePhaseModal';
import { EditPhaseModal } from '../modals/EditPhaseModal';
import { CreateTaskModal } from '../modals/CreateTaskModal';
import { EditTaskModal } from '../modals/EditTaskModal';
import { AssignEngineerModal } from '../modals/AssignEngineerModal';
import { AdjustDeadlineModal } from '../modals/AdjustDeadlineModal';
import { PhaseBOQModal } from '../modals/PhaseBOQModal';
import { LeaderApprovalModal } from '../modals/LeaderApprovalModal';
import { CreateMaterialRequestModal } from '../../MaterialRequests/modals/CreateMaterialRequestModal';
import { ResubmitMaterialRequestModal } from '../../MaterialRequests/modals/ResubmitMaterialRequestModal';
import { TaskDetailModal } from '../modals/TaskDetailModal';
import { DailyLogFormModal } from '../../Incidents/modals/DailyLogFormModal';

export const WBSModalsContainer = () => {
  const {
    projectId, user, isPL, materialRequests, tasks, members,
    isDetailOpen, setIsDetailOpen, project, isTPKTOrPL, handleDeleteTask, setCreateMatReqType, isAssignOpen, setIsAssignOpen,
    isLogOpen, setIsLogOpen,
    isCreateMatReqOpen, setIsCreateMatReqOpen, createMatReqType,
    isCreatePhaseOpen, setIsCreatePhaseOpen,
    isEditPhaseOpen, setIsEditPhaseOpen, selectedPhaseForEdit, setSelectedPhaseForEdit,
    isLeaderApprovalOpen, setIsLeaderApprovalOpen, selectedPhaseForMatReq, setSelectedPhaseForMatReq,
    isResubmitOpen, setIsResubmitOpen, selectedResubmitRequest, setSelectedResubmitRequest,
    isPhaseMatReqOpen, setIsPhaseMatReqOpen,
    isBOQOpen, setIsBOQOpen, selectedPhaseForBOQ, setSelectedPhaseForBOQ,
    isCreateTaskOpen, setIsCreateTaskOpen, selectedPhaseForTask, parentTaskForNew, parentDeadlineForNew,
    isEditTaskOpen, setIsEditTaskOpen, selectedTaskForEdit, setSelectedTaskForEdit,
    isAdjustDeadlineOpen, setIsAdjustDeadlineOpen, adjustingTask, setAdjustingTask,
    selectedTaskId, phases, handleSuccess, handleError
  } = useWBS();

  const selectedTask = tasks.find(t => t.id === selectedTaskId) || null;
  const selectedTaskPhase = selectedTask ? phases.find(p => p.id === selectedTask.phaseId) || null : null;

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
          isPL={isPL}
          onAssignOpen={() => { setIsDetailOpen(false); setIsAssignOpen(true); }}
          onLogOpen={() => { setIsDetailOpen(false); setIsLogOpen(true); }}
          onCreateMatReqOpen={(type) => { setIsDetailOpen(false); setCreateMatReqType(type); setIsCreateMatReqOpen(true); }}
          onObsolete={() => { setIsDetailOpen(false); handleDeleteTask && handleDeleteTask(selectedTask.id, selectedTask.name); }}
        />
      )}
    
      {isAssignOpen && selectedTask && (
        <AssignEngineerModal isOpen={isAssignOpen} onClose={() => setIsAssignOpen(false)} taskId={selectedTask.id} taskName={selectedTask.name} projectId={projectId} onSuccess={handleSuccess} onError={handleError} />
      )}


      {isLogOpen && selectedTask && user && (
        <DailyLogFormModal isOpen={isLogOpen} onClose={() => setIsLogOpen(false)} task={selectedTask} engineerId={user.id} engineerName={user.name} onSuccess={handleSuccess} onError={handleError} />
      )}

      {isCreateMatReqOpen && selectedTask && (
        <CreateMaterialRequestModal
          isOpen={isCreateMatReqOpen}
          onClose={() => setIsCreateMatReqOpen(false)}
          task={selectedTask}
          phase={selectedTaskPhase || undefined}
          projectId={projectId}
          user={user}
          isLeader={isPL}
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
          user={user}
          isLeader={isPL}
          onSuccess={(msg) => {
            handleSuccess(msg);
            // Mở rộng sau: fetch lại data
          }}
          onError={handleError}
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
          isLeader={isPL}
          allMaterialRequests={materialRequests}
          requestType={createMatReqType}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* Phase BOQ Modal */}
      {selectedPhaseForBOQ && (
        <PhaseBOQModal
          isOpen={isBOQOpen}
          onClose={() => { setIsBOQOpen(false); setSelectedPhaseForBOQ(null); }}
          phase={selectedPhaseForBOQ}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateTaskOpen}
        onClose={() => setIsCreateTaskOpen(false)}
        projectId={projectId}
        phaseId={selectedPhaseForTask}
        parentTaskId={parentTaskForNew}
        parentDeadline={parentDeadlineForNew}
        maxTaskOrder={tasks.filter(t => t.phaseId === selectedPhaseForTask && t.parentTaskId === parentTaskForNew).length + 1}
        members={members}
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

      {/* Report Incident Modal */}
    </>
  );
};
