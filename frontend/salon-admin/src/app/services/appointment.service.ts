import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { Appointment, SyncResponse } from '../models/appointment.model';
import { SignalRService } from './signalr.service';

/**
 * Appointment Service
 * 
 * Responsibilities:
 * 1. API calls to backend
 * 2. Local appointment state management
 * 3. Syncing data after reconnection
 * 4. Handling real-time updates from SignalR
 */
@Injectable({
  providedIn: 'root'
})
export class AppointmentService implements OnDestroy {
  private apiUrl = environment.apiUrl;
  
  // Local appointment store
  private appointments: Appointment[] = [];
  private appointments$ = new BehaviorSubject<Appointment[]>([]);
  
  // Sync status
  private isSyncing$ = new BehaviorSubject<boolean>(false);
  private syncError$ = new Subject<string>();
  private newAppointmentNotification$ = new Subject<Appointment>();
  
  // Subscriptions
  private subscriptions: Subscription[] = [];

  constructor(
    private http: HttpClient,
    private signalRService: SignalRService
  ) {
    this.setupSignalRListeners();
  }

  /**
   * Public observables
   */
  get appointmentsList() { return this.appointments$.asObservable(); }
  get syncing() { return this.isSyncing$.asObservable(); }
  get syncErrors() { return this.syncError$.asObservable(); }
  get newAppointmentNotifications() { return this.newAppointmentNotification$.asObservable(); }

  /**
   * Set up listeners for SignalR events
   */
  private setupSignalRListeners(): void {
    // Listen for new appointments
    this.subscriptions.push(
      this.signalRService.onNewAppointment.subscribe(appointment => {
        this.addAppointmentLocally(appointment);
        this.newAppointmentNotification$.next(appointment);
      })
    );

    // Listen for appointment updates
    this.subscriptions.push(
      this.signalRService.onAppointmentUpdated.subscribe(appointment => {
        this.updateAppointmentLocally(appointment);
      })
    );

    // Listen for appointment deletions
    this.subscriptions.push(
      this.signalRService.onAppointmentDeleted.subscribe(id => {
        this.removeAppointmentLocally(id);
      })
    );

    // Listen for sync required events (CRITICAL for reconnection)
    this.subscriptions.push(
      this.signalRService.onSyncRequired.subscribe(since => {
        console.log('[AppointmentService] Sync required since:', since);
        this.syncAppointments(since);
      })
    );
  }

  /**
   * Load all appointments from API
   */
  async loadAppointments(): Promise<void> {
    try {
      this.isSyncing$.next(true);
      const appointments = await this.http.get<Appointment[]>(`${this.apiUrl}/appointment`).toPromise();
      
      if (appointments) {
        this.appointments = this.sortAppointments(appointments);
        this.appointments$.next([...this.appointments]);
        console.log(`[AppointmentService] Loaded ${appointments.length} appointments`);
      }
    } catch (err) {
      console.error('[AppointmentService] Failed to load appointments:', err);
      this.syncError$.next('Failed to load appointments');
      throw err;
    } finally {
      this.isSyncing$.next(false);
    }
  }

  /**
   * Sync appointments since a specific timestamp
   * This is called after SignalR reconnection to get missed updates
   */
  async syncAppointments(since: Date): Promise<void> {
    console.log(`[AppointmentService] Syncing appointments since ${since.toISOString()}`);
    
    try {
      this.isSyncing$.next(true);
      
      const response = await this.http.get<SyncResponse>(
        `${this.apiUrl}/appointment/since`,
        { params: { since: since.toISOString() } }
      ).toPromise();

      if (response && response.appointments.length > 0) {
        console.log(`[AppointmentService] Received ${response.appointments.length} appointments to sync`);
        
        // Merge appointments
        this.mergeAppointments(response.appointments);
        
        // Notify about new appointments
        response.appointments.forEach(apt => {
          const isNew = !this.appointments.some(a => a.id === apt.id);
          if (isNew) {
            this.newAppointmentNotification$.next(apt);
          }
        });
      } else {
        console.log('[AppointmentService] No new appointments to sync');
      }
    } catch (err) {
      console.error('[AppointmentService] Sync failed:', err);
      this.syncError$.next('Failed to sync appointments');
    } finally {
      this.isSyncing$.next(false);
    }
  }

  /**
   * Merge new appointments with existing ones (prevent duplicates)
   */
  private mergeAppointments(newAppointments: Appointment[]): void {
    newAppointments.forEach(newApt => {
      const existingIndex = this.appointments.findIndex(a => a.id === newApt.id);
      
      if (existingIndex >= 0) {
        // Update existing appointment
        this.appointments[existingIndex] = newApt;
        console.log(`[AppointmentService] Updated existing appointment: ${newApt.id}`);
      } else {
        // Add new appointment
        this.appointments.push(newApt);
        console.log(`[AppointmentService] Added new appointment: ${newApt.id}`);
      }
    });

    this.appointments = this.sortAppointments(this.appointments);
    this.appointments$.next([...this.appointments]);
  }

  /**
   * Add appointment locally (from SignalR event)
   */
  private addAppointmentLocally(appointment: Appointment): void {
    // Check if already exists
    if (!this.appointments.some(a => a.id === appointment.id)) {
      this.appointments.unshift(appointment);
      this.appointments = this.sortAppointments(this.appointments);
      this.appointments$.next([...this.appointments]);
      console.log(`[AppointmentService] Added appointment locally: ${appointment.id}`);
    }
  }

  /**
   * Update appointment locally (from SignalR event)
   */
  private updateAppointmentLocally(appointment: Appointment): void {
    const index = this.appointments.findIndex(a => a.id === appointment.id);
    if (index >= 0) {
      this.appointments[index] = appointment;
      this.appointments$.next([...this.appointments]);
      console.log(`[AppointmentService] Updated appointment locally: ${appointment.id}`);
    }
  }

  /**
   * Remove appointment locally (from SignalR event)
   */
  private removeAppointmentLocally(id: string): void {
    this.appointments = this.appointments.filter(a => a.id !== id);
    this.appointments$.next([...this.appointments]);
    console.log(`[AppointmentService] Removed appointment locally: ${id}`);
  }

  /**
   * Sort appointments by createdAt (newest first)
   */
  private sortAppointments(appointments: Appointment[]): Appointment[] {
    return appointments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Manual refresh (fallback)
   */
  async refresh(): Promise<void> {
    await this.loadAppointments();
  }

  /**
   * Get current appointment count
   */
  get count(): number {
    return this.appointments.length;
  }

  /**
   * Cleanup subscriptions
   */
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
