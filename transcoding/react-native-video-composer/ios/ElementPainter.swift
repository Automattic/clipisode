import Foundation
import CoreGraphics
import CoreText
import UIKit
import CoreMedia
import AVFoundation

public typealias Element = Dictionary<String, Any>
public typealias Props = Dictionary<String, Any>

@objc
public class ElementPainter : NSObject {
  // We know we're working with kCVPixelFormatType_32BGRA
  private let COLOR_COMPONENT_COUNT: size_t = 4
  
  private let coordinateTransform: CGAffineTransform

  let context: CGContext
  let manager: CompositionManager?
  let files: Dictionary<String, String>
  
  @objc
  public init(context: CGContext, height: Int, manager: CompositionManager?, files: Dictionary<String, String>) {
    self.context = context
    self.manager = manager
    self.files = files
    
    coordinateTransform = CGAffineTransform.identity
      .translatedBy(x: 0, y: CGFloat(height))
      .scaledBy(x: 1, y: -1)
  }
  
  @objc
  public func drawBackground() {
    context.setFillColor(UIColor.black.cgColor)
    context.fill(CGRect(x: 0, y:0, width: context.width, height: context.height))
  }
  
  @objc
  public func drawElement(type: String, element: Element, props: Props, at: CMTime, compositionRequest: AVAsynchronousVideoCompositionRequest? = nil) {
    switch type {
    case "image":
      drawImage(props: props)
    case "rect":
      drawRectangle(props: props)
    case "gradient":
      drawGradient(props: props)
    case "video":
      if let request = compositionRequest, let elementName = element["name"] as? String {
        drawVideo(elementName: elementName, props: props, at: at, request: request)
      }
    case "frame":
      if let elementName = element["name"] as? String {
        drawFrame(elementName: elementName, props: props)
      }
    case "text":
      drawText(props: props)
    default:
      print("Element type not supported.")
    }
  }
  
  private func drawVideo(elementName: String, props: Props, at: CMTime, request: AVAsynchronousVideoCompositionRequest) {
    let resizeMode = props["resizeMode"] as? String ?? "cover"
    let x = props["x"] as? Double ?? 0
    let y = props["y"] as? Double ?? 0
    let width = props["width"] as? Double ?? 0
    let height = props["height"] as? Double ?? 0

    if let manager = self.manager, let trackId = manager.videoTrackId(elementName: elementName)  {
      let requestedFrame = request.sourceFrame(byTrackID: trackId)

      if let sourceFrame = requestedFrame {
        CVPixelBufferLockBaseAddress(sourceFrame, .readOnly)
        var sourceFrameImage = CIImage(cvPixelBuffer: sourceFrame)
        CVPixelBufferUnlockBaseAddress(sourceFrame, .readOnly)

        // ------- preferred transform ----------
        
        if let mainInstruction = request.videoCompositionInstruction as? AVVideoCompositionInstruction {
          if let li = mainInstruction.layerInstructions.first(where: { $0.trackID == trackId }) {
            var startTransform: CGAffineTransform = .identity
            
            if li.getTransformRamp(for: at, start: &startTransform, end: nil, timeRange: nil) {
              if !startTransform.isIdentity {
                var rotatedTransform = startTransform

                if rotatedTransform.tx == sourceFrameImage.extent.height, rotatedTransform.ty == 0 {
                  rotatedTransform = rotatedTransform
                    .rotated(by: -.pi)
                    .translatedBy(x: -sourceFrameImage.extent.width, y: -sourceFrameImage.extent.height)
                }
                
                sourceFrameImage = sourceFrameImage.transformed(by: rotatedTransform)
              }
            }
          }
        }

        // --------------------------------------
        
        let coreImageContext = CIContext(cgContext: context, options: nil)
        
        if let sourceFrameCGImage = coreImageContext.createCGImage(sourceFrameImage, from: sourceFrameImage.extent) {
          let finalRect = calculateRectForResizeMode(
            sourceWidth: Double(sourceFrameCGImage.width),
            sourceHeight: Double(sourceFrameCGImage.height),
            resizeMode: resizeMode,
            x: x, y: y, width: width, height: height
          ).applying(coordinateTransform)
          
          context.saveGState()
          context.clip(to: rectFromProps(props))
          context.draw(sourceFrameCGImage, in: finalRect)
          context.restoreGState()
        }
      }
    }
  }
  
  private func calculateRectForResizeMode(sourceWidth: Double, sourceHeight: Double, resizeMode: String, x: Double, y: Double ,width: Double, height: Double) -> CGRect {
    var finalX = x
    var finalY = y
    var finalWidth = width
    var finalHeight = height
    
    // ADJUST FOR HEIGHT
    
    if sourceHeight < height {
      finalHeight = height
      finalWidth = finalHeight * (sourceWidth / sourceHeight)
    }
    
    // ADJUST FOR WIDTH (if necessary)
    
    if finalWidth < sourceWidth {
      finalWidth = width
      finalHeight = finalWidth * (sourceHeight / sourceWidth)
    }
    
    if finalWidth > width {
      finalX = x - ((finalWidth - width) / 2)
    }
    
    if finalHeight > height {
      finalY = y - ((finalHeight - height) / 2)
    }
    
    return CGRect(x: finalX, y: finalY, width: finalWidth, height: finalHeight)
  }
  
  private func drawFrame(elementName: String, props: Props) {
//    let startDF = DispatchTime.now()
    
    let resizeMode = props["resizeMode"] as? String ?? "cover"
    let x = props["x"] as? Double ?? 0
    let y = props["y"] as? Double ?? 0
    let width = props["width"] as? Double ?? 0
    let height = props["height"] as? Double ?? 0
    
    if let manager = self.manager, let frameImage = manager.frame(elementName: elementName) {
      let alpha = props["alpha"] as? Double ?? 1.0
      let rect = rectFromProps(props)
      
      let finalRect = calculateRectForResizeMode(
        sourceWidth: Double(frameImage.width),
        sourceHeight: Double(frameImage.height),
        resizeMode: resizeMode,
        x: x, y: y, width: width, height: height
      ).applying(coordinateTransform)
      
      context.saveGState()

      context.clip(to: rect)
      context.setAlpha(CGFloat(alpha))
      context.draw(frameImage, in: finalRect)

      context.restoreGState()
    } else {
      print("No frame")
    }
  }
  
  private var imageCache: Dictionary<String, UIImage> = [:];
  
  private func imageByKey(_ key: String) -> UIImage? {
    if imageCache[key] != nil {
      return imageCache[key]
    }
    
    var image: UIImage? = nil
    
    if let filePath = self.files[key] {
      image = UIImage(contentsOfFile: filePath)
    }
    
    imageCache[key] = image
    
    return image
  }
  
  private func drawImage(props: Props) {
    let alpha = props["alpha"] as? Double ?? 1.0
    let imageKey = props["imageKey"] as? String
    let rect = rectFromProps(props)
    
    var image: UIImage? = nil
    
    if let imageKey = props["imageKey"] as? String {
      image = imageByKey(imageKey)
    }
    
    if (image == nil) {
      print("Image not found for key: '\(imageKey ?? "{nil}")'");
    } else {
      context.saveGState()
      
      context.setAlpha(CGFloat(alpha))
      context.draw(image!.cgImage!, in: rect)
      
      context.restoreGState()
    }
  }
  
  private func drawRectangle(props: Props) {
    let color = props["color"] as? String ?? "#000000"
    let alpha = props["alpha"] as? Double ?? 1.0
    let cornerRadius = props["cornerRadius"] as? Double ?? 0
    let strokeColor = props["strokeColor"] as? String ?? "#000000"
    let strokeAlpha = props["strokeAlpha"] as? Double ?? 1.0
    let strokeWidth = props["strokeWidth"] as? Double ?? 0.0
    
    let rect = rectFromProps(props)
    
    let floatRadius = CGFloat(cornerRadius)
    let rectBezierPath = UIBezierPath(roundedRect: rect, cornerRadius: floatRadius)
    let fillColor = ColorHelper.getUIColorObjectFromHexString(color: color, alpha: alpha)
    
    context.setFillColor(fillColor.cgColor)
    context.addPath(rectBezierPath.cgPath)
    context.fillPath()
    
    if (strokeWidth > 0) {
      let uiStrokeWidth = CGFloat(strokeWidth)
      
      let strokeRect = CGRect(
        x: rect.origin.x - uiStrokeWidth / 2,
        y: rect.origin.y - uiStrokeWidth / 2,
        width: rect.size.width + uiStrokeWidth,
        height: rect.size.height + uiStrokeWidth
      )
      
      let strokeRectBezierPath = UIBezierPath(
        roundedRect: strokeRect,
        cornerRadius: floatRadius + uiStrokeWidth / 2
      )
      
      let strokeColor = ColorHelper.getUIColorObjectFromHexString(color: strokeColor, alpha: strokeAlpha)
      
      context.setStrokeColor(strokeColor.cgColor)
      context.setLineWidth(uiStrokeWidth)
      context.addPath(strokeRectBezierPath.cgPath)
      context.strokePath()
    }
  }
  
  private func drawGradient(props: Props) {
    let alpha = props["alpha"] as? Double ?? 1.0
    let rVal = props["rVal"] as? Double ?? 52.0
    let gVal = props["gVal"] as? Double ?? 152.0
    let bVal = props["bVal"] as? Double ?? 219.0
    
    // TODO: 👆 alpha is the only supported prop right now to support fading in/out.
    // This needs to be updated to support colors, locations, and path.
    
    var gradient: CGGradient
    var colorSpace: CGColorSpace
    
    let numberOfLocations = 3
    
    let baseColor = UIColor(red: CGFloat(rVal)/255.0, green: CGFloat(gVal)/255.0, blue: CGFloat(bVal)/255.0, alpha: 1)
    
    let colorOne = baseColor.withAlphaComponent(0.0).cgColor
    let colorTwo = baseColor.withAlphaComponent(0.8).cgColor
    let colorThree = baseColor.withAlphaComponent(1.0).cgColor
    
    let scc = colorOne.components!
    let mcc = colorTwo.components!
    let ecc = colorThree.components!
    
    let locations: [CGFloat] = [0.0, 0.45, 1.0];
    let components: [CGFloat] = [ scc[0], scc[1], scc[2], scc[3],
                                  mcc[0], mcc[1], mcc[2], mcc[3],
                                  ecc[0], ecc[1], ecc[2], ecc[3] ];
    
    let height: CGFloat = 210.0
    
    colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
    gradient = CGGradient(
      colorSpace: colorSpace,
      colorComponents: components,
      locations: locations,
      count: numberOfLocations
    )!

    let myStartPoint: CGPoint = CGPoint(x: 0.0, y: 1280.0 - height).applying(coordinateTransform)
    let myEndPoint: CGPoint = CGPoint(x: 0.0, y: 1280.0).applying(coordinateTransform)

    context.saveGState()
    
    context.clip(to: CGRect(x: 0, y: 1280 - height, width: 720, height: 1280).applying(coordinateTransform))
    context.setAlpha(CGFloat(alpha))
    
    context.drawLinearGradient(gradient, start: myStartPoint, end: myEndPoint, options: .init(rawValue: 0))
    
    context.restoreGState()
  }
  
  private func drawText(props: Props) {
    let value = props["value"] as? String ?? ""
    let alpha = props["alpha"] as? Double ?? 1.0
    let fontName = props["fontName"] as? String ?? "Open Sans"
    let fontSize = props["fontSize"] as? Double ?? 44
    let color = props["color"] as? String ?? "#FFFFFF"
    let textAlign = props["textAlign"] as? String ?? "left"
    var lineHeight = props["lineHeight"] as? Double ?? fontSize * 1.4
    let originY = props["originY"] as? String ?? "top"
    let x = props["x"] as? Double ?? 0.0
    var y = props["y"] as? Double ?? 0.0
    let width = props["width"] as? Double ?? 0.0
    let height = props["height"] as? Double ?? 0.0
    
    // TODO: Can we check the validity of fontName?
    
    let descriptor = CTFontDescriptorCreateWithNameAndSize(fontName as CFString, CGFloat(fontSize))
    let font = CTFontCreateWithFontDescriptor(descriptor, 0.0, nil)
    let foregroundColor = ColorHelper.getUIColorObjectFromHexString(color: color, alpha: alpha).cgColor
    
    var alignment: CTTextAlignment
    
    switch textAlign {
    case "center":
      alignment = .center
    case "right":
      alignment = .right
    case "justified":
      alignment = .justified
    case "natural":
      alignment = .natural
    default:
      alignment = .left
    }

    let styleSettings: [CTParagraphStyleSetting] = [
      CTParagraphStyleSetting(spec: .minimumLineHeight, valueSize: MemoryLayout<CGFloat>.size, value: &lineHeight),
      CTParagraphStyleSetting(spec: .maximumLineHeight, valueSize: MemoryLayout<CGFloat>.size, value: &lineHeight),
      CTParagraphStyleSetting(spec: .alignment, valueSize: MemoryLayout<CTTextAlignment>.size, value: &alignment)
    ]
    let paragraphStyle = CTParagraphStyleCreate(styleSettings, styleSettings.count)

    let attrString = NSAttributedString(string: value, attributes: [
      NSAttributedString.Key.font: font,
      NSAttributedString.Key.foregroundColor: foregroundColor,
      NSAttributedString.Key.paragraphStyle: paragraphStyle
    ])
    let frameSetter = CTFramesetterCreateWithAttributedString(attrString);
    
    let currentRange = CFRangeMake(0, 0)
    
    // vertical align center or bottom?
    let frameConstraints = CGSize(width: width, height: height)
    let frameSize = CTFramesetterSuggestFrameSizeWithConstraints(frameSetter, currentRange, nil, frameConstraints, nil);
    
    if originY == "bottom" {
      y = y - Double(frameSize.height)
    } else if originY == "center" {
      y = y - Double(frameSize.height / 2)
    }
    
    let framePath = CGMutablePath()
    framePath.addRect(CGRect(x: x, y: y, width: width, height: height).applying(coordinateTransform))
    
    let frame = CTFramesetterCreateFrame(frameSetter, currentRange, framePath, nil);
    
    CTFrameDraw(frame, context)
  }
  
  // This is a standard way to pull x/y/width/height values from props and create a
  // CGRect which is commonly used for positioning elements. The modifier parameter
  // is there to support having multiple rectangle configs in the case that some draw
  // functions need that. This is necessary because the props must be flat key/value
  // pairs instead of nested objects to allow for simpler animation (preventing
  // base value mutation during animation).
  private func rectFromProps(_ props: Dictionary<String, Any>, modifier: String? = nil) -> CGRect {
    var xKey = "x"
    var yKey = "y"
    var widthKey = "width"
    var heightKey = "height"
    
    if (modifier != nil) {
      xKey = "\(modifier!)\(xKey)"
      yKey = "\(modifier!)\(yKey)"
      widthKey = "\(modifier!)\(widthKey)"
      heightKey = "\(modifier!)\(heightKey)"
    }
    
    let x = props[xKey] as? Double ?? 0
    let y = props[yKey] as? Double ?? 0
    let width = props[widthKey] as? Double ?? 0
    let height = props[heightKey] as? Double ?? 0

    let rect = CGRect(x: x, y: y, width: width, height: height)
    
    return rect.applying(coordinateTransform)
  }
}
