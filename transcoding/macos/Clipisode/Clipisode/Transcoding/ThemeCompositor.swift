//
//  ThemeCompositor.swift
//  Clipisode
//
//  AVVideoCompositing that renders only theme elements. No default background or overlays;
//  nothing is drawn unless specified in the elements array.
//

import AVFoundation
import CoreGraphics

final class ThemeCompositor: NSObject, AVVideoCompositing {

    var requiredPixelBufferAttributesForRenderContext: [String: Any] = [
        String(kCVPixelBufferPixelFormatTypeKey): [kCVPixelFormatType_32BGRA]
    ]
    var sourcePixelBufferAttributes: [String: Any]? = [
        String(kCVPixelBufferPixelFormatTypeKey): [kCVPixelFormatType_32BGRA]
    ]

    private let queue = DispatchQueue(label: "com.clipisode.themecompositor", qos: .userInitiated)
    private var cancelled = false

    func startRequest(_ request: AVAsynchronousVideoCompositionRequest) {
        queue.async {
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
        queue.async { self.cancelled = false }
    }

    private func renderFrame(_ request: AVAsynchronousVideoCompositionRequest) {
        guard let instruction = request.videoCompositionInstruction as? ThemeCompositionInstruction else {
            request.finish(with: NSError(domain: "ThemeCompositor", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid instruction"]))
            return
        }
        guard let destination = request.renderContext.newPixelBuffer() else {
            request.finish(with: NSError(domain: "ThemeCompositor", code: 2, userInfo: [NSLocalizedDescriptionKey: "No pixel buffer"]))
            return
        }

        CVPixelBufferLockBaseAddress(destination, [])
        defer { CVPixelBufferUnlockBaseAddress(destination, []) }

        let width = CVPixelBufferGetWidth(destination)
        let height = CVPixelBufferGetHeight(destination)
        let bytesPerRow = CVPixelBufferGetBytesPerRow(destination)
        guard let base = CVPixelBufferGetBaseAddress(destination),
              let ctx = CGContext(
                  data: base,
                  width: width,
                  height: height,
                  bitsPerComponent: 8,
                  bytesPerRow: bytesPerRow,
                  space: CGColorSpaceCreateDeviceRGB(),
                  bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue
              ) else {
            request.finish(with: NSError(domain: "ThemeCompositor", code: 3, userInfo: [NSLocalizedDescriptionKey: "No context"]))
            return
        }

        ctx.setAllowsAntialiasing(true)

        // Clear to transparent so only elements are drawn
        ctx.setFillColor(CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 0))
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))

        let time = request.compositionTime
        let timeSeconds = CMTimeGetSeconds(time)

        for element in instruction.elements {
            let startAt = element["startAt"] as? Double ?? 0
            let endAt = element["endAt"] as? Double ?? .infinity
            guard timeSeconds >= startAt && timeSeconds <= endAt else { continue }
            guard let props = element["props"] as? [String: Any] else { continue }

            ThemeElementRenderer.draw(
                ctx: ctx,
                element: element,
                props: props,
                at: time,
                request: request,
                videoTrackIdMap: instruction.videoTrackIdMap,
                videoPreferredTransforms: instruction.videoPreferredTransforms,
                frameMap: instruction.frameMap,
                files: instruction.files
            )
        }

        request.finish(withComposedVideoFrame: destination)
    }
}
