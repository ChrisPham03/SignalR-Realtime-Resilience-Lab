using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using SalonBookingApi.Hubs;
using SalonBookingApi.Models;
using SalonBookingApi.Services;

namespace SalonBookingApi.Controllers;

/// <summary>
/// REST API controller for appointment operations
/// Works alongside SignalR for complete real-time + REST hybrid approach
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class AppointmentController : ControllerBase
{
    private readonly ILogger<AppointmentController> _logger;
    private readonly AppointmentStore _store;
    private readonly IHubContext<AppointmentHub> _hubContext;

    public AppointmentController(
        ILogger<AppointmentController> logger,
        AppointmentStore store,
        IHubContext<AppointmentHub> hubContext)
    {
        _logger = logger;
        _store = store;
        _hubContext = hubContext;
    }

    /// <summary>
    /// Get all appointments
    /// </summary>
    [HttpGet]
    public ActionResult<List<Appointment>> GetAll()
    {
        _logger.LogInformation("Getting all appointments");
        var appointments = _store.GetAll();
        return Ok(appointments);
    }

    /// <summary>
    /// Get appointment by ID
    /// </summary>
    [HttpGet("{id:guid}")]
    public ActionResult<Appointment> GetById(Guid id)
    {
        var appointment = _store.GetById(id);
        if (appointment == null)
        {
            return NotFound(new { message = $"Appointment {id} not found" });
        }
        return Ok(appointment);
    }

    /// <summary>
    /// Get appointments created or updated since a specific timestamp
    /// THIS IS CRUCIAL FOR SYNC AFTER RECONNECTION
    /// </summary>
    [HttpGet("since")]
    public ActionResult<SyncResponse> GetSince([FromQuery] DateTime since)
    {
        _logger.LogInformation("Getting appointments since {Since}", since);
        
        var appointments = _store.GetSince(since);
        
        var response = new SyncResponse
        {
            Appointments = appointments,
            ServerTime = DateTime.UtcNow,
            TotalCount = appointments.Count
        };

        _logger.LogInformation("Returning {Count} appointments for sync", appointments.Count);
        return Ok(response);
    }

    /// <summary>
    /// Create a new appointment (manual booking)
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<Appointment>> Create([FromBody] CreateAppointmentRequest request)
    {
        var appointment = new Appointment
        {
            CustomerName = request.CustomerName,
            CustomerPhone = request.CustomerPhone,
            ServiceType = request.ServiceType,
            StylistName = request.StylistName,
            AppointmentTime = request.AppointmentTime,
            DurationMinutes = request.DurationMinutes,
            Price = request.Price,
            Notes = request.Notes,
            Status = AppointmentStatus.Scheduled
        };

        _store.Add(appointment);
        
        _logger.LogInformation("Manual appointment created: {Id}", appointment.Id);

        // Broadcast to all connected clients
        await _hubContext.BroadcastNewAppointment(appointment);

        return CreatedAtAction(nameof(GetById), new { id = appointment.Id }, appointment);
    }

    /// <summary>
    /// Update appointment status
    /// </summary>
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<Appointment>> UpdateStatus(Guid id, [FromBody] UpdateStatusRequest request)
    {
        var appointment = _store.Update(id, a => a.Status = request.Status);
        
        if (appointment == null)
        {
            return NotFound(new { message = $"Appointment {id} not found" });
        }

        _logger.LogInformation("Appointment {Id} status updated to {Status}", id, request.Status);

        // Broadcast update to all connected clients
        await _hubContext.BroadcastAppointmentUpdated(appointment);

        return Ok(appointment);
    }

    /// <summary>
    /// Delete an appointment
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        var deleted = _store.Delete(id);
        
        if (!deleted)
        {
            return NotFound(new { message = $"Appointment {id} not found" });
        }

        _logger.LogInformation("Appointment {Id} deleted", id);

        // Broadcast deletion to all connected clients
        await _hubContext.BroadcastAppointmentDeleted(id);

        return NoContent();
    }

    /// <summary>
    /// Get store statistics (for debugging/monitoring)
    /// </summary>
    [HttpGet("stats")]
    public ActionResult GetStats()
    {
        return Ok(new
        {
            TotalAppointments = _store.Count,
            ServerTime = DateTime.UtcNow,
            ServerTimeUtc = DateTime.UtcNow.ToString("O")
        });
    }

    /// <summary>
    /// Health check endpoint
    /// </summary>
    [HttpGet("health")]
    public ActionResult Health()
    {
        return Ok(new
        {
            Status = "Healthy",
            Timestamp = DateTime.UtcNow
        });
    }
}

/// <summary>
/// Request model for creating appointments
/// </summary>
public class CreateAppointmentRequest
{
    public string CustomerName { get; set; } = string.Empty;
    public string CustomerPhone { get; set; } = string.Empty;
    public string ServiceType { get; set; } = string.Empty;
    public string StylistName { get; set; } = string.Empty;
    public DateTime AppointmentTime { get; set; }
    public int DurationMinutes { get; set; }
    public decimal Price { get; set; }
    public string? Notes { get; set; }
}

/// <summary>
/// Request model for updating status
/// </summary>
public class UpdateStatusRequest
{
    public AppointmentStatus Status { get; set; }
}
