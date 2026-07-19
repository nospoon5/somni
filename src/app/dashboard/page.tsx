import { redirect } from "next/navigation";
import Link from "next/link";
import { createRequestLogger } from "@/lib/observability/logger";
import type { Database } from "@/types/database.types";
import { DailyPlanPanel } from "@/components/dashboard/DailyPlanPanel";
import { BabySwitcher } from "@/components/babies/BabySwitcher";
import { NextBestActionCard } from "@/components/dashboard/NextBestActionCard";
import { CaregiverHandoffTimeline, type TimelineEvent } from "@/components/dashboard/CaregiverHandoffTimeline";
import { NotificationBell } from "@/components/dashboard/NotificationBell";
import { SleepScorePanel } from "@/components/dashboard/SleepScorePanel";
import { calculateNextBestAction } from "@/lib/next-best-action/engine";
import { selectDailyPlanForDashboard } from "@/lib/daily-plan-derivation";
import { normalizeDailyPlanRow } from "@/lib/daily-plan";
import { getAgeInWeeks, getDateStringForTimezone } from "@/lib/date-utils";
import {
  normalizeDayStructure,
  normalizeNapPattern,
  normalizeSchedulePreference,
  normalizeSleepStyleLabel,
  parseNightFeeds,
} from "@/lib/onboarding-preferences";
import { ensureSleepPlanProfile } from "@/lib/sleep-plan-profile-init";
import {
  normalizeSleepPlanChangeEventRow,
  normalizeSleepPlanClockTime,
  type SleepPlanChangeEventRecord,
  type SleepPlanProfileRecord,
} from "@/lib/sleep-plan-profile";
import { createClient } from "@/lib/supabase/server";
import { readActiveBabyId, resolveActiveBaby } from "@/lib/babies/active-baby";
import { sanitizeTimezone } from "@/lib/billing/usage";
import {
  calculateSleepScore,
  getSleepScoreLookbackStart,
  SLEEP_SCORE_FETCH_LIMIT,
} from "@/lib/scoring/sleep-score";
import styles from "./page.module.css";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const reqLogger = createRequestLogger({ action: "dashboard" });
  const preferredBabyId = await readActiveBabyId();

  // 1. Initial independent reads (Profile, Baby, Notifications)
  const [profileResult, babyResult, notificationRowsResult, unreadCountResult] =
    await reqLogger.timeStage("dashboard_data_initial", () => Promise.all([
      supabase
        .from("profiles")
        .select("full_name, onboarding_completed, timezone")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("babies")
        .select("id, name, date_of_birth")
        .order("created_at", { ascending: true }),
      supabase
        .from("notification_logs")
        .select("id, title, body, is_read, created_at")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("notification_logs")
        .select("id", { count: "exact", head: true })
        .eq("profile_id", user.id)
        .eq("is_read", false),
      ]),
    );

  const profile = profileResult.data;
  const babies = babyResult.data ?? [];
  const baby = resolveActiveBaby(babies, preferredBabyId);
  const notificationRows = notificationRowsResult.data ?? [];
  const unreadNotificationCount = unreadCountResult.count ?? 0;

  if (!profile?.onboarding_completed) {
    redirect("/onboarding");
  }

  const timezone = sanitizeTimezone(profile.timezone);
  const todayPlanDate = getDateStringForTimezone(timezone);
  const lookbackStart = getSleepScoreLookbackStart();

  // 2. Baby-dependent parallel reads
  let preferencesRow = null;
  let dailyPlanRow = null;
  let changeEventRows: Database['public']['Tables']['sleep_plan_change_events']['Row'][] = [];
  let activeLog = null;
  let recentSleepLogs: (Pick<Database['public']['Tables']['sleep_logs']['Row'], 'id' | 'started_at' | 'ended_at' | 'is_night' | 'tags'> & { profiles?: { full_name: string | null } | null })[] = [];

  if (baby) {
    const [prefRes, planRes, eventsRes, activeLogRes, recentLogsRes] =
      await reqLogger.timeStage("dashboard_data_baby", () => Promise.all([
        supabase
          .from("onboarding_preferences")
          .select(
            "sleep_style_label, typical_wake_time, day_structure, nap_pattern, night_feeds, schedule_preference",
          )
          .eq("baby_id", baby.id)
          .maybeSingle(),
        supabase
          .from("daily_plans")
          .select(
            "id, baby_id, plan_date, sleep_targets, feed_targets, notes, updated_at, pending_rescue_targets, rescue_dismissed",
          )
          .eq("baby_id", baby.id)
          .eq("plan_date", todayPlanDate)
          .maybeSingle(),
        supabase
          .from("sleep_plan_change_events")
          .select(
            "id, baby_id, sleep_plan_profile_id, plan_date, change_scope, change_source, change_kind, evidence_confidence, summary, rationale, before_snapshot, after_snapshot, created_at",
          )
          .eq("baby_id", baby.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("sleep_logs")
          .select("id, started_at, ended_at, is_night, tags")
          .eq("baby_id", baby.id)
          .is("ended_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("sleep_logs")
          .select("id, started_at, ended_at, is_night, tags, profiles!sleep_logs_logged_by_fkey (full_name)")
          .eq("baby_id", baby.id)
          .gte("started_at", lookbackStart.toISOString())
          .order("started_at", { ascending: false })
          .limit(SLEEP_SCORE_FETCH_LIMIT),
      ]),
      );

    preferencesRow = prefRes.data;
    dailyPlanRow = planRes.data;
    changeEventRows = eventsRes.data ?? [];
    activeLog = activeLogRes.data;
    recentSleepLogs = recentLogsRes.data ?? [];

    if (planRes.error) {
      console.error("[dashboard] failed to load daily plan", planRes.error);
    }
  }

  // 3. Dependent logic
  let sleepPlanProfile: SleepPlanProfileRecord | null = null;

  if (baby) {
    try {
      const ensureResult = await ensureSleepPlanProfile({
        supabase,
        source: "system",
        id: baby.id,
        name: baby.name,
        dateOfBirth: baby.date_of_birth,
        sleepStyleLabel: normalizeSleepStyleLabel(
          preferencesRow?.sleep_style_label,
        ),
        typicalWakeTime: normalizeSleepPlanClockTime(
          preferencesRow?.typical_wake_time,
        ),
        dayStructure: normalizeDayStructure(preferencesRow?.day_structure),
        napPattern: normalizeNapPattern(preferencesRow?.nap_pattern),
        nightFeeds: parseNightFeeds(
          typeof preferencesRow?.night_feeds === "boolean"
            ? preferencesRow.night_feeds
              ? "yes"
              : "no"
            : null,
        ),
        schedulePreference: normalizeSchedulePreference(
          preferencesRow?.schedule_preference,
        ),
      });
      sleepPlanProfile = ensureResult.profile;
    } catch (profileBootstrapError) {
      console.error(
        "[dashboard] failed to bootstrap sleep plan profile",
        profileBootstrapError,
      );
    }
  }

  // 4. Transform data for UI
  const dailyPlan = normalizeDailyPlanRow(dailyPlanRow);
  const normalizedChangeEvents = changeEventRows
    .map((row) => normalizeSleepPlanChangeEventRow(row))
    .filter((row): row is SleepPlanChangeEventRecord => row !== null);

  const latestDailyChangeEvent = normalizedChangeEvents.find(
    (event) =>
      event.changeScope === "daily" && event.planDate === todayPlanDate,
  );

  const ageInWeeks = baby
    ? getAgeInWeeks(baby.date_of_birth, todayPlanDate)
    : null;
  const selectedPlan = baby
    ? selectDailyPlanForDashboard({
        savedPlan: dailyPlan,
        profile: sleepPlanProfile,
        ageInWeeks,
        babyId: baby.id,
        babyName: baby.name,
        planDate: todayPlanDate,
      })
    : { source: "none" as const, plan: null };

  const initialPlan =
    selectedPlan.plan &&
    selectedPlan.source === "saved_daily_plan" &&
    latestDailyChangeEvent
      ? {
          ...selectedPlan.plan,
          updatedAt: latestDailyChangeEvent.createdAt,
          metadata: {
            origin: "saved_daily_plan" as const,
            confidence: latestDailyChangeEvent.evidenceConfidence,
            reasonSummary: latestDailyChangeEvent.summary,
          },
        }
      : selectedPlan.plan;

  const sleepScore = baby
    ? calculateSleepScore(baby.date_of_birth, [
        ...recentSleepLogs.map((log) => ({
          startedAt: log.started_at,
          endedAt: log.ended_at,
          isNight: log.is_night,
          tags: log.tags ?? [],
        })),
        ...(activeLog
          ? [
              {
                startedAt: activeLog.started_at,
                endedAt: activeLog.ended_at,
                isNight: activeLog.is_night,
                tags: activeLog.tags ?? [],
              },
            ]
          : []),
      ])
    : null;

  const firstName = profile.full_name?.trim().split(/\s+/)[0];
  const dashboardTitle = firstName ? `Hi, ${firstName}.` : "Hi there.";

  const notifications = notificationRows.map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    isRead: notification.is_read,
    createdAt: notification.created_at,
  }));

  const now = new Date();

  const nbaInputs = {
    currentTime: now.toISOString(),
    timezone: timezone,
    babyAgeWeeks: ageInWeeks,
    activeSleep: activeLog ? {
      id: activeLog.id,
      startedAt: activeLog.started_at,
      endedAt: activeLog.ended_at,
      isNight: activeLog.is_night,
      tags: activeLog.tags ?? []
    } : null,
    latestCompletedSleep: recentSleepLogs[0] ? {
      id: recentSleepLogs[0].id,
      startedAt: recentSleepLogs[0].started_at,
      endedAt: recentSleepLogs[0].ended_at,
      isNight: recentSleepLogs[0].is_night,
      tags: recentSleepLogs[0].tags ?? []
    } : null,
    todaysLogs: recentSleepLogs.map(log => ({
      id: log.id,
      startedAt: log.started_at,
      endedAt: log.ended_at,
      isNight: log.is_night,
      tags: log.tags ?? []
    })),
    todaysAcceptedPlan: initialPlan ? {
      sleepTargets: initialPlan.sleepTargets,
      feedTargets: initialPlan.feedTargets
    } : null,
    pendingRescue: dailyPlan?.pendingRescueTargets && !dailyPlan.rescueDismissed ? dailyPlan.pendingRescueTargets : null,
    durableBaseline: sleepPlanProfile ? {
      targetBedtime: sleepPlanProfile.targetBedtime,
      usualWakeTime: sleepPlanProfile.usualWakeTime,
      targetNapCount: sleepPlanProfile.targetNapCount,
      wakeWindows: sleepPlanProfile.wakeWindowProfile.windows
    } : null,
    onboardingConstraints: sleepPlanProfile ? {
      dayStructure: sleepPlanProfile.dayStructure
    } : null
  };

  const nextBestAction = calculateNextBestAction(nbaInputs);

  reqLogger.info('[dashboard] next_best_action_rendered', {
    state: nextBestAction.state,
    action: nextBestAction.actionTitle,
    allowedActions: nextBestAction.allowedActions
  });

  const timelineEvents: TimelineEvent[] = [];

  for (const log of recentSleepLogs) {
    timelineEvents.push({
      id: `sleep_start_${log.id}`,
      timestamp: log.started_at,
      description: `Started ${log.is_night ? 'night sleep' : 'nap'}` + (log.tags.length > 0 ? ` (${log.tags.join(', ')})` : ''),
      attribution: log.profiles?.full_name ?? undefined,
    });
    if (log.ended_at) {
      timelineEvents.push({
        id: `sleep_end_${log.id}`,
        timestamp: log.ended_at,
        description: `Ended ${log.is_night ? 'night sleep' : 'nap'}`,
        attribution: log.profiles?.full_name ?? undefined,
      });
    }
  }

  for (const event of changeEventRows) {
    if (event.change_kind !== 'background' && event.change_source === 'user') {
      timelineEvents.push({
        id: `event_${event.id}`,
        timestamp: event.created_at,
        description: event.summary,
      });
    }
  }

  timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const topEvents = timelineEvents.slice(0, 5);

  return (
    <main className={styles.page}>
      <section className={`${styles.card} card`}>
        <div className={styles.header}>
          <div>
            <p className={`${styles.eyebrow} text-label`}>Dashboard</p>
            <h1 className={`${styles.title} text-display`}>{dashboardTitle}</h1>
            <div className={styles.actions}>
              <Link className={styles.quickLink} href="/sleep">
                Sleep
              </Link>
              <Link className={styles.quickLink} href="/chat">
                Chat
              </Link>
            </div>
          </div>
          <NotificationBell
            initialNotifications={notifications}
            initialUnreadCount={unreadNotificationCount}
          />
        </div>

        <BabySwitcher
          babies={babies}
          activeBabyId={baby?.id ?? null}
          returnTo="/dashboard"
        />

        <NextBestActionCard
          recommendation={nextBestAction}
          babyId={baby?.id}
          planDate={todayPlanDate}
        />

        <SleepScorePanel
          sleepScore={sleepScore}
          hasActiveSleep={Boolean(activeLog)}
          styles={styles}
        />

        <DailyPlanPanel
          profileId={user.id}
          babyId={baby?.id ?? null}
          babyName={baby?.name ?? "your baby"}
          initialPlan={initialPlan}
          sleepPlanProfile={sleepPlanProfile}
          todayPlanDate={todayPlanDate}
        />

        <CaregiverHandoffTimeline events={topEvents} />
      </section>
    </main>
  );
}
