-- Fill missing images for seed casts so profiles always have a thumbnail.
-- Safe: only affects ids that start with 'seed_cast_'.

-- Public cast thumbnail used by most APIs/UI.
UPDATE casts
SET thumbnail_url = 'https://assets.oshidra.com/1b0f8491-dd14-4aaf-b7f1-2b4dad8e882d',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE id LIKE 'seed_cast_%'
  AND (thumbnail_url IS NULL OR thumbnail_url = '');

-- CMS profile face image (used by some admin/profile screens).
UPDATE cast_staff_profiles
SET face_image_url = 'https://assets.oshidra.com/1b0f8491-dd14-4aaf-b7f1-2b4dad8e882d',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE cast_id LIKE 'seed_cast_%'
  AND (face_image_url IS NULL OR face_image_url = '');

-- CMS profile image list (fallback gallery).
UPDATE cast_staff_profiles
SET profile_images_json = '["https://assets.oshidra.com/1b0f8491-dd14-4aaf-b7f1-2b4dad8e882d"]',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
WHERE cast_id LIKE 'seed_cast_%'
  AND (profile_images_json IS NULL OR profile_images_json = '' OR profile_images_json = '[]');
