using Microsoft.AspNetCore.SignalR;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

app.UseCors();

var appointments = new List<Appointment>();

app.MapGet("/appointments", () => appointments);

app.MapPost("/appointments", async (Appointment apt, IHubContext<AppointmentHub> hub) => 
{
    apt.Id = Guid.NewGuid();
    apt.CreatedAt = DateTime.UtcNow;
    appointments.Add(apt);
    
    await hub.Clients.All.SendAsync("NewAppointment", apt);
    
    return apt;
});

app.MapHub<AppointmentHub>("/hub");

app.Run();

record Appointment
{
    public Guid Id { get; set; }
    public string CustomerName { get; set; } = "";
    public string Service { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

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