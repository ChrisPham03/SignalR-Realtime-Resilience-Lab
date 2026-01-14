# 🐛 Error Documentation - SignalR + Angular Lab

A troubleshooting guide documenting issues encountered and their solutions.

---

## Issue #1: Angular UI Not Updating from SignalR Events

**Date:** January 14, 2026  
**Severity:** High  
**Category:** Angular Change Detection + SignalR Integration

---

### Symptoms

- SignalR connection successful (✅ Connected to SignalR in console)
- Data received from server (📥 New appointment received in console)
- **BUT** the UI does not update
- Manual button clicks DO update the UI
- Page refresh shows the data

---

### Root Cause Analysis

**Three interconnected issues:**

#### 1. SignalR Runs Outside Angular's Zone

Angular uses Zone.js to automatically detect changes. When code runs inside Angular's zone, it knows to update the UI.

SignalR callbacks execute **outside** Angular's zone because they come from WebSocket events (browser-level, not Angular-level).

```
┌─────────────────────────────────────────────┐
│           Angular's Zone                    │
│                                             │
│   ✅ Button clicks                          │
│   ✅ HTTP responses (via HttpClient)        │
│   ✅ setTimeout (patched by Zone.js)        │
│                                             │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│        Outside Angular's Zone               │
│                                             │
│   ❌ WebSocket messages (SignalR)           │
│   ❌ Third-party library callbacks          │
│   ❌ Web Workers                            │
│                                             │
└─────────────────────────────────────────────┘
```

#### 2. Array Mutation vs. Reference Change

Angular's change detection (especially with OnPush strategy) compares **references**, not content.

```typescript
// ❌ WRONG - Same array reference, Angular doesn't notice
this.appointments.push(newItem);

// ✅ CORRECT - New array reference, Angular detects change
this.appointments = [...this.appointments, newItem];
```

**Visual explanation:**

```
MUTATION (push):
┌─────────────┐         ┌─────────────┐
│ Array @0x1  │   →     │ Array @0x1  │  ← Same address!
│ [A, B]      │         │ [A, B, C]   │
└─────────────┘         └─────────────┘
Angular: "Reference unchanged, skip update"

NEW REFERENCE (spread):
┌─────────────┐         ┌─────────────┐
│ Array @0x1  │   →     │ Array @0x2  │  ← New address!
│ [A, B]      │         │ [A, B, C]   │
└─────────────┘         └─────────────┘
Angular: "New reference detected, update UI!"
```

#### 3. Component Lifecycle Timing

Using `ngOnInit()` can sometimes cause timing issues with async operations. Moving initialization to the `constructor` ensures the SignalR connection is set up immediately when the component is instantiated.

---

### Solution

**Complete working code:**

```typescript
import { Component, ChangeDetectorRef } from '@angular/core';
import * as signalR from '@microsoft/signalr';

@Component({
  selector: 'app-root',
  template: `
    <h1>🏪 Salon Dashboard</h1>
    <p>Status: {{ connectionStatus }}</p>
    <p>Appointments: {{ appointments.length }}</p>
    
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

  connectToHub() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5246/hub')
      .build();

    this.connection.on('NewAppointment', (apt) => {
      console.log('📥 Received:', apt);
      
      // ✅ FIX 1: Create new array reference
      this.appointments = [...this.appointments, apt];
      
      // ✅ FIX 2: Force change detection
      this.cdr.detectChanges();
    });

    this.connection.start()
      .then(() => {
        this.connectionStatus = 'Connected';
        this.cdr.detectChanges();
      })
      .catch(err => {
        this.connectionStatus = 'Failed';
      });
  }
}
```

---

### Key Fixes Applied

| Fix | Code | Why It Works |
|-----|------|--------------|
| **New array reference** | `this.appointments = [...this.appointments, apt]` | Angular detects reference change |
| **Manual change detection** | `this.cdr.detectChanges()` | Forces Angular to re-render |
| **Store connection** | `private connection!: signalR.HubConnection` | Maintains connection reference |
| **Constructor init** | `constructor() { this.connectToHub() }` | Immediate setup |

---

### Alternative Solutions

#### Option A: NgZone.run()

```typescript
import { NgZone } from '@angular/core';

constructor(private ngZone: NgZone) {}

this.connection.on('NewAppointment', (apt) => {
  this.ngZone.run(() => {
    this.appointments = [...this.appointments, apt];
  });
});
```

**Pros:** Brings callback into Angular's zone, automatic change detection  
**Cons:** More verbose

#### Option B: Signals (Angular 17+)

```typescript
import { signal } from '@angular/core';

appointments = signal<any[]>([]);

this.connection.on('NewAppointment', (apt) => {
  this.appointments.update(current => [...current, apt]);
});
```

**Pros:** Modern, reactive, fine-grained updates  
**Cons:** Requires Angular 17+

#### Option C: RxJS Subject

```typescript
import { BehaviorSubject } from 'rxjs';
import { AsyncPipe } from '@angular/common';

appointments$ = new BehaviorSubject<any[]>([]);

// In template: @for (apt of appointments$ | async)

this.connection.on('NewAppointment', (apt) => {
  const current = this.appointments$.value;
  this.appointments$.next([...current, apt]);
});
```

**Pros:** Reactive, works well with async pipe  
**Cons:** More complex setup

---

### Debugging Checklist

When SignalR data doesn't update UI:

- [ ] Check browser console - is data being received?
- [ ] Verify connection status is "Connected"
- [ ] Check if using `.push()` - change to spread operator
- [ ] Add `console.log` after array update to verify length
- [ ] Try `cdr.detectChanges()` after update
- [ ] Test with a button click to isolate Angular vs. SignalR issue
- [ ] Check if component has `OnPush` change detection strategy

---

### Related Concepts

| Concept | Description |
|---------|-------------|
| **Zone.js** | Library that patches async APIs to enable automatic change detection |
| **Change Detection** | Angular's mechanism for updating the DOM when data changes |
| **OnPush Strategy** | Optimization that only checks when inputs change or events fire |
| **Immutability** | Creating new objects/arrays instead of modifying existing ones |
| **Signals** | Angular 17+ reactive primitive for fine-grained reactivity |

---

### References

- [Angular Change Detection Guide](https://angular.io/guide/change-detection)
- [NgZone Documentation](https://angular.io/api/core/NgZone)
- [SignalR JavaScript Client](https://docs.microsoft.com/aspnet/core/signalr/javascript-client)
- [Angular Signals](https://angular.io/guide/signals)

---

## Issue #2: CORS Error - SignalR Connection Blocked

**Date:** January 14, 2026  
**Severity:** High  
**Category:** Cross-Origin Resource Sharing (CORS)

---

### Symptoms

Browser console shows:
```
Access to fetch at 'http://localhost:5246/hub/negotiate' from origin 
'http://localhost:4200' has been blocked by CORS policy
```

---

### Root Cause

Frontend (Angular) runs on `localhost:4200`  
Backend (.NET) runs on `localhost:5246`

Different ports = different origins. Browsers block cross-origin requests by default for security.

```
┌─────────────────┐         ┌─────────────────┐
│  Angular        │   ❌    │  .NET Backend   │
│  localhost:4200 │ ──────► │  localhost:5246 │
└─────────────────┘ BLOCKED └─────────────────┘
```

---

### Solution

**Add CORS configuration in `Program.cs`:**

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();

// Add CORS policy
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:4200")  // Angular's address
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();  // Required for SignalR!
    });
});

var app = builder.Build();

// Use CORS (must be before MapHub!)
app.UseCors();

app.MapHub<AppointmentHub>("/hub");
```

---

### Key Points

| Configuration | Purpose |
|---------------|---------|
| `WithOrigins("http://localhost:4200")` | Allow requests from Angular |
| `AllowAnyHeader()` | Allow all HTTP headers |
| `AllowAnyMethod()` | Allow GET, POST, etc. |
| `AllowCredentials()` | **Required** for SignalR WebSocket |
| `app.UseCors()` before `MapHub` | Order matters! |

---

### Common Mistakes

```csharp
// ❌ WRONG - Missing AllowCredentials (SignalR needs it)
policy.WithOrigins("http://localhost:4200")
      .AllowAnyHeader()
      .AllowAnyMethod();

// ❌ WRONG - AllowAnyOrigin with AllowCredentials (not allowed)
policy.AllowAnyOrigin()
      .AllowCredentials();

// ✅ CORRECT
policy.WithOrigins("http://localhost:4200")
      .AllowAnyHeader()
      .AllowAnyMethod()
      .AllowCredentials();
```

---

## Issue #3: Port Already in Use

**Date:** January 14, 2026  
**Severity:** Low  
**Category:** Environment Configuration

---

### Symptoms

```
System.IO.IOException: Failed to bind to address http://0.0.0.0:5000: 
address already in use.
```

---

### Root Cause

Port 5000 is commonly used by macOS AirPlay Receiver (or another service).

---

### Solution

**Option A: Use a different port**

```bash
dotnet run --urls "http://localhost:5246"
```

**Option B: Update `appsettings.json`**

```json
{
  "Urls": "http://localhost:5246"
}
```

**Option C: Kill the process using the port**

```bash
# Find what's using port 5000
lsof -i :5000

# Kill it (replace PID with actual process ID)
kill -9 <PID>
```

**Option D: Disable AirPlay Receiver (macOS)**

System Preferences → General → AirDrop & Handoff → AirPlay Receiver → Off

---

## Issue #4: .NET Version Mismatch

**Date:** January 14, 2026  
**Severity:** Medium  
**Category:** Environment Configuration

---

### Symptoms

```
You must install or update .NET to run this application.
Framework: 'Microsoft.NETCore.App', version '8.0.0' (arm64)
```

---

### Root Cause

Project targets .NET 8 but only .NET 10 is installed.

---

### Solution

**Update `.csproj` to match installed version:**

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>  <!-- Changed from net8.0 -->
  </PropertyGroup>
</Project>
```

**Or check installed versions:**

```bash
dotnet --list-sdks
```

---

*Document will be updated as new issues are encountered.*
