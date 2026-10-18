# NASA · Mission Control — Clipisode video theme

NASA · Mission Control is an original spaceflight-inspired showcase theme for Clipisode. It packages cinematic opening and closing cards, broadcast overlays, deterministic clip-entry transitions, three visual systems, and an editable vector asset kit. It does not use or reproduce NASA's official insignia.

## Highlights

- Mission Control, Lunar Archive, Deep Space, and custom color systems.
- Six original rocket marks plus Earth, Moon, planet, astronaut, satellite, route, and status artwork.
- Earth orbit, lunar surface, deep field, and engineering-grid scenes.
- Orbital iris, launch wipe, signal scan, clean fade, and no-transition modes.
- Flight strip, mission patch, and minimal lower thirds.
- Per-clip callsigns, roles, locations, labels, overlay placement, and transition overrides.
- Optional countdown, telemetry, timer, rocket flyby, astronaut, satellite pass, acquisition stamp, and mission-complete stars.
- Responsive portrait, square, and landscape layouts with deterministic Remotion animation.

Install this directory beside the main `clipisode` plugin and activate it. Select **NASA · Mission Control** in a Clipisode composition. All visual options are available in the composition editor; no build step or remote asset service is required.

The files in `assets/` are a companion editable vector kit. `renderer.js` draws related inline geometry so previews and exports remain self-contained.

When changing the design, bump the version in `theme.json`, this plugin header, and the renderer URL. Existing compositions retain their saved theme version until updated.
