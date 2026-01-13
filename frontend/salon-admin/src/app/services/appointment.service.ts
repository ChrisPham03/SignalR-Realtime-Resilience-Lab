import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Subject, Subscription, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Appointment, SyncResponse } from '../models/appointment.model';
import { SignalRService } from './signalr.service';

@Injectable({
  providedIn: 'root'
})
export class AppointmentService implements OnDestroy {
  private apiUrl = environment.apiUrl;
  
  private appointments: Appointment[] = [];
  private appointments$ = new BehaviorSubject<Appointment[]>([]);
  
  private isSyncing$ = new BehaviorSubject<boolean>(false);
  private syncError$ = new Subject<string>();
  private newAppointmentNotification$ = new Subject<Appointment>();
  
  private subscriptions: Subscription[] = [];

  constructor(
    private http: HttpClient,
    private signalRService: SignalRService,
    private ngZone: NgZone  // ADD THIS
  ) {
    this.setupSignalRListeners();
  }

  get appointmentsList() { return this.appointments$.asObservable(); }
  get syncing() { return this.isSyncing$.asObservable(); }
  get syncErrors() { return this.syncError$.asObservable(); }
  get newAppointmentNotifications() { return this.newAppointmentNotification$.asObservable(); }

  private setupSignalRListeners(): void {
    this.subscriptions.push(
      this.signalRService.onNewAppointment.subscribe(appointment => {
        this.ngZone.run(() => {  // WRAP
          this.addAppointmentLocally(appointment);
          this.newAppointmentNotification$.next(appointment);
        });
      })
    );

    this.subscriptions.push(
      this.signalRService.onAppointmentUpdated.subscribe(appointment => {
        this.ngZone.run(() => {  // WRAP
          this.updateAppointmentLocally(appointment);
        });
      })
    );

    this.subscriptions.push(
      this.signalRService.onAppointmentDeleted.subscribe(id => {
        this.ngZone.run(() => {  // WRAP
          this.removeAppointmentLocally(id);
        });
      })
    );

    this.subscriptions.push(
      this.signalRService.onSyncRequired.subscribe(since => {
        console.log('[AppointmentService] Sync required since:', since);
        this.syncAppointments(since);
      })
    );
  }

  async loadAppointments(): Promise<void> {
    try {
      this.isSyncing$.next(true);
      const appointments = await firstValueFrom(
        this.http.get<Appointment[]>(`${this.apiUrl}/appointment`)
      );
      
      if (appointments) {
        this.ngZone.run(() => {  // WRAP
          this.appointments = this.sortAppointments(appointments);
          this.appointments$.next([...this.appointments]);
        });
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

  async syncAppointments(since: Date): Promise<void> {
    console.log(`[AppointmentService] Syncing appointments since ${since.toISOString()}`);
    
    try {
      this.ngZone.run(() => this.isSyncing$.next(true));
      
      const response = await firstValueFrom(
        this.http.get<SyncResponse>(
          `${this.apiUrl}/appointment/since`,
          { params: { since: since.toISOString() } }
        )
      );

      if (response && response.appointments.length > 0) {
        console.log(`[AppointmentService] Received ${response.appointments.length} appointments to sync`);
        
        this.ngZone.run(() => {  // WRAP THE ENTIRE UPDATE
          this.mergeAppointments(response.appointments);
          
          response.appointments.forEach(apt => {
            const isNew = !this.appointments.some(a => a.id === apt.id);
            if (isNew) {
              this.newAppointmentNotification$.next(apt);
            }
          });
        });
      } else {
        console.log('[AppointmentService] No new appointments to sync');
      }
    } catch (err) {
      console.error('[AppointmentService] Sync failed:', err);
      this.syncError$.next('Failed to sync appointments');
    } finally {
      this.ngZone.run(() => this.isSyncing$.next(false));
    }
  }

  private mergeAppointments(newAppointments: Appointment[]): void {
    newAppointments.forEach(newApt => {
      const existingIndex = this.appointments.findIndex(a => a.id === newApt.id);
      
      if (existingIndex >= 0) {
        this.appointments[existingIndex] = newApt;
        console.log(`[AppointmentService] Updated existing appointment: ${newApt.id}`);
      } else {
        this.appointments.push(newApt);
        console.log(`[AppointmentService] Added new appointment: ${newApt.id}`);
      }
    });

    this.appointments = this.sortAppointments(this.appointments);
    this.appointments$.next([...this.appointments]);
    console.log(`[AppointmentService] UI updated with ${this.appointments.length} total appointments`);
  }

  private addAppointmentLocally(appointment: Appointment): void {
    if (!this.appointments.some(a => a.id === appointment.id)) {
      this.appointments.unshift(appointment);
      this.appointments = this.sortAppointments(this.appointments);
      this.appointments$.next([...this.appointments]);
      console.log(`[AppointmentService] Added appointment locally: ${appointment.id}`);
    }
  }

  private updateAppointmentLocally(appointment: Appointment): void {
    const index = this.appointments.findIndex(a => a.id === appointment.id);
    if (index >= 0) {
      this.appointments[index] = appointment;
      this.appointments$.next([...this.appointments]);
      console.log(`[AppointmentService] Updated appointment locally: ${appointment.id}`);
    }
  }

  private removeAppointmentLocally(id: string): void {
    this.appointments = this.appointments.filter(a => a.id !== id);
    this.appointments$.next([...this.appointments]);
    console.log(`[AppointmentService] Removed appointment locally: ${id}`);
  }

  private sortAppointments(appointments: Appointment[]): Appointment[] {
    return appointments.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async refresh(): Promise<void> {
    await this.loadAppointments();
  }

  get count(): number {
    return this.appointments.length;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}
