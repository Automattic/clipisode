Product Requirements Document — Clipisode Relaunch

**Status:** Draft  
**Authors:** Max Schmeling, Brian Alvey, Christoph Khouri  
**Last Updated:** 2026-02-07

---

## Overview

Clipisode is being relaunched as a WordPress plugin with a companion desktop/mobile app. The new platform will enable creators and brands to collect, curate, and composite video content from their audiences.

## Vision

Bring back the magic of Clipisode — frictionless video collection from anyone, anywhere — with modern architecture:
- **WordPress-native** for content management and publishing
- **Native app** for high-quality video rendering (AVFoundation)
- **Flexible rendering** — on-device or cloud-based

## Problem Statement

Collecting user-generated video content remains painful:
- Email/DM collection is chaotic and doesn't secure rights
- Hashtag campaigns get hijacked by haters
- Existing solutions require users to install apps
- Video compositing requires expensive software and expertise

## Target Users

1. **Creators** — YouTubers, podcasters, influencers running AMAs, challenges, fan engagement
2. **Brands/Agencies** — Marketing teams running UGC campaigns, testimonials, event content
3. **Publishers** — News organizations, WordPress sites collecting viewer/reader submissions

## Core Architecture

### WordPress Plugin
- Campaign management dashboard
- Submission collection and moderation
- Rights management and consent tracking
- Publishing workflows (Gutenberg blocks for embedding)
- Integration with existing WordPress media library

### Native App (AVFoundation)
- macOS + iOS from single codebase (Catalyst or SwiftUI)
- Video composition and rendering
- On-device processing for privacy/speed
- Cloud rendering option for heavy workloads

## Key Features

### Phase 1: Collection (MVP)
- [ ] Create collection campaigns with prompt video
- [ ] Generate shareable links (no app install for submitters)
- [ ] Web-based video submission (MediaRecorder API)
- [ ] Automatic transcription for review
- [ ] Basic moderation tools (approve/reject)
- [ ] Rights/consent capture

### Phase 2: Composition
- [ ] Native app for video editing
- [ ] Combine multiple submissions into compilations
- [ ] Add intros/outros, titles, captions
- [ ] On-device rendering via AVFoundation
- [ ] Export to common formats

### Phase 3: Publishing & Scale
- [ ] Gutenberg blocks for embedding campaigns/videos
- [ ] Cloud rendering for high-volume use
- [ ] API for headless/external integrations
- [ ] Analytics dashboard
- [ ] White-label options

## Technical Considerations

### Video Submission (Web)
- MediaRecorder API for browser-based recording
- Progressive upload for large files
- Fallback for unsupported browsers (file upload)
- Mobile-optimized recording experience

### Rendering
- AVFoundation for native macOS/iOS rendering
- FFmpeg-based cloud rendering as alternative
- Consideration: GPU acceleration, Metal

### Storage
- WordPress media library integration
- CDN for delivery
- Consider: S3/R2 for raw submissions

### Transcription
- Whisper or similar for automatic transcription
- Enables quick review and captioning

## Open Questions

1. Pricing model? (Freemium, subscription, per-campaign?)
2. Self-hosted vs SaaS vs hybrid?
3. Gutenberg-first or also Classic Editor support?
4. Mobile app scope — just rendering, or also collection/review?
5. Integration with existing Automattic properties? (Jetpack, WooCommerce)

## Success Metrics

- Time from idea to collecting videos (target: <5 minutes)
- Submission completion rate
- Videos published per campaign
- Creator/brand retention

## Timeline

TBD — pending resource allocation and scope finalization.

---

## Appendix

See [[Research]] for history on the original Clipisode platform.
