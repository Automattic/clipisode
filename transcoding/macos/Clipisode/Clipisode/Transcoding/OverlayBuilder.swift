//
//  OverlayBuilder.swift
//  Clipisode
//

import AVFoundation
import QuartzCore

enum OverlayBuilder {

    // MARK: - Face Scan Wireframe (Video 1 - Facial Landmarks)

    private static let neonCyan = CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.9)
    private static let neonCyanGlow = CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 1)
    private static let neonMagenta = CGColor(srgbRed: 1, green: 0.1, blue: 0.6, alpha: 0.8)

    /// Creates a sci-fi face scan wireframe from detected facial landmarks:
    /// neon-traced features, pulsing dots on key points, geometric connecting
    /// lines, and an animated scan line sweeping across the face.
    static func buildFaceScan(
        landmarks: FaceLandmarks,
        renderSize: CGSize,
        placementStart: Double,
        placementEnd: Double,
        totalDuration: Double
    ) -> CALayer {
        let container = CALayer()
        container.frame = CGRect(origin: .zero, size: renderSize)
        container.opacity = 0

        let segDuration = placementEnd - placementStart

        // --- Feature trace lines (draw themselves on via strokeEnd animation) ---
        let featureSets: [(points: [CGPoint], color: CGColor, width: CGFloat, closed: Bool)] = [
            (landmarks.faceContour, neonCyan, 2.0, false),
            (landmarks.leftEyebrow, neonCyan, 1.5, false),
            (landmarks.rightEyebrow, neonCyan, 1.5, false),
            (landmarks.leftEye, neonCyan, 1.5, true),
            (landmarks.rightEye, neonCyan, 1.5, true),
            (landmarks.nose, neonCyan, 1.5, false),
            (landmarks.noseCrest, neonCyan, 1.0, false),
            (landmarks.outerLips, neonMagenta, 1.5, true),
        ]

        for (index, feature) in featureSets.enumerated() {
            guard feature.points.count >= 2 else { continue }
            let line = makeTraceLine(
                points: feature.points,
                color: feature.color,
                lineWidth: feature.width,
                closed: feature.closed,
                drawDelay: Double(index) * 0.12,
                drawDuration: 0.6,
                placementStart: placementStart
            )
            container.addSublayer(line)
        }

        // --- Geometric mesh: connecting lines between key feature centers ---
        let leftEyeC = landmarks.leftEyeCenter
        let rightEyeC = landmarks.rightEyeCenter
        let noseC = landmarks.noseCenter
        let mouthC = landmarks.mouthCenter

        let meshLines: [(CGPoint, CGPoint)] = [
            (leftEyeC, rightEyeC),
            (leftEyeC, noseC),
            (rightEyeC, noseC),
            (noseC, mouthC),
            (leftEyeC, mouthC),
            (rightEyeC, mouthC),
        ]

        for (i, line) in meshLines.enumerated() {
            let mesh = makeMeshLine(
                from: line.0, to: line.1,
                drawDelay: 0.8 + Double(i) * 0.08,
                drawDuration: 0.35,
                placementStart: placementStart
            )
            container.addSublayer(mesh)
        }

        // --- Pulsing dots on key landmarks ---
        let keyPoints: [CGPoint] = [
            leftEyeC, rightEyeC, noseC, mouthC,
        ]
        + (landmarks.leftEye.count >= 1 ? [landmarks.leftEye[0], landmarks.leftEye[landmarks.leftEye.count / 2]] : [])
        + (landmarks.rightEye.count >= 1 ? [landmarks.rightEye[0], landmarks.rightEye[landmarks.rightEye.count / 2]] : [])
        + (landmarks.outerLips.count >= 2 ? [landmarks.outerLips[0], landmarks.outerLips[landmarks.outerLips.count / 2]] : [])

        for (i, point) in keyPoints.enumerated() {
            let dot = makePulsingDot(
                at: point,
                radius: (i < 4) ? 5 : 3,
                delay: 0.4 + Double(i) * 0.06,
                placementStart: placementStart
            )
            container.addSublayer(dot)
        }

        // --- Scan line sweeping top-to-bottom across the face ---
        let scanLine = makeScanLine(
            faceRect: landmarks.faceRect,
            renderSize: renderSize,
            sweepDuration: segDuration * 0.6,
            placementStart: placementStart,
            segDuration: segDuration
        )
        container.addSublayer(scanLine)

        addFadeAnimation(to: container, start: placementStart, end: placementEnd, totalDuration: totalDuration)

        return container
    }

    // MARK: Face Scan Helpers

    private static func makeTraceLine(
        points: [CGPoint],
        color: CGColor,
        lineWidth: CGFloat,
        closed: Bool,
        drawDelay: Double,
        drawDuration: Double,
        placementStart: Double
    ) -> CAShapeLayer {
        let path = CGMutablePath()
        path.move(to: points[0])
        for pt in points.dropFirst() {
            path.addLine(to: pt)
        }
        if closed { path.closeSubpath() }

        let layer = CAShapeLayer()
        layer.path = path
        layer.fillColor = nil
        layer.strokeColor = color
        layer.lineWidth = lineWidth
        layer.lineCap = .round
        layer.lineJoin = .round
        layer.shadowColor = color
        layer.shadowRadius = 6
        layer.shadowOpacity = 0.8
        layer.shadowOffset = .zero
        layer.strokeEnd = 0

        let draw = CABasicAnimation(keyPath: "strokeEnd")
        draw.fromValue = 0
        draw.toValue = 1
        draw.duration = drawDuration
        draw.beginTime = AVCoreAnimationBeginTimeAtZero + placementStart + drawDelay
        draw.fillMode = .forwards
        draw.isRemovedOnCompletion = false
        layer.add(draw, forKey: "draw")

        let glowPulse = CABasicAnimation(keyPath: "shadowRadius")
        glowPulse.fromValue = 4
        glowPulse.toValue = 10
        glowPulse.duration = 1.0
        glowPulse.autoreverses = true
        glowPulse.repeatCount = .infinity
        glowPulse.beginTime = AVCoreAnimationBeginTimeAtZero
        glowPulse.isRemovedOnCompletion = false
        layer.add(glowPulse, forKey: "glowPulse")

        return layer
    }

    private static func makeMeshLine(
        from start: CGPoint,
        to end: CGPoint,
        drawDelay: Double,
        drawDuration: Double,
        placementStart: Double
    ) -> CAShapeLayer {
        let path = CGMutablePath()
        path.move(to: start)
        path.addLine(to: end)

        let layer = CAShapeLayer()
        layer.path = path
        layer.fillColor = nil
        layer.strokeColor = CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.35)
        layer.lineWidth = 1.0
        layer.lineDashPattern = [4, 4]
        layer.shadowColor = neonCyan
        layer.shadowRadius = 3
        layer.shadowOpacity = 0.5
        layer.shadowOffset = .zero
        layer.strokeEnd = 0

        let draw = CABasicAnimation(keyPath: "strokeEnd")
        draw.fromValue = 0
        draw.toValue = 1
        draw.duration = drawDuration
        draw.beginTime = AVCoreAnimationBeginTimeAtZero + placementStart + drawDelay
        draw.fillMode = .forwards
        draw.isRemovedOnCompletion = false
        layer.add(draw, forKey: "draw")

        return layer
    }

    private static func makePulsingDot(
        at point: CGPoint,
        radius: CGFloat,
        delay: Double,
        placementStart: Double
    ) -> CALayer {
        let dot = CALayer()
        let size = radius * 2
        dot.frame = CGRect(x: point.x - radius, y: point.y - radius, width: size, height: size)
        dot.cornerRadius = radius
        dot.backgroundColor = neonCyan
        dot.shadowColor = neonCyanGlow
        dot.shadowRadius = 8
        dot.shadowOpacity = 1
        dot.shadowOffset = .zero
        dot.opacity = 0

        let appear = CABasicAnimation(keyPath: "opacity")
        appear.fromValue = 0
        appear.toValue = 1
        appear.duration = 0.3
        appear.beginTime = AVCoreAnimationBeginTimeAtZero + placementStart + delay
        appear.fillMode = .forwards
        appear.isRemovedOnCompletion = false
        dot.add(appear, forKey: "appear")

        let pulse = CABasicAnimation(keyPath: "transform.scale")
        pulse.fromValue = 1.0
        pulse.toValue = 1.5
        pulse.duration = 0.6
        pulse.autoreverses = true
        pulse.repeatCount = .infinity
        pulse.beginTime = AVCoreAnimationBeginTimeAtZero + placementStart + delay
        pulse.isRemovedOnCompletion = false
        dot.add(pulse, forKey: "pulse")

        return dot
    }

    private static func makeScanLine(
        faceRect: CGRect,
        renderSize: CGSize,
        sweepDuration: Double,
        placementStart: Double,
        segDuration: Double
    ) -> CALayer {
        let lineHeight: CGFloat = 2
        let margin: CGFloat = 40

        let line = CAGradientLayer()
        line.frame = CGRect(
            x: faceRect.minX - margin,
            y: faceRect.minY,
            width: faceRect.width + margin * 2,
            height: lineHeight
        )
        line.colors = [
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0),
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.9),
            CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0),
        ]
        line.startPoint = CGPoint(x: 0, y: 0.5)
        line.endPoint = CGPoint(x: 1, y: 0.5)
        line.opacity = 0

        let fadeIn = CABasicAnimation(keyPath: "opacity")
        fadeIn.fromValue = 0
        fadeIn.toValue = 1
        fadeIn.duration = 0.2
        fadeIn.beginTime = AVCoreAnimationBeginTimeAtZero + placementStart + 0.3
        fadeIn.fillMode = .forwards
        fadeIn.isRemovedOnCompletion = false
        line.add(fadeIn, forKey: "fadeIn")

        let topY = faceRect.minY - 20
        let bottomY = faceRect.maxY + 20

        let sweep = CAKeyframeAnimation(keyPath: "position.y")
        sweep.values = [topY, bottomY, topY, bottomY] as [NSNumber]
        sweep.keyTimes = [0, 0.5, 0.75, 1] as [NSNumber]
        sweep.duration = min(sweepDuration, segDuration - 1.0)
        sweep.beginTime = AVCoreAnimationBeginTimeAtZero + placementStart + 0.5
        sweep.fillMode = .forwards
        sweep.isRemovedOnCompletion = false
        line.add(sweep, forKey: "sweep")

        return line
    }

    // MARK: - Particles + Rotating Ring (Video 3)

    /// Creates floating particle dots and a rotating dashed ring.
    static func buildParticleOverlay(
        renderSize: CGSize,
        placementStart: Double,
        placementEnd: Double,
        totalDuration: Double
    ) -> CALayer {
        let container = CALayer()
        container.frame = CGRect(origin: .zero, size: renderSize)
        container.opacity = 0

        // Floating particles
        let particleCount = 18
        for i in 0..<particleCount {
            let size: CGFloat = CGFloat.random(in: 4...10)
            let startX = CGFloat.random(in: 20...(renderSize.width - 20))
            let startY = CGFloat.random(in: renderSize.height * 0.3...renderSize.height * 0.95)
            let endY = startY - CGFloat.random(in: 100...350)
            let drift = CGFloat.random(in: -40...40)

            let dot = CALayer()
            dot.frame = CGRect(x: 0, y: 0, width: size, height: size)
            dot.cornerRadius = size / 2
            dot.backgroundColor = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: CGFloat.random(in: 0.3...0.7))
            dot.position = CGPoint(x: startX, y: startY)
            container.addSublayer(dot)

            let segDuration = placementEnd - placementStart
            let animDuration = Double.random(in: segDuration * 0.5...segDuration * 0.9)
            let delay = Double.random(in: 0...segDuration * 0.3)

            // Upward drift path
            let path = CGMutablePath()
            path.move(to: CGPoint(x: startX, y: startY))
            path.addCurve(
                to: CGPoint(x: startX + drift, y: endY),
                control1: CGPoint(x: startX + drift * 0.3, y: startY - (startY - endY) * 0.3),
                control2: CGPoint(x: startX + drift * 0.7, y: startY - (startY - endY) * 0.7)
            )

            let move = CAKeyframeAnimation(keyPath: "position")
            move.path = path
            move.duration = animDuration
            move.beginTime = AVCoreAnimationBeginTimeAtZero + placementStart + delay
            move.isRemovedOnCompletion = false
            move.fillMode = .both
            dot.add(move, forKey: "move_\(i)")

            // Fade lifecycle: appear → hold → disappear
            let fade = CAKeyframeAnimation(keyPath: "opacity")
            fade.values = [0, 0.8, 0.8, 0] as [NSNumber]
            fade.keyTimes = [0, 0.15, 0.75, 1] as [NSNumber]
            fade.duration = animDuration
            fade.beginTime = AVCoreAnimationBeginTimeAtZero + placementStart + delay
            fade.isRemovedOnCompletion = false
            fade.fillMode = .both
            dot.add(fade, forKey: "fade_\(i)")
        }

        // Rotating dashed ring behind the lower-third area
        let ringRadius: CGFloat = 100
        let ringCenter = CGPoint(x: renderSize.width / 2, y: renderSize.height - 150)

        let ringPath = CGPath(
            ellipseIn: CGRect(x: -ringRadius, y: -ringRadius, width: ringRadius * 2, height: ringRadius * 2),
            transform: nil
        )

        let ring = CAShapeLayer()
        ring.path = ringPath
        ring.position = ringCenter
        ring.fillColor = nil
        ring.strokeColor = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.25)
        ring.lineWidth = 2
        ring.lineDashPattern = [8, 6]
        container.addSublayer(ring)

        let rotation = CABasicAnimation(keyPath: "transform.rotation.z")
        rotation.fromValue = 0
        rotation.toValue = Double.pi * 2
        rotation.duration = 6.0
        rotation.repeatCount = .infinity
        rotation.beginTime = AVCoreAnimationBeginTimeAtZero
        rotation.isRemovedOnCompletion = false
        ring.add(rotation, forKey: "rotation")

        // Second ring, counter-rotating, slightly larger
        let ring2 = CAShapeLayer()
        let ring2Radius: CGFloat = 130
        ring2.path = CGPath(
            ellipseIn: CGRect(x: -ring2Radius, y: -ring2Radius, width: ring2Radius * 2, height: ring2Radius * 2),
            transform: nil
        )
        ring2.position = ringCenter
        ring2.fillColor = nil
        ring2.strokeColor = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 0.15)
        ring2.lineWidth = 1.5
        ring2.lineDashPattern = [4, 10]
        container.addSublayer(ring2)

        let rotation2 = CABasicAnimation(keyPath: "transform.rotation.z")
        rotation2.fromValue = 0
        rotation2.toValue = -Double.pi * 2
        rotation2.duration = 10.0
        rotation2.repeatCount = .infinity
        rotation2.beginTime = AVCoreAnimationBeginTimeAtZero
        rotation2.isRemovedOnCompletion = false
        ring2.add(rotation2, forKey: "rotation2")

        addFadeAnimation(to: container, start: placementStart, end: placementEnd, totalDuration: totalDuration)

        return container
    }

    // MARK: - Shared Helpers

    private static func addFadeAnimation(
        to layer: CALayer,
        start: Double,
        end: Double,
        totalDuration: Double,
        fadeDuration: Double = 0.5,
        delay: Double = 0.5
    ) {
        let fadeInStart = start + delay
        let fadeInEnd = fadeInStart + fadeDuration
        let fadeOutStart = end - delay - fadeDuration
        let fadeOutEnd = fadeOutStart + fadeDuration

        let anim = CAKeyframeAnimation(keyPath: "opacity")
        anim.beginTime = AVCoreAnimationBeginTimeAtZero
        anim.duration = totalDuration
        anim.isRemovedOnCompletion = false
        anim.fillMode = .forwards
        anim.calculationMode = .linear

        anim.keyTimes = [
            0,
            NSNumber(value: max(fadeInStart, 0) / totalDuration),
            NSNumber(value: fadeInEnd / totalDuration),
            NSNumber(value: max(fadeOutStart, fadeInEnd) / totalDuration),
            NSNumber(value: min(fadeOutEnd, totalDuration) / totalDuration),
            1,
        ]
        anim.values = [0, 0, 1, 1, 0, 0] as [NSNumber]

        layer.add(anim, forKey: "fade")
    }
}
