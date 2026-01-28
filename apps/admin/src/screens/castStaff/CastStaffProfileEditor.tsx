import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native'

import { type CmsApiConfig, cmsFetchJson, cmsFetchJsonWithBase } from '../../lib/cmsApi'

type SnsItem = { label: string; url: string }

export type CastStaffProfileDraft = {
  displayName: string
  nameKana: string
  nameEn: string

  role: string

  // Images
  profileImages: string[] // up to 10, portrait
  faceImageUrl: string // square

  birthDate: string
  birthplace: string
  bloodType: string

  hobbies: string
  specialSkills: string
  qualifications: string

  sns: SnsItem[]

  bio: string
  career: string

  privatePdfUrl: string
}

type CmsCastStaffItemResponse = {
  item: {
    castId: string
    displayName: string
    role: string
    profileImageUrl: string

    birthDate: string
    bloodType: string
    birthplace: string

    qualifications: string

    // Extended fields
    nameKana?: string
    nameEn?: string
    profileImages?: string[]
    faceImageUrl?: string
    hobbies?: string
    specialSkills?: string
    sns?: SnsItem[]
    bio?: string
    career?: string
    privatePdfUrl?: string
  }
}

function clampArray<T>(v: T[], max: number): T[] {
  if (!Array.isArray(v)) return []
  if (v.length <= max) return v
  return v.slice(0, max)
}

function safeUrlList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return []
  return clampArray(
    v
      .map((x) => String(x ?? '').trim())
      .filter(Boolean),
    max
  )
}

function safeSnsList(v: unknown, max: number): SnsItem[] {
  if (!Array.isArray(v)) return []
  const items: SnsItem[] = []
  for (const raw of v) {
    const label = String((raw as any)?.label ?? '').trim()
    const url = String((raw as any)?.url ?? '').trim()
    if (!label && !url) continue
    items.push({ label, url })
    if (items.length >= max) break
  }
  return items
}

async function uploadImage(cfg: CmsApiConfig, file: File): Promise<string> {
  const res = await cmsFetchJsonWithBase<{ error: string | null; data: { url: string } | null }>(cfg, cfg.uploaderBase, '/cms/images', {
    method: 'PUT',
    headers: {
      'content-type': file.type || 'application/octet-stream',
    },
    body: file,
  })

  if (res.error || !res.data?.url) throw new Error(res.error || '画像アップロードに失敗しました')
  return res.data.url
}

async function uploadPdf(cfg: CmsApiConfig, file: File): Promise<string> {
  const res = await cmsFetchJsonWithBase<{ error: string | null; data: { url: string } | null }>(cfg, cfg.uploaderBase, '/cms/files', {
    method: 'PUT',
    headers: {
      'content-type': file.type || 'application/pdf',
    },
    body: file,
  })

  if (res.error || !res.data?.url) throw new Error(res.error || 'PDFアップロードに失敗しました')
  return res.data.url
}

function getPreviewSize(aspect: number): { w: number; h: number } {
  // Keep a reasonable size for admin UI
  const w = 320
  const h = Math.round(w / aspect)
  return { w, h }
}

async function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = document.createElement('img')
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('画像を読み込めませんでした'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function cropToFile(params: {
  file: File
  aspect: number
  zoom: number
  offsetX: number
  offsetY: number
  outType?: string
  quality?: number
  namePrefix: string
}): Promise<File> {
  const { file, aspect, zoom, offsetX, offsetY, outType = 'image/jpeg', quality = 0.92, namePrefix } = params

  const img = await loadHtmlImage(file)
  const iw = img.naturalWidth || (img as any).width
  const ih = img.naturalHeight || (img as any).height

  const { w: cw, h: ch } = getPreviewSize(aspect)

  const baseScale = Math.max(cw / iw, ch / ih)
  const appliedScale = baseScale * Math.max(1, zoom)

  const dw = iw * appliedScale
  const dh = ih * appliedScale

  const cx = cw / 2
  const cy = ch / 2

  const imgLeft = cx + offsetX - dw / 2
  const imgTop = cy + offsetY - dh / 2

  const sx = (0 - imgLeft) / appliedScale
  const sy = (0 - imgTop) / appliedScale
  const sw = cw / appliedScale
  const sh = ch / appliedScale

  const sxc = Math.max(0, Math.min(iw - 1, sx))
  const syc = Math.max(0, Math.min(ih - 1, sy))
  const swc = Math.max(1, Math.min(iw - sxc, sw))
  const shc = Math.max(1, Math.min(ih - syc, sh))

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(cw)
  canvas.height = Math.round(ch)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvasが初期化できませんでした')

  ctx.drawImage(img, sxc, syc, swc, shc, 0, 0, canvas.width, canvas.height)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) return reject(new Error('画像変換に失敗しました'))
        resolve(b)
      },
      outType,
      quality
    )
  })

  const ext = outType === 'image/png' ? 'png' : outType === 'image/webp' ? 'webp' : 'jpg'
  const outName = `${namePrefix}_${Date.now()}.${ext}`
  return new File([blob], outName, { type: outType })
}

function ImageCropModal(props: {
  visible: boolean
  title: string
  file: File | null
  aspect: number
  onCancel: () => void
  onConfirm: (cropped: File) => void
}) {
  const { visible, title, file, aspect, onCancel, onConfirm } = props

  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [nat, setNat] = useState<{ iw: number; ih: number }>({ iw: 0, ih: 0 })

  const dragRef = useRef<{ dragging: boolean; sx: number; sy: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (!visible) return
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
    setBusy(false)
    setErr('')
    setNat({ iw: 0, ih: 0 })
  }, [visible])

  const { w: cw, h: ch } = useMemo(() => getPreviewSize(aspect), [aspect])

  const baseScale = useMemo(() => {
    if (!nat.iw || !nat.ih) return 1
    return Math.max(cw / nat.iw, ch / nat.ih)
  }, [cw, ch, nat.ih, nat.iw])

  const onPointerDown = useCallback((e: any) => {
    try {
      const clientX = Number(e?.clientX ?? 0)
      const clientY = Number(e?.clientY ?? 0)
      dragRef.current = { dragging: true, sx: clientX, sy: clientY, ox: offsetX, oy: offsetY }
    } catch {
      // ignore
    }
  }, [offsetX, offsetY])

  const onPointerMove = useCallback((e: any) => {
    const st = dragRef.current
    if (!st?.dragging) return
    const clientX = Number(e?.clientX ?? 0)
    const clientY = Number(e?.clientY ?? 0)
    setOffsetX(st.ox + (clientX - st.sx))
    setOffsetY(st.oy + (clientY - st.sy))
  }, [])

  const onPointerUp = useCallback(() => {
    const st = dragRef.current
    if (!st) return
    dragRef.current = { ...st, dragging: false }
  }, [])

  const confirm = useCallback(() => {
    if (!file) return
    setBusy(true)
    setErr('')
    void (async () => {
      try {
        const cropped = await cropToFile({
          file,
          aspect,
          zoom,
          offsetX,
          offsetY,
          namePrefix: 'crop',
        })
        onConfirm(cropped)
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [aspect, file, offsetX, offsetY, onConfirm, zoom])

  if (!visible || Platform.OS !== 'web') return null

  const objectUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file])
  useEffect(() => {
    return () => {
      try {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
      } catch {
        // ignore
      }
    }
  }, [objectUrl])

  return (
    <View
      style={
        {
          position: 'fixed' as any,
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 9999,
        } as any
      }
    >
      <View style={{ backgroundColor: '#fff', padding: 14, borderRadius: 10, width: Math.max(360, cw + 40) } as any}>
        <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 8 } as any}>{title}</Text>
        <Text style={{ fontSize: 12, color: '#444', marginBottom: 10 } as any}>ドラッグで位置調整、スライダーで拡大（縦のみ/正方形）</Text>

        <View
          style={
            {
              width: cw,
              height: ch,
              backgroundColor: '#111',
              overflow: 'hidden',
              borderRadius: 8,
              position: 'relative',
              alignSelf: 'center',
              touchAction: 'none',
            } as any
          }
          // eslint-disable-next-line react/no-unknown-property
          onPointerDown={onPointerDown as any}
          // eslint-disable-next-line react/no-unknown-property
          onPointerMove={onPointerMove as any}
          // eslint-disable-next-line react/no-unknown-property
          onPointerUp={onPointerUp as any}
          // eslint-disable-next-line react/no-unknown-property
          onPointerCancel={onPointerUp as any}
          // eslint-disable-next-line react/no-unknown-property
          onPointerLeave={onPointerUp as any}
        >
          {objectUrl ? (
            // eslint-disable-next-line react/no-unknown-property
            <img
              src={objectUrl}
              alt="crop"
              onLoad={(e: any) => {
                try {
                  const iw = Number(e?.currentTarget?.naturalWidth ?? 0)
                  const ih = Number(e?.currentTarget?.naturalHeight ?? 0)
                  if (iw > 0 && ih > 0) setNat({ iw, ih })
                } catch {
                  // ignore
                }
              }}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: nat.iw ? nat.iw * baseScale : undefined,
                height: nat.ih ? nat.ih * baseScale : undefined,
                transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) scale(${Math.max(1, zoom)})`,
                transformOrigin: 'center',
                userSelect: 'none',
                pointerEvents: 'none',
                maxWidth: 'none',
                maxHeight: 'none',
              }}
            />
          ) : null}
        </View>

        <View style={{ marginTop: 12 } as any}>
          <Text style={{ fontSize: 12, color: '#444' } as any}>{`拡大: ${zoom.toFixed(2)}x`}</Text>
          {
            // eslint-disable-next-line react/no-unknown-property
          }
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e: any) => setZoom(Number(e?.target?.value ?? 1))}
            style={{ width: '100%' }}
          />
        </View>

        {err ? <Text style={{ marginTop: 8, color: '#b00020' } as any}>{err}</Text> : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, justifyContent: 'flex-end' } as any}>
          <Pressable disabled={busy} onPress={onCancel} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#eee', borderRadius: 8 } as any}>
            <Text>キャンセル</Text>
          </Pressable>
          <Pressable disabled={busy || !file} onPress={confirm} style={{ paddingVertical: 10, paddingHorizontal: 14, backgroundColor: '#2563eb', borderRadius: 8 } as any}>
            <Text style={{ color: '#fff' } as any}>{busy ? '処理中…' : '確定'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export function CastStaffProfileEditor(props: {
  cfg: CmsApiConfig
  castId: string
  styles: any
  onSaved: (castId: string) => void
}) {
  const { cfg, castId, styles, onSaved } = props

  const [banner, setBanner] = useState('')
  const [busy, setBusy] = useState(false)

  const [displayName, setDisplayName] = useState('')
  const [nameKana, setNameKana] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [role, setRole] = useState('')

  const [profileImages, setProfileImages] = useState<string[]>([])
  const [faceImageUrl, setFaceImageUrl] = useState('')

  const [birthDate, setBirthDate] = useState('')
  const [birthplace, setBirthplace] = useState('')
  const [bloodType, setBloodType] = useState('')
  const [hobbies, setHobbies] = useState('')
  const [specialSkills, setSpecialSkills] = useState('')
  const [qualifications, setQualifications] = useState('')

  const [sns, setSns] = useState<SnsItem[]>([])

  const [bio, setBio] = useState('')
  const [career, setCareer] = useState('')

  const [privatePdfUrl, setPrivatePdfUrl] = useState('')

  const [cropVisible, setCropVisible] = useState(false)
  const [cropTitle, setCropTitle] = useState('')
  const [cropAspect, setCropAspect] = useState(1)
  const [cropFile, setCropFile] = useState<File | null>(null)
  const cropResolveRef = useRef<((f: File | null) => void) | null>(null)

  const pickAndCrop = useCallback(async (file: File, aspect: number, title: string): Promise<File | null> => {
    if (Platform.OS !== 'web') return file

    return await new Promise<File | null>((resolve) => {
      cropResolveRef.current = resolve
      setCropTitle(title)
      setCropAspect(aspect)
      setCropFile(file)
      setCropVisible(true)
    })
  }, [])

  const onCropCancel = useCallback(() => {
    setCropVisible(false)
    const resolve = cropResolveRef.current
    cropResolveRef.current = null
    resolve?.(null)
  }, [])

  const onCropConfirm = useCallback((cropped: File) => {
    setCropVisible(false)
    const resolve = cropResolveRef.current
    cropResolveRef.current = null
    resolve?.(cropped)
  }, [])

  const loadDraft = useCallback(
    (item: CmsCastStaffItemResponse['item']) => {
      setDisplayName(String(item.displayName ?? ''))
      setNameKana(String((item as any).nameKana ?? ''))
      setNameEn(String((item as any).nameEn ?? ''))
      setRole(String(item.role ?? ''))

      setProfileImages(safeUrlList((item as any).profileImages, 10))
      setFaceImageUrl(String((item as any).faceImageUrl ?? '') || String(item.profileImageUrl ?? ''))

      setBirthDate(String(item.birthDate ?? ''))
      setBirthplace(String(item.birthplace ?? ''))
      setBloodType(String(item.bloodType ?? ''))

      setHobbies(String((item as any).hobbies ?? ''))
      setSpecialSkills(String((item as any).specialSkills ?? ''))
      setQualifications(String(item.qualifications ?? ''))

      setSns(safeSnsList((item as any).sns, 20))
      setBio(String((item as any).bio ?? ''))
      setCareer(String((item as any).career ?? ''))
      setPrivatePdfUrl(String((item as any).privatePdfUrl ?? ''))
    },
    []
  )

  useEffect(() => {
    if (!castId) return
    let mounted = true
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        const json = await cmsFetchJson<CmsCastStaffItemResponse>(cfg, `/cms/cast-staff/${encodeURIComponent(castId)}`)
        if (!mounted) return
        loadDraft(json.item)
      } catch (e) {
        if (!mounted) return
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        if (!mounted) return
        setBusy(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [castId, cfg, loadDraft])

  const canAddMoreProfileImages = profileImages.length < 10

  const addSnsRow = useCallback(() => {
    setSns((prev) => [...prev, { label: '', url: '' }])
  }, [])

  const updateSnsRow = useCallback((idx: number, patch: Partial<SnsItem>) => {
    setSns((prev) => prev.map((v, i) => (i === idx ? { ...v, ...patch } : v)))
  }, [])

  const removeSnsRow = useCallback((idx: number) => {
    setSns((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const uploadPortraitFiles = useCallback(
    async (files: File[]) => {
      if (Platform.OS !== 'web') {
        setBanner('画像アップロードはWeb版管理画面のみ対応です')
        return
      }

      const remain = Math.max(0, 10 - profileImages.length)
      const targets = files.slice(0, remain)
      if (targets.length === 0) return

      setBusy(true)
      setBanner('')
      try {
        const urls: string[] = []
        for (const f of targets) {
          const cropped = await pickAndCrop(f, 9 / 16, 'プロフィール画像（縦 9:16）をトリミング')
          if (!cropped) continue
          const url = await uploadImage(cfg, cropped)
          urls.push(url)
        }

        if (urls.length) {
          setProfileImages((prev) => clampArray([...prev, ...urls], 10))
          setBanner('プロフィール画像をアップロードしました')
        }
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [cfg, pickAndCrop, profileImages.length]
  )

  const uploadFaceFile = useCallback(
    async (file: File) => {
      if (Platform.OS !== 'web') {
        setBanner('画像アップロードはWeb版管理画面のみ対応です')
        return
      }

      setBusy(true)
      setBanner('')
      try {
        const cropped = await pickAndCrop(file, 1, '顔画像（正方形）をトリミング')
        if (!cropped) return
        const url = await uploadImage(cfg, cropped)
        setFaceImageUrl(url)
        setBanner('顔画像をアップロードしました')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [cfg, pickAndCrop]
  )

  const uploadPdfFile = useCallback(
    async (file: File) => {
      if (Platform.OS !== 'web') {
        setBanner('PDFアップロードはWeb版管理画面のみ対応です')
        return
      }

      setBusy(true)
      setBanner('')
      try {
        const url = await uploadPdf(cfg, file)
        setPrivatePdfUrl(url)
        setBanner('PDFをアップロードしました（非公開）')
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    },
    [cfg]
  )

  const removeProfileImage = useCallback((idx: number) => {
    setProfileImages((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const draft: CastStaffProfileDraft = useMemo(
    () => ({
      displayName,
      nameKana,
      nameEn,
      role,
      profileImages,
      faceImageUrl,
      birthDate,
      birthplace,
      bloodType,
      hobbies,
      specialSkills,
      qualifications,
      sns,
      bio,
      career,
      privatePdfUrl,
    }),
    [bio, birthDate, birthplace, bloodType, career, displayName, faceImageUrl, hobbies, nameEn, nameKana, profileImages, qualifications, role, sns, privatePdfUrl, specialSkills]
  )

  const onSave = useCallback(() => {
    setBusy(true)
    setBanner('')
    void (async () => {
      try {
        if (!draft.displayName.trim()) throw new Error('名前（姓名）は必須です')

        const payload = {
          displayName: draft.displayName,
          role: draft.role,
          // Keep existing public thumbnail in casts.thumbnail_url
          profileImageUrl: draft.faceImageUrl,

          birthDate: draft.birthDate,
          birthplace: draft.birthplace,
          bloodType: draft.bloodType,

          qualifications: draft.qualifications,

          // Extended
          nameKana: draft.nameKana,
          nameEn: draft.nameEn,
          profileImages: draft.profileImages,
          faceImageUrl: draft.faceImageUrl,
          hobbies: draft.hobbies,
          specialSkills: draft.specialSkills,
          sns: draft.sns,
          bio: draft.bio,
          career: draft.career,
          privatePdfUrl: draft.privatePdfUrl,
        }

        if (castId) {
          await cmsFetchJson(cfg, `/cms/cast-staff/${encodeURIComponent(castId)}`, {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          })
          setBanner('保存しました')
          return
        }

        // Create public cast record first, then attach extended profile.
        const created = await cmsFetchJson<{ ok: true; id: string }>(cfg, '/cms/casts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: draft.displayName, role: draft.role, thumbnailUrl: draft.faceImageUrl }),
        })
        const nextId = String((created as any).id ?? '')
        if (!nextId) throw new Error('作成に失敗しました')

        await cmsFetchJson(cfg, `/cms/cast-staff/${encodeURIComponent(nextId)}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        })

        setBanner('作成しました')
        onSaved(nextId)
      } catch (e) {
        setBanner(e instanceof Error ? e.message : String(e))
      } finally {
        setBusy(false)
      }
    })()
  }, [castId, cfg, draft, onSaved])

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>キャストプロフィール</Text>

      {banner ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{banner}</Text>
        </View>
      ) : null}

      {castId ? (
        <View style={styles.field}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.readonlyText}>{castId}</Text>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>名前（姓名）</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} style={styles.input} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>カナ（姓名）</Text>
        <TextInput value={nameKana} onChangeText={setNameKana} style={styles.input} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>アルファベット（Firstname Lastname）</Text>
        <TextInput value={nameEn} onChangeText={setNameEn} style={styles.input} autoCapitalize="words" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>役割</Text>
        <TextInput value={role} onChangeText={setRole} style={styles.input} placeholder="例: 俳優/監督/脚本" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>顔画像（正方形）: 1枚</Text>
        <Text style={styles.selectMenuDetailText}>※画像エディタで正方形にトリミング</Text>
        {Platform.OS === 'web' ? (
          <View style={{ marginTop: 6 } as any}>
            {
              // eslint-disable-next-line react/no-unknown-property
            }
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e: any) => {
                const f = e?.target?.files?.[0] ?? null
                if (f) void uploadFaceFile(f)
              }}
            />
          </View>
        ) : null}
        <View style={{ marginTop: 10 } as any}>
          {faceImageUrl ? <Image source={{ uri: faceImageUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{`プロフィール画像（縦）: ${profileImages.length}/10枚`}</Text>
        <Text style={styles.selectMenuDetailText}>※画像エディタで縦サイズにトリミング</Text>

        {Platform.OS === 'web' ? (
          <View style={{ marginTop: 6 } as any}>
            {
              // eslint-disable-next-line react/no-unknown-property
            }
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              disabled={!canAddMoreProfileImages}
              onChange={(e: any) => {
                const files = Array.from((e?.target?.files as FileList | undefined) ?? []) as File[]
                if (files.length) void uploadPortraitFiles(files)
              }}
            />
          </View>
        ) : null}

        <View style={[styles.table, { marginTop: 10 } as any]}>
          {profileImages.map((url, idx) => (
            <View key={`${url}_${idx}`} style={styles.tableRow}>
              <View style={styles.tableLeft}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' } as any}>
                  {url ? <Image source={{ uri: url }} style={styles.thumb} /> : <View style={styles.thumb} />}
                  <View style={{ flex: 1 } as any}>
                    <Text style={styles.tableLabel}>{`画像${idx + 1}`}</Text>
                    <Text style={styles.tableDetail} numberOfLines={1}>
                      {url}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={[styles.tableRight, { flexDirection: 'row', gap: 8, alignItems: 'center' } as any]}>
                <Pressable onPress={() => removeProfileImage(idx)} style={styles.smallBtnDanger}>
                  <Text style={styles.smallBtnDangerText}>削除</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {!profileImages.length ? (
            <View style={styles.placeholderBox}>
              <Text style={styles.placeholderText}>プロフィール画像がありません</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>生年月日</Text>
        <Text style={styles.selectMenuDetailText}>※形式: YYYY-MM-DD</Text>
        <TextInput value={birthDate} onChangeText={setBirthDate} style={styles.input} placeholder="1990-01-23" autoCapitalize="none" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>出身地</Text>
        <TextInput value={birthplace} onChangeText={setBirthplace} style={styles.input} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>血液型</Text>
        <TextInput value={bloodType} onChangeText={setBloodType} style={styles.input} placeholder="A/B/O/AB" autoCapitalize="characters" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>趣味</Text>
        <TextInput value={hobbies} onChangeText={setHobbies} style={styles.input} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>特技</Text>
        <TextInput value={specialSkills} onChangeText={setSpecialSkills} style={styles.input} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>資格</Text>
        <TextInput value={qualifications} onChangeText={setQualifications} style={styles.input} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SNS（複数）</Text>
        <Text style={styles.selectMenuDetailText}>例: X / Instagram / TikTok など</Text>

        {sns.map((row, idx) => (
          <View key={idx} style={[styles.tableRow, { paddingVertical: 10 } as any]}>
            <View style={styles.tableLeft}>
              <View style={{ gap: 8 } as any}>
                <View style={styles.field}>
                  <Text style={styles.label}>種別</Text>
                  <TextInput value={row.label} onChangeText={(v) => updateSnsRow(idx, { label: v })} style={styles.input} placeholder="X" />
                </View>
                <View style={styles.field}>
                  <Text style={styles.label}>URL</Text>
                  <TextInput value={row.url} onChangeText={(v) => updateSnsRow(idx, { url: v })} style={styles.input} placeholder="https://..." autoCapitalize="none" />
                </View>
              </View>
            </View>
            <View style={[styles.tableRight, { justifyContent: 'flex-start' } as any]}>
              <Pressable onPress={() => removeSnsRow(idx)} style={styles.smallBtnDanger}>
                <Text style={styles.smallBtnDangerText}>削除</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={[styles.filterActions, { justifyContent: 'flex-start' } as any]}>
          <Pressable onPress={addSnsRow} style={styles.btnSecondary}>
            <Text style={styles.btnSecondaryText}>SNSを追加</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>自己紹介・自己アピール（自由記入 / URL可）</Text>
        <TextInput value={bio} onChangeText={setBio} style={[styles.input, { minHeight: 110 } as any]} multiline />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>経歴・出演作品など（自由記入 / URL可）</Text>
        <TextInput value={career} onChangeText={setCareer} style={[styles.input, { minHeight: 140 } as any]} multiline />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>PDFアップロード（非公開 / 事務局閲覧用）</Text>
        {Platform.OS === 'web' ? (
          <View style={{ marginTop: 6 } as any}>
            {
              // eslint-disable-next-line react/no-unknown-property
            }
            <input
              type="file"
              accept="application/pdf"
              onChange={(e: any) => {
                const f = e?.target?.files?.[0] ?? null
                if (f) void uploadPdfFile(f)
              }}
            />
          </View>
        ) : null}

        <View style={{ marginTop: 8 } as any}>
          <Text style={styles.selectMenuDetailText}>{privatePdfUrl ? `登録済み: ${privatePdfUrl}` : '未登録'}</Text>
        </View>
      </View>

      <View style={styles.filterActions}>
        <Pressable disabled={busy} onPress={onSave} style={[styles.btnPrimary, busy ? styles.btnDisabled : null]}>
          <Text style={styles.btnPrimaryText}>{busy ? '保存中…' : castId ? '保存' : '作成'}</Text>
        </Pressable>
      </View>

      <ImageCropModal visible={cropVisible} title={cropTitle} file={cropFile} aspect={cropAspect} onCancel={onCropCancel} onConfirm={onCropConfirm} />
    </View>
  )
}
