# Residential Management System

A web-based residential and apartment management system developed with React, ASP.NET Core and Microsoft SQL Server.

The project is being developed incrementally.

- **Phase 1**: Full-stack prototype validating React, ASP.NET Core Web API, and SQL Server connectivity.
- **Phase 2**: Service layer, DTO refactoring, standardized string lengths, and centralized exception handling middleware.
- **Phase 3**: Complete Property Structure Management (`PropertyType` & `UnitType` lookups, `Building` & `Unit` entities, composite unique indexes, database CHECK constraints, Turkey 81 city-district searchable selection, real-world business rules enforcement, and full React hierarchy UI).
- **Phase 4**: Authentication & Authorization infrastructure (`User`, `Role`, `UserRole` data model, PBKDF2 password hashing, JWT access tokens, login API endpoint, role-based authorization rules, React AuthContext, Login screen, role-based UI rendering, development bootstrap admin initializer, and SQL support scripts).

---

## Technology Stack

### Frontend
- React 19
- TypeScript
- Vite
- Vanilla CSS (Glassmorphism & modern design tokens)

### Backend
- ASP.NET Core Web API (.NET 10)
- Entity Framework Core 10
- Centralized `ExceptionHandlingMiddleware`
- OpenAPI

### Database
- Microsoft SQL Server 2022 (Docker)
- EF Core Migrations
- T-SQL verification scripts & check constraints

---

## Current Status: Phase 4 In Progress

### Phase 4 — Authentication & Authorization Infrastructure

Phase 4 introduces identity, role-based access control (RBAC), and authentication:

1. **User, Role, and UserRole Data Model**:
   - `User`, `Role`, and `UserRole` entities configured via EF Core Fluent API.
   - Unique constraints on `UserName`, `Email`, and `Role.Code`.
   - Composite primary key on `UserRole` (`UserId`, `RoleId`) with `Cascade` delete behavior.
   - Seeded system roles: `ADMIN` (Administrator), `MANAGER` (Property Manager), `USER` (Standard User).
   - Passwords stored strictly as `PasswordHash`.
   - T-SQL verification scripts (`verify_auth_schema.sql`, `auth_user_role_queries.sql`).

2. **JWT Authentication & Password Hashing**:
   - Framework `PasswordHasher<User>` wrapper (`IPasswordService`) utilizing PBKDF2 password hashing. Passwords stored strictly as hashes; plain-text passwords never logged or persisted.
   - JWT Access Token generation (`IJwtTokenService`) including `sub`, `unique_name`, `email`, `given_name`, `family_name`, and `role` claims.
   - Login API endpoint (`POST /api/auth/login`) returning `LoginResponseDto` with generic invalid credential response (`401 Unauthorized`) and inactive user check (`403 Forbidden`).
   - Development-only `AdminInitializer` bootstrapping initial `ADMIN` user safely via `user-secrets` or environment variables without hardcoded passwords. Production secrets must use environment variables or secret manager.
   - T-SQL support queries (`auth_login_support_queries.sql`).

3. **Role-Based Authorization (RBAC)**:
   - Endpoint protection via `[Authorize]` attributes and `AppRoles` constants (`ADMIN`, `MANAGER`, `USER`).
   - `ADMIN`: Full CRUD access across all business endpoints and lookup tables.
   - `MANAGER`: Operational create and update access (`Properties`, `Buildings`, `Units`), read-only lookup access (`PropertyTypes`, `UnitTypes`), no delete permissions.
   - `USER`: Read-only access across all endpoints (`GET` only); write or delete attempts return `403 Forbidden`.
   - `POST /api/auth/login` is explicitly marked `[AllowAnonymous]`; unauthenticated requests to protected endpoints return `401 Unauthorized`.
   - Swagger / OpenAPI document transformer configured to support JWT Bearer token authorization UI.

4. **Frontend Auth State & Role-Based UI**:
   - `AuthContext` and `useAuth` hook managing authentication state, token persistence (`localStorage`), and session restoration.
   - Modern Glassmorphism Login screen displaying generic backend error messages for invalid credentials (`401`) and inactive user accounts (`403`).
   - Automatic `Authorization: Bearer <token>` header attached to all protected API calls.
   - Header User Bar displaying authenticated user's name, role badges, and Logout button.
   - Role-Based UI rendering:
     - `ADMIN`: Sees all create, edit, and delete forms and buttons.
     - `MANAGER`: Sees operational create and edit forms for Properties, Buildings, and Units; delete buttons and lookup creation forms are hidden.
     - `USER`: Sees read-only lists and details; all creation/edit/delete forms, buttons, and `SINGLE_APARTMENT` setup prompts are hidden.
   - `401` responses trigger session cleanup and transition to Login screen with "Oturumunuz sona erdi. Lütfen tekrar giriş yapın." notice; `403` responses display inline permission error messages without clearing the session.
   - Backend API remains the final authorization authority.

---

### Phase 3 — Property Structure Management

Phase 3 introduces complete physical structure modeling for complex residential sites, single apartment blocks, and commercial/mixed-use properties:

1. **PropertyTypes Lookup Module**:
   - Dynamic lookup table for property types (`RESIDENTIAL_COMPLEX`, `SINGLE_APARTMENT`, `COMMERCIAL`, `MIXED_USE`).
   - T-SQL migration transferring legacy string data to `PropertyTypeId` foreign key with `DeleteBehavior.Restrict`.
   - Dedicated service layer and `PropertyTypesController` API.

2. **UnitTypes Lookup Module**:
   - Normalized lookup table for unit types (`APARTMENT`, `SHOP`, `OFFICE`, `STORAGE`, `PARKING_SPACE`).
   - Seed data scaffolded via migration.
   - Dedicated service layer and `UnitTypesController` API.

3. **Building Entity & Relationships**:
   - One-to-many relationship: `Property` $\rightarrow$ `Building` (`DeleteBehavior.Restrict`).
   - Composite unique index `IX_Buildings_PropertyId_Code` on `(PropertyId, Code)`.
   - SQL Server Check Constraint: `CK_Buildings_FloorCount_Range` (`[FloorCount] >= 1 AND [FloorCount] <= 200`).
   - Code normalization (`" a - blok "` $\rightarrow$ `"A_BLOK"`).

4. **Unit Entity & Relationships**:
   - One-to-many relationships: `Building` $\rightarrow$ `Unit` and `UnitType` $\rightarrow$ `Unit` (`DeleteBehavior.Restrict`).
   - Composite unique index `IX_Units_BuildingId_UnitNumber` on `(BuildingId, UnitNumber)`.
   - SQL Server Check Constraints:
     - `CK_Units_GrossArea_Positive`: `[GrossArea] IS NULL OR [GrossArea] > 0`
     - `CK_Units_NetArea_Positive`: `[NetArea] IS NULL OR [NetArea] > 0`
     - `CK_Units_NetArea_NotGreaterThanGrossArea`: `[GrossArea] IS NULL OR [NetArea] IS NULL OR [NetArea] <= [GrossArea]`
   - Precision types: `decimal(10,2)` for `GrossArea` and `NetArea`.
   - Support for negative `FloorNumber` values (basements/parking floors) and `FloorNumber = 0` for Ground Floor (Zemin Kat).

5. **React Frontend Integration**:
   - Hierarchical management flow: **Property $\rightarrow$ Building $\rightarrow$ Unit**.
   - Dynamic lookup dropdowns for `PropertyType` and `UnitType`.
   - Client-side validation (`NetArea <= GrossArea`, range checks).
   - Unified API client (`api.ts`) displaying backend 404/409/400 error messages.
   - Responsive breadcrumb selection and card management.

6. **Turkey City–District Searchable Selection**:
   - Self-contained local data source (`turkeyLocations.ts`) containing all 81 provinces of Turkey and their corresponding districts.
   - Reusable `SearchableSelect.tsx` component supporting keyboard navigation (Arrow keys, Enter, Escape) and click-outside dismissal.
   - Turkish case-insensitive and diacritic-insensitive search normalization (`normalizeTurkishText`: e.g., `"izmir"` $\rightarrow$ `"İzmir"`, `"canakkale"` $\rightarrow$ `"Çanakkale"`).
   - Dependent district filtering: district selection is disabled until a city is selected, and choices automatically filter based on the selected city.

7. **Real-World Business Rules & Enforcements**:
   - **Single Apartment Rule (`SINGLE_APARTMENT`)**: A property of type `SINGLE_APARTMENT` can contain at most one building. Additional building creation is blocked in `BuildingService` with HTTP 409 Conflict. In frontend, block CRUD UI is hidden and replaced with explicit "Apartman Yapısını Hazırla" setup prompt asking for actual `FloorCount`.
   - **Parent–Child Deletion Protection**: Deleting a `Property` with buildings, a `Building` with units, a `UnitType` in use, or a `PropertyType` in use is blocked in the service layer returning clean HTTP 409 Conflict messages.
   - **PropertyType Conversion Safety**: Changing `PropertyTypeId` on a property with existing buildings or units is blocked (HTTP 409 Conflict).
   - **Building Relocation Safety**: Relocating a building with existing units to another property or moving to a passive/single-apartment property is blocked.
   - **Floor Elevation Consistency**: `FloorNumber` cannot exceed `Building.FloorCount`. Negative numbers are supported for basement levels (`-1`, `-2`), and `FloorNumber = 0` represents the Ground Floor (Zemin Kat).

---

## Project Structure

```text
residential-management-system/
├── backend/
│   └── ResidentialManagement.Api/
│       ├── Authorization/
│       │   └── AppRoles.cs
│       ├── Controllers/
│       │   ├── AuthController.cs
│       │   ├── BuildingsController.cs
│       │   ├── PropertiesController.cs
│       │   ├── PropertyTypesController.cs
│       │   ├── UnitsController.cs
│       │   └── UnitTypesController.cs
│       ├── Data/
│       │   └── AppDbContext.cs
│       ├── DTOs/
│       │   ├── AuthenticatedUserDto.cs
│       │   ├── LoginRequestDto.cs
│       │   └── LoginResponseDto.cs
│       ├── Entities/
│       │   ├── Role.cs
│       │   ├── User.cs
│       │   └── UserRole.cs
│       ├── Exceptions/
│       │   ├── ForbiddenException.cs
│       │   └── UnauthorizedException.cs
│       ├── Middleware/
│       │   └── ExceptionHandlingMiddleware.cs
│       ├── Services/
│       │   ├── AdminInitializer.cs
│       │   ├── AuthService.cs
│       │   ├── IAuthService.cs
│       │   ├── IJwtTokenService.cs
│       │   ├── IPasswordService.cs
│       │   ├── JwtTokenService.cs
│       │   └── PasswordService.cs
├── database/
│   └── queries/
│       ├── auth_login_support_queries.sql
│       ├── auth_user_role_queries.sql
│       └── verify_auth_schema.sql
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.tsx
│   │   │   └── SearchableSelect.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── App.tsx
│   │   ├── api.ts
│   │   ├── main.tsx
│   │   └── types.ts
└── README.md
```

---

## Database Setup & Migrations

The application database is `ApartmentManagementDb` running in Microsoft SQL Server 2022.

### Apply Migrations

To apply all EF Core migrations:

```bash
dotnet ef database update \
  --project backend/ResidentialManagement.Api \
  --startup-project backend/ResidentialManagement.Api
```

### Migration History

```text
1. 20260729110442_InitialCreate
2. 20260730074710_AddPropertyColumnLengths
3. 20260730085815_AddPropertyTypesTable
4. 20260730110407_MigratePropertyTypeData
5. 20260730133921_AddUnitTypesLookup
6. 20260730200204_AddBuildings
7. 20260730205710_AddUnits
8. 20260731064656_AddAuthenticationEntities
```

---

## API Endpoints

### Auth API (Anonymous)
- `POST /api/auth/login`
- `POST /api/auth/register`


### Property Types API (Auth Required)
- `GET /api/property-types` (`ADMIN`, `MANAGER`, `USER`)
- `GET /api/property-types/{id}` (`ADMIN`, `MANAGER`, `USER`)
- `POST /api/property-types` (`ADMIN`)
- `PUT /api/property-types/{id}` (`ADMIN`)
- `DELETE /api/property-types/{id}` (`ADMIN`)

### Unit Types API (Auth Required)
- `GET /api/unit-types` (`ADMIN`, `MANAGER`, `USER`)
- `GET /api/unit-types/{id}` (`ADMIN`, `MANAGER`, `USER`)
- `POST /api/unit-types` (`ADMIN`)
- `PUT /api/unit-types/{id}` (`ADMIN`)
- `DELETE /api/unit-types/{id}` (`ADMIN`)

### Properties API (Auth Required)
- `GET /api/properties` (`ADMIN`, `MANAGER`, `USER`)
- `GET /api/properties/{id}` (`ADMIN`, `MANAGER`, `USER`)
- `POST /api/properties` (`ADMIN`, `MANAGER`)
- `PUT /api/properties/{id}` (`ADMIN`, `MANAGER`)
- `DELETE /api/properties/{id}` (`ADMIN`)

### Buildings API (Auth Required)
- `GET /api/buildings` (`ADMIN`, `MANAGER`, `USER`)
- `GET /api/buildings/{id}` (`ADMIN`, `MANAGER`, `USER`)
- `GET /api/buildings/property/{propertyId}` (`ADMIN`, `MANAGER`, `USER`)
- `POST /api/buildings` (`ADMIN`, `MANAGER`)
- `PUT /api/buildings/{id}` (`ADMIN`, `MANAGER`)
- `DELETE /api/buildings/{id}` (`ADMIN`)

### Units API (Auth Required)
- `GET /api/units` (`ADMIN`, `MANAGER`, `USER`)
- `GET /api/units/{id}` (`ADMIN`, `MANAGER`, `USER`)
- `GET /api/units/building/{buildingId}` (`ADMIN`, `MANAGER`, `USER`)
- `GET /api/units/property/{propertyId}` (`ADMIN`, `MANAGER`, `USER`)
- `POST /api/units` (`ADMIN`, `MANAGER`)
- `PUT /api/units/{id}` (`ADMIN`, `MANAGER`)
- `DELETE /api/units/{id}` (`ADMIN`)

---

## How to Run Locally

### 1. Run Backend (.NET API)

```bash
dotnet run --project backend/ResidentialManagement.Api
```
Runs at `http://localhost:5006`.

### Local Development User-Secrets Setup

Configure JWT signing key and development bootstrap admin credentials locally using .NET User Secrets:

```bash
# Set JWT signing key (minimum 32 characters)
dotnet user-secrets set "Jwt:Key" "<minimum-32-character-development-secret>" --project backend/ResidentialManagement.Api

# Set development bootstrap admin account credentials
dotnet user-secrets set "BootstrapAdmin:UserName" "admin" --project backend/ResidentialManagement.Api
dotnet user-secrets set "BootstrapAdmin:Email" "admin@example.com" --project backend/ResidentialManagement.Api
dotnet user-secrets set "BootstrapAdmin:Password" "<secure-admin-password>" --project backend/ResidentialManagement.Api
```

### 2. Run Frontend (React + Vite)

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```
Runs at `http://localhost:5173`.

---

## Verification & Checks

### SQL Verification Scripts

Execute T-SQL read-only verification scripts under `database/queries/`:

- `auth_login_support_queries.sql`
- `verify_auth_schema.sql`
- `auth_user_role_queries.sql`
- `verify_properties.sql`
- `verify_property_types.sql`
- `verify_unit_types.sql`
- `verify_buildings.sql`
- `verify_units.sql`

### Build Checks

```bash
# Backend build
dotnet build backend/ResidentialManagement.Api

# Frontend build
npm --prefix frontend run build

# Git formatting check
git diff --check
```
