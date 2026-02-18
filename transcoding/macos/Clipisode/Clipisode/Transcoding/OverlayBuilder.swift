//
//  OverlayBuilder.swift
//  Clipisode
//

import AVFoundation
import QuartzCore

enum OverlayBuilder {

    // MARK: - Glow Ring (Video 1 - Face Detection)

    /// Creates a pulsing neon ring positioned around a detected face.
    static func buildGlowRing(
        faceRect: CGRect,
        renderSize: CGSize,
        placementStart: Double,
        placementEnd: Double,
        totalDuration: Double
    ) -> CALayer {
        let container = CALayer()
        container.frame = CGRect(origin: .zero, size: renderSize)
        container.opacity = 0

        let centerX = faceRect.midX
        let centerY = faceRect.midY
        let radius = max(faceRect.width, faceRect.height) * 0.7

        let ringPath = CGPath(
            ellipseIn: CGRect(x: -radius, y: -radius, width: radius * 2, height: radius * 2),
            transform: nil
        )

        let ring = CAShapeLayer()
        ring.path = ringPath
        ring.position = CGPoint(x: centerX, y: centerY)
        ring.fillColor = nil
        ring.strokeColor = CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 0.9)
        ring.lineWidth = 4
        ring.shadowColor = CGColor(srgbRed: 0, green: 0.9, blue: 1, alpha: 1)
        ring.shadowRadius = 12
        ring.shadowOpacity = 1
        ring.shadowOffset = .zero
        container.addSublayer(ring)

        // Pulse scale animation
        let pulse = CABasicAnimation(keyPath: "transform.scale")
        pulse.fromValue = 1.0
        pulse.toValue = 1.12
        pulse.duration = 0.8
        pulse.autoreverses = true
        pulse.repeatCount = .infinity
        pulse.beginTime = AVCoreAnimationBeginTimeAtZero
        pulse.isRemovedOnCompletion = false
        ring.add(pulse, forKey: "pulse")

        // Glow intensity animation
        let glow = CABasicAnimation(keyPath: "shadowRadius")
        glow.fromValue = 10
        glow.toValue = 25
        glow.duration = 0.8
        glow.autoreverses = true
        glow.repeatCount = .infinity
        glow.beginTime = AVCoreAnimationBeginTimeAtZero
        glow.isRemovedOnCompletion = false
        ring.add(glow, forKey: "glow")

        // Fade in/out timed to the segment
        addFadeAnimation(to: container, start: placementStart, end: placementEnd, totalDuration: totalDuration)

        return container
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
