import './app.css'
import { reportBootFailure, runSupportGate } from '@/app/shell/support/gate'

import { boot } from './boot'

async function start(): Promise<void> {
  if (!(await runSupportGate())) return
  try {
    if (__OPENPENCIL_CLOUD_SITE__) {
      const { enterCloudSite } = await import('@/app/cloud-portal/site')
      if (!(await enterCloudSite())) return
    }
    await boot()
  } catch (error) {
    await reportBootFailure(error)
  }
}

const bootPromise = start()
if (typeof window !== 'undefined') {
  ;(window as any).__OPENPENCIL_APP__ = bootPromise
}
