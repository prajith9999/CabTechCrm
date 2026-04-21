# Step-by-Step Setup & Deployment Instructions

## 1. Local Development Setup

### Prerequisites
- .NET 8 SDK
- Node.js (v18+)
- SQL Server (LocalDB or Express)

### Database Configuration
1. Open your SQL Server Management Studio (SSMS).
2. Execute the `database_setup.sql` script located in the root directory.
3. This will create the `CabtechCrm` database and all necessary tables.

### Backend Setup
1. Navigate to `/CabtechCrm.Api`.
2. Open `appsettings.json` and update the `ConnectionStrings:DefaultConnection`.
3. Run `dotnet restore` then `dotnet run`.
4. The API will be available at `http://localhost:5101`.

### Frontend Setup
1. Navigate to `/CabtechCrm.Client`.
2. Create a `.env` file based on `.env.example`.
3. Run `npm install` then `npm run dev`.
4. Access the CRM at `http://localhost:5173`.

---

## 2. Render Deployment (Backend)

1. **GitHub**: Push the entire repository to GitHub.
2. **Render**: Connect your GitHub repo to Render.com.
3. **Service Type**: Select **Web Service**.
4. **Build Settings**:
   - Environment: `Docker`
   - Dockerfile Path: `Dockerfile`
5. **Environment Variables**:
   - `ASPNETCORE_ENVIRONMENT`: `Production`
   - `DB_PROVIDER`: `mssql`
   - `ConnectionStrings__DefaultConnection`: Your Azure SQL connection string.
   - `Auth__Jwt__Secret`: A secure random string.
   - `Auth__Jwt__Issuer`: `CabtechCrm`
   - `Auth__Jwt__Audience`: `CabtechCrmClient`
6. Render will build the image and deploy the API.

---

## 3. Firebase Deployment (Frontend)

1. **Build**: Run `npm run build` inside `/CabtechCrm.Client`.
2. **Setup Firebase CLI**: `npm install -g firebase-tools`.
3. **Login & Init**:
   - `firebase login`
   - `firebase init hosting`
   - Select your project.
   - Set public directory to `dist`.
   - Configure as a single-page app (Yes).
4. **Deploy**: `firebase deploy`.

---

## 📧 Support & Audit
- All technical issues submitted via **Help Desk** are tracked in the `HelpDeskTickets` table.
- All user actions (Logins, Deletions, Transitions) are logged in the `AuditLogs` table.
- Login with **DevAdmin** (`Cabtechdev`) to access the **Developer** tab for system monitoring.
