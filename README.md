# 🏪 Salon Booking Lab - Real-Time Connection Recovery

A laboratory environment to test and solve the real-time update problem in admin booking dashboards when devices enter freeze/battery-saving mode.

## 📋 Problem Being Solved

When admin staff monitor a salon appointment dashboard:
- WebSocket connections get suspended when browser tabs go to background
- Mobile devices in power-saving mode aggressively close connections
- Network fluctuations drop connections
- Result: Staff miss new bookings, requiring manual page refreshes

## 🎯 Solution Implemented

1. **Automatic Reconnection** - SignalR with exponential backoff retry
2. **Visibility Detection** - Page Visibility API to detect tab state changes
3. **Data Synchronization** - Fetch missed appointments after reconnection
4. **Connection Monitoring** - Visual indicators and manual sync fallback

## 🏗️ Project Structure

```
salon-booking-lab/
├── backend/                    # .NET 8 Web API + SignalR
│   ├── Controllers/           # REST API endpoints
│   ├── Hubs/                  # SignalR hub for real-time
│   ├── Models/                # Data models
│   ├── Services/              # Business logic & simulator
│   └── Program.cs             # App configuration
│
├── frontend/                  # Angular 19 Application
│   └── salon-admin/
│       └── src/app/
│           ├── components/    # UI components
│           ├── services/      # SignalR & API services
│           ├── models/        # TypeScript interfaces
│           └── environments/  # Configuration
│
├── infrastructure/            # Terraform configs (Phase 4)
└── docs/                      # Documentation
```

## 🚀 Quick Start

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js 20+](https://nodejs.org/)
- [Angular CLI](https://angular.io/cli) (`npm install -g @angular/cli`)

### Step 1: Start Backend

```bash
cd backend
dotnet restore
dotnet run
```

Backend will start at: **http://localhost:5000**

Endpoints:
- API: `http://localhost:5000/api/appointment`
- SignalR Hub: `http://localhost:5000/hubs/appointments`
- Swagger: `http://localhost:5000/swagger`

### Step 2: Start Frontend

```bash
cd frontend/salon-admin
npm install
ng serve
```

Frontend will start at: **http://localhost:4200**

### Step 3: Test the Lab

1. Open `http://localhost:4200` in your browser
2. Observe appointments appearing in real-time (every 10-30 seconds)
3. Switch to another browser tab for 30+ seconds
4. Return to the dashboard
5. **Expected**: Missed appointments should sync automatically!

## 🧪 Testing Scenarios

### Basic Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Tab Background | Switch tabs for 30s | Auto-sync on return |
| Browser Minimize | Minimize for 1 min | Auto-reconnect |
| Network Disconnect | Toggle WiFi | Auto-reconnect when restored |
| Multiple Tabs | Open 2+ instances | All receive updates |

### Mobile Tests (After Deployment)

- Lock screen for various durations
- Enable battery saver mode
- Switch apps and return

## 🔧 Configuration

### Backend (appsettings.json)

```json
{
  "Simulator": {
    "Enabled": true,
    "MinIntervalSeconds": 10,
    "MaxIntervalSeconds": 30
  }
}
```

### Frontend (environment.ts)

```typescript
export const environment = {
  apiUrl: 'http://localhost:5000/api',
  signalRUrl: 'http://localhost:5000/hubs/appointments',
  signalR: {
    reconnectDelays: [0, 2000, 5000, 10000, 15000, 30000]
  }
};
```

## 📡 API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appointment` | Get all appointments |
| GET | `/api/appointment/{id}` | Get by ID |
| GET | `/api/appointment/since?since={datetime}` | Get appointments since timestamp (for sync) |
| POST | `/api/appointment` | Create new appointment |
| PATCH | `/api/appointment/{id}/status` | Update status |
| DELETE | `/api/appointment/{id}` | Delete appointment |
| GET | `/api/appointment/stats` | Get statistics |

### SignalR Events

**Server → Client:**
- `NewAppointment` - New appointment created
- `AppointmentUpdated` - Appointment updated
- `AppointmentDeleted` - Appointment deleted
- `Connected` - Connection confirmed

**Client → Server:**
- `NotifyVisibilityChange(bool)` - Report tab visibility
- `Ping()` - Connection health check

## 🔍 Key Files Explained

### SignalR Service (signalr.service.ts)

The core of the solution:
- `setupVisibilityListener()` - Detects tab state changes
- `handleVisibilityRestore()` - Triggers reconnection & sync
- `syncRequired$` - Observable that triggers data sync

### Appointment Hub (AppointmentHub.cs)

Server-side SignalR:
- Manages client connections
- Broadcasts appointment changes
- Tracks connection statistics

### Appointment Simulator (AppointmentSimulatorService.cs)

Background service:
- Generates realistic test appointments
- Configurable frequency
- Broadcasts via SignalR

## 📊 Monitoring

### Browser Console

Open DevTools (F12) and watch for:
```
[SignalR] Connected successfully
[SignalR] Visibility changed: HIDDEN
[SignalR] Visibility changed: VISIBLE
[SignalR] Handling visibility restore...
[AppointmentService] Sync required since: ...
[AppointmentService] Received 3 appointments to sync
```

### Backend Logs

The backend logs all:
- SignalR connections/disconnections
- Appointment generations
- Sync requests

## 🐛 Troubleshooting

### CORS Errors
- Ensure backend is running on port 5000
- Check browser console for specific errors

### No Real-Time Updates
- Check SignalR connection status indicator
- Verify WebSocket in DevTools Network tab
- Check backend console for errors

### Sync Not Working
- Verify `/api/appointment/since` endpoint works
- Check timestamp format in requests
- Look for errors in browser console

## 📈 Next Steps (After Local Testing)

1. **Phase 3**: Docker containerization
2. **Phase 4**: GCP infrastructure with Terraform
3. **Phase 5**: Cloud deployment
4. **Phase 6**: Comprehensive testing
5. **Phase 7**: Documentation & knowledge transfer

## 📚 Resources

- [SignalR Documentation](https://docs.microsoft.com/aspnet/signalr)
- [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
- [Angular Documentation](https://angular.io/docs)

---

**Lab Created**: January 2026  
**Version**: 1.0.0
