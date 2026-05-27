# Open questions

Decisions the implementer needs to make or surface back to the design team.

## Data-layer

1. **Wave data source for non-coastal locations.** Open-Meteo's marine API
   only returns wave data when the requested lat/lon is in or near ocean.
   What should the Windguru table / Graph / Week show for inland cities?
   Suggested: hide the three wave rows entirely (collapse the section) rather
   than show empty cells.

2. **Sun-phase computation.** The prototype hard-codes Palma's phases for
   Feb 9 2026. Recommended replacement: `suncalc` npm package (computes
   astronomical / nautical / civil twilight + golden hour locally; small,
   no API call). Confirm OK.

3. **Moon-phase computation.** Same: use `suncalc`'s `getMoonIllumination`
   and `getMoonTimes`. Phase name from `phase` fraction can be mapped
   client-side. Confirm OK.

4. **Update cadence.** How often should `now` tick? The prototype is
   static. Suggested: `setInterval(..., 60_000)` for the "Now" marker,
   re-fetch forecast every 10 min only when the app is foregrounded.

5. **Units.** Currently km/h, °C, mm, m, seconds. Should we add a settings
   screen for imperial units (mph, °F, in)? Out of scope for first ship?

## Visual

6. **Tab bar overflow.** Designed for 3–5 tabs. We've drawn Home / Today /
   Week, with Map and More as placeholders. Does the SW Client integration
   override this? Should Map (radar/satellite view) be designed before
   first ship or punted?

7. **Featured location pulsing dot.** The Home view's "My Location" card
   shows a pulsing white dot. Currently no `@keyframes` defined for it —
   add a simple 2s ease-in-out opacity pulse?

8. **Reduced motion.** Confirmed in `ARCHITECTURE.md` that `prefers-reduced-motion`
   should disable backdrop animations. Should we replace them with a
   stippled SVG illustration of the same condition, or just freeze the
   first frame?

9. **Empty state for Home.** What does Home look like with zero saved
   locations? Suggested: a big "Add your first location" CTA with a
   placeholder card behind it. Not designed yet.

10. **Onboarding.** Does the first-launch flow need design? Geolocation
    permission, units selection, optional saved-location seeding. Punted
    for now.

11. **Error states.** Forecast fetch failure, geolocation denied, offline.
    Not designed. Suggested approach: inline banner at the top of the
    affected view + cached-data badge.

## Behaviour / interaction

12. **Tap-to-expand on Week.** The footnote promises "Tap a day for
    hourly". Implementer should decide: navigate to a per-day Today view,
    or expand inline in the row?

13. **Long-press on Week.** Footnote also says "long-press to pin". Pin
    behaviour not designed yet — should we leave that footnote out for
    first ship?

14. **Horizontal swipe between days/views.** Not designed. Defer.

15. **Pull-to-refresh.** Standard. Should refresh both Open-Meteo and
    Marine in parallel.

## Code-shape

16. **CSS approach.** The prototypes use inline `style={{}}`. For
    production, three reasonable choices:
    - CSS modules + a `tokens.css` file (recommended for new project)
    - Tailwind (if SW Client uses it)
    - styled-components / Emotion (only if SW Client mandates)

    Pick whichever the SW Client already uses; if SW Client has no
    preference, go CSS-modules.

17. **Web component vs React component for the module surface.** If
    SW Client is React-based, ship as a React component. If it's
    framework-agnostic, ship as a custom element + a thin React adapter.
    Need a decision from SW Client team.

18. **Per-cell memoization in Windguru table.** Confirmed in
    `ARCHITECTURE.md` that memoizing each cell is the right call. Should
    we ship a `<Cell>` that's `React.memo`'d with a custom comparator on
    `bg/fg/value`?

## Out of scope for v1

- Radar / satellite map
- Hourly notifications / alerts (push)
- Custom location pinning beyond the device's location
- Surf-specific overlays (this is a generic marine forecast, not a
  surf-spot one — though SW Rating row hints at it)
- Light theme
