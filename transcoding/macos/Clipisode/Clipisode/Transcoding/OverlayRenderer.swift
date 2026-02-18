//
//  OverlayRenderer.swift
//  Clipisode
//
//  Per-frame overlay drawing methods used by VideoCompositor.
//  All drawing targets a CGContext backed by a BGRA pixel buffer
//  with a standard bottom-left coordinate origin (y=0 at bottom of frame).
//

import AVFoundation
import CoreGraphics
import CoreText
import Vision
import AppKit

/// Pre-computed particle state so every frame renders the same set of particles.
struct ParticleConfig {
    let startX: CGFloat
    let startY: CGFloat
    let endYOffset: CGFloat   // added to startY (positive = upward)
    let drift: CGFloat
    let size: CGFloat
    let baseAlpha: CGFloat
    let animDuration: Double
    let delay: Double
}

enum OverlayRenderer {

    // MARK: - Face Tracking Wireframe

    /// Runs Vision face landmark detection on `sourceBuffer` and draws a neon
    /// wireframe overlay into `ctx`. Coordinates from Vision (bottom-left origin)
    /// map directly to the CGContext's coordinate system.
    static func drawFaceOverlay(
        ctx: CGContext,
        sourceBuffer: CVPixelBuffer,
        localTime: Double,
        segmentDuration: Double,
        alpha: CGFloat
    ) {
        let request = VNDetectFaceLandmarksRequest()
        try? VNImageRequestHandler(cvPixelBuffer: sourceBuffer, options: [:]).perform([request])

        guard let face = request.results?.first,
              let lm = face.landmarks else { return }

        let box = face.boundingBox
        let w = CGFloat(CVPixelBufferGetWidth(sourceBuffer))
        let h = CGFloat(CVPixelBufferGetHeight(sourceBuffer))

        func px(_ pt: CGPoint) -> CGPoint {
            CGPoint(
                x: (box.origin.x + pt.x * box.width) * w,
                y: (box.origin.y + pt.y * box.height) * h
            )
        }

        func path(_ r: VNFaceLandmarkRegion2D?, closed: Bool) -> CGPath? {
            guard let r, r.pointCount >= 2 else { return nil }
            let p = CGMutablePath()
            let pts = r.normalizedPoints
            p.move(to: px(pts[0]))
            for pt in pts.dropFirst() { p.addLine(to: px(pt)) }
            if closed { p.closeSubpath() }
            return p
        }

        func center(_ r: VNFaceLandmarkRegion2D?) -> CGPoint? {
            guard let r, r.pointCount > 0 else { return nil }
            let pts = r.normalizedPoints
            let s = pts.reduce(CGPoint.zero) { CGPoint(x: $0.x + $1.x, y: $0.y + $1.y) }
            return px(CGPoint(x: s.x / CGFloat(pts.count), y: s.y / CGFloat(pts.count)))
        }

        let cyan: (CGFloat, CGFloat, CGFloat) = (0, 0.9, 1)
        let magenta: (CGFloat, CGFloat, CGFloat) = (1, 0.1, 0.6)

        let features: [(VNFaceLandmarkRegion2D?, Bool, (CGFloat, CGFloat, CGFloat))] = [
            (lm.faceContour, false, cyan),
            (lm.leftEyebrow, false, cyan),
            (lm.rightEyebrow, false, cyan),
            (lm.leftEye, true, cyan),
            (lm.rightEye, true, cyan),
            (lm.nose, false, cyan),
            (lm.noseCrest, false, cyan),
            (lm.outerLips, true, magenta),
        ]

        ctx.setLineCap(.round)
        ctx.setLineJoin(.round)

        for (region, closed, color) in features {
            guard let p = path(region, closed: closed) else { continue }
            let (r, g, b) = color

            // Glow
            ctx.setStrokeColor(CGColor(srgbRed: r, green: g, blue: b, alpha: 0.12 * alpha))
            ctx.setLineWidth(10)
            ctx.addPath(p); ctx.strokePath()

            // Mid
            ctx.setStrokeColor(CGColor(srgbRed: r, green: g, blue: b, alpha: 0.35 * alpha))
            ctx.setLineWidth(4)
            ctx.addPath(p); ctx.strokePath()

            // Core
            ctx.setStrokeColor(CGColor(srgbRed: r, green: g, blue: b, alpha: 0.9 * alpha))
            ctx.setLineWidth(1.5)
            ctx.addPath(p); ctx.strokePath()
        }

        // Geometric mesh connecting lines
        if let le = center(lm.leftEye), let re = center(lm.rightEye),
           let n = center(lm.nose), let m = center(lm.outerLips) {

            ctx.setStrokeColor(CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.2 * alpha))
            ctx.setLineWidth(1)
            ctx.setLineDash(phase: 0, lengths: [4, 4])

            for (from, to) in [(le, re), (le, n), (re, n), (n, m), (le, m), (re, m)] {
                ctx.move(to: from); ctx.addLine(to: to)
            }
            ctx.strokePath()
            ctx.setLineDash(phase: 0, lengths: [])
        }

        // Pulsing dots
        let pulse = 1.0 + 0.3 * sin(localTime * 6.0)

        var dots: [(CGPoint, CGFloat)] = []
        for (region, radius) in [(lm.leftEye, 4.0), (lm.rightEye, 4.0),
                                 (lm.nose, 4.0), (lm.outerLips, 4.0)] as [(VNFaceLandmarkRegion2D?, Double)] {
            if let c = center(region) { dots.append((c, CGFloat(radius))) }
        }
        for eye in [lm.leftEye, lm.rightEye] {
            if let eye, eye.pointCount >= 2 {
                let pts = eye.normalizedPoints
                dots.append((px(pts[0]), 3))
                dots.append((px(pts[pts.count / 2]), 3))
            }
        }
        if let lips = lm.outerLips, lips.pointCount >= 2 {
            let pts = lips.normalizedPoints
            dots.append((px(pts[0]), 3))
            dots.append((px(pts[pts.count / 2]), 3))
        }

        for (point, baseR) in dots {
            let r = baseR * CGFloat(pulse)

            ctx.setFillColor(CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.25 * alpha))
            ctx.fillEllipse(in: CGRect(x: point.x - r * 2, y: point.y - r * 2, width: r * 4, height: r * 4))

            ctx.setFillColor(CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.9 * alpha))
            ctx.fillEllipse(in: CGRect(x: point.x - r, y: point.y - r, width: r * 2, height: r * 2))
        }

        // Scan line sweeping across the face
        let faceMinX = box.origin.x * w - 30
        let faceMaxX = (box.origin.x + box.width) * w + 30
        let faceMinY = box.origin.y * h
        let faceMaxY = (box.origin.y + box.height) * h

        let phase = localTime.truncatingRemainder(dividingBy: 2.0) / 2.0
        let scanY = faceMaxY - (faceMaxY - faceMinY) * CGFloat(phase)

        let cs = CGColorSpaceCreateDeviceRGB()
        let colors = [
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0),
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.6 * alpha),
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0),
        ] as CFArray

        if let grad = CGGradient(colorsSpace: cs, colors: colors, locations: [0, 0.5, 1]) {
            ctx.saveGState()
            ctx.clip(to: CGRect(x: faceMinX, y: scanY - 1, width: faceMaxX - faceMinX, height: 2))
            ctx.drawLinearGradient(
                grad,
                start: CGPoint(x: faceMinX, y: scanY),
                end: CGPoint(x: faceMaxX, y: scanY),
                options: []
            )
            ctx.restoreGState()
        }
    }

    // MARK: - Particle System

    /// Generates deterministic particle configurations using a seeded PRNG.
    static func generateParticles(
        renderSize: CGSize,
        segmentDuration: Double,
        count: Int = 18
    ) -> [ParticleConfig] {
        var rng = DeterministicRNG(seed: 42)
        return (0..<count).map { _ in
            let startY = rng.cgFloat(in: renderSize.height * 0.05...renderSize.height * 0.7)
            return ParticleConfig(
                startX: rng.cgFloat(in: 20...(renderSize.width - 20)),
                startY: startY,
                endYOffset: rng.cgFloat(in: 100...350),
                drift: rng.cgFloat(in: -40...40),
                size: rng.cgFloat(in: 4...10),
                baseAlpha: rng.cgFloat(in: 0.3...0.7),
                animDuration: rng.double(in: segmentDuration * 0.5...segmentDuration * 0.9),
                delay: rng.double(in: 0...segmentDuration * 0.3)
            )
        }
    }

    /// Draws particle dots and rotating dashed rings.
    static func drawParticles(
        ctx: CGContext,
        particles: [ParticleConfig],
        localTime: Double,
        segmentDuration: Double,
        alpha: CGFloat,
        renderSize: CGSize
    ) {
        for p in particles {
            let animStart = p.delay
            let animEnd = p.delay + p.animDuration
            guard localTime >= animStart && localTime <= animEnd else { continue }

            let t = (localTime - animStart) / p.animDuration

            // Cubic bezier upward drift
            let endY = p.startY + p.endYOffset
            let endPt = CGPoint(x: p.startX + p.drift, y: endY)
            let cp1 = CGPoint(x: p.startX + p.drift * 0.3, y: p.startY + p.endYOffset * 0.3)
            let cp2 = CGPoint(x: p.startX + p.drift * 0.7, y: p.startY + p.endYOffset * 0.7)
            let pos = cubicBezier(
                t: CGFloat(t),
                p0: CGPoint(x: p.startX, y: p.startY),
                p1: cp1, p2: cp2, p3: endPt
            )

            // Fade lifecycle: appear → hold → disappear
            let fadeAlpha: CGFloat
            if t < 0.15 {
                fadeAlpha = CGFloat(t / 0.15) * 0.8
            } else if t > 0.75 {
                fadeAlpha = CGFloat((1.0 - t) / 0.25) * 0.8
            } else {
                fadeAlpha = 0.8
            }

            ctx.setFillColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: fadeAlpha * alpha))
            let r = p.size / 2
            ctx.fillEllipse(in: CGRect(x: pos.x - r, y: pos.y - r, width: p.size, height: p.size))
        }

        drawRotatingRings(ctx: ctx, localTime: localTime, alpha: alpha, renderSize: renderSize)
    }

    private static func drawRotatingRings(
        ctx: CGContext,
        localTime: Double,
        alpha: CGFloat,
        renderSize: CGSize
    ) {
        // Rings sit near the bottom of the displayed frame (low Y in bottom-left coords).
        let ringCenter = CGPoint(x: renderSize.width / 2, y: 150)

        let angle1 = localTime / 6.0 * 2.0 * .pi
        let angle2 = -localTime / 10.0 * 2.0 * .pi

        // Ring 1
        let r1: CGFloat = 100
        ctx.saveGState()
        ctx.translateBy(x: ringCenter.x, y: ringCenter.y)
        ctx.rotate(by: CGFloat(angle1))
        ctx.setStrokeColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.25 * alpha))
        ctx.setLineWidth(2)
        ctx.setLineDash(phase: 0, lengths: [8, 6])
        ctx.addEllipse(in: CGRect(x: -r1, y: -r1, width: r1 * 2, height: r1 * 2))
        ctx.strokePath()
        ctx.restoreGState()

        // Ring 2 (larger, counter-rotating)
        let r2: CGFloat = 130
        ctx.saveGState()
        ctx.translateBy(x: ringCenter.x, y: ringCenter.y)
        ctx.rotate(by: CGFloat(angle2))
        ctx.setStrokeColor(CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.15 * alpha))
        ctx.setLineWidth(1.5)
        ctx.setLineDash(phase: 0, lengths: [4, 10])
        ctx.addEllipse(in: CGRect(x: -r2, y: -r2, width: r2 * 2, height: r2 * 2))
        ctx.strokePath()
        ctx.restoreGState()

        // Reset dash
        ctx.setLineDash(phase: 0, lengths: [])
    }

    // MARK: - Name Badge

    /// Draws a gradient lower-third with the person's name. Fades in 0.8s after
    /// the segment starts and out 0.8s before it ends, avoiding the transition zone.
    static func drawNameBadge(
        ctx: CGContext,
        name: String,
        localTime: Double,
        segmentDuration: Double,
        renderSize: CGSize
    ) {
        let badgeHeight: CGFloat = 120
        let delayAfterStart: TimeInterval = 0.8
        let delayBeforeEnd: TimeInterval = 0.8
        let fadeDuration: TimeInterval = 0.5

        let fadeInStart = delayAfterStart
        let fadeInEnd = fadeInStart + fadeDuration
        let fadeOutStart = segmentDuration - delayBeforeEnd - fadeDuration
        let fadeOutEnd = fadeOutStart + fadeDuration

        let badgeAlpha: CGFloat
        if localTime < fadeInStart {
            badgeAlpha = 0
        } else if localTime < fadeInEnd {
            badgeAlpha = CGFloat((localTime - fadeInStart) / fadeDuration)
        } else if localTime < fadeOutStart {
            badgeAlpha = 1
        } else if localTime < fadeOutEnd {
            badgeAlpha = CGFloat(1.0 - (localTime - fadeOutStart) / fadeDuration)
        } else {
            badgeAlpha = 0
        }

        guard badgeAlpha > 0.001 else { return }

        // Badge sits at the bottom of the frame (y=0 in bottom-left coords).
        let badgeRect = CGRect(x: 0, y: 0, width: renderSize.width, height: badgeHeight)

        ctx.saveGState()
        ctx.setAlpha(badgeAlpha)

        // Gradient: transparent at top of badge → deep blue at bottom
        let colors = [
            CGColor(srgbRed: 0, green: 0.12, blue: 0.35, alpha: 0),
            CGColor(srgbRed: 0, green: 0.12, blue: 0.35, alpha: 0.88),
        ] as CFArray

        if let gradient = CGGradient(
            colorsSpace: CGColorSpaceCreateDeviceRGB(),
            colors: colors,
            locations: [0, 1]
        ) {
            ctx.saveGState()
            ctx.clip(to: badgeRect)
            ctx.drawLinearGradient(
                gradient,
                start: CGPoint(x: renderSize.width / 2, y: badgeHeight),
                end: CGPoint(x: renderSize.width / 2, y: 0),
                options: []
            )
            ctx.restoreGState()
        }

        // Name text via Core Text
        let fontSize: CGFloat = 32
        let font = CTFontCreateWithName("Helvetica Neue" as CFString, fontSize, nil)
        let textColor = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)

        let attributes: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: textColor,
        ]
        let attrStr = NSAttributedString(string: name, attributes: attributes)
        let framesetter = CTFramesetterCreateWithAttributedString(attrStr)

        let textX: CGFloat = 36
        let textWidth = renderSize.width - 72
        let textHeight: CGFloat = 48
        let textY: CGFloat = 30

        let textPath = CGMutablePath()
        textPath.addRect(CGRect(x: textX, y: textY, width: textWidth, height: textHeight))
        let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: 0), textPath, nil)
        CTFrameDraw(frame, ctx)

        ctx.restoreGState()
    }

    // MARK: - Helpers

    private static func cubicBezier(
        t: CGFloat,
        p0: CGPoint,
        p1: CGPoint,
        p2: CGPoint,
        p3: CGPoint
    ) -> CGPoint {
        let mt = 1 - t
        let mt2 = mt * mt
        let t2 = t * t
        return CGPoint(
            x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
            y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
        )
    }
}

// MARK: - Deterministic RNG

/// Simple linear congruential generator for reproducible particle layouts.
private struct DeterministicRNG: RandomNumberGenerator {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state = state &* 6364136223846793005 &+ 1442695040888963407
        return state
    }

    mutating func cgFloat(in range: ClosedRange<CGFloat>) -> CGFloat {
        let raw = next()
        let normalized = CGFloat(raw % 10000) / 10000.0
        return range.lowerBound + normalized * (range.upperBound - range.lowerBound)
    }

    mutating func double(in range: ClosedRange<Double>) -> Double {
        let raw = next()
        let normalized = Double(raw % 10000) / 10000.0
        return range.lowerBound + normalized * (range.upperBound - range.lowerBound)
    }
}
