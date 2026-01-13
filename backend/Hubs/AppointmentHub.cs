// backend/Hubs/AppointmentHub.cs

public static class AppointmentHubExtensions
{
    public static async Task BroadcastNewAppointment(
        this IHubContext<AppointmentHub> hubContext,
        Appointment appointment)
    {
        // CHANGE: Use .All instead of .Group("AdminDashboard")
        await hubContext.Clients.All.SendAsync("NewAppointment", appointment);
    }

    public static async Task BroadcastAppointmentUpdated(
        this IHubContext<AppointmentHub> hubContext,
        Appointment appointment)
    {
        await hubContext.Clients.All.SendAsync("AppointmentUpdated", appointment);
    }

    public static async Task BroadcastAppointmentDeleted(
        this IHubContext<AppointmentHub> hubContext,
        Guid appointmentId)
    {
        await hubContext.Clients.All.SendAsync("AppointmentDeleted", appointmentId);
    }
}