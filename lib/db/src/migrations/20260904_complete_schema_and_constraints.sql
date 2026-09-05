-- ============================================================
-- Migration: 20260904_complete_schema_and_constraints.sql
-- Description: Comprehensive database schema upgrade and constraints
-- Supports: Both public schema and all tenant schemas (prop_*)
-- ============================================================

DO $$
DECLARE
  schema_record RECORD;
BEGIN
  -- Iterate through 'public' and all tenant schemas registered in properties
  FOR schema_record IN 
    SELECT 'public' AS s_name
    UNION
    SELECT schema_name AS s_name FROM public.properties WHERE schema_name IS NOT NULL AND schema_name <> ''
  LOOP
    RAISE NOTICE '>>> Applying migrations to schema: %', schema_record.s_name;
    EXECUTE 'SET search_path TO ' || quote_ident(schema_record.s_name) || ', public';

    -- ========================================================
    -- 1. RESERVATIONS TABLE
    -- ========================================================
    CREATE TABLE IF NOT EXISTS reservations (
      id SERIAL PRIMARY KEY,
      room_id INTEGER,
      bed_number TEXT,
      room_type TEXT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      check_in_date TEXT NOT NULL,
      check_out_date TEXT,
      notes TEXT NOT NULL DEFAULT '',
      guest_id_card_number TEXT NOT NULL DEFAULT '',
      guest_phone TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'UPCOMING',
      nationality TEXT,
      gender TEXT,
      profile_code TEXT,
      level TEXT,
      employment_type TEXT NOT NULL DEFAULT 'INTERNAL',
      company_name TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE reservations
      ADD COLUMN IF NOT EXISTS bed_number TEXT,
      ADD COLUMN IF NOT EXISTS room_id INTEGER,
      ADD COLUMN IF NOT EXISTS room_type TEXT,
      ADD COLUMN IF NOT EXISTS profile_code TEXT,
      ADD COLUMN IF NOT EXISTS gender TEXT,
      ADD COLUMN IF NOT EXISTS nationality TEXT,
      ADD COLUMN IF NOT EXISTS level TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS guest_id_card_number TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS guest_phone TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS job_title TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS department TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'UPCOMING',
      ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'INTERNAL',
      ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS check_in_date TEXT,
      ADD COLUMN IF NOT EXISTS check_out_date TEXT;

    -- Clean reservations status before constraint
    UPDATE reservations 
      SET status = 'UPCOMING' 
      WHERE status IS NULL OR status = '' OR status NOT IN ('UPCOMING', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED');

    ALTER TABLE reservations DROP CONSTRAINT IF EXISTS chk_reservations_status;
    ALTER TABLE reservations ADD CONSTRAINT chk_reservations_status 
      CHECK (status IN ('UPCOMING', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW', 'COMPLETED'));

    CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON reservations(room_id);
    CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
    CREATE INDEX IF NOT EXISTS idx_reservations_check_in ON reservations(check_in_date);

    -- ========================================================
    -- 2. ASSIGNMENTS TABLE
    -- ========================================================
    CREATE TABLE IF NOT EXISTS assignments (
      id SERIAL PRIMARY KEY,
      profile_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      check_in_date TEXT NOT NULL,
      expected_check_out_date TEXT,
      actual_check_out_date TEXT,
      check_out_date TEXT,
      bed_number INTEGER,
      is_entire_room BOOLEAN NOT NULL DEFAULT false,
      contract_end_date TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS bed_number INTEGER,
      ADD COLUMN IF NOT EXISTS is_entire_room BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS check_out_date TEXT,
      ADD COLUMN IF NOT EXISTS contract_end_date TEXT,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE',
      ADD COLUMN IF NOT EXISTS notes TEXT;

    -- Clean assignments status before constraint
    UPDATE assignments 
      SET status = 'ACTIVE' 
      WHERE status IS NULL OR status = '' OR status NOT IN ('ACTIVE', 'COMPLETED', 'CANCELLED', 'TRANSFERRED', 'MOVED');

    ALTER TABLE assignments DROP CONSTRAINT IF EXISTS chk_assignments_status;
    ALTER TABLE assignments ADD CONSTRAINT chk_assignments_status 
      CHECK (status IN ('ACTIVE', 'CHECKED_OUT', 'COMPLETED', 'CANCELLED', 'TRANSFERRED', 'MOVED', 'LEFT'));

    CREATE INDEX IF NOT EXISTS idx_assignments_profile ON assignments(profile_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_room ON assignments(room_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

    -- ========================================================
    -- 3. ROOMS TABLE
    -- ========================================================
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      building_id INTEGER NOT NULL,
      floor_id INTEGER NOT NULL,
      room_number TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 1,
      current_occupancy INTEGER NOT NULL DEFAULT 0,
      room_type TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      classification TEXT,
      separator_door BOOLEAN NOT NULL DEFAULT false,
      bed_type TEXT,
      view TEXT,
      features TEXT,
      size TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE rooms
      ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 1,
      ADD COLUMN IF NOT EXISTS current_occupancy INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available',
      ADD COLUMN IF NOT EXISTS classification TEXT,
      ADD COLUMN IF NOT EXISTS separator_door BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS bed_type TEXT,
      ADD COLUMN IF NOT EXISTS view TEXT,
      ADD COLUMN IF NOT EXISTS features TEXT,
      ADD COLUMN IF NOT EXISTS size TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT;

    UPDATE rooms SET capacity = 1 WHERE capacity IS NULL OR capacity < 1;
    UPDATE rooms SET current_occupancy = 0 WHERE current_occupancy IS NULL OR current_occupancy < 0;
    UPDATE rooms SET status = 'available' 
      WHERE status IS NULL OR status = '' OR status NOT IN ('available', 'occupied', 'dirty', 'occupied_dirty', 'out_of_service', 'out_of_order');

    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS chk_rooms_capacity;
    ALTER TABLE rooms ADD CONSTRAINT chk_rooms_capacity CHECK (capacity >= 1);

    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS chk_rooms_occupancy;
    ALTER TABLE rooms ADD CONSTRAINT chk_rooms_occupancy CHECK (current_occupancy >= 0);

    ALTER TABLE rooms DROP CONSTRAINT IF EXISTS chk_rooms_status;
    ALTER TABLE rooms ADD CONSTRAINT chk_rooms_status 
      CHECK (status IN ('available', 'occupied', 'dirty', 'occupied_dirty', 'occupied_vacation', 'out_of_service', 'out_of_order'));

    CREATE INDEX IF NOT EXISTS idx_rooms_building ON rooms(building_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
    CREATE INDEX IF NOT EXISTS idx_rooms_number ON rooms(room_number);

    -- ========================================================
    -- 4. PROFILES TABLE
    -- ========================================================
    CREATE TABLE IF NOT EXISTS profiles (
      id SERIAL PRIMARY KEY,
      profile_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      third_name TEXT NOT NULL DEFAULT '',
      fourth_name TEXT NOT NULL DEFAULT '',
      national_id TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      emergency_contact TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      level TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT 'M',
      nationality TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'UNASSIGNED',
      employment_type TEXT NOT NULL DEFAULT 'INTERNAL',
      company_name TEXT DEFAULT '',
      contract_end_date TEXT,
      date_of_birth TEXT,
      hire_date TEXT,
      address TEXT,
      photo_url TEXT,
      id_documents JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'INTERNAL',
      ADD COLUMN IF NOT EXISTS company_name TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS contract_end_date TEXT,
      ADD COLUMN IF NOT EXISTS photo_url TEXT,
      ADD COLUMN IF NOT EXISTS id_image TEXT,
      ADD COLUMN IF NOT EXISTS id_documents JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS third_name TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS fourth_name TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS emergency_contact TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'UNASSIGNED',
      ADD COLUMN IF NOT EXISTS level TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'M',
      ADD COLUMN IF NOT EXISTS vacation_start_date TEXT,
      ADD COLUMN IF NOT EXISTS vacation_end_date TEXT,
      ADD COLUMN IF NOT EXISTS vacation_notes TEXT DEFAULT '';

    -- Clean profiles data before constraints
    UPDATE profiles SET gender = 'M' 
      WHERE gender IS NULL OR gender = '' OR lower(gender) IN ('m', 'male', 'ذكر');
    UPDATE profiles SET gender = 'F' 
      WHERE lower(gender) IN ('f', 'female', 'أنثى', 'انثى');
    UPDATE profiles SET gender = 'M' 
      WHERE gender NOT IN ('M', 'F');

    UPDATE profiles SET status = 'UNASSIGNED' 
      WHERE status IS NULL OR status = '' OR status NOT IN ('UNASSIGNED', 'IN_HOUSE', 'CHECKED_OUT', 'VACATION', 'ACTIVE', 'INACTIVE', 'TERMINATED', 'PENDING', 'LEFT');

    UPDATE profiles SET employment_type = 'INTERNAL' 
      WHERE employment_type IS NULL OR employment_type = '' OR employment_type NOT IN ('INTERNAL', 'THIRD_PARTY', 'CONTRACTOR', 'GUEST', 'TEMPORARY');

    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_status;
    ALTER TABLE profiles ADD CONSTRAINT chk_profiles_status 
      CHECK (status IN ('UNASSIGNED', 'IN_HOUSE', 'CHECKED_OUT', 'VACATION', 'ACTIVE', 'INACTIVE', 'TERMINATED', 'PENDING', 'LEFT'));

    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_gender;
    ALTER TABLE profiles ADD CONSTRAINT chk_profiles_gender 
      CHECK (gender IN ('M', 'F', 'OTHER') OR gender IS NULL);

    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_employment_type;
    ALTER TABLE profiles ADD CONSTRAINT chk_profiles_employment_type 
      CHECK (employment_type IN ('INTERNAL', 'THIRD_PARTY', 'CONTRACTOR', 'GUEST', 'TEMPORARY'));

    CREATE INDEX IF NOT EXISTS idx_profiles_profile_id ON profiles(profile_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_national_id ON profiles(national_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
    CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);
    CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

    -- ========================================================
    -- 5. MAINTENANCE TABLE
    -- ========================================================
    CREATE TABLE IF NOT EXISTS maintenance (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'pending',
      description TEXT NOT NULL,
      reported_by TEXT NOT NULL,
      assigned_to TEXT,
      reported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMPTZ,
      notes TEXT
    );

    ALTER TABLE maintenance
      ADD COLUMN IF NOT EXISTS reported_at TIMESTAMPTZ DEFAULT NOW(),
      ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

    UPDATE maintenance SET status = 'pending' 
      WHERE status IS NULL OR status = '' OR status NOT IN ('pending', 'in_progress', 'completed', 'cancelled', 'escalated', 'closed');
    UPDATE maintenance SET priority = 'normal' 
      WHERE priority IS NULL OR priority = '' OR priority NOT IN ('low', 'normal', 'high', 'urgent', 'emergency');

    ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS chk_maintenance_status;
    ALTER TABLE maintenance ADD CONSTRAINT chk_maintenance_status 
      CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled', 'escalated', 'closed'));

    ALTER TABLE maintenance DROP CONSTRAINT IF EXISTS chk_maintenance_priority;
    ALTER TABLE maintenance ADD CONSTRAINT chk_maintenance_priority 
      CHECK (priority IN ('low', 'normal', 'high', 'urgent', 'emergency'));

    CREATE INDEX IF NOT EXISTS idx_maintenance_reported_at ON maintenance(reported_at DESC);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
    CREATE INDEX IF NOT EXISTS idx_maintenance_priority ON maintenance(priority);

    -- ========================================================
    -- 6. LOOKUP VALUES TABLE
    -- ========================================================
    CREATE TABLE IF NOT EXISTS lookup_values (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      value TEXT NOT NULL,
      parent_value TEXT,
      extra_value TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      disabled BOOLEAN NOT NULL DEFAULT false
    );

    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = schema_record.s_name AND table_name = 'lookup_values' AND column_name = 'property_id'
    ) THEN
      CREATE INDEX IF NOT EXISTS idx_lookup_prop_cat ON lookup_values(property_id, category);
    ELSE
      CREATE INDEX IF NOT EXISTS idx_lookup_cat ON lookup_values(category);
    END IF;

    -- ========================================================
    -- 7. ROOM IMPORT JOBS TABLE
    -- ========================================================
    CREATE TABLE IF NOT EXISTS room_import_jobs (
      id SERIAL PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'pending',
      total_rooms INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

  END LOOP;

  -- Reset search path back to public
  SET search_path TO public;
  RAISE NOTICE 'All schemas, tables, and constraints migrated successfully!';
END $$;
