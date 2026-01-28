-- Private cast/staff info managed in CMS (not public)

ALTER TABLE cast_staff_profiles ADD COLUMN real_name TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN private_birth_date TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN blood_type TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN birthplace TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN residence TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN education TEXT NOT NULL DEFAULT '';

-- Size fields (free text numeric strings, e.g. "172", "26.5")
ALTER TABLE cast_staff_profiles ADD COLUMN height_cm TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN weight_kg TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN bust_cm TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN waist_cm TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN hip_cm TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN shoe_cm TEXT NOT NULL DEFAULT '';

ALTER TABLE cast_staff_profiles ADD COLUMN qualifications TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN skills_hobbies TEXT NOT NULL DEFAULT '';

-- Contact info for operations (not login credentials)
ALTER TABLE cast_staff_profiles ADD COLUMN contact_email TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN contact_phone TEXT NOT NULL DEFAULT '';
