using SalonBookingApi.Hubs;
using SalonBookingApi.Services;

var builder = WebApplication.CreateBuilder(args);

// ============================================
// Service Configuration
// ============================================

// Add controllers
builder.Services.AddControllers();

// Add API Explorer and Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { 
        Title = "Salon Booking API", 
        Version = "v1",
        Description = "Real-time salon appointment booking system with SignalR"
    });
});

// Add SignalR with configuration
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
});

// Register singleton services
builder.Services.AddSingleton<AppointmentStore>();

// Register background service
builder.Services.AddHostedService<AppointmentSimulatorService>();

// Configure CORS for Angular development
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngular", policy =>
    {
        policy.WithOrigins(
                "http://localhost:4200",
                "http://localhost:5050",
                "http://localhost",
                "http://127.0.0.1:4200"
            )
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();  // Required for SignalR
    });
});

// Configure JSON serialization
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = 
            System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

var app = builder.Build();

// ============================================
// Middleware Pipeline
// ============================================

// Development environment settings
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Salon Booking API v1");
    });
}

// CORS must be before routing
app.UseCors("AllowAngular");

app.UseRouting();

// Map controllers and SignalR hub
app.MapControllers();
app.MapHub<AppointmentHub>("/hubs/appointments");

// Simple root endpoint
app.MapGet("/", () => Results.Ok(new
{
    Service = "Salon Booking API",
    Version = "1.0.0",
    Status = "Running",
    Endpoints = new
    {
        Api = "/api/appointment",
        SignalR = "/hubs/appointments",
        Swagger = "/swagger",
        Health = "/api/appointment/health"
    },
    Timestamp = DateTime.UtcNow
}));

// ============================================
// Application Startup
// ============================================

var logger = app.Services.GetRequiredService<ILogger<Program>>();
logger.LogInformation("===========================================");
logger.LogInformation("Salon Booking API Starting...");
logger.LogInformation("SignalR Hub: /hubs/appointments");
logger.LogInformation("API Endpoints: /api/appointment");
logger.LogInformation("Swagger UI: /swagger");
logger.LogInformation("===========================================");

app.Run();
