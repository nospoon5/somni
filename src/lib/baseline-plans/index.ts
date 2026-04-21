import type { DailyPlanFeedTarget, DailyPlanRecord, DailyPlanSleepTarget } from '@/lib/daily-plan'
import newbornTemplate from './templates/0-8wk.json'
import eightToSixteenWeeksTemplate from './templates/8-16wk.json'
import sixteenToTwentyEightWeeksTemplate from './templates/16-28wk.json'
import twentyEightToFortyWeeksTemplate from './templates/28-40wk.json'
import fortyToFiftyTwoWeeksTemplate from './templates/40-52wk.json'
import fiftyTwoToSeventyEightWeeksTemplate from './templates/52-78wk.json'
import seventyEightWeeksPlusTemplate from './templates/78wk-plus.json'

type BaselinePlanTemplate = DailyPlanRecord
const FALLBACK_TEMPLATE = seventyEightWeeksPlusTemplate as BaselinePlanTemplate

const BASELINE_TEMPLATES: Array<{
  maxAgeInWeeks: number
  template: BaselinePlanTemplate
}> = [
  { maxAgeInWeeks: 8, template: newbornTemplate as BaselinePlanTemplate },
  { maxAgeInWeeks: 16, template: eightToSixteenWeeksTemplate as BaselinePlanTemplate },
  { maxAgeInWeeks: 28, template: sixteenToTwentyEightWeeksTemplate as BaselinePlanTemplate },
  { maxAgeInWeeks: 40, template: twentyEightToFortyWeeksTemplate as BaselinePlanTemplate },
  { maxAgeInWeeks: 52, template: fortyToFiftyTwoWeeksTemplate as BaselinePlanTemplate },
  { maxAgeInWeeks: 78, template: fiftyTwoToSeventyEightWeeksTemplate as BaselinePlanTemplate },
  { maxAgeInWeeks: Number.POSITIVE_INFINITY, template: FALLBACK_TEMPLATE },
]

function cloneSleepTargets(targets: ReadonlyArray<DailyPlanSleepTarget>) {
  return targets.map((target) => ({ ...target }))
}

function cloneFeedTargets(targets: ReadonlyArray<DailyPlanFeedTarget>) {
  return targets.map((target) => ({ ...target }))
}

function pickTemplate(ageInWeeks: number): BaselinePlanTemplate {
  return BASELINE_TEMPLATES.find((entry) => ageInWeeks <= entry.maxAgeInWeeks)?.template ?? FALLBACK_TEMPLATE
}

export function getBaselinePlan(ageInWeeks: number, babyName: string): DailyPlanRecord {
  const template = pickTemplate(Math.max(0, Math.floor(ageInWeeks)))
  const safeBabyName = babyName.trim() || 'your baby'

  return {
    id: template.id,
    babyId: template.babyId,
    planDate: template.planDate,
    sleepTargets: cloneSleepTargets(template.sleepTargets),
    feedTargets: cloneFeedTargets(template.feedTargets),
    notes: template.notes?.replaceAll('{{babyName}}', safeBabyName) ?? null,
    updatedAt: template.updatedAt,
  }
}
