# Cabtech CRM - Production Architecture

Modern, secure, and role-based CRM for managing enquiries, Shopify orders, and technical support.

## 📁 Folder Structure
```text
/
├── CabtechCrm.Api/        # .NET 8 Web API
│   ├── Controllers/       # JWT protected controllers (Roles: Admin, DevAdmin)
│   ├── Middleware/        # Global exception & logging middleware
│   ├── Models/            # DTOs and Data Models (Dapper)
│   ├── Repositories/      # Data access layer (MSSQL / Azure SQL)
│   └── Services/          # Background workers (Email, Sync)
├── CabtechCrm.Client/     # React (Vite) Frontend
│   ├── src/
│   │   ├── components/    # Modular UI components (HelpDesk, DevView, etc.)
│   │   └── App.jsx        # Main application logic & route guards
│   ├── firebase.json      # Firebase hosting config
│   └── .env.example       # Frontend environment template
├── Dockerfile             # Container definition for Backend deployment
├── render.yaml            # Render.com deployment blueprint
├── database_setup.sql     # Consolidated MSSQL database schema
└── README.md              # Project overview
```

## 🔐 Credentials (Production)
- **DevAdmin**: `Cabtechdev`
- **Password**: `PrajithCabtech3031@`
- **Admin**: `CabtechTrack`
- **Password**: `CabtechDohaQatar111!@#`

## 🚀 Quick Start
1. **Database**: Run `database_setup.sql` on your MSSQL/Azure SQL instance.
2. **Backend**: Update `appsettings.json` or set `ConnectionStrings__DefaultConnection` environment variable.
3. **Frontend**: Set `VITE_API_BASE_URL` in `.env` and run `npm install && npm run dev`.

For detailed setup, see [setup_instructions.md](./setup_instructions.md).
