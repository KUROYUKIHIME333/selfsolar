create table
    "verification" (
        "id" text not null primary key,
        "identifier" text not null,
        "value" text not null,
        "expiresAt" timestamptz not null,
        "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
        "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
    );

create index "verification_identifier_idx" on "verification" ("identifier");