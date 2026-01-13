using System.Collections.Concurrent;
using SalonBookingApi.Models;

namespace SalonBookingApi.Services;

/// <summary>
/// Thread-safe in-memory storage for appointments
/// In production, this would be replaced with a database
/// </summary>
public class AppointmentStore
{
    private readonly ConcurrentDictionary<Guid, Appointment> _appointments = new();
    private readonly object _lock = new();

    /// <summary>
    /// Add a new appointment to the store
    /// </summary>
    public Appointment Add(Appointment appointment)
    {
        appointment.CreatedAt = DateTime.UtcNow;
        appointment.UpdatedAt = DateTime.UtcNow;
        _appointments[appointment.Id] = appointment;
        return appointment;
    }

    /// <summary>
    /// Get all appointments
    /// </summary>
    public List<Appointment> GetAll()
    {
        return _appointments.Values
            .OrderByDescending(a => a.CreatedAt)
            .ToList();
    }

    /// <summary>
    /// Get appointment by ID
    /// </summary>
    public Appointment? GetById(Guid id)
    {
        _appointments.TryGetValue(id, out var appointment);
        return appointment;
    }

    /// <summary>
    /// Get appointments created or updated since a specific timestamp
    /// This is crucial for synchronization after reconnection
    /// </summary>
    public List<Appointment> GetSince(DateTime since)
    {
        return _appointments.Values
            .Where(a => a.CreatedAt > since || a.UpdatedAt > since)
            .OrderBy(a => a.CreatedAt)
            .ToList();
    }

    /// <summary>
    /// Update an existing appointment
    /// </summary>
    public Appointment? Update(Guid id, Action<Appointment> updateAction)
    {
        if (_appointments.TryGetValue(id, out var appointment))
        {
            lock (_lock)
            {
                updateAction(appointment);
                appointment.UpdatedAt = DateTime.UtcNow;
            }
            return appointment;
        }
        return null;
    }

    /// <summary>
    /// Delete an appointment
    /// </summary>
    public bool Delete(Guid id)
    {
        return _appointments.TryRemove(id, out _);
    }

    /// <summary>
    /// Get total count
    /// </summary>
    public int Count => _appointments.Count;

    /// <summary>
    /// Clear all appointments (for testing)
    /// </summary>
    public void Clear()
    {
        _appointments.Clear();
    }
}
