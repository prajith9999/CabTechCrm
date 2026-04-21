using CabtechCrm.Api.Repositories;
using CabtechCrm.Api.Services;
using CabtechCrm.Api.Middleware;
using CabtechCrm.Api.Hubs;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;
using Serilog;
using FluentValidation.AspNetCore;
using FluentValidation;
using System.Reflection;
using Microsoft.AspNetCore.Authorization;

var builder = WebApplication.CreateBuilder(args);

// ── Logging (Serilog) ─────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File("Logs/crm-api-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// ── Core infrastructure ───────────────────────────────────────
builder.Services.AddSingleton<DapperContext>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<IEncryptionService, EncryptionService>();
builder.Services.AddScoped<ICurrentUserProvider, CurrentUserProvider>();
builder.Services.AddScoped<IJwtService, JwtService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<DataSeeder>();

// ── Repositories (Legacy/Compatibility) ───────────────────────
builder.Services.AddScoped<IEnquiryRepository, EnquiryRepository>();
builder.Services.AddHostedService<SyncBackgroundService>();

// ── MediatR (Clean Architecture) ──────────────────────────────
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

// ── JWT Authentication ──────────────────────────────────────
var jwtSecret = builder.Configuration["Auth:Jwt:Secret"] ?? throw new InvalidOperationException("JWT Secret not configured");
var jwtIssuer  = builder.Configuration["Auth:Jwt:Issuer"]  ?? "CabtechCrm";
var jwtAudience = builder.Configuration["Auth:Jwt:Audience"] ?? "CabtechCrmClient";
var keyBytes = Encoding.UTF8.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = builder.Environment.IsProduction();
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey         = new SymmetricSecurityKey(keyBytes),
        ValidateIssuer           = true,
        ValidIssuer              = jwtIssuer,
        ValidateAudience         = true,
        ValidAudience            = jwtAudience,
        ValidateLifetime         = true,
        ClockSkew                = TimeSpan.FromMinutes(1)
    };

    // SignalR passes the JWT as ?access_token= for WebSocket connections
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var path = context.HttpContext.Request.Path;
            if (path.StartsWithSegments("/hubs"))
            {
                var token = context.Request.Query["access_token"].FirstOrDefault();
                if (!string.IsNullOrEmpty(token))
                    context.Token = token;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddSingleton<IAuthorizationHandler, PermissionHandler>();

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdminOnly", policy => policy.RequireRole("SuperAdmin"));
    options.AddPolicy("AdminAccess", policy => policy.RequireRole("SuperAdmin", "DevAdmin", "Admin"));
    
    // Dynamically handle permissions
    // Note: For a fixed set of permissions, we could add them here manually,
    // but the PermissionHandler handles the 'permission' claim automatically for custom requirements.
});

builder.Services.AddSignalR();

// ── Controllers & Validation ─────────────────────────────────
builder.Services.AddControllers();

// FluentValidation (new registration API)
builder.Services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddFluentValidationClientsideAdapters();

builder.Services.AddEndpointsApiExplorer();

// ── Swagger ──────────────────────────────────────────────────
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title   = "Cabtech CRM API",
        Version = "v1",
        Description = "Enterprise Backend API for Cabtech CRM — RBAC Enabled"
    });

    var securityScheme = new OpenApiSecurityScheme
    {
        Name         = "Authorization",
        Description  = "Enter: Bearer {token}",
        In           = ParameterLocation.Header,
        Type         = SecuritySchemeType.Http,
        Scheme       = "bearer",
        BearerFormat = "JWT",
        Reference    = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
    };
    c.AddSecurityDefinition("Bearer", securityScheme);
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        { securityScheme, Array.Empty<string>() }
    });
});

// ── CORS ────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll",
        b => b.SetIsOriginAllowed(origin => true) // Allow Firebase and any other origin dynamically
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials());
});

// ── Build ────────────────────────────────────────────────────
var app = builder.Build();

// ── Seed Data ────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var seeder = scope.ServiceProvider.GetRequiredService<DataSeeder>();
    await seeder.SeedAsync();
}

// ── Pipeline ─────────────────────────────────────────────────
app.UseMiddleware<ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "Cabtech CRM API v1"));
}

app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications");

app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow })).AllowAnonymous();
app.MapGet("/", () => Results.Ok("Cabtech CRM API is running.")).AllowAnonymous();

app.Run();

