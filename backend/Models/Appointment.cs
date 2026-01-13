namespace SalonBookingApi.Models;

/// <summary>
/// Represents a salon appointment booking
/// </summary>
public class Appointment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public string StylistName { get; set; } = string.Empty;
    public DateTime AppointmentTime { get; set; }
    public int DurationMinutes { get; set; }
    public AppointmentStatus Status { get; set; } = AppointmentStatus.Scheduled;
    public decimal Price { get; set; }
    public string? Notes { get; set; }
    
    // Timestamps for synchronization
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum AppointmentStatus
{
    Scheduled,
    Confirmed,
    InProgress,
    Completed,
    Cancelled,
    NoShow
}

/// <summary>
/// DTO for appointment sync requests
/// </summary>
public class AppointmentSyncRequest
{
    public DateTime Since { get; set; }
}

/// <summary>
/// Response containing sync data
/// </summary>
public class SyncResponse
{
    public List<Appointment> Appointments { get; set; } = new();
    public DateTime ServerTime { get; set; } = DateTime.UtcNow;
    public int TotalCount { get; set; }
}
