# ShapeRoute Product And MVP Plan

## Product Verdict

Start with a GPS art and intentional route planner wedge, not a broad travel/tour app. The most marketable first positioning is: "Draw a shape, get a runnable/walkable route." It is visually obvious, demoable in seconds, and meaningfully different from Strava, Komoot, AllTrails, Google Maps, and generic route planners.

The winning wedge is creative route generation for runners and walkers, with scenic/tour intelligence layered in later. GPS art alone may be too novelty-driven unless tied to events, creator packs, clubs, and social proof. Scenic route generation is commercially bigger but harder to trust because bad routes, unsafe segments, and poor place recommendations can kill retention.

## MVP Definition

Smallest impressive MVP:

- Web app.
- User picks city or uses current map area.
- User freehand-draws a route shape.
- App simplifies sketch into capped waypoints.
- App requests a real route through those waypoints.
- App displays routed path, direction, distance, ETA, and similarity score.
- App warns when the sketch is too complex or the route match is weak.
- User can export GPX and share a branded route image placeholder.

Avoid in v1: live GPS tracking, creator marketplace, payments, deep social graph, and AI-generated city tours before route quality is stable.

## Architecture

Recommendation: web first. Route drawing, sharing, SEO landing pages, creator templates, and tourism demos are faster to validate on web. React Native can follow after the route engine and sharing loop are proven.

First MVP stack:

- Frontend: Vite + TypeScript + Leaflet or MapLibre.
- Backend: Node/TypeScript API for provider proxying, scoring, and persistence.
- Database: Postgres with PostGIS, via Supabase or Neon.
- Map provider: Mapbox or MapTiler for production tiles; OpenStreetMap only for prototype/demo.
- Routing provider: Mapbox Directions for fastest commercial MVP; GraphHopper/OpenRouteService as secondary; self-host OSRM later for cost/control.
- Places: Foursquare, Google Places, OpenStreetMap Overpass, Wikidata/Wikipedia, or Mapbox Search depending on city and licensing.
- Auth: Clerk or Supabase Auth.
- Deployment: Vercel for frontend/API; Fly.io/Render for route workers if needed.
- Analytics: PostHog.
- Error logging: Sentry.

## Algorithm

1. Capture freehand polyline in map coordinates.
2. Remove jitter and duplicate points.
3. Simplify with Douglas-Peucker.
4. Resample by route length and provider waypoint budget.
5. Snap or route through waypoints using selected travel profile.
6. Score route similarity against original sketch.
7. If score is poor, retry with fewer or shifted waypoints.
8. Add POIs/landmarks near the final route.
9. Return distance, ETA, steps, warnings, route geometry, and export payload.

```ts
function generateShapeRoute(sketch, mode, priorities) {
  cleaned = removeJitter(sketch, 8)
  simplified = douglasPeucker(cleaned, toleranceForLength(cleaned))
  waypoints = resampleToBudget(simplified, waypointBudget(mode, provider))

  candidates = []
  for strategy of ["strict", "reduced", "anchorsOnly"] {
    route = routingProvider.route(adaptWaypoints(waypoints, strategy), mode)
    if route.ok {
      candidates.push({
        route,
        shape: scoreSimilarity(cleaned, route.geometry),
        safety: scoreSafety(route),
        scenic: scoreScenic(route, priorities)
      })
    }
  }

  best = rank(candidates, priorities)
  if !best or best.shape < threshold return manualEditFallback(waypoints)
  return enrichRoute(best, findPlacesNearRoute(best.route.geometry, priorities))
}
```

Edge cases: impossible routes, private roads, rivers, too many waypoints, unsafe routes, complex sketches, quota exhaustion, and sketches outside the route network should all produce clear warnings and a manual-edit fallback.

## Six-Week Roadmap

Week 1: prove sketch-to-route with drawing, simplification, provider adapter, route display, and manual city tests.

Week 2: add similarity scoring, warnings, waypoint list, and basic edit/delete anchors.

Week 3: add auth, saved routes, public share page, and GPX export hardening.

Week 4: add scenic/tour layer with POIs, landmark chips, and priority reranking.

Week 5: add onboarding, empty/error states, analytics, Sentry, production provider, and beta polish.

Week 6: launch beta with demo cities, route templates, feedback loop, regression checklist, and creator outreach.

## QA Plan

Test geometry utilities, route generation, provider failures, GPX export, mobile drawing, map rendering, safety warnings, and performance. Required route cases: dense-grid line, heart loop, river crossing, sparse suburb, outside-network sketch, and excessive scribble.

## Deployment Plan

Use Vercel for web/API MVP, Postgres/PostGIS on Supabase or Neon, server-side provider keys, staging/production separation, GitHub Actions build checks, Sentry, PostHog, provider latency/cost monitoring, and daily database backups.
