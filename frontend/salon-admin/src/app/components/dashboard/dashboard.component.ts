import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SignalRService } from '../../services/signalr.service';
import { AppointmentService } from '../../services/appointment.service';
import { ConnectionStatusComponent } from '../connection-status/connection-status.component';
import { Appointment, AppointmentStatus } from '../../models/appointment.model';

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
  
  AppointmentStatus = AppointmentStatus;
  private subscriptions: Subscription[] = [];

  constructor(
    private signalRService: SignalRService,
    private appointmentService: AppointmentService
  ) {}

  async ngOnInit(): Promise<void> {
    // 1. Subscribe to appointment list updates
    this.subscriptions.push(
      this.appointmentService.appointmentsList.subscribe(appointments => {
        this.appointments = appointments;
        this.lastUpdated = new Date();
      })
    );

    // 2. Subscribe to sync status indicators
    this.subscriptions.push(
      this.appointmentService.syncing.subscribe(syncing => {
        this.isSyncing = syncing;
      })
    );

    // 3. Subscribe to real-time notification events
    this.subscriptions.push(
      this.appointmentService.newAppointmentNotifications.subscribe(appointment => {
        this.showNotification(`New booking: ${appointment.customerName} - ${appointment.serviceType}`);
      })
    );

    // 4. CRITICAL: Start the SignalR connection to enable auto-updates
    try {
      await this.signalRService.startConnection();
    } catch (err) {
      console.error('Failed to start SignalR connection:', err);
    }

    // 5. Initial data load
    await this.appointmentService.loadAppointments();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.signalRService.stopConnection(); // Ensure socket cleanup
  }

  private showNotification(message: string): void {
    this.notification = message;
    setTimeout(() => {
      this.notification = null;
    }, 5000);
  }

  async refresh(): Promise<void> {
    await this.appointmentService.refresh();
  }

  getStatusClass(status: AppointmentStatus): string {
    const classes: Record<string, string> = {
      [AppointmentStatus.Scheduled]: 'status-scheduled',
      [AppointmentStatus.Confirmed]: 'status-confirmed',
      [AppointmentStatus.InProgress]: 'status-inprogress',
      [AppointmentStatus.Completed]: 'status-completed',
      [AppointmentStatus.Cancelled]: 'status-cancelled',
      [AppointmentStatus.NoShow]: 'status-noshow'
    };
    return classes[status] || '';
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  }

  formatTimeAgo(dateString: string): string {
    const diffMs = new Date().getTime() - new Date(dateString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    return this.formatDate(dateString);
  }

  trackByAppointment(index: number, appointment: Appointment): string {
    return appointment.id;
  }
}