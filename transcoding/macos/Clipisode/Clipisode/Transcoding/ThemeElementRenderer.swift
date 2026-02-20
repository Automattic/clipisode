//
//  ThemeElementRenderer.swift
//  Clipisode
//
//  Draws theme elements (rect, gradient, video, frame, text, image) into a CGContext.
//  Expects a y-down (top-left origin) context — the caller flips the CTM before invoking.
//

import AVFoundation
import CoreGraphics
import CoreImage
import CoreText
import AppKit
import ImageIO

enum ThemeElementRenderer {

    static let renderHeight: CGFloat = 1280
    static let renderWidth: CGFloat = 720

    static func rectFromProps(_ props: [String: Any]) -> CGRect {
        let x = props["x"] as? Double ?? 0
        let y = props["y"] as? Double ?? 0
        let w = props["width"] as? Double ?? 0
        let h = props["height"] as? Double ?? 0
        return CGRect(x: x, y: y, width: w, height: h)
    }

    static func draw(
        ctx: CGContext,
        element: [String: Any],
        props: [String: Any],
        at time: CMTime,
        request: AVAsynchronousVideoCompositionRequest,
        videoTrackIdMap: [String: CMPersistentTrackID],
        videoPreferredTransforms: [String: CGAffineTransform],
        frameMap: [String: CGImage],
        files: [String: String]
    ) {
        guard let type = element["type"] as? String else { return }
        switch type {
        case "rect":
            drawRect(ctx: ctx, props: props)
        case "gradient":
            drawGradient(ctx: ctx, props: props)
        case "video":
            if let name = element["name"] as? String {
                drawVideo(ctx: ctx, elementName: name, props: props, at: time, request: request, videoTrackIdMap: videoTrackIdMap, videoPreferredTransforms: videoPreferredTransforms)
            }
        case "frame":
            if let name = element["name"] as? String {
                drawFrame(ctx: ctx, elementName: name, props: props, frameMap: frameMap)
            }
        case "text":
            drawText(ctx: ctx, props: props)
        case "image":
            drawImage(ctx: ctx, props: props, files: files)
        default:
            break
        }
    }

    // MARK: - Rect

    private static func drawRect(ctx: CGContext, props: [String: Any]) {
        let colorHex = props["color"] as? String ?? "#000000"
        let alpha = CGFloat(props["alpha"] as? Double ?? 1.0)
        let rect = rectFromProps(props)
        let color = hexToCGColor(colorHex, alpha: alpha)
        ctx.setFillColor(color)
        ctx.fill(rect)
    }

    // MARK: - Gradient

    private static func drawGradient(ctx: CGContext, props: [String: Any]) {
        let alpha = CGFloat(props["alpha"] as? Double ?? 1.0)
        let rVal = CGFloat(props["rVal"] as? Double ?? 52) / 255
        let gVal = CGFloat(props["gVal"] as? Double ?? 152) / 255
        let bVal = CGFloat(props["bVal"] as? Double ?? 219) / 255
        let rect = rectFromProps(props)
        let base = CGColor(srgbRed: rVal, green: gVal, blue: bVal, alpha: 1)
        let c0 = CGColor(srgbRed: rVal, green: gVal, blue: bVal, alpha: 0)
        let c1 = CGColor(srgbRed: rVal, green: gVal, blue: bVal, alpha: 0.8)
        let c2 = CGColor(srgbRed: rVal, green: gVal, blue: bVal, alpha: 1)
        let colors = [c0, c1, c2] as CFArray
        let locations: [CGFloat] = [0, 0.45, 1]
        guard let gradient = CGGradient(
            colorsSpace: CGColorSpaceCreateDeviceRGB(),
            colors: colors,
            locations: locations
        ) else { return }
        let start = CGPoint(x: rect.minX, y: rect.minY)
        let end = CGPoint(x: rect.minX, y: rect.maxY)
        ctx.saveGState()
        ctx.clip(to: rect)
        ctx.setAlpha(alpha)
        ctx.drawLinearGradient(gradient, start: start, end: end, options: [])
        ctx.restoreGState()
    }

    // MARK: - Video

    private static func drawVideo(
        ctx: CGContext,
        elementName: String,
        props: [String: Any],
        at time: CMTime,
        request: AVAsynchronousVideoCompositionRequest,
        videoTrackIdMap: [String: CMPersistentTrackID],
        videoPreferredTransforms: [String: CGAffineTransform]
    ) {
        guard let trackID = videoTrackIdMap[elementName],
              let sourceBuffer = request.sourceFrame(byTrackID: trackID) else { return }
        let x = CGFloat(props["x"] as? Double ?? 0)
        let y = CGFloat(props["y"] as? Double ?? 0)
        let w = CGFloat(props["width"] as? Double ?? renderWidth)
        let h = CGFloat(props["height"] as? Double ?? renderHeight)
        let rect = CGRect(x: x, y: y, width: w, height: h)
        var ciImage = CIImage(cvPixelBuffer: sourceBuffer)
        if let transform = videoPreferredTransforms[elementName], !transform.isIdentity {
            ciImage = ciImage.oriented(VideoCompositor.videoOrientation(from: transform))
        }
        let ciContext = CIContext()
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else { return }
        ctx.saveGState()
        ctx.clip(to: rect)
        drawImageRightSideUp(cgImage, in: rect, ctx: ctx)
        ctx.restoreGState()
    }

    // MARK: - Frame

    private static func drawFrame(
        ctx: CGContext,
        elementName: String,
        props: [String: Any],
        frameMap: [String: CGImage]
    ) {
        guard let frameImage = frameMap[elementName] else { return }
        let alpha = CGFloat(props["alpha"] as? Double ?? 1.0)
        let rect = rectFromProps(props)
        ctx.saveGState()
        ctx.clip(to: rect)
        ctx.setAlpha(alpha)
        drawImageRightSideUp(frameImage, in: rect, ctx: ctx)
        ctx.restoreGState()
    }

    // MARK: - Text

    private static func drawText(ctx: CGContext, props: [String: Any]) {
        let value = props["value"] as? String ?? ""
        let alpha = CGFloat(props["alpha"] as? Double ?? 1.0)
        let fontName = props["fontName"] as? String ?? "Helvetica Neue"
        let fontSize = CGFloat(props["fontSize"] as? Double ?? 44)
        let colorHex = props["color"] as? String ?? "#FFFFFF"
        let textAlign = props["textAlign"] as? String ?? "left"
        var lineHeight = CGFloat(props["lineHeight"] as? Double ?? fontSize * 1.4)
        let originY = props["originY"] as? String ?? "top"
        var x = CGFloat(props["x"] as? Double ?? 0)
        var y = CGFloat(props["y"] as? Double ?? 0)
        let w = CGFloat(props["width"] as? Double ?? 0)
        let h = CGFloat(props["height"] as? Double ?? 0)
        let font = CTFontCreateWithName(fontName as CFString, fontSize, nil)
        let cgColor = hexToCGColor(colorHex, alpha: alpha)
        let textColor = NSColor(cgColor: cgColor) ?? .white
        var alignment: CTTextAlignment
        switch textAlign {
        case "center": alignment = .center
        case "right": alignment = .right
        case "justified": alignment = .justified
        default: alignment = .left
        }
        let styleSettings: [CTParagraphStyleSetting] = [
            CTParagraphStyleSetting(spec: .minimumLineHeight, valueSize: MemoryLayout<CGFloat>.size, value: &lineHeight),
            CTParagraphStyleSetting(spec: .maximumLineHeight, valueSize: MemoryLayout<CGFloat>.size, value: &lineHeight),
            CTParagraphStyleSetting(spec: .alignment, valueSize: MemoryLayout<CTTextAlignment>.size, value: &alignment)
        ]
        let paragraphStyle = CTParagraphStyleCreate(styleSettings, styleSettings.count)
        let attrString = NSAttributedString(string: value, attributes: [
            .font: font,
            .foregroundColor: textColor,
            .paragraphStyle: paragraphStyle
        ])
        let framesetter = CTFramesetterCreateWithAttributedString(attrString)
        let frameSize = CTFramesetterSuggestFrameSizeWithConstraints(framesetter, CFRange(location: 0, length: 0), nil, CGSize(width: w, height: h), nil)
        if originY == "bottom" { y = y - frameSize.height }
        else if originY == "center" { y = y - frameSize.height / 2 }
        let textRect = CGRect(x: x, y: y, width: w, height: h)
        let framePath = CGPath(rect: textRect, transform: nil)
        let frame = CTFramesetterCreateFrame(framesetter, CFRange(location: 0, length: 0), framePath, nil)
        ctx.saveGState()
        ctx.translateBy(x: 0, y: textRect.minY + textRect.maxY)
        ctx.scaleBy(x: 1, y: -1)
        CTFrameDraw(frame, ctx)
        ctx.restoreGState()
    }

    // MARK: - Image

    private static func drawImage(ctx: CGContext, props: [String: Any], files: [String: String]) {
        guard let imageKey = props["imageKey"] as? String,
              let path = files[imageKey],
              let imageSource = CGImageSourceCreateWithURL(URL(fileURLWithPath: path) as CFURL, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else { return }
        let alpha = CGFloat(props["alpha"] as? Double ?? 1.0)
        let rect = rectFromProps(props)
        ctx.saveGState()
        ctx.setAlpha(alpha)
        drawImageRightSideUp(cgImage, in: rect, ctx: ctx)
        ctx.restoreGState()
    }

    // MARK: - Helpers

    /// Draws a CGImage right-side up in a y-down (CTM-flipped) context.
    private static func drawImageRightSideUp(_ image: CGImage, in rect: CGRect, ctx: CGContext) {
        ctx.saveGState()
        ctx.translateBy(x: 0, y: rect.minY + rect.maxY)
        ctx.scaleBy(x: 1, y: -1)
        ctx.draw(image, in: rect)
        ctx.restoreGState()
    }

    private static func hexToCGColor(_ hex: String, alpha: CGFloat) -> CGColor {
        var hex = hex
        if hex.hasPrefix("#") { hex = String(hex.dropFirst()) }
        var rgb: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&rgb)
        let r = CGFloat((rgb >> 16) & 0xFF) / 255
        let g = CGFloat((rgb >> 8) & 0xFF) / 255
        let b = CGFloat(rgb & 0xFF) / 255
        return CGColor(srgbRed: r, green: g, blue: b, alpha: alpha)
    }
}
