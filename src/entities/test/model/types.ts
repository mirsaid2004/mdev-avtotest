export type TestSize = 10 | 20

export interface TestTemplate {
  /** e.g. "t20-14" - stable across rebuilds, safe to put in a URL */
  id: string
  size: TestSize
  /** display number, 1..N within its size group */
  number: number
  /** e-avtomaktab's own id for this template - kept for traceability */
  sourceNumber: number
  questionIds: number[]
}
