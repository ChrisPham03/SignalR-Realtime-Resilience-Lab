import { Injectable, OnDestroy, NgZone } from '@angular/core';
import { BehaviorSubject, Subject, fromEvent, merge } from 'rxjs';
import { debounceTime, filter } from 'rxjs/operators';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../environments/environment';
import { Appointment, ConnectionState, ConnectionInfo } from '../models/appointment.model';

/**
 * SignalR Service - Handles real-time communication with robust connection recovery
 * 
 * Key Features:
 * 1. Automatic reconnection with exponential backoff
 * 2. Browser visibility change detection (Page Visibility API)
 * 3. Connection state management with observables
 * 4. Triggers sync when reconnecting after visibility change
 */
@Injectable({
  providedIn: 'root'
})
export class SignalRService implements OnDestroy {
  private hubConnection: signalR.HubConnection | null = null;
  
  // Connection state management
  private connectionInfo: ConnectionInfo = {
    state: ConnectionState.Disconnected,
    reconnectAttempts: 0
  };
  
  // Observables for components to subscribe to
  private connectionState$ = new BehaviorSubject<ConnectionInfo>(this.connectionInfo);
  private newAppointment$ = new Subject<Appointment>();
  private appointmentUpdated$ = new Subject<Appointment>();
  private appointmentDeleted$ = new Subject<string>();
  private syncRequired$ = new Subject<Date>(); // Emits when sync is needed
  
  // Track last known good connection time for sync
  private lastSyncTime: Date = new Date();
  private wasVisible = true;
  
  // Cleanup subscriptions
  private destroyed = false;

  constructor(private ngZone: NgZone) {
    this.setupVisibilityListener();
    this.setupFocusListener();
  }

  /**
   * Public observables for components
   */
  get connectionState() { return this.connectionState$.asObservable(); }
  get onNewAppointment() { return this.newAppointment$.asObservable(); }
  get onAppointmentUpdated() { return this.appointmentUpdated$.asObservable(); }
  get onAppointmentDeleted() { return this.appointmentDeleted$.asObservable(); }
  get onSyncRequired() { return this.syncRequired$.asObservable(); }

  /**
   * Initialize and start the SignalR connection
   */
  async startConnection(): Promise<void> {
    if (this.hubConnection) {
      console.log('[SignalR] Connection already exists');
      return;
    }

    this.updateState(ConnectionState.Connecting);
    
    // Build the connection with automatic reconnection
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.signalRUrl, {
        skipNegotiation: false,
        transport: signalR.HttpTransportType.WebSockets | 
                   signalR.HttpTransportType.ServerSentEvents |
                   signalR.HttpTransportType.LongPolling
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // Custom retry delays from environment config
          const delays = environment.signalR.reconnectDelays;
          const attempt = retryContext.previousRetryCount;
          
          if (attempt < delays.length) {
            console.log(`[SignalR] Retry attempt ${attempt + 1}, waiting ${delays[attempt]}ms`);
            return delays[attempt];
          }
          
          // After all defined delays, keep trying every 30 seconds
          return 30000;
        }
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();

    // Set timeouts
    this.hubConnection.serverTimeoutInMilliseconds = environment.signalR.serverTimeoutMs;
    this.hubConnection.keepAliveIntervalInMilliseconds = environment.signalR.keepAliveIntervalMs;

    // Set up event handlers
    this.setupHubEventHandlers();
    this.setupMessageHandlers();

    // Start the connection
    try {
      await this.hubConnection.start();
      console.log('[SignalR] Connected successfully');
      this.updateState(ConnectionState.Connected, {
        connectionId: this.hubConnection.connectionId || undefined,
        lastConnected: new Date()
      });
      this.lastSyncTime = new Date();
    } catch (err) {
      console.error('[SignalR] Connection failed:', err);
      this.updateState(ConnectionState.Disconnected);
      throw err;
    }
  }

  /**
   * Set up SignalR hub event handlers (connection lifecycle)
   */
  private setupHubEventHandlers(): void {
    if (!this.hubConnection) return;

    this.hubConnection.onreconnecting((error) => {
      console.log('[SignalR] Reconnecting...', error);
      this.connectionInfo.reconnectAttempts++;
      this.updateState(ConnectionState.Reconnecting);
    });

    this.hubConnection.onreconnected((connectionId) => {
      console.log('[SignalR] Reconnected with ID:', connectionId);
      
      // CRITICAL: Trigger sync for missed data
      const syncTime = this.lastSyncTime;
      this.lastSyncTime = new Date();
      
      this.updateState(ConnectionState.Connected, {
        connectionId: connectionId || undefined,
        lastConnected: new Date(),
        reconnectAttempts: 0
      });

      // Emit sync required event
      this.ngZone.run(() => {
        this.syncRequired$.next(syncTime);
      });
    });

    this.hubConnection.onclose((error) => {
      console.log('[SignalR] Connection closed:', error);
      this.updateState(ConnectionState.Disconnected, {
        lastDisconnected: new Date()
      });
    });
  }

  /**
   * Set up message handlers for appointment events
   */
  private setupMessageHandlers(): void {
    if (!this.hubConnection) return;

    // Handle new appointment
    this.hubConnection.on('NewAppointment', (appointment: Appointment) => {
      console.log('[SignalR] New appointment received:', appointment.id);
      this.ngZone.run(() => {
        this.newAppointment$.next(appointment);
        this.lastSyncTime = new Date(appointment.createdAt);
      });
    });

    // Handle appointment update
    this.hubConnection.on('AppointmentUpdated', (appointment: Appointment) => {
      console.log('[SignalR] Appointment updated:', appointment.id);
      this.ngZone.run(() => {
        this.appointmentUpdated$.next(appointment);
        this.lastSyncTime = new Date(appointment.updatedAt);
      });
    });

    // Handle appointment deletion
    this.hubConnection.on('AppointmentDeleted', (appointmentId: string) => {
      console.log('[SignalR] Appointment deleted:', appointmentId);
      this.ngZone.run(() => {
        this.appointmentDeleted$.next(appointmentId);
      });
    });

    // Handle connection confirmation
    this.hubConnection.on('Connected', (data: any) => {
      console.log('[SignalR] Connection confirmed:', data);
      this.updateState(ConnectionState.Connected, {
        connectionId: data.connectionId,
        serverTime: new Date(data.serverTime)
      });
    });

    // Handle pong response
    this.hubConnection.on('Pong', (serverTime: string) => {
      console.log('[SignalR] Pong received, server time:', serverTime);
    });
  }

  /**
   * Set up Page Visibility API listener
   * CRITICAL: This detects when tab goes to background/foreground
   */
  private setupVisibilityListener(): void {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      const isVisible = document.visibilityState === 'visible';
      console.log(`[SignalR] Visibility changed: ${isVisible ? 'VISIBLE' : 'HIDDEN'}`);

      if (isVisible && !this.wasVisible) {
        // Tab became visible again - check connection and sync
        this.handleVisibilityRestore();
      }

      this.wasVisible = isVisible;

      // Notify server of visibility change (for analytics)
      if (this.hubConnection?.state === signalR.HubConnectionState.Connected) {
        this.hubConnection.invoke('NotifyVisibilityChange', isVisible).catch(console.error);
      }
    });
  }

  /**
   * Set up window focus listener as backup
   */
  private setupFocusListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('focus', () => {
      console.log('[SignalR] Window focused');
      // Small delay to let visibility change fire first
      setTimeout(() => this.checkConnectionHealth(), 100);
    });

    window.addEventListener('online', () => {
      console.log('[SignalR] Network came online');
      this.handleNetworkRestore();
    });
  }

 /**
 * Handle when tab becomes visible again
 */
private async handleVisibilityRestore(): Promise<void> {
  console.log('[SignalR] Handling visibility restore...');

  if (!this.hubConnection) {
    console.log('[SignalR] No connection exists, starting new connection');
    await this.startConnection();
    return;
  }

  const state = this.hubConnection.state;
  console.log(`[SignalR] Current connection state: ${state}`);

  if (state === signalR.HubConnectionState.Disconnected) {
    console.log('[SignalR] Connection lost while in background, reconnecting...');
    try {
      await this.hubConnection.start();
      const syncTime = this.lastSyncTime;
      this.lastSyncTime = new Date();
      
      this.updateState(ConnectionState.Connected, {
        connectionId: this.hubConnection.connectionId || undefined,
        lastConnected: new Date()
      });

      // FIXED: Wrap in ngZone
      this.ngZone.run(() => {
        this.syncRequired$.next(syncTime);
      });
    } catch (err) {
      console.error('[SignalR] Manual reconnection failed:', err);
    }
  } else if (state === signalR.HubConnectionState.Connected) {
    console.log('[SignalR] Connection still alive, triggering sync anyway');
    const syncTime = this.lastSyncTime;
    this.lastSyncTime = new Date();
    
    // FIXED: Wrap in ngZone
    this.ngZone.run(() => {
      this.syncRequired$.next(syncTime);
    });
    
    this.ping();
  }
}

  /**
   * Handle network restore
   */
  private async handleNetworkRestore(): Promise<void> {
    if (!this.hubConnection) return;

    if (this.hubConnection.state === signalR.HubConnectionState.Disconnected) {
      try {
        await this.hubConnection.start();
        const syncTime = this.lastSyncTime;
        this.lastSyncTime = new Date();
        
        this.updateState(ConnectionState.Connected);
        this.syncRequired$.next(syncTime);
      } catch (err) {
        console.error('[SignalR] Network restore reconnection failed:', err);
      }
    }
  }

  /**
   * Check connection health
   */
  private checkConnectionHealth(): void {
    if (!this.hubConnection) return;

    if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
      this.ping();
    }
  }

  /**
   * Ping the server to verify connection
   */
  async ping(): Promise<void> {
    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    try {
      await this.hubConnection.invoke('Ping');
    } catch (err) {
      console.error('[SignalR] Ping failed:', err);
    }
  }

  /**
   * Update connection state and notify subscribers
   */
  private updateState(state: ConnectionState, additionalInfo?: Partial<ConnectionInfo>): void {
    this.connectionInfo = {
      ...this.connectionInfo,
      state,
      ...additionalInfo
    };
    this.connectionState$.next({ ...this.connectionInfo });
  }

  /**
   * Get current last sync time
   */
  getLastSyncTime(): Date {
    return this.lastSyncTime;
  }

  /**
   * Manually trigger a sync (for fallback button)
   */
  triggerSync(): void {
    const syncTime = new Date(this.lastSyncTime.getTime() - 60000); // Go back 1 minute to be safe
    this.lastSyncTime = new Date();
    this.syncRequired$.next(syncTime);
  }

  /**
   * Stop the connection
   */
  async stopConnection(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.updateState(ConnectionState.Disconnected);
    }
  }

  /**
   * Cleanup on destroy
   */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.stopConnection();
  }
}
