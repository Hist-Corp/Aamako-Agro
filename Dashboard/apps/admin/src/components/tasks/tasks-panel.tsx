'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/config/auth-context';
import { useToast } from '@/components/ui/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api-client';
import { ListTodo, Plus, CheckCircle2, ClipboardList } from 'lucide-react';

interface StaffTask {
  id: string;
  title: string;
  description: string | null;
  status: 'PENDING' | 'COMPLETED';
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  assignedTo: { id: string; firstName: string; lastName: string; email: string; role: string };
  assignedBy: { id: string; firstName: string; lastName: string; email: string; role: string };
}

interface AssignableUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

/** Roles that can ASSIGN tasks to users below their rank. */
const TASK_ASSIGNER_ROLES = ['SUPER_ADMIN', 'STAFF_ADMIN', 'STAFF_MANAGER', 'STAFF_SALES'];

/**
 * Tasks panel — shared by the Dashboard home page and the Users page.
 * Assignees see their task details here and mark them complete; users with a
 * rank above others can assign tasks to anyone strictly below their role.
 */
export function TasksPanel() {
  const { user } = useAuth();
  const { addToast } = useToast();

  const canAssignTasks = !!user && TASK_ASSIGNER_ROLES.includes(user.role);
  const [taskTab, setTaskTab] = useState<'mine' | 'assignedByMe'>('mine');
  const [tasks, setTasks] = useState<{ mine: StaffTask[]; assignedByMe: StaffTask[] }>({ mine: [], assignedByMe: [] });
  const [assignable, setAssignable] = useState<AssignableUser[]>([]);
  const [taskDialog, setTaskDialog] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', assignedToId: '', dueDate: '' });
  const [isSavingTask, setIsSavingTask] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const data = await apiClient.get<{ mine: StaffTask[]; assignedByMe: StaffTask[] }>('/tasks');
      setTasks(data);
    } catch {
      /* panel is non-critical */
    }
  }, []);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const openTaskDialog = async () => {
    setNewTask({ title: '', description: '', assignedToId: '', dueDate: '' });
    setTaskDialog(true);
    try {
      const data = await apiClient.get<AssignableUser[]>('/tasks/assignable');
      setAssignable(data);
    } catch {
      setAssignable([]);
    }
  };

  const handleAssignTask = async () => {
    if (!newTask.title.trim() || !newTask.assignedToId) {
      addToast({ type: 'error', title: 'Missing fields', description: 'Pick an assignee and give the task a title.' });
      return;
    }
    setIsSavingTask(true);
    try {
      await apiClient.post('/tasks', {
        title: newTask.title.trim(),
        description: newTask.description || undefined,
        assignedToId: newTask.assignedToId,
        dueDate: newTask.dueDate || undefined,
      });
      addToast({ type: 'success', title: 'Task assigned', description: 'The assignee has been notified.' });
      setTaskDialog(false);
      setTaskTab('assignedByMe');
      void loadTasks();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Assign failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    } finally {
      setIsSavingTask(false);
    }
  };

  const handleCompleteTask = async (task: StaffTask) => {
    try {
      await apiClient.patch(`/tasks/${task.id}/complete`, {});
      addToast({ type: 'success', title: 'Task completed', description: task.title });
      void loadTasks();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Update failed',
        description: err instanceof ApiError ? err.message : 'Unexpected error',
      });
    }
  };

  const renderList = (list: StaffTask[], showAssignee: boolean) =>
    list.length === 0 ? (
      <p className="py-3 text-sm text-surface-500">
        {taskTab === 'mine' ? 'No tasks assigned to you yet.' : 'You have not assigned any tasks yet.'}
      </p>
    ) : (
      <ul className="divide-y divide-surface-100">
        {list.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
            <ClipboardList className={`h-4 w-4 flex-shrink-0 ${t.status === 'COMPLETED' ? 'text-green-500' : 'text-amber-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-medium text-surface-900">
                {t.title}
                <Badge variant={t.status === 'COMPLETED' ? 'success' : 'warning'} dot>{t.status}</Badge>
              </p>
              <p className="text-xs text-surface-500">
                {showAssignee
                  ? `Assigned to ${t.assignedTo.firstName} ${t.assignedTo.lastName ?? ''}`.trim()
                  : `Assigned by ${t.assignedBy.firstName} ${t.assignedBy.lastName ?? ''}`.trim()}
                {t.dueDate ? ` · due ${new Date(t.dueDate).toLocaleDateString()}` : ''}
                {t.description ? ` · ${t.description.replace(/<[^>]+>/g, '').slice(0, 90)}` : ''}
              </p>
            </div>
            {t.status === 'PENDING' && (
              <Button size="sm" variant="outline" onClick={() => handleCompleteTask(t)}>
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
              </Button>
            )}
          </li>
        ))}
      </ul>
    );
return (
    <div className="rounded-lg border border-surface-200 bg-white p-5">
      <div className="flex flex-wrap items-center gap-3">
        <ListTodo className="h-4 w-4 text-brand-600" />
        <h2 className="text-sm font-semibold text-surface-900">Tasks</h2>
        {canAssignTasks && (
          <Button size="sm" onClick={openTaskDialog} className="ml-auto">
            <Plus className="h-3.5 w-3.5" /> Assign Task
          </Button>
        )}
      </div>
      <div className="mt-3">
        <Tabs
          tabs={[
            { id: 'mine', label: `My Tasks (${tasks.mine.length})` },
            { id: 'assignedByMe', label: `Assigned by Me (${tasks.assignedByMe.length})` },
          ]}
          activeTab={taskTab}
          onChange={(t) => setTaskTab(t as 'mine' | 'assignedByMe')}
        />
      </div>
      {taskTab === 'mine' ? renderList(tasks.mine, false) : renderList(tasks.assignedByMe, true)}

      {taskDialog && (
        <Dialog
          open
          onClose={() => setTaskDialog(false)}
          title="Assign Task"
          description="Assign a task to a user below your rank. They will be notified immediately."
          primaryAction={{ label: 'Assign Task', onClick: handleAssignTask, isLoading: isSavingTask }}
        >
          <div className="space-y-4">
            <Input
              label="Task title *"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="e.g. Follow up with wholesale lead"
            />
            <Select
              label="Assign to *"
              value={newTask.assignedToId}
              onChange={(e) => setNewTask({ ...newTask, assignedToId: e.target.value })}
              options={
                assignable.length > 0
                  ? assignable.map((u) => ({
                      value: u.id,
                      label: `${u.firstName} ${u.lastName ?? ''} (${u.role.replace(/_/g, ' ')})`,
                    }))
                  : [{ value: '', label: 'No users below your rank' }]
              }
            />
            <Input
              label="Due date"
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
            />
            <div>
              <label className="text-sm font-medium text-surface-700">Description</label>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
                placeholder="Task details, links, expectations…"
                className="mt-1 w-full rounded-lg border border-surface-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 resize-none"
              />
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}