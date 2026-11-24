import { describe, expect, test } from 'bun:test'

import { SceneGraph } from '@open-pencil/scene-graph'
import { asDouble } from '@open-pencil/test-support/doubles'

import type { EditorStore } from '@/app/editor/active-store'
import { shadrConverter } from '@/app/integrations/shadr/converter'
import { getShadrData, setShadrData } from '@/app/integrations/shadr/data'
import type { ShadrPage } from '@/app/integrations/shadr/types'
import { imageService } from '@/components/event-builder/services/image.service'

describe('Shadr Image & Texture Integration', () => {
  test('imports image element and exports back with textureName and fit', () => {
    const page: ShadrPage = {
      name: 'gallery',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'image',
          id: 'banner_bg',
          image: 'overworld_banner',
          fit: 'cover',
          position: { x: 100, y: 150 },
          size: { width: 800, height: 400 }
        }
      ]
    }

    const graph = shadrConverter.importPage(page)
    const pageNode = graph.getPages()[0]
    const rootFrame = graph.getChildren(pageNode.id)[0]
    const imgNode = graph.getChildren(rootFrame.id)[0]

    expect(imgNode).toBeDefined()
    expect(imgNode.name).toBe('img_overworld_banner')
    expect(imgNode.width).toBe(800)
    expect(imgNode.height).toBe(400)

    const data = getShadrData(imgNode)
    expect(data.textureName).toBe('overworld_banner')
    expect(data.imageFit).toBe('cover')

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'gallery')
    expect(exported.blocks.length).toBe(1)
    const expImg = exported.blocks[0]
    expect(expImg.type).toBe('image')
    expect(expImg.image).toBe('overworld_banner')
    expect(expImg.fit).toBe('cover')
    expect(expImg.position?.x).toBe(100)
    expect(expImg.position?.y).toBe(150)
  })

  test('applies texture as native IMAGE background fill and extracts it', () => {
    const graph = new SceneGraph()
    const pageNode = graph.getPages()[0]
    const node = graph.createNode('RECTANGLE', pageNode.id, {
      name: 'card',
      x: 0,
      y: 0,
      width: 300,
      height: 200
    })

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id },
      getSelectedNodes: () => [node],
      updateNodeWithUndo: (id: string, patch: Partial<typeof node>) => {
        graph.updateNode(id, patch)
      }
    })

    const fakeBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])
    imageService.applyTextureAsBackground(mockEditor, node, 'dirt_texture', fakeBytes, 'FILL')

    const updatedNode = graph.getNode(node.id)
    expect(updatedNode).toBeDefined()
    const fill = updatedNode?.fills?.[0]
    expect(fill?.type).toBe('IMAGE')
    expect(fill?.imageHash).toBeDefined()
    const imageHash = fill?.imageHash ?? ''
    expect(graph.images.get(imageHash)).toEqual(fakeBytes)

    const extracted = updatedNode ? imageService.extractNodeTexture(mockEditor, updatedNode) : null
    expect(extracted).not.toBeNull()
    expect(extracted?.bytes).toEqual(fakeBytes)
  })

  test('text centering calculates position.x as center anchor on export', () => {
    const page: ShadrPage = {
      name: 'hud',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'text',
          id: 'title',
          text: 'Welcome',
          textAlign: 'center',
          position: { x: 960, y: 100 },
          size: { width: 400, height: 50 }
        }
      ]
    }

    const graph = shadrConverter.importPage(page)
    const pageNode = graph.getPages()[0]
    const rootFrame = graph.getChildren(pageNode.id)[0]
    const textNode = graph.getChildren(rootFrame.id)[0]

    expect(textNode.type).toBe('TEXT')
    expect(textNode.textAlignHorizontal).toBe('CENTER')

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'hud')
    const expText = exported.blocks[0]
    expect(expText.type).toBe('text')
    expect(expText.textAlign).toBe('center')
    // In Shadr, position.x of centered text should equal textNode.x + textNode.width / 2
    expect(expText.position?.x).toBe(Math.round(textNode.x + textNode.width / 2))
  })

  test('exports actions including onClickAction and onSubmitAction', () => {
    const page: ShadrPage = {
      name: 'input_page',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'block',
          id: 'submit_btn',
          onClickAction: ['sound: shadr.click', 'open: success_dialog'],
          position: { x: 50, y: 50 },
          size: { width: 100, height: 40 }
        }
      ]
    }

    const graph = shadrConverter.importPage(page)
    const pageNode = graph.getPages()[0]
    const rootFrame = graph.getChildren(pageNode.id)[0]
    const btnNode = graph.getChildren(rootFrame.id)[0]

    const data = getShadrData(btnNode)
    expect(data.onClickAction).toEqual(['sound: shadr.click', 'open: success_dialog'])

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'input_page')
    expect(exported.blocks[0].onClickAction).toEqual(['sound: shadr.click', 'open: success_dialog'])
  })

  test('auto-derives image element from native IMAGE fill without img_ prefix', () => {
    const graph = new SceneGraph()
    const pageNode = graph.getPages()[0]
    const rootFrame = graph.createNode('FRAME', pageNode.id, {
      name: 'screen_1920',
      width: 1920,
      height: 1080
    })

    const fakeBytes = new Uint8Array([1, 2, 3, 4])
    const hash = 'abcd1234efgh'
    graph.images.set(hash, fakeBytes)

    graph.createNode('RECTANGLE', rootFrame.id, {
      name: 'avatar_icon',
      x: 10,
      y: 20,
      width: 64,
      height: 64,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          imageScaleMode: 'FIT',
          opacity: 1,
          visible: true,
          color: { r: 1, g: 1, b: 1, a: 1 }
        }
      ]
    })

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'test_page')
    expect(exported.blocks.length).toBe(1)
    const block = exported.blocks[0]
    expect(block.type).toBe('image')
    expect(block.image).toBe('avatar_icon')
    expect(block.fit).toBe('contain')
  })

  test('auto-syncs component params (label, color, dimensions) from native OpenPencil properties on export', () => {
    const graph = new SceneGraph()
    const pageNode = graph.getPages()[0]
    const rootFrame = graph.createNode('FRAME', pageNode.id, {
      name: 'screen_1920',
      width: 1920,
      height: 1080
    })

    const compNode = graph.createNode('FRAME', rootFrame.id, {
      name: 'action_btn',
      x: 50,
      y: 60,
      width: 250,
      height: 55,
      cornerRadius: 4,
      fills: [
        {
          type: 'SOLID',
          color: { r: 1, g: 0, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokes: [
        {
          type: 'SOLID',
          color: { r: 0, g: 0, b: 1, a: 1 },
          opacity: 1,
          visible: true
        }
      ],
      strokeWeight: 1
    })

    graph.createNode('TEXT', compNode.id, {
      name: 'btn_label',
      text: 'Нажми меня!',
      fontSize: 16,
      fills: [
        {
          type: 'SOLID',
          color: { r: 0, g: 1, b: 0, a: 1 },
          opacity: 1,
          visible: true
        }
      ]
    })

    // Set component Shadr data
    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id },
      updateNodeWithUndo: (id: string, patch: Partial<typeof compNode>) => {
        graph.updateNode(id, patch)
      }
    })

    setShadrData(mockEditor, [compNode], {
      componentName: 'custom_button',
      componentParams: {
        label: 'Old text',
        color: '#000000',
        border: '#ffffff',
        textColor: '#ffffff',
        fontSize: 32,
        rounding: 'large',
        width: 100,
        height: 30
      }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'test_comp')
    expect(exported.blocks.length).toBe(1)
    const block = exported.blocks[0]
    expect(block.type).toBe('component')
    expect(block.component).toBe('custom_button')
    // label auto-synced from text child
    expect(block.params?.label).toBe('Нажми меня!')
    // color auto-synced from fills
    expect(block.params?.color).toBe('ff0000')
    // border auto-synced from strokes
    expect(block.params?.border).toBe('0000ff')
    // textColor auto-synced from text child fills
    expect(block.params?.textColor).toBe('00ff00')
    // fontSize auto-synced from text child fontSize (16 * 4 = 64)
    expect(block.params?.fontSize).toBe(64)
    // rounding auto-synced from cornerRadius (4 -> 'small')
    expect(block.params?.rounding).toBe('small')
    // width and height auto-synced from frame dimensions
    expect(block.params?.width).toBe(250)
    expect(block.params?.height).toBe(55)
  })

  test('does not re-upload textures that already exist on server', async () => {
    const graph = new SceneGraph()
    const pageNode = graph.getPages()[0]
    const rootFrame = graph.createNode('FRAME', pageNode.id, {
      name: 'screen',
      width: 1920,
      height: 1080
    })

    const bytes = new Uint8Array([10, 20, 30])
    const hash = 'existing_hash_123'
    graph.images.set(hash, bytes)

    const imgNode = graph.createNode('RECTANGLE', rootFrame.id, {
      name: 'server_logo',
      width: 100,
      height: 100,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          opacity: 1,
          visible: true,
          color: { r: 1, g: 1, b: 1, a: 1 }
        }
      ]
    })

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id },
      updateNodeWithUndo: (id: string, patch: Partial<typeof imgNode>) => {
        graph.updateNode(id, patch)
      }
    })

    setShadrData(mockEditor, [imgNode], {
      textureName: 'server_logo'
    })

    const uploadedNames: string[] = []
    const originalUpload = imageService.upload
    imageService.upload = async (name: string) => {
      uploadedNames.push(name)
    }

    try {
      const { clearImageCache, recordServerTexture } =
        await import('@/components/event-builder/services/image.service')
      clearImageCache()
      // Mark as existing on server
      recordServerTexture('server_logo', hash)

      const count = await imageService.autoUploadGraphImages(mockEditor)
      expect(count).toBe(0)
      expect(uploadedNames.length).toBe(0)
    } finally {
      imageService.upload = originalUpload
    }
  })

  test('uploads brand new local texture that does not exist on server', async () => {
    const graph = new SceneGraph()
    const pageNode = graph.getPages()[0]
    const rootFrame = graph.createNode('FRAME', pageNode.id, {
      name: 'screen',
      width: 1920,
      height: 1080
    })

    const bytes = new Uint8Array([99, 88, 77])
    const hash = 'new_local_hash_456'
    graph.images.set(hash, bytes)

    const imgNode = graph.createNode('RECTANGLE', rootFrame.id, {
      name: 'img_brand_new_icon',
      width: 50,
      height: 50,
      fills: [
        {
          type: 'IMAGE',
          imageHash: hash,
          opacity: 1,
          visible: true,
          color: { r: 1, g: 1, b: 1, a: 1 }
        }
      ]
    })

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id },
      updateNodeWithUndo: (id: string, patch: Partial<typeof imgNode>) => {
        graph.updateNode(id, patch)
      }
    })

    const uploadedNames: string[] = []
    const originalUpload = imageService.upload
    const originalList = imageService.list
    imageService.upload = async (name: string) => {
      uploadedNames.push(name)
    }
    imageService.list = async () => []

    try {
      const { clearImageCache } = await import('@/components/event-builder/services/image.service')
      clearImageCache()

      const count = await imageService.autoUploadGraphImages(mockEditor)
      expect(count).toBe(1)
      expect(uploadedNames).toEqual(['brand_new_icon'])
    } finally {
      imageService.upload = originalUpload
      imageService.list = originalList
    }
  })
})
