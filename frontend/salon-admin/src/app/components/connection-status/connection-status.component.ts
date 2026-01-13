import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { SignalRService } from '../../services/signalr.service';
import { ConnectionState, ConnectionInfo } from '../../models/appointment.model';

/**
 * Connection Status Component
 * 
 * Displays the current SignalR connection state with visual indicators
 */
@Component({
  selector: 'app-connection-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './connection-status.component.html',
  styleUrls: ['./connection-status.component.css']
})
export class ConnectionStatusComponent implements OnInit, OnDestroy {
  connectionInfo: ConnectionInfo = {
    state: ConnectionState.Disconnected,
    reconnectAttempts: 0
  };
  
  ConnectionState = ConnectionState; // Make enum available in template
  
  private subscription?: Subscription;

  constructor(private signalRService: SignalRService) {}

  ngOnInit(): void {
    this.subscription = this.signalRService.connectionState.subscribe(
      info => this.connectionInfo = info
    );
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Get CSS class based on connection state
   */
  getStateClass(): string {
    switch (this.connectionInfo.state) {
      case ConnectionState.Connected:
        return 'connected';
      case ConnectionState.Connecting:
        return 'connecting';
      case ConnectionState.Reconnecting:
        return 'reconnecting';
      case ConnectionState.Disconnected:
      default:
        return 'disconnected';
    }
  }

  /**
   * Get display text for connection state
   */
  getStateText(): string {
    switch (this.connectionInfo.state) {
      case ConnectionState.Connected:
        return 'Connected';
      case ConnectionState.Connecting:
        return 'Connecting...';
      case ConnectionState.Reconnecting:
        return `Reconnecting (attempt ${this.connectionInfo.reconnectAttempts})...`;
      case ConnectionState.Disconnected:
      default:
        return 'Disconnected';
    }
  }

  /**
   * Manual reconnect trigger
   */
  manualReconnect(): void {
    this.signalRService.triggerSync();
  }
}
