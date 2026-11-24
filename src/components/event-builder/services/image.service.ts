import { type Fill, type SceneNode } from '@open-pencil/scene-graph'
import { computeImageHash } from '@open-pencil/scene-graph/images'

import type { EditorStore } from '@/app/editor/active-store'
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
}

export function cleanTextureName(name: string): string {
  return name
    .replace(/^img_/, '')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .toLowerCase()
}

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
    if (p.name === '_components') return false
    if (pageNames && pageNames.length > 0) return pageNames.includes(p.name)
    return p.id === editor.state.currentPageId
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

  // Only process nodes that are EXPLICITLY Shadr image blocks
  return candidateNodes.filter((n) => {
    const data = getShadrData(n, graph)
    if (!data.textureName && !n.name.startsWith('img_')) return false
    return !!findPrimaryImageFill(n)?.imageHash
  })
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
  if (!imageHash) return false

  const bytes = editor.graph.images.get(imageHash)
  if (!bytes || bytes.length === 0) return false

  const currentData = getShadrData(node, editor.graph)
  const textureName =
    currentData.textureName || cleanTextureName(node.name) || `texture_${imageHash.slice(0, 8)}`
  const cleanId = cleanTextureName(textureName)

  if (currentData.textureName !== textureName) {
    setShadrData(editor, [node], { textureName })
  }

  const uploadKey = `${cleanId}_${imageHash}`
  if (uploadedHashes.has(uploadKey)) return false

  const isKnownOnServer = serverKnownTextures.has(cleanId)
  const serverHash = serverImageHashes.get(cleanId)
  if (isKnownOnServer && (serverHash === imageHash || (!serverHash && currentData.textureName))) {
    if (!serverHash) serverImageHashes.set(cleanId, imageHash)
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
    console.warn(`[Shadr] Could not auto-upload texture "${textureName}":`, err)
    return false
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
    try {
      return await http.binary(`/images/${encodeURIComponent(cleanName)}`)
    } catch {
      // Fallback with .png extension if not found
      return await http.binary(`/images/${encodeURIComponent(cleanName)}.png`)
    }
  },

  /** Uploads or replaces a texture image file on the Shadr server using PUT /images/{id} */
  async upload(name: string, file: Blob | Uint8Array): Promise<void> {
    const cleanId = cleanTextureName(name)
    await http.putBinary(`/images/${encodeURIComponent(cleanId)}`, file, 'image/png')
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
      const data = getShadrData(n)
      if (data.textureName) textureNames.add(data.textureName)
    }
    if (textureNames.size === 0) return

    await Promise.all(
      Array.from(textureNames).map(async (name) => {
        try {
          const bytes = await imageService.getBytes(name)
          if (!bytes || bytes.length === 0) return
          const imageHash = computeImageHash(bytes)
          editor.graph.images.set(imageHash, bytes)
          recordServerTexture(name, imageHash)

          for (const n of nodes) {
            const data = getShadrData(n)
            if (data.textureName === name) {
              const hasImage = (n.fills ?? []).some((f: Fill) => f.type === 'IMAGE')
              if (!hasImage) {
                editor.graph.updateNode(n.id, {
                  fills: [createImageFill(imageHash, data.imageFit === 'contain' ? 'FIT' : 'FILL')]
                })
              }
            }
          }
        } catch (err) {
          console.warn(`[Shadr] Could not preload texture ${name}:`, err)
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

    let uploadedCount = 0
    for (const node of imageNodes) {
      if (await uploadNodeTextureIfNeeded(editor, node)) {
        uploadedCount++
      }
    }

    if (uploadedCount > 0) {
      toast.info(`Синхронизировано текстур с сервером: ${uploadedCount}`)
    }
    return uploadedCount
  }
}
