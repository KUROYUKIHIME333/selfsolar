-- 1. Extensions nécessaires &  ENUMs (Évolutifs)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE service_type AS ENUM ('PV', 'GE', 'IRVE', 'BT', 'BATT');
CREATE TYPE plan_type AS ENUM ('FREE', 'STANDARD', 'PRO');
CREATE TYPE jobs_status AS ENUM ('PENDING...', 'PROCESSING...', 'COMPLETED', 'FAILED')

-- 2. Profil utilisateur (Étendu depuis auth.users si on utilise supabase)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    profile_picture TEXT,
    username TEXT,
    company_name TEXT,
    email TEXT UNIQUE NOT NULL,
    is_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptiion_plan(
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan plan_type DEFAULT 'FREE',
    price NUMERIC(10,3) NOT NULL DEFAULT 0,
    profile_icon TEXT,
    description TEXT,
    is_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Abonnements (Gestion Freemium)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    plan_subscriptions UUID NOT NULL REFERENCES subscriptiion_plan(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    is_delete BOOLEAN DEFAULT false,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. File d'attente (Gestion asynchrone des calculs)
CREATE TABLE jobs_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status jobs_status DEFAULT 'PENDING...',
    result_id UUID,
    error_message TEXT,
    is_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Projets
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    profile_icon TEXT,
    description TEXT,
    service_type service_type NOT NULL,
    is_free BOOLEAN DEFAULT true,
    is_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Calculs (Payload technique flexible)
CREATE TABLE calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version TEXT NOT NULL DEFAULT '1.0.0',
    input_params JSONB NOT NULL,
    output_results JSONB NOT NULL,
    is_delete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Index pour la performance
CREATE INDEX idx_jobs_pending ON jobs_queue(status) WHERE status = 'PENDING...';
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_calculations_project_id ON calculations(project_id);
CREATE INDEX idx_calculations_inputs ON calculations USING GIN (input_params);

-- 8. Triggers pour mise à jour automatique des champs 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


CREATE TRIGGER update_jobs_queue_updated_at
    BEFORE UPDATE ON jobs_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_calculations_updated_at
    BEFORE UPDATE ON calculations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();