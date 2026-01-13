import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SignalRService } from '../../services/signalr.service';
import { AppointmentService } from '../../services/appointment.service';
import { ConnectionStatusComponent } from '../connection-status/connection-status.component';
import { Appointment, AppointmentStatus } from '../../models/appointment.model';

/**
 * Dashboard Component
 * 
 * Main admin dashboard showing:
 * - Connection status
 * - Real-time appointment list
 * - Sync status
 * - New appointment notifications
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ConnectionStatusComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  appointments: Appointment[] = [];
  isSyncing = false;
  notification: string | null = null;
  lastUpdated: Date | null = null;
  
  // Make enum available in template
  AppointmentStatus = AppointmentStatus;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private signalRService: SignalRService,
    private appointmentService: AppointmentService
  ) {}

  async ngOnInit(): Promise<void> {
    // Subscribe to appointment updates
    this.subscriptions.push(
      this.appointmentService.appointmentsList.subscribe(appointments => {
        this.appointments = appointments;
        this.lastUpdated = new Date();
      })
    );

    // Subscribe to sync status
    this.subscriptions.push(
      this.appointmentService.syncing.subscribe(syncing => {
        this.isSyncing = syncing;
      })
    );

    // Subscribe to new appointment notifications
    this.subscriptions.push(
      this.appointmentService.newAppointmentNotifications.subscribe(appointment => {
        this.showNotification(`New booking: ${appointment.customerName} - ${appointment.serviceType}`);
      })
    );

    // Start SignalR connection
    try {
      await this.signalRService.startConnection();
    } catch (err) {
      console.error('Failed to start SignalR connection:', err);
    }

    // Load initial appointments
    await this.appointmentService.loadAppointments();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.signalRService.stopConnection();
  }

  /**
   * Show a temporary notification
   */
  private showNotification(message: string): void {
    this.notification = message;
    setTimeout(() => {
      this.notification = null;
    }, 5000);
  }

  /**
   * Manual refresh button handler
   */
  async refresh(): Promise<void> {
    await this.appointmentService.refresh();
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: AppointmentStatus): string {
    switch (status) {
      case AppointmentStatus.Scheduled:
        return 'status-scheduled';
      case AppointmentStatus.Confirmed:
        return 'status-confirmed';
      case AppointmentStatus.InProgress:
        return 'status-inprogress';
      case AppointmentStatus.Completed:
        return 'status-completed';
      case AppointmentStatus.Cancelled:
        return 'status-cancelled';
      case AppointmentStatus.NoShow:
        return 'status-noshow';
      default:
        return '';
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  /**
   * Format time ago
   */
  formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return this.formatDate(dateString);
  }

  /**
   * Track by function for ngFor
   */
  trackByAppointment(index: number, appointment: Appointment): string {
    return appointment.id;
  }
}
