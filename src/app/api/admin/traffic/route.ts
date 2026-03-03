import { NextRequest, NextResponse } from "next/server";
import { dbHttp } from "@/lib/db/client";
import { pageViews, analyticsEvents } from "@/lib/db/schema";
import { sql, gte, and } from "drizzle-orm";

export const runtime = "nodejs";

// Decode percent-encoded city names stored by older rows (e.g. "Santa%20Clara" → "Santa Clara")
function safeDecodeCity(city: string): string {
  try { return decodeURIComponent(city); } catch { return city; }
}

// Validate IANA timezone name — only allow safe characters to prevent SQL injection
function sanitizeTz(tz: string | null): string {
  if (tz && /^[A-Za-z][A-Za-z0-9/_-]{0,39}$/.test(tz)) return tz;
  return "UTC";
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);
    // Visitor's local timezone — used for hour/day-of-week bucketing
    const tz = sanitizeTz(searchParams.get("tz"));
    // humanOnly=1 → restrict to sessions with ≥3s page_exit event (filters bot drive-bys)
    const humanOnly = searchParams.get("humanOnly") === "1";

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const sinceFilter = gte(pageViews.createdAt, since);
    const eventsFilter = gte(analyticsEvents.createdAt, since);

    // Engaged-session subquery: sessions with at least one page_exit ≥ 3 seconds.
    // Bots that briefly execute JS still won't spend 3+ seconds on a page.
    const engagedSessionFilter = humanOnly
      ? sql`${pageViews.sessionId} IN (
          SELECT DISTINCT ae.session_id
          FROM analytics_events ae
          WHERE ae.event_type = 'page_exit'
            AND ae.created_at >= ${since}
            AND (ae.properties->>'durationSeconds')::float >= 3
        )`
      : undefined;

    // Combined filter for all page_views queries
    const pvFilter = humanOnly
      ? and(sinceFilter, engagedSessionFilter)
      : sinceFilter;

    // 1. Summary stats
    const [summaryRow] = await dbHttp
      .select({
        totalPageViews: sql<number>`count(*)::int`,
        uniqueSessions: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      })
      .from(pageViews)
      .where(pvFilter);

    const totalPageViews = summaryRow?.totalPageViews ?? 0;
    const uniqueSessions = summaryRow?.uniqueSessions ?? 0;
    const avgPagesPerSession =
      uniqueSessions > 0
        ? Math.round((totalPageViews / uniqueSessions) * 10) / 10
        : 0;

    // 2. Top pages
    const topPagesRaw = await dbHttp
      .select({
        path: pageViews.path,
        views: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(pvFilter)
      .groupBy(pageViews.path)
      .orderBy(sql`count(*) desc`)
      .limit(15);

    const topPages = topPagesRaw.map((row) => ({
      path: row.path,
      views: row.views,
      percentage:
        totalPageViews > 0
          ? Math.round((row.views / totalPageViews) * 100)
          : 0,
    }));

    // 3. Top products (paths matching /shop/[slug]) — views only; avg time added below
    const topProductsBase = topPagesRaw
      .filter(
        (row) =>
          row.path.startsWith("/shop/") && row.path.split("/").length === 3
      )
      .slice(0, 10)
      .map((row) => ({
        path: row.path,
        slug: row.path.replace("/shop/", ""),
        views: row.views,
      }));

    // 4. Visits by hour of day — bucketed in visitor's local timezone
    const byHourRaw = await dbHttp
      .select({
        hour: sql<number>`extract(hour from ${pageViews.createdAt} at time zone ${sql.raw("'" + tz + "'")})::int`,
        views: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(pvFilter)
      .groupBy(sql`extract(hour from ${pageViews.createdAt} at time zone ${sql.raw("'" + tz + "'")})`)
      .orderBy(sql`extract(hour from ${pageViews.createdAt} at time zone ${sql.raw("'" + tz + "'")})`);

    const byHour = Array.from({ length: 24 }, (_, h) => {
      const found = byHourRaw.find((r) => r.hour === h);
      return { hour: h, views: found?.views ?? 0 };
    });

    // 5. Visits by day of week (0=Sunday … 6=Saturday) — in visitor's local timezone
    const byDayRaw = await dbHttp
      .select({
        day: sql<number>`extract(dow from ${pageViews.createdAt} at time zone ${sql.raw("'" + tz + "'")})::int`,
        views: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(pvFilter)
      .groupBy(sql`extract(dow from ${pageViews.createdAt} at time zone ${sql.raw("'" + tz + "'")})`)
      .orderBy(sql`extract(dow from ${pageViews.createdAt} at time zone ${sql.raw("'" + tz + "'")})`);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const byDayOfWeek = Array.from({ length: 7 }, (_, d) => {
      const found = byDayRaw.find((r) => r.day === d);
      return { day: d, label: dayNames[d], views: found?.views ?? 0 };
    });

    // 6. Top countries
    const topCountriesRaw = await dbHttp
      .select({
        country: pageViews.country,
        views: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(and(pvFilter, sql`${pageViews.country} is not null`))
      .groupBy(pageViews.country)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    const topCountries = topCountriesRaw.map((row) => ({
      country: row.country ?? "Unknown",
      views: row.views,
      percentage:
        totalPageViews > 0
          ? Math.round((row.views / totalPageViews) * 100)
          : 0,
    }));

    // 7. US regions (states) — unique visitors, all states for heatmap
    const topRegionsRaw = await dbHttp
      .select({
        region: pageViews.region,
        country: pageViews.country,
        views: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      })
      .from(pageViews)
      .where(
        and(
          pvFilter,
          sql`${pageViews.region} is not null`,
          sql`${pageViews.country} = 'US'`
        )
      )
      .groupBy(pageViews.region, pageViews.country)
      .orderBy(sql`count(distinct ${pageViews.sessionId}) desc`)
      .limit(51); // all US states + DC

    const topRegions = topRegionsRaw.map((row) => ({
      region: row.region ?? "Unknown",
      country: row.country ?? "US",
      views: row.views,
    }));

    // 7b. Top US cities — fetch extra rows, then deduplicate by decoded name in JS
    //     (some existing DB rows have percent-encoded city names e.g. "Santa%20Clara")
    const topCitiesRaw = await dbHttp
      .select({
        city: pageViews.city,
        region: pageViews.region,
        visitors: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      })
      .from(pageViews)
      .where(
        and(
          pvFilter,
          sql`${pageViews.city} is not null`,
          sql`${pageViews.country} = 'US'`
        )
      )
      .groupBy(pageViews.city, pageViews.region)
      .orderBy(sql`count(distinct ${pageViews.sessionId}) desc`)
      .limit(100); // fetch extra so deduplication doesn't cut off real cities

    // 7c. Avg time per US city — join page_exit events with pageViews by sessionId
    const cityTimesRaw = await dbHttp
      .select({
        city: pageViews.city,
        region: pageViews.region,
        avgSeconds: sql<number>`round(avg((${analyticsEvents.properties}->>'durationSeconds')::float))::int`,
      })
      .from(analyticsEvents)
      .innerJoin(pageViews, sql`${analyticsEvents.sessionId} = ${pageViews.sessionId}`)
      .where(
        and(
          eventsFilter,
          sql`${analyticsEvents.eventType} = 'page_exit'`,
          sql`${pageViews.city} is not null`,
          sql`${pageViews.country} = 'US'`,
          sql`${analyticsEvents.properties}->>'durationSeconds' is not null`
        )
      )
      .groupBy(pageViews.city, pageViews.region);

    const cityTimesMap = new Map<string, number>();
    for (const row of cityTimesRaw) {
      if (row.city) {
        const key = `${safeDecodeCity(row.city)}|${row.region ?? ""}`;
        cityTimesMap.set(key, row.avgSeconds);
      }
    }

    // Aggregate by decoded city name to merge e.g. "Santa%20Clara" + "Santa Clara"
    const cityMap = new Map<string, { city: string; region: string; visitors: number; avgSeconds: number }>();
    for (const row of topCitiesRaw) {
      const decoded = row.city ? safeDecodeCity(row.city) : "Unknown";
      const key = `${decoded}|${row.region ?? ""}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.visitors += row.visitors;
      } else {
        cityMap.set(key, {
          city: decoded,
          region: row.region ?? "",
          visitors: row.visitors,
          avgSeconds: cityTimesMap.get(key) ?? 0,
        });
      }
    }
    const topCities = [...cityMap.values()]
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 10);

    // 8. Avg time on page — overall average from page_exit events (durationSeconds in properties)
    const [durationRow] = await dbHttp
      .select({
        avgSeconds: sql<number>`round(avg((${analyticsEvents.properties}->>'durationSeconds')::float))::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eventsFilter,
          sql`${analyticsEvents.eventType} = 'page_exit'`,
          sql`${analyticsEvents.properties}->>'durationSeconds' is not null`
        )
      );

    const avgPageSeconds = durationRow?.avgSeconds ?? 0;

    // 8b. Avg time per product page — from page_exit events where _path starts with /shop/
    const productTimesRaw = await dbHttp
      .select({
        path: sql<string>`${analyticsEvents.properties}->>'_path'`,
        avgSeconds: sql<number>`round(avg((${analyticsEvents.properties}->>'durationSeconds')::float))::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eventsFilter,
          sql`${analyticsEvents.eventType} = 'page_exit'`,
          sql`${analyticsEvents.properties}->>'_path' like '/shop/%'`,
          sql`${analyticsEvents.properties}->>'durationSeconds' is not null`
        )
      )
      .groupBy(sql`${analyticsEvents.properties}->>'_path'`);

    const productTimesMap: Record<string, number> = {};
    for (const row of productTimesRaw) {
      if (row.path) productTimesMap[row.path] = row.avgSeconds;
    }

    // Build topProducts with avgSeconds merged in
    const topProducts = topProductsBase.map((p) => ({
      ...p,
      avgSeconds: productTimesMap[p.path] ?? 0,
    }));

    // 8c. Avg time per US state — from page_exit events with region
    const stateTimesRaw = await dbHttp
      .select({
        region: analyticsEvents.region,
        avgSeconds: sql<number>`round(avg((${analyticsEvents.properties}->>'durationSeconds')::float))::int`,
      })
      .from(analyticsEvents)
      .where(
        and(
          eventsFilter,
          sql`${analyticsEvents.eventType} = 'page_exit'`,
          sql`${analyticsEvents.region} is not null`,
          sql`${analyticsEvents.country} = 'US'`,
          sql`${analyticsEvents.properties}->>'durationSeconds' is not null`
        )
      )
      .groupBy(analyticsEvents.region);

    const stateTimes: Record<string, number> = {};
    for (const row of stateTimesRaw) {
      if (row.region) stateTimes[row.region] = row.avgSeconds;
    }

    // 9. Cart abandonment
    const [cartStats] = await dbHttp
      .select({
        addToCartSessions: sql<number>`count(distinct case when ${analyticsEvents.eventType} = 'cart_add' then ${analyticsEvents.sessionId} end)::int`,
        checkoutStartedSessions: sql<number>`count(distinct case when ${analyticsEvents.eventType} = 'checkout_started' then ${analyticsEvents.sessionId} end)::int`,
      })
      .from(analyticsEvents)
      .where(eventsFilter);

    const addToCartSessions = cartStats?.addToCartSessions ?? 0;
    const checkoutStartedSessions = cartStats?.checkoutStartedSessions ?? 0;
    const abandonedSessions = Math.max(
      0,
      addToCartSessions - checkoutStartedSessions
    );
    const abandonmentRate =
      addToCartSessions > 0
        ? Math.round((abandonedSessions / addToCartSessions) * 100)
        : 0;

    return NextResponse.json({
      summary: {
        totalPageViews,
        uniqueSessions,
        avgPagesPerSession,
        avgPageSeconds,
      },
      topPages,
      topProducts,
      stateTimes,
      byHour,
      byDayOfWeek,
      topCountries,
      topRegions,
      topCities,
      cartEvents: {
        addToCartSessions,
        checkoutStartedSessions,
        abandonedSessions,
        abandonmentRate,
      },
    });
  } catch (error) {
    console.error("[Admin Traffic API] Error:", error);
    return NextResponse.json(
      { error: "Failed to load traffic data" },
      { status: 500 }
    );
  }
}
