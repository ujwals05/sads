/** Shapes returned by the SADS backend agent endpoints. */

export type TaskStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'WAITING_FOR_APPROVAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export interface DisplayToolCall {
  id: string;
  name: string;
  summary: string;
}

export interface DisplayToolResult {
  toolUseId: string;
  isError: boolean;
  preview: string;
}

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  text: string;
  toolCalls?: DisplayToolCall[];
  toolResults?: DisplayToolResult[];
  senderId: string | null;
  createdAt: string;
}

export interface PendingToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  summary: string;
}

export interface AgentStepResult {
  taskId: string;
  conversationId: string;
  status: TaskStatus;
  messages: DisplayMessage[];
  pendingToolCalls: PendingToolCall[];
  error?: { code: string; message: string };
}

export interface ConversationSummary {
  id: string;
  workspaceId: string;
  createdById: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetails {
  conversation: ConversationSummary;
  messages: DisplayMessage[];
  activeTask: { id: string; status: TaskStatus; requestedById: string } | null;
}

export interface ToolExecutionResult {
  content: string;
  isError: boolean;
}
