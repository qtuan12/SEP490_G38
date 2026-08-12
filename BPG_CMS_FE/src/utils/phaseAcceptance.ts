import type { WBSTask } from '../types/common';

export const getActivePhaseTasks = (tasks: WBSTask[]): WBSTask[] =>
  tasks.filter((task) => task.status !== 'obsolete');

export const isPhaseReadyForAcceptance = (tasks: WBSTask[]): boolean => {
  const activeTasks = getActivePhaseTasks(tasks);
  return activeTasks.length > 0 && activeTasks.every((task) => task.progress === 100);
};
