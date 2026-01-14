import { Component, ChangeDetectorRef } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Component({
  selector: 'app-root',
  template: `
    <h1>🏪 Salon Dashboard</h1>
    <p>Status: {{ connectionStatus }}</p>
    <p>Appointments: {{ appointments.length }}</p>
    
    <button (click)="addTest()">Add Test (local)</button>
    
    @for (apt of appointments; track apt.id) {
      <div>✂️ {{ apt.customerName }} - {{ apt.service }}</div>
    } @empty {
      <p>No appointments yet</p>
    }
  `,
  standalone: true
})
export class App {
  appointments: any[] = [];
  connectionStatus = 'Disconnected';
  private connection!: signalR.HubConnection;

  constructor(private cdr: ChangeDetectorRef) {
    this.connectToHub();
  }

  addTest() {
    console.log('Button clicked!');
    this.appointments = [...this.appointments, {
      id: Date.now(),
      customerName: 'Test User',
      service: 'Test Service'
    }];
    console.log('Appointments now:', this.appointments.length);
  }

  connectToHub() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5246/hub')
      .build();

    this.connection.on('NewAppointment', (apt) => {
      console.log('📥 Received:', apt);
      this.appointments = [...this.appointments, apt];
      this.cdr.detectChanges();
      console.log('After update:', this.appointments.length);
    });

    this.connection.start()
      .then(() => {
        console.log('✅ Connected');
        this.connectionStatus = 'Connected';
        this.cdr.detectChanges();
      })
      .catch(err => {
        console.error('❌ Failed:', err);
        this.connectionStatus = 'Failed';
      });
  }
}