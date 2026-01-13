/**
 * Appointment model matching backend
 */
export interface Appointment {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceType: string;
  stylistName: string;
  appointmentTime: string;
  durationMinutes: number;
  status: AppointmentStatus;
  price: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Appointment status enum matching backend
 */
export enum AppointmentStatus {
  Scheduled = 'Scheduled',
  Confirmed = 'Confirmed',
  InProgress = 'InProgress',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
  NoShow = 'NoShow'
}

/**
 * Sync response from API
 */
export interface SyncResponse {
  appointments: Appointment[];
  serverTime: string;
  totalCount: number;
}

/**
 * Connection state enum for SignalR
 */
export enum ConnectionState {
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Reconnecting = 'Reconnecting'
}

/**
 * Connection info for UI display
 */
export interface ConnectionInfo {
  state: ConnectionState;
  connectionId?: string;
  lastConnected?: Date;
  lastDisconnected?: Date;
  reconnectAttempts: number;
  serverTime?: Date;
}

/**
 * Stats from server
 */
export interface ServerStats {
  totalConnections: number;
  serverTime: string;
}
