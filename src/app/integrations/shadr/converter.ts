import {
  exportComponent,
  importComponent,
  importComponentsIntoGraph
} from './converter/component-converter'
import { elementToNode } from './converter/element-to-node'
import {
  exportPage,
  exportProject,
  importPage,
  importProject,
  listProjectSceneNames
} from './converter/page-converter'

export const shadrConverter = {
  exportPage,
  importPage,
  exportProject,
  importProject,
  listProjectSceneNames,
  importComponentsIntoGraph,
  importComponent,
  exportComponent,
  addElementToGraph: elementToNode
}

export { colorToShadrHex, shadrHexToColor } from './converter/color'
export { parseCoordinate } from './converter/math'
export { componentRegistry, expandComponent } from './converter/template'
export { elementToNode } from './converter/element-to-node'
export { nodeToElement } from './converter/node-to-element'
export {
  exportComponent,
  importComponent,
  importComponentsIntoGraph
} from './converter/component-converter'
export {
  exportPage,
  exportProject,
  importPage,
  importProject,
  listProjectSceneNames
} from './converter/page-converter'
export { paramPlaceholder, simulatePlaceholders } from './converter/placeholder'
