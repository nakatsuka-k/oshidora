-- Auto-generated: finalize remaining thumbnails
-- 1) Fix one production video with empty thumbnail_url by copying its work thumbnail
UPDATE videos SET thumbnail_url=(SELECT w.thumbnail_url FROM works w WHERE w.id=videos.work_id), updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='6ed11a38-b1a1-4fa8-b1d0-0b2b48d9d9d4' AND (thumbnail_url IS NULL OR thumbnail_url='');

-- 2) Ensure all seed_cast_011..024 have human face thumbnails (reuse pool seed_cast_001..010)
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/1b0f8491-dd14-4aaf-b7f1-2b4dad8e882d', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_011';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/c77311e2-c647-4a4c-bebd-233df323ad55', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_012';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/cb90e4d7-f160-41f7-b9f9-fe6efb22d376', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_013';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/b3fd8092-508c-4350-830d-e27887ec624c', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_014';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/51eead1d-7c63-431a-8a11-5e0e9c0d389d', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_015';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/4f9502f6-240e-4dbe-b525-23c04429d473', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_016';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/1db01c19-ea25-4eee-8e0a-8e6231af7ca5', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_017';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/beeac57a-e314-4b71-9dc4-e51a331f6b67', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_018';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/4a06f987-89b4-43f2-9793-23f35d6053f5', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_019';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/426e2e86-af2d-4e1d-b1e9-c0f90dea8b01', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_020';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/1b0f8491-dd14-4aaf-b7f1-2b4dad8e882d', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_021';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/c77311e2-c647-4a4c-bebd-233df323ad55', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_022';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/cb90e4d7-f160-41f7-b9f9-fe6efb22d376', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_023';
UPDATE casts SET thumbnail_url='https://assets.oshidra.com/b3fd8092-508c-4350-830d-e27887ec624c', updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='seed_cast_024';
