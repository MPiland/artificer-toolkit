# Workbook: SCENE-5.T3 zoom control, per-device zoom, screen-sized tabletop window, Full screen

Closes AC SCENE-5.3 (see [scene-5-plan.md](scene-5-plan.md)). Client only; no backend or contract change.

## What shipped

- **Zoom control** (`VttZoomControl`): zoom icon, a percentage field and minus/plus steps, in the Stage toolbar for every viewer. Typing takes `150` or `150%` on Enter or blur, clamps to 2%-800%, and reverts text that is not a number. Escape drops an unfinished edit. Steps move through browser-style stops (`stepVttZoomScale`).
- **Renderer** (`vttSceneRenderer.ts`): `setZoomScale` zooms about the view centre to an absolute scale; `onZoomChange(scale, 'USER' | 'SCENE')` reports every change; `resolveSceneZoom(sceneId)` replaces the fit-to-view when a scene is first shown, so a saved zoom survives reloads, reconnects (the renderer is rebuilt) and scene switches. Wheel, pinch, steps, typed values, Fit and Focus token all report `USER`.
- **Persistence** (`vttZoom.model.ts`): `localStorage`, key `artificer:tabletop-zoom:<campaignId>:<sceneId>`, written only for `USER` changes so the automatic fit is never saved as a choice. Reads and writes are wrapped in try/catch; blocked or full storage degrades to a zoom that lasts for the window.
- **View switches**: selecting or switching a viewed token never touches the renderer's zoom. The Scene controls menu's explicit "Focus <token>" keeps its zoom-to-readable behaviour (pre-existing) and its result is persisted like any other user zoom.
- **Popup** (`buildAuxiliaryWindowFeatures`): sized to `screen.availWidth/availHeight` at `availLeft/availTop` (multi-monitor aware) instead of 1440x900; the tab fallback when popups are blocked is unchanged.
- **Full screen** (`CampaignTabletopFullscreenButton`): header button using the Fullscreen API on the click, toggles to "Exit full screen", follows `fullscreenchange` (Escape), and is absent where `document.fullscreenEnabled` is false.

## Decisions

- Zoom is keyed per Campaign **and** Scene: grid size differs per Scene, and the point of the zoom is squares matching physical minis.
- Old zoom-in/out buttons were replaced by the control (same accessible names "Zoom in" / "Zoom out" retained). The Scene editor keeps its own buttons: it is a GM authoring surface, not the tabletop.

## Proof

| Criterion | Test |
| --- | --- |
| Type a percentage / step | `VttZoomControl.test.tsx`, `vttZoom.model.test.ts` (parse, clamp, steps, range ends) |
| Keeps zoom per device across reloads and reconnects | `CampaignVttStage.zoom.test.tsx` (real Stage and storage code; the canvas renderer is the faked platform), `vttZoom.model.test.ts` (storage round trip, corrupt values, throwing storage) |
| Auto-fit is not saved as a choice | `CampaignVttStage.zoom.test.tsx` |
| Window sized to the screen | `CampaignTabletopWindow.model.test.ts` |
| Full screen button | `CampaignTabletopFullscreenButton.test.tsx` (fake Fullscreen API) |

## Limits

- The popup size is a request; the browser may clamp it. Full screen needs the click in that window by browser rule.
- The browser-level proof of reload persistence through the real Pixi renderer is not in this slice; the renderer contract (`resolveSceneZoom` replaces fit, `onZoomChange` reports) is exercised through the Stage.
