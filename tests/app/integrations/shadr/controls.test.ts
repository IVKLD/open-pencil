import { describe, expect, test } from 'bun:test'

import { asDouble } from '@open-pencil/test-support/doubles'

import type { EditorStore } from '@/app/editor/active-store'
import { shadrConverter } from '@/app/integrations/shadr/converter'
import type { ShadrPage } from '@/app/integrations/shadr/types'

describe('Shadr Controls Integration (slider, toggle, item)', () => {
  test('preserves slider, toggle, and item blocks with properties on round-trip', () => {
    const pageWithControls: ShadrPage = {
      name: 'controls_demo',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'slider',
          id: 'volume_slider',
          position: { x: 100, y: 100 },
          size: { width: 200, height: 20 },
          min: 0,
          max: 100,
          step: 5,
          value: 75
        },
        {
          type: 'toggle',
          id: 'sfx_toggle',
          position: { x: 100, y: 140 },
          size: { width: 40, height: 20 },
          checked: true,
          value: 1
        },
        {
          type: 'item',
          id: 'reward_item',
          position: { x: 100, y: 180 },
          size: { width: 32, height: 32 },
          item: 'minecraft:diamond_sword',
          customModelData: 1001,
          itemDisplay: 'gui'
        }
      ]
    }

    const graph = shadrConverter.importPage(pageWithControls)
    const pageNode = graph.getPages()[0]

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: pageNode.id
      }
    })

    const exported = shadrConverter.exportPage(mockEditor, 'controls_demo')

    const sliderBlock = exported.blocks.find((b) => b.id === 'volume_slider')
    expect(sliderBlock).toBeDefined()
    expect(sliderBlock?.type).toBe('slider')
    expect(sliderBlock?.min).toBe(0)
    expect(sliderBlock?.max).toBe(100)
    expect(sliderBlock?.step).toBe(5)
    expect(sliderBlock?.value).toBe(75)

    const toggleBlock = exported.blocks.find((b) => b.id === 'sfx_toggle')
    expect(toggleBlock).toBeDefined()
    expect(toggleBlock?.type).toBe('toggle')
    expect(toggleBlock?.checked).toBe(true)

    const itemBlock = exported.blocks.find((b) => b.id === 'reward_item')
    expect(itemBlock).toBeDefined()
    expect(itemBlock?.type).toBe('item')
    expect(itemBlock?.item).toBe('minecraft:diamond_sword')
    expect(itemBlock?.customModelData).toBe(1001)
    expect(itemBlock?.itemDisplay).toBe('gui')
  })

  test('hugs single-line text with large lineWidth without expanding bounding box, while preserving rawLineWidth on export', () => {
    const pageWithText: ShadrPage = {
      name: 'text_wrap_demo',
      screen: { width: 1920, height: 1080 },
      blocks: [
        {
          type: 'text',
          id: 'nether_number',
          position: { x: 754, y: 701 },
          size: { width: 36, height: 36 },
          text: '02 / NETHER',
          lineWidth: 1600
        },
        {
          type: 'text',
          id: 'long_desc',
          position: { x: 100, y: 200 },
          size: { width: 36, height: 36 },
          text: 'This is a very long description text that definitely exceeds two hundred pixels in width and wraps',
          lineWidth: 200
        }
      ]
    }

    const graph = shadrConverter.importPage(pageWithText)
    const pageNode = graph.getPages()[0]
    const screenFrame = graph.getChildren(pageNode.id)[0]
    const children = graph.getChildren(screenFrame.id)

    const shortTextNode = children.find((c) => c.name === 'nether_number')
    expect(shortTextNode).toBeDefined()
    if (!shortTextNode) throw new Error('shortTextNode not found')
    // Bounding box hugs text and does NOT stretch across screen to 1600
    expect(shortTextNode.textAutoResize).toBe('WIDTH_AND_HEIGHT')
    expect(shortTextNode.width).toBeLessThan(150)

    const wrappingTextNode = children.find((c) => c.name === 'long_desc')
    expect(wrappingTextNode).toBeDefined()
    if (!wrappingTextNode) throw new Error('wrappingTextNode not found')
    // Wrapping text maintains fixed width of 200
    expect(wrappingTextNode.textAutoResize).toBe('HEIGHT')
    expect(wrappingTextNode.width).toBe(200)

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: { currentPageId: pageNode.id }
    })
    const exported = shadrConverter.exportPage(mockEditor, 'text_wrap_demo')
    const expShort = exported.blocks.find((b) => b.id === 'nether_number')
    const expWrapping = exported.blocks.find((b) => b.id === 'long_desc')

    // Preserves original lineWidth on export
    expect(expShort?.lineWidth).toBe(1600)
    expect(expWrapping?.lineWidth).toBe(200)
  })
})
