// Chat data shapes shared by the chat hook and screens.
export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  department: string | null;
  jobTitle: string | null;
  photoUrl: string | null;
}

export interface Conversation {
  id: number;
  subject: string | null;
  isGroup: boolean;
  lastMessage: {
    content: string;
    createdAt: string;
    senderId: number;
    contentType?: string;
  } | null;
  unreadCount: number;
  participantIds: number[];
  participantsData?: any[];
  updatedAt: string;
}

export interface Message {
  id: number;
  conversationId: number;
  senderId: number;
  content: string;
  contentType?: string;
  createdAt: string;
  isEdited: boolean;
  reads?: { employeeId: number; readAt: string }[];
}

export interface TabChatProps {
  myEmployeeId: number | undefined;
  contacts: any[];
  autoOpenChatWith?: number | null;
  onClearAutoOpen?: () => void;
  isActive?: boolean;
  onUnreadChange?: (count: number) => void;
  onChatOpenChange?: (isOpen: boolean) => void;
}
