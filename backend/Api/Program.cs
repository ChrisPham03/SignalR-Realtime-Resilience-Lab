
using Microsoft.AspNetCore.SignalR;
var builder = WebApplication.CreateBuilder(args);

// Add SignalR service
builder.Services.AddSignalR();

var app = builder.Build();


// Simple list to store appointments (in memory)
var appointments = new List<Appointment>();

// GET - return all appointments
app.MapGet("/appointments", () => appointments);
// POST - add a new appointment
app.MapPost("/appointments", (Appointment apt) => 
{
    apt.Id = Guid.NewGuid();
    apt.CreatedAt = DateTime.UtcNow;
    appointments.Add(apt);
    // 🔥 Broadcast to ALL connected clients instantly!
    await hub.Clients.All.SendAsync("NewAppointment", apt);
    return apt;
});

// Map the SignalR hub endpoint
app.MapHub<AppointmentHub>("/hub");

app.Run();

// Define what an Appointment looks like
record Appointment
{
    public Guid Id { get; set; }
    public string CustomerName { get; set; } = "";
    public string Service { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

// SignalR Hub - clients connect here
public class AppointmentHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        Console.WriteLine($"✅ Client connected: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Console.WriteLine($"❌ Client disconnected: {Context.ConnectionId}");
        await base.OnDisconnectedAsync(exception);
    }
}