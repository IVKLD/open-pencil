import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { asDouble } from '@open-pencil/test-support/doubles'

import type { EditorStore } from '@/app/editor/active-store'
import { shadrConverter } from '@/app/integrations/shadr/converter'
import type { ShadrPage } from '@/app/integrations/shadr/types'

describe('Shadr Project Converter', () => {
  test('imports full project with multiple scenes and components and exports back', () => {
    const menuRaw = readFileSync(resolve(process.cwd(), 'docs/shadr/pages/main_menu.json'), 'utf-8')
    const buttonRaw = readFileSync(
      resolve(process.cwd(), 'docs/shadr/components/button.json'),
      'utf-8'
    )
    const badgeRaw = readFileSync(
      resolve(process.cwd(), 'docs/shadr/components/badge.json'),
      'utf-8'
    )

    const pages = [asDouble<ShadrPage>(JSON.parse(menuRaw))]
    const components = {
      button: JSON.parse(buttonRaw),
      badge: JSON.parse(badgeRaw)
    }

    const graph = shadrConverter.importProject(pages, components)
    const docPages = graph.getPages()
    expect(docPages.length).toBe(2) // main_menu + _components
    expect(docPages[0].name).toBe('main_menu')
    expect(docPages[1].name).toBe('_components')

    const mockEditor = asDouble<EditorStore>({
      graph,
      state: {
        currentPageId: docPages[0].id
      }
    })

    const exported = shadrConverter.exportProject(mockEditor)
    expect(exported.pages.length).toBe(1)
    expect(exported.pages[0].name).toBe('main_menu')
    expect(Object.keys(exported.components)).toContain('button')
    expect(Object.keys(exported.components)).toContain('badge')
  })
})
