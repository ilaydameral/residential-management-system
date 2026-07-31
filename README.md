# Residential Management System

A web-based residential and apartment management system developed with React, ASP.NET Core and Microsoft SQL Server.

The project is being developed incrementally.

- **Phase 1**: Full-stack prototype validating React, ASP.NET Core Web API, and SQL Server connectivity.
- **Phase 2**: Service layer, DTO refactoring, standardized string lengths, and centralized exception handling middleware.
- **Phase 3**: Complete Property Structure Management (`PropertyType` & `UnitType` lookups, `Building` & `Unit` entities, composite unique indexes, database CHECK constraints, Turkey 81 city-district searchable selection, real-world business rules enforcement, and full React hierarchy UI).

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

## Current Status: Phase 3 Completed

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
│       ├── Controllers/
│       │   ├── BuildingsController.cs
│       │   ├── PropertiesController.cs
│       │   ├── PropertyTypesController.cs
│       │   ├── UnitsController.cs
│       │   └── UnitTypesController.cs
│       ├── Data/
│       │   └── AppDbContext.cs
│       ├── DTOs/
│       ├── Entities/
│       │   ├── Building.cs
│       │   ├── Property.cs
│       │   ├── PropertyType.cs
│       │   ├── Unit.cs
│       │   └── UnitType.cs
│       ├── Middleware/
│       │   └── ExceptionHandlingMiddleware.cs
│       ├── Migrations/
│       └── Services/
├── database/
│   ├── 001_create_database.sql
│   └── queries/
│       ├── migrate_property_type_data.sql
│       ├── verify_buildings.sql
│       ├── verify_properties.sql
│       ├── verify_property_types.sql
│       ├── verify_unit_types.sql
│       └── verify_units.sql
├── frontend/
│   ├── src/
│   │   ├── api.ts
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   └── SearchableSelect.tsx
│   │   ├── config.ts
│   │   ├── data/
│   │   │   └── turkeyLocations.ts
│   │   ├── index.css
│   │   └── types.ts
└── README.md
```

---

## Database Setup & Migrations

The application database is `ApartmentManagementDb` running in Microsoft SQL Server 2022.

### Apply Migrations

To apply all EF Core migrations up to `AddUnits`:

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
```

---

## API Endpoints

### Property Types API
- `GET /api/property-types`
- `GET /api/property-types/{id}`
- `POST /api/property-types`
- `PUT /api/property-types/{id}`
- `DELETE /api/property-types/{id}`

### Unit Types API
- `GET /api/unit-types`
- `GET /api/unit-types/{id}`
- `POST /api/unit-types`
- `PUT /api/unit-types/{id}`
- `DELETE /api/unit-types/{id}`

### Properties API
- `GET /api/properties` (`?includeInactive=false`)
- `GET /api/properties/{id}`
- `POST /api/properties`
- `PUT /api/properties/{id}`
- `DELETE /api/properties/{id}`

### Buildings API
- `GET /api/buildings` (`?includeInactive=false`)
- `GET /api/buildings/{id}`
- `GET /api/buildings/property/{propertyId}`
- `POST /api/buildings`
- `PUT /api/buildings/{id}`
- `DELETE /api/buildings/{id}`

### Units API
- `GET /api/units` (`?includeInactive=false`)
- `GET /api/units/{id}`
- `GET /api/units/building/{buildingId}`
- `GET /api/units/property/{propertyId}`
- `POST /api/units`
- `PUT /api/units/{id}`
- `DELETE /api/units/{id}`

---

## How to Run Locally

### 1. Run Backend (.NET API)

```bash
dotnet run --project backend/ResidentialManagement.Api
```
Runs at `http://localhost:5006`.

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
