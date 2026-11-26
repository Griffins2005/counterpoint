import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'
import {
  classifyInvestigation,
  deleteInvestigation,
  investigateClaim,
  synthesizeInvestigation,
} from './investigate'

export const actions: Record<string, ActionHandler<Env>> = {
  investigateClaim: (ctx) => investigateClaim(ctx),
  classifyInvestigation: (ctx) => classifyInvestigation(ctx),
  synthesizeInvestigation: (ctx) => synthesizeInvestigation(ctx),
  deleteInvestigation: (ctx) => deleteInvestigation(ctx),
}
