// ─── Support Ticket Types ───────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface SupportTicket {
  id: string;
  subject: string;
  customerName: string;
  customerEmail: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignedTo: string;
  lastMessage: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface SupportListParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTicketRequest {
  subject: string;
  customerName: string;
  customerEmail?: string;
  category: string;
  priority: TicketPriority;
  message?: string;
}

export interface UpdateTicketRequest {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
  message?: string;
}
