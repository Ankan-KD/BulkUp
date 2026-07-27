CREATE TABLE users (
    id UUID PRIMARY KEY
);

CREATE TABLE user_settings (
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    goal_mode TEXT NOT NULL,
    calorie_goal NUMERIC NOT NULL,
    protein_goal NUMERIC NOT NULL,
    goal_weight_kg NUMERIC NOT NULL,
    start_weight_kg NUMERIC NOT NULL,
    water_goal_ml NUMERIC NOT NULL,
    units TEXT NOT NULL,
    theme TEXT NOT NULL,
    onboarded BOOLEAN NOT NULL,
    updated_at TIMESTAMP,

    PRIMARY KEY (user_id),

    CONSTRAINT fk_user_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);

CREATE TABLE foods (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL,
    target_quantity NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    calories NUMERIC NOT NULL,
    protein NUMERIC NOT NULL,
    carbs NUMERIC NOT NULL,
    fats NUMERIC NOT NULL,
    aliases TEXT[],
    sort_order INTEGER,
    archived BOOLEAN,
    kind TEXT,
    active_days SMALLINT[],
    category TEXT,
    custom_category TEXT,
    base_ingredient TEXT,
    created_at TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_foods_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);

CREATE TABLE day_logs (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    food_id UUID NOT NULL,
    logged_quantity NUMERIC,
    updated_at TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT uq_day_logs
        UNIQUE (user_id, date, food_id),

    CONSTRAINT fk_day_logs_user
        FOREIGN KEY (user_id)
        REFERENCES users(id),

    CONSTRAINT fk_day_logs_food
        FOREIGN KEY (food_id)
        REFERENCES foods(id)
);

CREATE TABLE daily_water (
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    water_ml NUMERIC,

    PRIMARY KEY (user_id, date),

    CONSTRAINT fk_daily_water_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);

CREATE TABLE weight_entries (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    weight_kg NUMERIC NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT uq_weight_entries
        UNIQUE (user_id, date),

    CONSTRAINT fk_weight_entries_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);

CREATE TABLE meal_combos (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    icon TEXT,
    items JSON,
    sort_order INTEGER,
    created_at TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_meal_combos_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);

CREATE TABLE milestones (
    user_id UUID NOT NULL,
    key TEXT NOT NULL,
    achieved_at DATE,

    PRIMARY KEY (user_id, key),

    CONSTRAINT fk_milestones_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);