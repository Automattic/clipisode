//
//  VideoCompositor.swift
//  Clipisode
//
//  Custom AVVideoCompositing that renders video frames, face tracking overlays,
//  particle effects, name badges, and crossfade+zoom transitions per-frame.
//

import AVFoundation
import CoreImage

final class VideoCompositor: NSObject, AVVideoCompositing {

    var requiredPixelBufferAttributesForRenderContext: [String: Any] = [
        String(kCVPixelBufferPixelFormatTypeKey): [kCVPixelFormatType_32BGRA]
    ]

    var sourcePixelBufferAttributes: [String: Any]? = [
        String(kCVPixelBufferPixelFormatTypeKey): [kCVPixelFormatType_32BGRA]
    ]

    private let renderingQueue = DispatchQueue(
        label: "com.clipisode.compositor.rendering",
        qos: .userInitiated
    )
    private var cancelled = false
    private let ciContext = CIContext(options: [.useSoftwareRenderer: false])

    /// Pre-computed particle configurations keyed by segment track ID.
    private var particleCache: [CMPersistentTrackID: [ParticleConfig]] = [:]

    // MARK: - AVVideoCompositing

    func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
        renderingQueue.async {
            if self.cancelled {
                request.finishCancelledRequest()
                return
            }
            autoreleasepool {
                self.renderFrame(request)
            }
        }
    }

    func renderContextChanged(_ newRenderContext: AVVideoCompositionRenderContext) {}

    func cancelAllPendingVideoCompositionRequests() {
        cancelled = true
        renderingQueue.async { self.cancelled = false }
    }

    // MARK: - Per-Frame Rendering

    private func renderFrame(_ request: AVAsynchronousVideoCompositionRequest) {
        guard let instruction = request.videoCompositionInstruction as? CompositionInstruction else {
            request.finish(with: NSError(
                domain: "VideoCompositor", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Invalid instruction type"]
            ))
            return
        }

        guard let destination = request.renderContext.newPixelBuffer() else {
            request.finish(with: NSError(
                domain: "VideoCompositor", code: 2,
                userInfo: [NSLocalizedDescriptionKey: "Could not allocate pixel buffer"]
            ))
            return
        }

        CVPixelBufferLockBaseAddress(destination, [])

        let width = CVPixelBufferGetWidth(destination)
        let height = CVPixelBufferGetHeight(destination)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(destination)
        let renderSize = instruction.renderSize
        let time = request.compositionTime
        let timeSeconds = CMTimeGetSeconds(time)
        let transDur = CMTimeGetSeconds(instruction.transitionDuration)

        guard let baseAddress = CVPixelBufferGetBaseAddress(destination),
              let ctx = CGContext(
                  data: baseAddress,
                  width: width,
                  height: height,
                  bitsPerComponent: 8,
                  bytesPerRow: bytesPerRow,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue
                      | CGImageAlphaInfo.premultipliedFirst.rawValue
              )
        else {
            CVPixelBufferUnlockBaseAddress(destination, [])
            request.finish(with: NSError(
                domain: "VideoCompositor", code: 3,
                userInfo: [NSLocalizedDescriptionKey: "Could not create CGContext"]
            ))
            return
        }

        // Black background
        ctx.setFillColor(CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1))
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))

        let segments = instruction.segments

        // Collect segments whose composition time range contains the current time.
        var activeEntries: [(segment: CompositionInstruction.Segment, index: Int)] = []
        for (i, seg) in segments.enumerated() {
            if CMTimeRangeContainsTime(seg.timeRange, time: time) {
                activeEntries.append((seg, i))
            }
        }

        for (seg, segIndex) in activeEntries {
            guard let sourceBuffer = request.sourceFrame(byTrackID: seg.trackID) else { continue }

            let segStart = CMTimeGetSeconds(seg.timeRange.start)
            let segEnd = CMTimeGetSeconds(CMTimeRangeGetEnd(seg.timeRange))
            let segDuration = segEnd - segStart
            let localTime = timeSeconds - segStart

            var videoOpacity: CGFloat = 1.0
            var videoScale: CGFloat = 1.0

            // Incoming transition: this segment fades in while previous is still visible.
            // The previous segment is drawn first at full opacity; this segment is drawn
            // on top with increasing opacity, producing a correct crossfade via Porter-Duff
            // source-over compositing.
            if segIndex > 0 {
                let prevEnd = CMTimeGetSeconds(CMTimeRangeGetEnd(segments[segIndex - 1].timeRange))
                if timeSeconds < prevEnd {
                    let progress = (timeSeconds - segStart) / transDur
                    videoOpacity = CGFloat(min(max(progress, 0), 1))
                }
            }

            // Outgoing transition: push a slight zoom while the next segment fades in over us.
            if segIndex < segments.count - 1 {
                let nextStart = CMTimeGetSeconds(segments[segIndex + 1].timeRange.start)
                if timeSeconds >= nextStart {
                    let progress = (timeSeconds - nextStart) / transDur
                    videoScale = CGFloat(1.0 + 0.08 * min(max(progress, 0), 1))
                }
            }

            drawVideoFrame(
                ctx: ctx,
                sourceBuffer: sourceBuffer,
                opacity: videoOpacity,
                scale: videoScale,
                renderSize: renderSize
            )

            // Effect overlays fade in 0.5s after segment starts and out 0.5s before it ends,
            // keeping them invisible during the 1s transition overlap.
            let effectFadeIn = min(localTime / 0.5, 1.0)
            let effectFadeOut = min((segDuration - localTime) / 0.5, 1.0)
            let effectAlpha = CGFloat(min(effectFadeIn, effectFadeOut))

            if seg.effects.contains(.faceTracking) && effectAlpha > 0 {
                OverlayRenderer.drawFaceOverlay(
                    ctx: ctx,
                    sourceBuffer: sourceBuffer,
                    localTime: localTime,
                    segmentDuration: segDuration,
                    alpha: effectAlpha
                )
            }

            if seg.effects.contains(.particles) && effectAlpha > 0 {
                let particles = cachedParticles(
                    for: seg.trackID,
                    renderSize: renderSize,
                    segmentDuration: segDuration
                )
                OverlayRenderer.drawParticles(
                    ctx: ctx,
                    particles: particles,
                    localTime: localTime,
                    segmentDuration: segDuration,
                    alpha: effectAlpha,
                    renderSize: renderSize
                )
            }

            if let name = seg.name {
                OverlayRenderer.drawNameBadge(
                    ctx: ctx,
                    name: name,
                    localTime: localTime,
                    segmentDuration: segDuration,
                    renderSize: renderSize
                )
            }
        }

        CVPixelBufferUnlockBaseAddress(destination, [])
        request.finish(withComposedVideoFrame: destination)
    }

    // MARK: - Video Frame Drawing

    private func drawVideoFrame(
        ctx: CGContext,
        sourceBuffer: CVPixelBuffer,
        opacity: CGFloat,
        scale: CGFloat,
        renderSize: CGSize
    ) {
        let ciImage = CIImage(cvPixelBuffer: sourceBuffer)
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else { return }

        let sourceW = CGFloat(cgImage.width)
        let sourceH = CGFloat(cgImage.height)
        let targetW = renderSize.width * scale
        let targetH = renderSize.height * scale

        // Aspect-fill: scale to cover the target area, then center.
        let fillScale = max(targetW / sourceW, targetH / sourceH)
        let drawW = sourceW * fillScale
        let drawH = sourceH * fillScale
        let drawX = (renderSize.width - drawW) / 2
        let drawY = (renderSize.height - drawH) / 2

        ctx.saveGState()
        ctx.setAlpha(opacity)
        ctx.draw(cgImage, in: CGRect(x: drawX, y: drawY, width: drawW, height: drawH))
        ctx.restoreGState()
    }

    // MARK: - Particle Cache

    private func cachedParticles(
        for trackID: CMPersistentTrackID,
        renderSize: CGSize,
        segmentDuration: Double
    ) -> [ParticleConfig] {
        if let existing = particleCache[trackID] {
            return existing
        }
        let particles = OverlayRenderer.generateParticles(
            renderSize: renderSize,
            segmentDuration: segmentDuration
        )
        particleCache[trackID] = particles
        return particles
    }
}
