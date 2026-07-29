# Residential Management System

A web-based residential and apartment management system developed with React, ASP.NET Core and Microsoft SQL Server.

The project is being developed incrementally. Phase 1 validates the complete full-stack workflow between the frontend, backend and database.

## Technology Stack

### Frontend

- React
- TypeScript
- Vite
- ESLint

### Backend

- ASP.NET Core Web API
- .NET 10
- Entity Framework Core
- OpenAPI

### Database

- Microsoft SQL Server 2022
- Docker
- EF Core Migrations
- T-SQL scripts

## Current Phase

### Phase 1 — Full-Stack Prototype

The first phase includes:

- ASP.NET Core Web API setup
- SQL Server connection
- Entity Framework Core configuration
- Initial database migration
- Property entity and database table
- Property listing endpoint
- Property creation endpoint
- React property form
- React property list
- React to ASP.NET Core integration
- ASP.NET Core to SQL Server integration
- Basic responsive user interface

## Project Structure

```text
residential-management-system/
├── backend/
│   └── ResidentialManagement.Api/
├── database/
│   ├── 001_create_database.sql
│   └── queries/
│       └── verify_properties.sql
├── docs/
├── frontend/
├── .gitignore
└── README.md
```

## Prerequisites

The following tools are required:

- .NET SDK 10
- Node.js
- npm
- Docker
- Git

## Database Setup

The project uses Microsoft SQL Server 2022 running in Docker.

Create the application database by running:

```text
database/001_create_database.sql
```

The application database is:

```text
ApartmentManagementDb
```

The SQL Server connection string is stored with .NET User Secrets and is not committed to the repository.

Example connection string format:

```text
Server=localhost,1433;Database=ApartmentManagementDb;User Id=sa;Password=YOUR_PASSWORD;TrustServerCertificate=True;
```

Initialize .NET User Secrets:

```bash
dotnet user-secrets init \
  --project backend/ResidentialManagement.Api
```

Set the connection string:

```bash
dotnet user-secrets set \
  "ConnectionStrings:DefaultConnection" \
  "Server=localhost,1433;Database=ApartmentManagementDb;User Id=sa;Password=YOUR_PASSWORD;TrustServerCertificate=True;" \
  --project backend/ResidentialManagement.Api
```

## Apply Database Migrations

Apply the existing Entity Framework Core migrations:

```bash
dotnet ef database update \
  --project backend/ResidentialManagement.Api \
  --startup-project backend/ResidentialManagement.Api
```

This creates the application tables in `ApartmentManagementDb`.

## Run the Backend

From the repository root:

```bash
dotnet run --project backend/ResidentialManagement.Api
```

The backend runs locally at:

```text
http://localhost:5006
```

## Run the Frontend

Install frontend dependencies:

```bash
npm --prefix frontend install
```

Start the Vite development server:

```bash
npm --prefix frontend run dev
```

The frontend runs locally at:

```text
http://localhost:5173
```

## API Endpoints

### List Properties

```http
GET /api/properties
```

### Get Property by ID

```http
GET /api/properties/{id}
```

### Create Property

```http
POST /api/properties
```

Example request body:

```json
{
  "name": "Olbia Residence",
  "propertyType": "Residential Complex",
  "addressLine": "Atatürk Caddesi No: 10",
  "city": "İzmir",
  "district": "Konak",
  "description": "Example property"
}
```

## Verification

Run the following SQL script to inspect the property records:

```text
database/queries/verify_properties.sql
```

The script queries the `dbo.Properties` table in `ApartmentManagementDb`.

## Development Checks

Run the frontend linter:

```bash
npm --prefix frontend run lint
```

Build the frontend:

```bash
npm --prefix frontend run build
```

Build the backend:

```bash
dotnet build backend/ResidentialManagement.Api
```

## Development Workflow

Development is performed on feature branches.

The current Phase 1 branch is:

```text
feature/phase-1-fullstack-prototype
```

Completed feature branches are reviewed through Pull Requests before being merged into `main`.

## Planned Development

Upcoming phases will introduce:

- Controlled property type values
- Building, block and unit management
- Authentication and authorization
- Resident and occupancy management
- Financial operations
- Maintenance request management
- Advanced SQL Server features
- Testing
- Docker Compose
- CI/CD with GitHub Actions
