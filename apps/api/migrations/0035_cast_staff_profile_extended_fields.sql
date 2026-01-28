-- Extended cast/staff profile fields for CMS
-- Adds kana/en names, multiple profile images, face image, SNS, free-text sections, and private PDF.

ALTER TABLE cast_staff_profiles ADD COLUMN name_kana TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN name_en TEXT NOT NULL DEFAULT '';

-- JSON arrays (stored as TEXT)
ALTER TABLE cast_staff_profiles ADD COLUMN profile_images_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE cast_staff_profiles ADD COLUMN sns_json TEXT NOT NULL DEFAULT '[]';

-- Images / files
ALTER TABLE cast_staff_profiles ADD COLUMN face_image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN private_pdf_url TEXT NOT NULL DEFAULT '';

-- Public-ish profile text (still CMS-managed)
ALTER TABLE cast_staff_profiles ADD COLUMN hobbies TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN special_skills TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN bio TEXT NOT NULL DEFAULT '';
ALTER TABLE cast_staff_profiles ADD COLUMN career TEXT NOT NULL DEFAULT '';
