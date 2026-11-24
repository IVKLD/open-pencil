import { http } from '@/app/integrations/shadr/http/http-client'
import type {
  ShadrComponent,
  ShadrEffect,
  ShadrGrading,
  ShadrLang,
  ShadrPage
} from '@/app/integrations/shadr/types'

function createResourceService<T extends object>(resource: string) {
  const base = `/configs/${resource}`
  return {
    list: (): Promise<string[]> => http.get<{ ids: string[] }>(base).then((r) => r.ids ?? []),

    get: (id: string): Promise<T> =>
      http.get<{ document: T }>(`${base}/${encodeURIComponent(id)}`).then((r) => r.document),

    save: (id: string, item: T): Promise<void> =>
      http.put(`${base}/${encodeURIComponent(id)}`, item),

    delete: (id: string): Promise<void> => http.delete(`${base}/${encodeURIComponent(id)}`)
  }
}

/** HTTP API service for Shadr pages */
export const pageService = createResourceService<ShadrPage>('pages')

/** HTTP API service for Shadr components */
export const componentService = createResourceService<ShadrComponent>('components')

/** HTTP API service for Shadr effects */
export const effectService = createResourceService<ShadrEffect>('effects')

/** HTTP API service for Shadr lang (default) */
export const langService = createResourceService<ShadrLang>('lang')

/** HTTP API service for Shadr grading presets */
export const gradingService = createResourceService<ShadrGrading>('grading')
