using Microsoft.AspNetCore.SignalR;
using SalonBookingApi.Hubs;
using SalonBookingApi.Models;

namespace SalonBookingApi.Services;

/// <summary>
/// Background service that simulates new appointment bookings
/// This creates realistic test data for the lab environment
/// </summary>
public class AppointmentSimulatorService : BackgroundService
{
    private readonly ILogger<AppointmentSimulatorService> _logger;
    private readonly AppointmentStore _store;
    private readonly IHubContext<AppointmentHub> _hubContext;
    private readonly IConfiguration _configuration;
    private readonly Random _random = new();

    // Sample data for realistic appointments
    private readonly string[] _customerFirstNames = 
    {
        "Emma", "Liam", "Olivia", "Noah", "Ava", "Oliver", "Isabella", "Elijah",
        "Sophia", "Lucas", "Mia", "Mason", "Charlotte", "Logan", "Amelia", "James",
        "Harper", "Benjamin", "Evelyn", "Henry", "Luna", "Alexander", "Ella", "Sebastian"
    };

    private readonly string[] _customerLastNames = 
    {
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
        "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
        "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Thompson", "White"
    };

    private readonly string[] _stylists = 
    {
        "Jessica M.", "Michael R.", "Sarah K.", "David L.", "Amanda P.",
        "Christopher B.", "Jennifer H.", "Matthew S."
    };

    private readonly (string Name, int DurationMinutes, decimal MinPrice, decimal MaxPrice)[] _services = 
    {
        ("Haircut", 30, 25m, 45m),
        ("Hair Coloring", 90, 75m, 150m),
        ("Highlights", 120, 100m, 200m),
        ("Blowout", 45, 35m, 60m),
        ("Deep Conditioning", 30, 25m, 50m),
        ("Keratin Treatment", 180, 150m, 300m),
        ("Balayage", 150, 150m, 250m),
        ("Trim", 20, 15m, 25m),
        ("Updo/Styling", 60, 50m, 100m),
        ("Hair Extensions", 180, 200m, 500m),
        ("Beard Trim", 15, 10m, 20m),
        ("Men's Haircut", 30, 20m, 35m)
    };

    public AppointmentSimulatorService(
        ILogger<AppointmentSimulatorService> logger,
        AppointmentStore store,
        IHubContext<AppointmentHub> hubContext,
        IConfiguration configuration)
    {
        _logger = logger;
        _store = store;
        _hubContext = hubContext;
        _configuration = configuration;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Appointment Simulator Service starting...");

        // Wait a bit for the app to fully start
        await Task.Delay(3000, stoppingToken);

        // Generate some initial appointments
        await GenerateInitialAppointments(5);

        // Get configuration for simulation interval
        var minInterval = _configuration.GetValue("Simulator:MinIntervalSeconds", 10);
        var maxInterval = _configuration.GetValue("Simulator:MaxIntervalSeconds", 30);
        var enabled = _configuration.GetValue("Simulator:Enabled", true);

        _logger.LogInformation(
            "Simulator configured - Enabled: {Enabled}, Interval: {Min}-{Max} seconds",
            enabled, minInterval, maxInterval);

        while (!stoppingToken.IsCancellationRequested && enabled)
        {
            try
            {
                // Generate a new appointment
                var appointment = GenerateRandomAppointment();
                _store.Add(appointment);

                _logger.LogInformation(
                    "New appointment generated: {Id} - {Customer} - {Service} at {Time}",
                    appointment.Id,
                    appointment.CustomerName,
                    appointment.ServiceType,
                    appointment.AppointmentTime.ToString("g"));

                // Broadcast to all connected clients
                await _hubContext.BroadcastNewAppointment(appointment);

                // Wait for random interval before next appointment
                var interval = _random.Next(minInterval, maxInterval + 1);
                await Task.Delay(TimeSpan.FromSeconds(interval), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Expected when stopping
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in appointment simulator");
                await Task.Delay(5000, stoppingToken);
            }
        }

        _logger.LogInformation("Appointment Simulator Service stopped.");
    }

    private async Task GenerateInitialAppointments(int count)
    {
        _logger.LogInformation("Generating {Count} initial appointments...", count);

        for (int i = 0; i < count; i++)
        {
            var appointment = GenerateRandomAppointment();
            // Set creation time in the past for initial appointments
            appointment.CreatedAt = DateTime.UtcNow.AddMinutes(-_random.Next(5, 60));
            appointment.UpdatedAt = appointment.CreatedAt;
            _store.Add(appointment);
        }

        _logger.LogInformation("Initial appointments generated. Total: {Count}", _store.Count);
        await Task.CompletedTask;
    }

    private Appointment GenerateRandomAppointment()
    {
        var service = _services[_random.Next(_services.Length)];
        var firstName = _customerFirstNames[_random.Next(_customerFirstNames.Length)];
        var lastName = _customerLastNames[_random.Next(_customerLastNames.Length)];
        
        // Generate appointment time (today or tomorrow during business hours)
        var today = DateTime.Today;
        var dayOffset = _random.Next(0, 3); // Today, tomorrow, or day after
        var hour = _random.Next(9, 18); // 9 AM to 6 PM
        var minute = _random.Next(0, 4) * 15; // 0, 15, 30, or 45
        var appointmentTime = today.AddDays(dayOffset).AddHours(hour).AddMinutes(minute);

        // Generate price within service range
        var priceRange = service.MaxPrice - service.MinPrice;
        var price = service.MinPrice + (decimal)(_random.NextDouble() * (double)priceRange);
        price = Math.Round(price, 2);

        return new Appointment
        {
            Id = Guid.NewGuid(),
            CustomerName = $"{firstName} {lastName}",
            CustomerPhone = GeneratePhoneNumber(),
            ServiceType = service.Name,
            StylistName = _stylists[_random.Next(_stylists.Length)],
            AppointmentTime = appointmentTime,
            DurationMinutes = service.DurationMinutes,
            Status = AppointmentStatus.Scheduled,
            Price = price,
            Notes = _random.Next(0, 5) == 0 ? GenerateRandomNote() : null
        };
    }

    private string GeneratePhoneNumber()
    {
        return $"({_random.Next(200, 999)}) {_random.Next(200, 999)}-{_random.Next(1000, 9999)}";
    }

    private string GenerateRandomNote()
    {
        var notes = new[]
        {
            "First time customer",
            "Prefers light conversation",
            "Has sensitive scalp",
            "VIP client - offer complimentary beverage",
            "Running late - please call to confirm",
            "Bringing reference photos",
            "Allergic to certain products - check file",
            "Requested same stylist as last time"
        };
        return notes[_random.Next(notes.Length)];
    }
}
