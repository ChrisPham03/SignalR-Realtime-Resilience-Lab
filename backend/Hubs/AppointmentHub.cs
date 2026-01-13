using Microsoft.AspNetCore.SignalR;
using SalonBookingApi.Models;

namespace SalonBookingApi.Hubs;

/// <summary>
/// SignalR Hub for real-time appointment updates
/// Handles client connections and broadcasts appointment changes
/// </summary>
public class AppointmentHub : Hub
{
    private readonly ILogger<AppointmentHub> _logger;

    // Static counter for tracking connections (useful for debugging)
    private static int _connectionCount = 0;

    public AppointmentHub(ILogger<AppointmentHub> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Called when a client connects
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        Interlocked.Increment(ref _connectionCount);
        
        _logger.LogInformation(
            "Client connected: {ConnectionId}. Total connections: {Count}",
            Context.ConnectionId,
            _connectionCount
        );

        // Add client to the "AdminDashboard" group
        await Groups.AddToGroupAsync(Context.ConnectionId, "AdminDashboard");
        
        // Notify the client of successful connection with server time
        await Clients.Caller.SendAsync("Connected", new
        {
            ConnectionId = Context.ConnectionId,
            ServerTime = DateTime.UtcNow,
            Message = "Successfully connected to appointment hub"
        });

        await base.OnConnectedAsync();
    }

    /// <summary>
    /// Called when a client disconnects
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Interlocked.Decrement(ref _connectionCount);
        
        _logger.LogInformation(
            "Client disconnected: {ConnectionId}. Reason: {Reason}. Total connections: {Count}",
            Context.ConnectionId,
            exception?.Message ?? "Normal disconnect",
            _connectionCount
        );

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "AdminDashboard");
        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Client can request current server time for synchronization
    /// </summary>
    public async Task RequestServerTime()
    {
        await Clients.Caller.SendAsync("ServerTime", DateTime.UtcNow);
    }

    /// <summary>
    /// Client notifies server of visibility change (for logging/analytics)
    /// </summary>
    public async Task NotifyVisibilityChange(bool isVisible)
    {
        _logger.LogInformation(
            "Client {ConnectionId} visibility changed: {IsVisible}",
            Context.ConnectionId,
            isVisible ? "Visible" : "Hidden"
        );

        // Acknowledge the notification
        await Clients.Caller.SendAsync("VisibilityAcknowledged", new
        {
            IsVisible = isVisible,
            ServerTime = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Ping/Pong for connection health check
    /// </summary>
    public async Task Ping()
    {
        await Clients.Caller.SendAsync("Pong", DateTime.UtcNow);
    }

    /// <summary>
    /// Get current connection statistics
    /// </summary>
    public async Task GetStats()
    {
        await Clients.Caller.SendAsync("Stats", new
        {
            TotalConnections = _connectionCount,
            ServerTime = DateTime.UtcNow
        });
    }
}

/// <summary>
/// Extension methods for broadcasting appointments through SignalR
/// </summary>
public static class AppointmentHubExtensions
{
    /// <summary>
    /// Broadcast a new appointment to all connected admin dashboards
    /// </summary>
    public static async Task BroadcastNewAppointment(
        this IHubContext<AppointmentHub> hubContext,
        Appointment appointment)
    {
        await hubContext.Clients.Group("AdminDashboard")
            .SendAsync("NewAppointment", appointment);
    }

    /// <summary>
    /// Broadcast an updated appointment to all connected admin dashboards
    /// </summary>
    public static async Task BroadcastAppointmentUpdated(
        this IHubContext<AppointmentHub> hubContext,
        Appointment appointment)
    {
        await hubContext.Clients.Group("AdminDashboard")
            .SendAsync("AppointmentUpdated", appointment);
    }

    /// <summary>
    /// Broadcast appointment deletion to all connected admin dashboards
    /// </summary>
    public static async Task BroadcastAppointmentDeleted(
        this IHubContext<AppointmentHub> hubContext,
        Guid appointmentId)
    {
        await hubContext.Clients.Group("AdminDashboard")
            .SendAsync("AppointmentDeleted", appointmentId);
    }
}
