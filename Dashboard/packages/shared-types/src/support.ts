// ─── Support Ticket Types ─────────────────────────────────────────────────

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENCY';

export interface SupportMessage {
  id: string;
  ticketId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

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

export interface CreateTicketRequest {
  subject: string;
  customerName: string;
  customerEmail?: string;
  category?: string;
  priority?: TicketPriority;
  message?: string;
  assignedTo?: string;
}

export interface UpdateTicketRequest {
  status?: TicketStatus;
  assignedTo?: string;
  message?: string;
}

export interface SupportListParams {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}
