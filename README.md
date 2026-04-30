# ShapeRoute MVP

ShapeRoute is a web prototype for sketching a rough route shape on a map and converting it into a real-world routed path.

## What Works

- City preset selection.
- Freehand drawing on a Leaflet map.
- Douglas-Peucker simplification.
- Waypoint capping for routing-provider limits.
- Public OSRM demo routing for walk/run/bike/drive/tour modes.
- Route display with distance, ETA, and shape similarity score.
- Waypoint list.
- Local draft save placeholder.
- Share-image placeholder.
- GPX export.

## Run Locally

```bash
npm install
npm run dev -- --host 127.0.0.1 --port 5174
```

Open `http://127.0.0.1:5174`.

## Build

```bash
npm run build
```

## Prototype Notes

The prototype calls the public `routing.openstreetmap.de` OSRM demo endpoint directly from the browser. That is acceptable for local validation, but not for production. A commercial MVP should route through a backend provider adapter and use Mapbox, GraphHopper, OpenRouteService, or a self-hosted OSRM/Valhalla service.

OpenStreetMap raster tiles are also used directly for prototype speed. Production should use a provider with a commercial tile policy, such as Mapbox, MapTiler, Stadia Maps, or a self-hosted tile stack.

## Product Plan

See [PRODUCT_PLAN.md](./PRODUCT_PLAN.md) for the product verdict, MVP definition, architecture, algorithm, roadmap, QA plan, and deployment plan.
