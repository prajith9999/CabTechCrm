using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using CabtechCrm.Api.Models;
using CabtechCrm.Api.Repositories;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Search;
using MimeKit;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.SignalR;
using CabtechCrm.Api.Hubs;
using Dapper;
using Microsoft.Extensions.Logging;

namespace CabtechCrm.Api.Services
{
    public class SyncBackgroundService : BackgroundService
    {
        private readonly ILogger<SyncBackgroundService> _logger;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly HttpClient _httpClient;
        private readonly IHubContext<NotificationHub> _hubContext;

        public SyncBackgroundService(ILogger<SyncBackgroundService> logger, IServiceScopeFactory scopeFactory, IHubContext<NotificationHub> hubContext)
        {
            _logger = logger;
            _scopeFactory = scopeFactory;
            _hubContext = hubContext;
            _httpClient = new HttpClient();
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            _logger.LogInformation("Sync Background Service is starting.");

            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    await ProcessSyncAsync(stoppingToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error occurred executing SyncBackgroundService.");
                }

                // Poll every 20 seconds for "live" feel
                await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
            }

            _logger.LogInformation("Sync Background Service is stopping.");
        }

        private async Task ProcessSyncAsync(CancellationToken stoppingToken)
        {
            using var scope = _scopeFactory.CreateScope();
            var repo = scope.ServiceProvider.GetRequiredService<IEnquiryRepository>();

            var settings = (await repo.GetAllSettingsAsync()).ToDictionary(s => s.KeyName, s => s.KeyValue);

            var gmailAddress = settings.GetValueOrDefault("GmailAddress");
            var gmailPassword = settings.GetValueOrDefault("GmailAppPassword");

            var shopifyDomain = settings.GetValueOrDefault("ShopifyDomain");
            var shopifyToken = settings.GetValueOrDefault("ShopifyToken");
            var lastShopifySyncStr = settings.GetValueOrDefault("LastShopifySync");

            if (!string.IsNullOrWhiteSpace(gmailAddress) && !string.IsNullOrWhiteSpace(gmailPassword))
            {
                var gmailPw = (gmailPassword ?? "").Replace(" ", "");
                await SyncEmailsAsync(repo, gmailAddress.Trim(), gmailPw, stoppingToken);
            }

            if (!string.IsNullOrWhiteSpace(shopifyDomain) && !string.IsNullOrWhiteSpace(shopifyToken))
            {
                DateTime? lastSync = null;
                if (DateTime.TryParse(lastShopifySyncStr, out var parsed)) lastSync = parsed;

                await SyncShopifyOrdersAsync(repo, shopifyDomain, shopifyToken, lastSync, stoppingToken);
            }
        }

        private async Task SyncEmailsAsync(IEnquiryRepository repo, string email, string password, CancellationToken cancellationToken)
        {
            try
            {
                using var client = new ImapClient();
                await client.ConnectAsync("imap.gmail.com", 993, true, cancellationToken);
                await client.AuthenticateAsync(email, password, cancellationToken);
                
                var inbox = client.Inbox;
                if (inbox == null)
                {
                    _logger.LogWarning("IMAP client returned null Inbox folder.");
                    return;
                }
                await inbox.OpenAsync(FolderAccess.ReadWrite, cancellationToken);

                // Pull all inbox emails so users can view complete history in the UI.
                // Limit processing window to recent messages to keep sync lightweight.
                var uids = (await inbox.SearchAsync(SearchQuery.All, cancellationToken))
                    .OrderByDescending(u => u.Id)
                    .Take(200)
                    .ToList();

                foreach (var uid in uids)
                {
                    var message = await inbox.GetMessageAsync(uid, cancellationToken);
                    var subject = message.Subject ?? "New Email Enquiry";
                    
                    // Simple Regex to extract Phone and Company
                    var bodyText = message.TextBody ?? message.HtmlBody ?? "";
                    var phoneRegex = new Regex(@"(\+?\d[\d -]{8,15}\d)", RegexOptions.Compiled);
                    var phoneMatch = phoneRegex.Match(bodyText);
                    var phoneNumber = phoneMatch.Success ? phoneMatch.Value.Trim() : "";

                    var contactName = message.From.Mailboxes.FirstOrDefault()?.Name ?? "Unknown Sender";
                    var contactEmail = message.From.Mailboxes.FirstOrDefault()?.Address ?? "unknown@email.com";
                    
                    var attachments = new List<EmailAttachment>();
                    
                    foreach (var attachment in message.Attachments)
                    {
                        if (attachment is MimePart mimePart)
                        {
                            if (mimePart.Content == null)
                                continue;

                            using var memory = new MemoryStream();
                            await mimePart.Content.DecodeToAsync(memory, cancellationToken);
                            attachments.Add(new EmailAttachment
                            {
                                FileName = mimePart.FileName ?? "attachment.bin",
                                ContentType = mimePart.ContentType.MimeType,
                                FileData = memory.ToArray()
                            });
                        }
                    }

                    var newEnquiry = new Enquiry
                    {
                        Title = subject,
                        Description = bodyText.Length > 2000 ? bodyText.Substring(0, 2000) : bodyText,
                        Source = "Email",
                        SourceId = message.MessageId
                    };

                    var newContact = new Contact
                    {
                        Name = contactName,
                        Email = contactEmail,
                        PhoneNumber = phoneNumber,
                        Company = "" // Extraction might be complex, default to empty
                    };

                    var emailId = await repo.CreateEmailEnquiryAsync(newEnquiry, newContact, attachments);
                    
                    if (emailId > 0)
                    {
                        try
                        {
                            using var dbScope = _scopeFactory.CreateScope();
                            var context = dbScope.ServiceProvider.GetRequiredService<DapperContext>();
                            using var connection = context.CreateConnection();

                            var inboxRow = new
                            {
                                Sender = contactName,
                                SenderEmail = contactEmail,
                                Subject = subject,
                                Preview = bodyText.Length > 200 ? bodyText.Substring(0, 200) : bodyText,
                                Body = bodyText,
                                Recipient = (string?)null,
                                Direction = "Incoming",
                                IsRead = false,
                                ReceivedAt = DateTime.UtcNow
                            };

                            if (context.IsPostgres)
                            {
                                await connection.ExecuteAsync(@"
                                    INSERT INTO emails (sender, senderemail, subject, preview, body, recipient, direction, isread, receivedat, createdat)
                                    VALUES (@Sender, @SenderEmail, @Subject, @Preview, @Body, @Recipient, @Direction, @IsRead, @ReceivedAt, CURRENT_TIMESTAMP)",
                                    inboxRow);
                                await connection.ExecuteAsync(@"
                                    INSERT INTO notifications (userid, type, message, isread, entityid, createdat)
                                    VALUES ('ALL', 'Email', @Message, false, NULL, CURRENT_TIMESTAMP)",
                                    new { Message = $"New email from {contactName}: {subject}" });
                            }
                            else
                            {
                                await connection.ExecuteAsync(@"
                                    INSERT INTO Emails (Sender, SenderEmail, Subject, Preview, Body, Recipient, Direction, IsRead, ReceivedAt, CreatedAt)
                                    VALUES (@Sender, @SenderEmail, @Subject, @Preview, @Body, @Recipient, @Direction, @IsRead, @ReceivedAt, GETDATE())",
                                    inboxRow);
                                await connection.ExecuteAsync(@"
                                    INSERT INTO Notifications (UserId, Type, Message, IsRead, EntityId, CreatedAt)
                                    VALUES ('ALL', 'Email', @Message, 0, NULL, GETDATE())",
                                    new { Message = $"New email from {contactName}: {subject}" });
                            }

                            await _hubContext.Clients.All.SendAsync("ReceiveNotification", new
                            {
                                Type = "Email",
                                Message = $"New email from {contactName}",
                                Time = DateTime.UtcNow
                            });
                        }
                        catch (Exception rowEx)
                        {
                            _logger.LogWarning(rowEx, "Synced enquiry {EnquiryId} but failed to write Emails/Notifications row for {Subject}", emailId, subject);
                        }
                    }
                }

                await client.DisconnectAsync(true, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to sync emails.");
            }
        }

        private async Task SyncShopifyOrdersAsync(IEnquiryRepository repo, string domain, string token, DateTime? lastSync, CancellationToken cancellationToken)
        {
            try
            {
                var querySuffix = lastSync.HasValue ? $"?updated_at_min={lastSync.Value:O}" : "?status=any";
                var url = $"https://{domain}/admin/api/2024-01/orders.json{querySuffix}";

                var request = new HttpRequestMessage(HttpMethod.Get, url);
                request.Headers.Add("X-Shopify-Access-Token", token);

                var response = await _httpClient.SendAsync(request, cancellationToken);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("Shopify API returned {StatusCode}", response.StatusCode);
                    return;
                }

                var content = await response.Content.ReadAsStringAsync(cancellationToken);
                using var document = JsonDocument.Parse(content);
                var root = document.RootElement;

                if (root.TryGetProperty("orders", out var ordersElement))
                {
                    foreach (var order in ordersElement.EnumerateArray())
                    {
                        var orderId = order.GetProperty("id").GetInt64().ToString();
                        
                        // Prevent duplicates
                        var existingOrders = await repo.GetAllShopifyOrdersAsync();
                        if (existingOrders.Any(o => o.ShopifyOrderId == orderId))
                            continue;

                        var contactEmail = order.TryGetProperty("email", out var emailProp) && emailProp.ValueKind != JsonValueKind.Null ? emailProp.GetString() : "shopify@store.com";
                        var customerName = "Shopify Customer";
                        var phoneNumber = "";
                        
                        if (order.TryGetProperty("customer", out var customerInfo) && customerInfo.ValueKind != JsonValueKind.Null)
                        {
                            var fn = customerInfo.TryGetProperty("first_name", out var f) && f.ValueKind != JsonValueKind.Null ? f.GetString() : "";
                            var ln = customerInfo.TryGetProperty("last_name", out var l) && l.ValueKind != JsonValueKind.Null ? l.GetString() : "";
                            customerName = $"{fn} {ln}".Trim();
                            phoneNumber = customerInfo.TryGetProperty("phone", out var p) && p.ValueKind != JsonValueKind.Null ? p.GetString() : "";
                        }

                        decimal totalPrice = 0;
                        if (order.TryGetProperty("total_price", out var priceProp) && priceProp.ValueKind != JsonValueKind.Null)
                        {
                            var priceStr = priceProp.GetString();
                            if (!string.IsNullOrWhiteSpace(priceStr))
                            {
                                decimal.TryParse(priceStr, NumberStyles.Number, CultureInfo.InvariantCulture, out totalPrice);
                            }
                        }
                        var financialStatus = order.TryGetProperty("financial_status", out var finStat) && finStat.ValueKind != JsonValueKind.Null ? finStat.GetString() : "pending";
                        var fulfillmentStatus = order.TryGetProperty("fulfillment_status", out var fulStat) && fulStat.ValueKind != JsonValueKind.Null ? fulStat.GetString() : "unfulfilled";
                        
                        var newEnquiry = new Enquiry
                        {
                            Title = $"Shopify Order #{order.GetProperty("order_number").GetInt64()}",
                            Description = $"Order from Shopify channel. Total: {totalPrice}. Financial Status: {financialStatus}",
                            Source = "Shopify",
                            SourceId = orderId,
                            CurrentStage = 1 // Default
                        };

                        var newContact = new Contact
                        {
                            Name = string.IsNullOrWhiteSpace(customerName) ? "Unknown Customer" : customerName,
                            Email = contactEmail,
                            PhoneNumber = phoneNumber
                        };

                        var shopifyOrder = new ShopifyOrder
                        {
                            ShopifyOrderId = orderId,
                            Channel = "Online Store",
                            PaymentStatus = financialStatus,
                            FulfillmentStatus = fulfillmentStatus,
                            DeliveryStatus = "",
                            DeliveryMethod = "Shipping",
                            TotalAmount = totalPrice,
                            OrderDate = DateTime.UtcNow,
                            ItemsSummary = "Items fetched"
                        };

                        var shopifyId = await repo.CreateShopifyEnquiryAsync(newEnquiry, newContact, shopifyOrder);
                        
                        if (shopifyId > 0)
                        {
                            using var dbScope = _scopeFactory.CreateScope();
                            var ctx = dbScope.ServiceProvider.GetRequiredService<DapperContext>();
                            using var nConn = ctx.CreateConnection();
                            var ordNum = order.GetProperty("order_number").GetInt64();
                            await nConn.ExecuteAsync(@"
                                INSERT INTO Notifications (UserId, Type, Message, IsRead, EntityId, CreatedAt)
                                VALUES ('ALL', 'Shopify', @Message, 0, @EntityId, GETUTCDATE())",
                                new { Message = $"New Shopify order #{ordNum}", EntityId = orderId });

                            await _hubContext.Clients.All.SendAsync("ReceiveNotification", new { 
                                Type = "Shopify", 
                                Message = $"New Shopify Order: #{ordNum}",
                                Time = DateTime.UtcNow 
                            });
                        }
                    }
                }

                await repo.UpsertSettingAsync("LastShopifySync", DateTime.UtcNow.ToString("O"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to sync Shopify orders.");
            }
        }
    }
}
