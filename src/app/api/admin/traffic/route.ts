import { NextRequest, NextResponse } from "next/server";
import { dbHttp } from "@/lib/db/client";
import { pageViews, analyticsEvents } from "@/lib/db/schema";
import { sql, gte, and } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(parseInt(searchParams.get("days") || "30"), 365);

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const sinceFilter = gte(pageViews.createdAt, since);
    const eventsFilter = gte(analyticsEvents.createdAt, since);

    // 1. Summary stats
    const [summaryRow] = await dbHttp
      .select({
        totalPageViews: sql<number>`count(*)::int`,
        uniqueSessions: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      })
      .from(pageViews)
      .where(sinceFilter);

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
      .where(sinceFilter)
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

    // 3. Top products (paths matching /shop/[slug])
    const topProducts = topPagesRaw
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

    // 4. Visits by hour of day
    const byHourRaw = await dbHttp
      .select({
        hour: sql<number>`extract(hour from ${pageViews.createdAt})::int`,
        views: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(sinceFilter)
      .groupBy(sql`extract(hour from ${pageViews.createdAt})`)
      .orderBy(sql`extract(hour from ${pageViews.createdAt})`);

    const byHour = Array.from({ length: 24 }, (_, h) => {
      const found = byHourRaw.find((r) => r.hour === h);
      return { hour: h, views: found?.views ?? 0 };
    });

    // 5. Visits by day of week (0=Sunday … 6=Saturday)
    const byDayRaw = await dbHttp
      .select({
        day: sql<number>`extract(dow from ${pageViews.createdAt})::int`,
        views: sql<number>`count(*)::int`,
      })
      .from(pageViews)
      .where(sinceFilter)
      .groupBy(sql`extract(dow from ${pageViews.createdAt})`)
      .orderBy(sql`extract(dow from ${pageViews.createdAt})`);

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
      .where(and(sinceFilter, sql`${pageViews.country} is not null`))
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
          sinceFilter,
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

    // 7b. Top US cities — unique visitors
    const topCitiesRaw = await dbHttp
      .select({
        city: pageViews.city,
        region: pageViews.region,
        visitors: sql<number>`count(distinct ${pageViews.sessionId})::int`,
      })
      .from(pageViews)
      .where(
        and(
          sinceFilter,
          sql`${pageViews.city} is not null`,
          sql`${pageViews.country} = 'US'`
        )
      )
      .groupBy(pageViews.city, pageViews.region)
      .orderBy(sql`count(distinct ${pageViews.sessionId}) desc`)
      .limit(10);

    const topCities = topCitiesRaw.map((row) => ({
      city: row.city ?? "Unknown",
      region: row.region ?? "",
      visitors: row.visitors,
    }));

    // 8. Cart abandonment
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
      },
      topPages,
      topProducts,
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
