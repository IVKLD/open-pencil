import { compact, uniq } from 'es-toolkit'

import { type Fill, type SceneNode } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'

import type { EditorStore } from '@/app/editor/active-store'
import { sanitizeTextureId } from '@/app/integrations/shadr/converter'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import { http } from '@/app/integrations/shadr/http/http-client'
import { toast } from '@/app/shell/ui'

export interface ImageListItem {
  name: string
  unicode?: string
  url?: string
}

const uploadedHashes = new Set<string>()
const serverKnownTextures = new Set<string>()
const serverImageHashes = new Map<string, string>()
const missingImageHashes = new Set<string>()

export function recordServerTexture(name: string, hash?: string): void {
  const cleanId = cleanTextureName(name)
  serverKnownTextures.add(cleanId)
  if (hash) {
    serverImageHashes.set(cleanId, hash)
    uploadedHashes.add(`${cleanId}_${hash}`)
  }
}

export function clearImageCache(): void {
  uploadedHashes.clear()
  serverKnownTextures.clear()
  serverImageHashes.clear()
  missingImageHashes.clear()
}

export const cleanTextureName = sanitizeTextureId

export function createImageFill(imageHash: string, mode: 'FILL' | 'FIT' = 'FILL'): Fill {
  return {
    type: 'IMAGE',
    imageHash,
    imageScaleMode: mode,
    opacity: 1,
    visible: true,
    color: { r: 1, g: 1, b: 1, a: 1 }
  }
}

function findPrimaryImageFill(node: SceneNode): Fill | undefined {
  return (node.fills ?? []).find((f: Fill) => f.visible !== false && f.type === 'IMAGE')
}

function collectExplicitImageNodes(editor: EditorStore, pageNames?: string[]): SceneNode[] {
  const graph = editor.graph
  const targetPages = graph.getPages().filter((p) => {
    if (pageNames && pageNames.length > 0) {
      return p.name !== '_components' && pageNames.includes(p.name)
    }
    return p.id === editor.state.currentPageId || p.name === '_components'
  })

  const candidateNodes: SceneNode[] = []
  function collect(nodeList: readonly SceneNode[]) {
    for (const n of nodeList) {
      candidateNodes.push(n)
      const children = graph.getChildren(n.id)
      if (children.length > 0) collect(children)
    }
  }
  for (const p of targetPages) {
    collect(graph.getChildren(p.id))
  }

  return candidateNodes.filter((n) => !!findPrimaryImageFill(n)?.imageHash)
}

async function ensureServerKnownTextures(): Promise<void> {
  if (serverKnownTextures.size > 0) return
  try {
    const remoteList = await imageService.list()
    for (const item of remoteList) {
      serverKnownTextures.add(cleanTextureName(item.name))
    }
  } catch (err) {
    console.warn('[Shadr] Failed to fetch server textures list:', err)
  }
}

async function uploadNodeTextureIfNeeded(editor: EditorStore, node: SceneNode): Promise<boolean> {
  const imageHash = findPrimaryImageFill(node)?.imageHash
  if (!imageHash || missingImageHashes.has(imageHash)) return false

  const bytes = editor.graph.images.get(imageHash)
  if (!bytes || bytes.length === 0) return false

  const currentData = getShadrData(node, editor.graph)
  const rawName = currentData.textureName || node.name
  const cleanId = cleanTextureName(rawName, imageHash)

  if (currentData.textureName !== cleanId) {
    setShadrData(editor, [node], { textureName: cleanId })
  }

  const uploadKey = `${cleanId}_${imageHash}`
  if (uploadedHashes.has(uploadKey)) return false

  const isKnownOnServer = serverKnownTextures.has(cleanId)
  const serverHash = serverImageHashes.get(cleanId)
  if (isKnownOnServer && serverHash === imageHash) {
    uploadedHashes.add(uploadKey)
    return false
  }

  try {
    await imageService.upload(cleanId, bytes)
    uploadedHashes.add(uploadKey)
    serverKnownTextures.add(cleanId)
    serverImageHashes.set(cleanId, imageHash)
    return true
  } catch (err) {
    console.warn(`[Shadr] Could not auto-upload texture "${cleanId}":`, err)
    return false
  }
}

function detectSupportedMime(bytes: Uint8Array): 'image/png' | 'image/jpeg' | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  return null
}

async function toSupportedImage(
  file: Blob | Uint8Array
): Promise<{ body: Blob | Uint8Array; contentType: string }> {
  if (file instanceof Uint8Array) {
    const mime = detectSupportedMime(file)
    if (mime) return { body: file, contentType: mime }
  }
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return { body: file, contentType: 'image/png' }
  }
  const blob = file instanceof Blob ? file : new Blob([new Uint8Array(file)])
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
  bitmap.close()
  const pngBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  return { body: pngBlob ?? file, contentType: 'image/png' }
}

async function createMissingTexturePlaceholder(
  name: string,
  width: number,
  height: number
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined') return null
  const w = Math.max(120, Math.min(Math.round(width) || 320, 1024))
  const h = Math.max(60, Math.min(Math.round(height) || 180, 1024))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.fillStyle = '#1b202c'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(248, 113, 113, 0.55)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, w - 2, h - 2)

  const fontSize = Math.max(12, Math.min(20, Math.round(w / 18)))
  ctx.fillStyle = '#f87171'
  ctx.font = `600 ${fontSize}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Изображение не найдено', w / 2, h / 2 - fontSize * 0.6)

  ctx.fillStyle = '#94a3b8'
  ctx.font = `${Math.max(10, fontSize - 3)}px monospace`
  ctx.fillText(name, w / 2, h / 2 + fontSize * 0.7, w - 24)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

function applyImageFillToMatchingNodes(
  editor: EditorStore,
  nodes: readonly SceneNode[],
  name: string,
  imageHash: string,
  fallbackFit: 'FILL' | 'FIT' = 'FILL'
): void {
  for (const n of nodes) {
    const data = getShadrData(n, editor.graph)
    if (data.textureName !== name) continue
    const hasLoadedImage = (n.fills ?? []).some(
      (f: Fill) => f.type === 'IMAGE' && !!f.imageHash && editor.graph.images.has(f.imageHash)
    )
    if (!hasLoadedImage) {
      const mode = data.imageFit === 'contain' ? 'FIT' : fallbackFit
      editor.graph.updateNode(n.id, { fills: [createImageFill(imageHash, mode)] })
    }
  }
}

export const imageService = {
  /** Retrieves list of available texture images from the Shadr backend */
  async list(): Promise<ImageListItem[]> {
    try {
      const data = await http.get<
        { images?: Array<ImageListItem | string> } | Array<ImageListItem | string>
      >('/images')
      const raw = Array.isArray(data) ? data : (data?.images ?? [])
      return raw.map((item) => (typeof item === 'string' ? { name: item } : item))
    } catch (e) {
      console.warn('[Shadr] Failed to fetch images list:', e)
      return []
    }
  },

  /** Downloads the raw bytes for a given texture name */
  async getBytes(name: string): Promise<Uint8Array> {
    const cleanName = name.replace(/\.[a-zA-Z0-9]+$/, '')
    const candidates = uniq([cleanName, `${cleanName}.png`])
    let lastErr: unknown
    for (const candidate of candidates) {
      try {
        const bytes = await http.binary(`/images/${encodeURIComponent(candidate)}`, {
          timeout: 30000
        })
        if (bytes.length > 0 && bytes[0] !== 0x3c) return bytes
      } catch (err) {
        lastErr = err
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(`Texture "${name}" not found`)
  },

  /** Uploads or replaces a texture image file on the Shadr server using PUT /images/{id} */
  async upload(name: string, file: Blob | Uint8Array): Promise<void> {
    const { body, contentType } = await toSupportedImage(file)
    await http.putBinary(`/images/${encodeURIComponent(cleanTextureName(name))}`, body, contentType, {
      timeout: 30000
    })
  },

  /** Deletes a texture image from the Shadr server */
  async delete(name: string): Promise<void> {
    const cleanId = cleanTextureName(name)
    await http.delete(`/images/${encodeURIComponent(cleanId)}`)
  },

  /** Applies a texture as a native background IMAGE fill to the target SceneNode */
  applyTextureAsBackground(
    editor: EditorStore,
    node: SceneNode,
    textureName: string,
    bytes: Uint8Array,
    mode: 'FILL' | 'FIT' = 'FILL'
  ): void {
    const imageHash = computeImageHash(bytes)
    editor.graph.images.set(imageHash, bytes)

    const fill = createImageFill(imageHash, mode)
    editor.updateNodeWithUndo(node.id, { fills: [fill] }, 'Set texture background')
    setShadrData(editor, [node], {
      textureName,
      imageFit: mode === 'FILL' ? 'cover' : 'contain'
    })
  },

  /** Extracts image fill bytes and texture name from a node if it has an IMAGE fill */
  extractNodeTexture(
    editor: EditorStore,
    node: SceneNode
  ): { textureName: string; bytes: Uint8Array } | null {
    const imageFill = (node.fills ?? []).find((f) => f.type === 'IMAGE' && f.imageHash)
    if (!imageFill?.imageHash) return null

    const bytes = editor.graph.images.get(imageFill.imageHash)
    if (!bytes) return null

    return {
      textureName: node.name.replace(/^img_/, '') || 'texture',
      bytes
    }
  },

  /** Preloads server textures for all nodes with textureName in the active graph */
  async preloadGraphTextures(editor: EditorStore): Promise<void> {
    const nodes = Array.from(editor.graph.nodes.values())
    const textureNames = new Set<string>()
    for (const n of nodes) {
      const data = getShadrData(n, editor.graph)
      if (data.textureName) textureNames.add(data.textureName)
    }
    if (textureNames.size === 0) return

    await ensureServerKnownTextures()

    await Promise.all(
      Array.from(textureNames).map(async (name) => {
        try {
          if (serverKnownTextures.size > 0 && !serverKnownTextures.has(cleanTextureName(name))) {
            throw new Error(`Texture "${name}" is not on server`)
          }
          const bytes = await imageService.getBytes(name)
          const imageHash = computeImageHash(bytes)
          editor.graph.images.set(imageHash, bytes)
          recordServerTexture(name, imageHash)
          applyImageFillToMatchingNodes(editor, nodes, name, imageHash)
        } catch (err) {
          console.warn(`[Shadr] Could not preload texture ${name}:`, err)
          const sample = nodes.find((n) => getShadrData(n, editor.graph).textureName === name)
          const placeholder = await createMissingTexturePlaceholder(
            name,
            sample?.width ?? 320,
            sample?.height ?? 180
          )
          if (placeholder) {
            const placeholderHash = computeImageHash(placeholder)
            missingImageHashes.add(placeholderHash)
            editor.graph.images.set(placeholderHash, placeholder)
            applyImageFillToMatchingNodes(editor, nodes, name, placeholderHash, 'FIT')
          }
        }
      })
    )
    editor.state.sceneVersion++
    editor.requestRender()
  },

  /**
   * Scans explicit Shadr image blocks in the target scenes and uploads any truly new or modified textures
   * to the Shadr server. Arbitrary canvas nodes with image fills are never uploaded.
   */
  async autoUploadGraphImages(editor: EditorStore, pageNames?: string[]): Promise<number> {
    const imageNodes = collectExplicitImageNodes(editor, pageNames)
    if (imageNodes.length === 0) return 0

    await ensureServerKnownTextures()

    const results = await Promise.all(
      imageNodes.map((node) => uploadNodeTextureIfNeeded(editor, node))
    )
    const uploadedCount = compact(results).length

    if (uploadedCount > 0) {
      toast.info(`Синхронизировано текстур с сервером: ${uploadedCount}`)
    }
    return uploadedCount
  }
}
