USE CabtechCrm;
GO

-- Seed Demo Contacts
INSERT INTO Contacts (Name, PhoneNumber, Company, Email) VALUES 
('John Smith', '+974 5555 1234', 'Gulf Construction WLL', 'john.smith@gulfcon.qa'),
('Sarah Ahmed', '+974 6666 5678', 'Qatar Petroleum', 's.ahmed@qp.com.qa'),
('Michael Chen', '+44 20 7946 0958', 'Sterling Engineering', 'm.chen@sterling-eng.co.uk'),
('Fatima Al-Thani', '+974 3333 9988', 'Education City', 'f.althani@ec.org.qa'),
('Robert Wilson', '+1 212 555 0198', 'Global Logistics Inc', 'rwilson@globallogistics.com');
GO

-- Seed Demo Enquiries across different stages
DECLARE @Contact1 INT = (SELECT MIN(Id) FROM Contacts);
DECLARE @Contact2 INT = @Contact1 + 1;
DECLARE @Contact3 INT = @Contact1 + 2;
DECLARE @Contact4 INT = @Contact1 + 3;
DECLARE @Contact5 INT = @Contact1 + 4;

INSERT INTO Enquiries (ContactId, ReferenceNumber, Title, Description, DistanceKm, CurrentStage, UpdatedAt) VALUES 
(@Contact1, 'CAB-20260401-A1B2', 'Industrial Power Cable Supply', 'Supply of 500m XLPE armoured cables for stadium project.', 12.5, 1, GETDATE()),
(@Contact2, 'CAB-20260402-C3D4', 'Switchgear Maintenance', 'Bi-annual maintenance for main distribution board.', 8.2, 2, GETDATE()),
(@Contact3, 'CAB-20260403-E5F6', 'Control Panel Fabrication', 'Custom control panel for HVAC automation system.', 5.8, 3, GETDATE()),
(@Contact4, 'CAB-20260404-G7H8', 'Lighting Upgrade Phase 2', 'LED retrofit for 200 units in office tower.', 16.4, 4, GETDATE()),
(@Contact5, 'CAB-20260405-I9J0', 'Emergency Generator Commissioning', 'Installation and testing of 500kVA generator.', 22.0, 5, GETDATE()),
(@Contact1, 'CAB-20260406-K1L1', 'Substation Civil Works', 'Foundation work for new 11kV substation.', 18.7, 6, GETDATE()),
(@Contact2, 'CAB-20260407-M2N2', 'Solar Panel Installation', 'Grid-tied solar PV system for residential complex.', 7.3, 8, GETDATE()),
(@Contact3, 'CAB-20260408-O3P3', 'Infrastructure Wiring', 'Underground cabling for smart city network.', 9.9, 9, GETDATE());
GO

-- Seed Stage History for these enquiries
INSERT INTO EnquiryStages (EnquiryId, StageId, StatusComments, UpdatedBy)
SELECT Id, CurrentStage, 'Auto-seeded for demonstration', 'System' FROM Enquiries;
GO
