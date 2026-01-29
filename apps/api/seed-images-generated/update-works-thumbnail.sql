-- Auto-generated: fix seed works thumbnails for production
-- Strategy: prefer uploaded work thumbnail if present; otherwise reuse the first video thumbnail for the work.
UPDATE works SET thumbnail_url='https://assets.oshidra.com/8c4a0287-2028-4e91-9866-0c2ae4e79f75', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_001';
UPDATE works SET thumbnail_url='https://assets.oshidra.com/442b4c8d-1db5-42eb-ac3a-715b1dff008d', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_002';
UPDATE works SET thumbnail_url='https://assets.oshidra.com/cf2fd69b-efb1-4f34-ac29-fab22134ef57', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_003';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_004';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_005';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_006';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_007';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_008';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_009';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_010';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_011';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_012';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_013';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_014';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_015';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_016';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_017';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_018';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_019';
UPDATE works SET thumbnail_url=(SELECT v.thumbnail_url FROM videos v WHERE v.work_id=works.id ORDER BY v.id LIMIT 1), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_work_020';
