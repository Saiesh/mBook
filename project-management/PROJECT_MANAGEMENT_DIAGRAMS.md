# Project Management Module - Visual Diagrams

This document contains visual diagrams for the Project Management module using Mermaid syntax.

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : creates
    USERS ||--o{ PROJECT_TEAM_MEMBERS : "assigned to"
    PROJECTS ||--o{ PROJECT_TEAM_MEMBERS : has
    PROJECTS ||--o{ AREAS : contains
    AREAS ||--o{ AREAS : "parent of"
    USERS ||--o{ AUDIT_LOGS : performs
    
    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar phone
        enum role
        boolean is_active
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
    }
    
    PROJECTS {
        uuid id PK
        varchar name
        varchar code UK
        varchar client_name
        varchar location_city
        varchar location_state
        text location_address
        date start_date
        date end_date
        enum status
        text description
        decimal budget
        uuid created_by FK
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    
    PROJECT_TEAM_MEMBERS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        enum role
        timestamp assigned_at
        timestamp removed_at
        boolean is_active
    }
    
    AREAS {
        uuid id PK
        uuid project_id FK
        varchar code
        varchar name
        text description
        uuid parent_area_id FK
        int level
        int sort_order
        boolean is_active
        timestamp created_at
        timestamp updated_at
        timestamp deleted_at
    }
    
    AUDIT_LOGS {
        uuid id PK
        varchar entity_type
        uuid entity_id
        enum action
        uuid user_id FK
        jsonb changes_before
        jsonb changes_after
        timestamp timestamp
        inet ip_address
        text user_agent
    }
```

---

## 2. System Architecture Diagram

```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Browser<br/>React + Material-UI]
    end
    
    subgraph "API Gateway Layer"
        GATEWAY[API Gateway<br/>Express.js / FastAPI<br/>Port 3000/8000]
    end
    
    subgraph "Middleware Layer"
        AUTH[Authentication<br/>JWT Verification]
        AUTHZ[Authorization<br/>RBAC]
        VALID[Validation<br/>Request Schema]
        ERROR[Error Handler]
        AUDIT[Audit Logger]
    end
    
    subgraph "Controller Layer"
        PC[ProjectController]
        AC[AreaController]
        TC[TeamController]
    end
    
    subgraph "Service Layer"
        PS[ProjectService<br/>Business Logic]
        AS[AreaService<br/>Business Logic]
        ALS[AuditLogService]
        VS[ValidationService]
    end
    
    subgraph "Repository Layer"
        PR[ProjectRepository<br/>Data Access]
        AR[AreaRepository<br/>Data Access]
        TR[TeamRepository<br/>Data Access]
        ALR[AuditLogRepository]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL 14+<br/>Database)]
        CACHE[(Redis Cache<br/>Optional)]
    end
    
    WEB -->|HTTPS| GATEWAY
    GATEWAY --> AUTH
    AUTH --> AUTHZ
    AUTHZ --> VALID
    VALID --> PC
    VALID --> AC
    VALID --> TC
    
    PC --> PS
    AC --> AS
    TC --> PS
    
    PS --> PR
    PS --> TR
    PS --> ALS
    AS --> AR
    AS --> ALS
    
    PR --> DB
    AR --> DB
    TR --> DB
    ALR --> DB
    
    PS -.->|Optional| CACHE
    AS -.->|Optional| CACHE
    
    ERROR -.-> WEB
    AUDIT --> ALR
```

---

## 3. Project Creation Flow

```mermaid
sequenceDiagram
    actor User as HO QS
    participant UI as React UI
    participant API as API Gateway
    participant Auth as Auth Middleware
    participant PC as ProjectController
    participant PS as ProjectService
    participant PR as ProjectRepository
    participant TR as TeamRepository
    participant DB as PostgreSQL
    participant AL as AuditLog
    
    User->>UI: Fill project form
    User->>UI: Click "Create Project"
    UI->>API: POST /api/v1/projects
    Note over UI,API: {name, code, client, team}
    
    API->>Auth: Verify JWT token
    Auth->>API: ✓ Authenticated
    
    API->>PC: createProject(data)
    PC->>PS: createProject(data, userId)
    
    PS->>PS: Validate input
    Note over PS: Check code format,<br/>date range, etc.
    
    PS->>PR: exists(code)
    PR->>DB: SELECT FROM projects<br/>WHERE code = ?
    DB-->>PR: No rows
    PR-->>PS: false
    
    PS->>PR: create(project)
    PR->>DB: INSERT INTO projects
    DB-->>PR: Project created
    PR-->>PS: project
    
    loop For each team member
        PS->>TR: addMember(projectId, userId, role)
        TR->>DB: INSERT INTO project_team_members
        DB-->>TR: Member added
        TR-->>PS: teamMember
    end
    
    PS->>AL: log(create, project)
    AL->>DB: INSERT INTO audit_logs
    
    PS-->>PC: project
    PC-->>API: 201 Created + project
    API-->>UI: Project data
    UI->>User: Success notification
    UI->>UI: Redirect to project details
```

---

## 4. Area Hierarchy Building

```mermaid
graph TD
    A[Get Area Hierarchy] --> B[Fetch all areas for project]
    B --> C{Has areas?}
    C -->|No| D[Return empty array]
    C -->|Yes| E[Create area map]
    
    E --> F[Initialize root areas array]
    
    F --> G[Loop through all areas]
    G --> H{Has parent?}
    H -->|No| I[Add to root array]
    H -->|Yes| J[Find parent in map]
    J --> K[Add to parent.children]
    
    K --> G
    I --> G
    
    G --> L{More areas?}
    L -->|Yes| G
    L -->|No| M[Sort by sort_order]
    
    M --> N[Sort children recursively]
    N --> O[Return hierarchy tree]
    
    style A fill:#e1f5ff
    style O fill:#c8e6c9
    style D fill:#ffecb3
```

---

## 5. Authorization Flow

```mermaid
flowchart TD
    START([API Request]) --> AUTH{Authenticated?}
    AUTH -->|No| UNAUTH[401 Unauthorized]
    AUTH -->|Yes| ROLE{Get User Role}
    
    ROLE --> ADMIN{Is Admin?}
    ADMIN -->|Yes| ALLOW[Allow Access]
    ADMIN -->|No| MEMBER
    
    MEMBER{Is Project Member?}
    MEMBER -->|Yes| ACTION
    MEMBER -->|No| FORBID[403 Forbidden]
    
    ACTION{What Action?}
    ACTION -->|Read| ALLOW
    ACTION -->|Create/Update| HOQS
    ACTION -->|Delete| FORBID
    
    HOQS{Is HO QS?}
    HOQS -->|Yes| ALLOW
    HOQS -->|No| FORBID
    
    ALLOW --> SUCCESS[Process Request]
    SUCCESS --> AUDIT[Log to Audit]
    AUDIT --> END([Return Response])
    
    UNAUTH --> END
    FORBID --> END
    
    style START fill:#e3f2fd
    style ALLOW fill:#c8e6c9
    style SUCCESS fill:#a5d6a7
    style UNAUTH fill:#ffcdd2
    style FORBID fill:#ffcdd2
    style END fill:#e1f5ff
```

---

## 6. Database Schema Relationships

```mermaid
erDiagram
    USERS {
        uuid id
        varchar email
        enum role
    }
    
    PROJECTS {
        uuid id
        varchar code
        varchar name
        enum status
        uuid created_by
    }
    
    AREAS {
        uuid id
        uuid project_id
        uuid parent_area_id
        int level
        int sort_order
    }
    
    PROJECT_TEAM_MEMBERS {
        uuid id
        uuid project_id
        uuid user_id
        enum role
    }
    
    USERS ||--o{ PROJECTS : "1:N (creates)"
    PROJECTS ||--o{ AREAS : "1:N (contains)"
    AREAS ||--o{ AREAS : "1:N (parent-child)"
    PROJECTS ||--o{ PROJECT_TEAM_MEMBERS : "1:N"
    USERS ||--o{ PROJECT_TEAM_MEMBERS : "1:N"
```

---

## 7. Project Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> Active: Create Project
    
    Active --> OnHold: Pause Project
    OnHold --> Active: Resume Project
    
    Active --> Completed: Mark Complete
    OnHold --> Completed: Mark Complete
    
    Active --> Cancelled: Cancel Project
    OnHold --> Cancelled: Cancel Project
    
    Completed --> [*]
    Cancelled --> [*]
    
    note right of Active
        Most measurements and bills
        are created in this state
    end note
    
    note right of Completed
        Read-only state
        Cannot add measurements
    end note
```

---

## 8. Area Hierarchy Example

```mermaid
graph TD
    P[Project: Sattva City]
    
    P --> Z1[Zone 1: Marketing Office<br/>Level 1, Sort: 0]
    P --> Z2[Zone 2: Block A<br/>Level 1, Sort: 1]
    P --> Z3[Zone 3: Common Areas<br/>Level 1, Sort: 2]
    
    Z1 --> A1[Area: Entrance<br/>Level 2, Sort: 0]
    Z1 --> A2[Area: Parking<br/>Level 2, Sort: 1]
    Z1 --> A3[Area: Driveway<br/>Level 2, Sort: 2]
    
    Z2 --> A4[Area: Floor 1<br/>Level 2, Sort: 0]
    Z2 --> A5[Area: Floor 2<br/>Level 2, Sort: 1]
    
    Z3 --> A6[Area: Lobby<br/>Level 2, Sort: 0]
    Z3 --> A7[Area: Corridor<br/>Level 2, Sort: 1]
    
    style P fill:#1976d2,color:#fff
    style Z1 fill:#4caf50,color:#fff
    style Z2 fill:#4caf50,color:#fff
    style Z3 fill:#4caf50,color:#fff
    style A1 fill:#81c784
    style A2 fill:#81c784
    style A3 fill:#81c784
    style A4 fill:#81c784
    style A5 fill:#81c784
    style A6 fill:#81c784
    style A7 fill:#81c784
```

---

## 9. API Request/Response Flow

```mermaid
sequenceDiagram
    participant Client
    participant Gateway
    participant Auth
    participant Controller
    participant Service
    participant Repository
    participant Database
    
    Client->>Gateway: HTTP Request
    Note over Client,Gateway: Headers: Authorization
    
    Gateway->>Auth: Verify Token
    Auth->>Auth: Decode JWT
    Auth->>Auth: Check Expiry
    Auth-->>Gateway: User Context
    
    Gateway->>Controller: Handle Request
    Controller->>Controller: Validate Request
    
    Controller->>Service: Call Business Logic
    Service->>Service: Authorize Action
    Service->>Service: Apply Business Rules
    
    Service->>Repository: Data Operation
    Repository->>Database: SQL Query
    Database-->>Repository: Result Set
    Repository-->>Service: Domain Objects
    
    Service->>Service: Transform Data
    Service-->>Controller: Response DTO
    
    Controller->>Controller: Format Response
    Controller-->>Gateway: HTTP Response
    Gateway-->>Client: JSON Response
```

---

## 10. Frontend Component Hierarchy

```mermaid
graph TD
    APP[App Component]
    
    APP --> LAYOUT[Layout]
    LAYOUT --> NAV[Navigation]
    LAYOUT --> MAIN[Main Content]
    
    MAIN --> PROJECTS[Projects Module]
    MAIN --> AREAS[Areas Module]
    
    PROJECTS --> PROJ_LIST[ProjectList]
    PROJECTS --> PROJ_DETAILS[ProjectDetails]
    PROJECTS --> PROJ_FORM[ProjectForm]
    
    PROJ_LIST --> PROJ_TABLE[DataGrid]
    PROJ_LIST --> PROJ_FILTERS[FilterBar]
    PROJ_LIST --> PROJ_SEARCH[SearchBox]
    
    PROJ_DETAILS --> PROJ_INFO[ProjectInfo]
    PROJ_DETAILS --> TEAM_LIST[TeamMemberList]
    PROJ_DETAILS --> AREA_TREE[AreaTree]
    PROJ_DETAILS --> STATS[ProjectStats]
    
    PROJ_FORM --> FORM_FIELDS[Form Fields]
    PROJ_FORM --> TEAM_SELECT[TeamMemberSelector]
    PROJ_FORM --> DATE_PICKER[DatePicker]
    
    AREAS --> AREA_MGMT[AreaManagement]
    AREA_MGMT --> TREE_VIEW[TreeView]
    AREA_MGMT --> AREA_FORM[AreaFormDialog]
    AREA_MGMT --> DND[Drag & Drop Handler]
    
    style APP fill:#1976d2,color:#fff
    style PROJECTS fill:#4caf50,color:#fff
    style AREAS fill:#4caf50,color:#fff
    style PROJ_LIST fill:#81c784
    style PROJ_DETAILS fill:#81c784
    style PROJ_FORM fill:#81c784
    style AREA_MGMT fill:#81c784
```

---

## 11. Test Coverage Strategy

```mermaid
graph LR
    subgraph "Unit Tests"
        UT1[Repository Tests<br/>CRUD Operations]
        UT2[Service Tests<br/>Business Logic]
        UT3[Validation Tests<br/>Input Rules]
    end
    
    subgraph "Integration Tests"
        IT1[API Tests<br/>Endpoints]
        IT2[Database Tests<br/>Queries]
        IT3[Auth Tests<br/>JWT & RBAC]
    end
    
    subgraph "E2E Tests"
        E2E1[User Flows<br/>Project Creation]
        E2E2[User Flows<br/>Area Management]
        E2E3[User Flows<br/>Team Management]
    end
    
    UT1 --> IT1
    UT2 --> IT1
    UT3 --> IT1
    
    IT1 --> E2E1
    IT2 --> E2E1
    IT3 --> E2E1
    
    E2E1 --> PROD[Production Ready]
    E2E2 --> PROD
    E2E3 --> PROD
    
    style UT1 fill:#e3f2fd
    style UT2 fill:#e3f2fd
    style UT3 fill:#e3f2fd
    style IT1 fill:#fff9c4
    style IT2 fill:#fff9c4
    style IT3 fill:#fff9c4
    style E2E1 fill:#c8e6c9
    style E2E2 fill:#c8e6c9
    style E2E3 fill:#c8e6c9
    style PROD fill:#4caf50,color:#fff
```

---

## 12. Deployment Pipeline

```mermaid
graph LR
    DEV[Developer]
    
    DEV -->|git push| REPO[GitHub<br/>Repository]
    
    REPO -->|webhook| CI[CI Pipeline<br/>GitHub Actions]
    
    CI --> LINT[Linting<br/>ESLint/Pylint]
    LINT --> BUILD[Build<br/>TypeScript/Python]
    BUILD --> UT[Unit Tests<br/>>80% Coverage]
    UT --> IT[Integration Tests<br/>With Test DB]
    IT --> E2E[E2E Tests<br/>Selenium/Cypress]
    
    E2E -->|Success| STAGING[Deploy to<br/>Staging]
    
    STAGING --> QA[QA Testing<br/>Manual Verification]
    
    QA -->|Approved| PROD[Deploy to<br/>Production]
    
    PROD --> MONITOR[Monitoring<br/>Logs & Metrics]
    
    E2E -->|Failure| NOTIFY[Notify Team<br/>Slack/Email]
    QA -->|Rejected| NOTIFY
    
    style DEV fill:#e3f2fd
    style CI fill:#fff9c4
    style STAGING fill:#ffecb3
    style PROD fill:#c8e6c9
    style NOTIFY fill:#ffcdd2
```

---

## How to View These Diagrams

### Option 1: GitHub (Automatic Rendering)
GitHub automatically renders Mermaid diagrams in Markdown files. Just view this file on GitHub.

### Option 2: VS Code
Install the "Markdown Preview Mermaid Support" extension.

### Option 3: Online Viewer
Copy the Mermaid code and paste it into: https://mermaid.live/

### Option 4: Documentation Site
If you're using Docusaurus, MkDocs, or similar, they support Mermaid natively.

---

## Diagram Legend

**Colors:**
- 🔵 Blue: Entry points, user-facing
- 🟢 Green: Success states, allowed actions
- 🟡 Yellow: Processing, intermediate states
- 🔴 Red: Error states, denied actions
- ⚪ White/Gray: Neutral, data entities

**Shapes:**
- Rectangle: Component, process
- Diamond: Decision point
- Circle: State, endpoint
- Cylinder: Database
- Cloud: External service

---

**Document Version:** 1.0  
**Last Updated:** February 15, 2026
