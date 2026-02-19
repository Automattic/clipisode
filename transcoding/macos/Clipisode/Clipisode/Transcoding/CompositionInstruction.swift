//
//  CompositionInstruction.swift
//  Clipisode
//

import AVFoundation
import CoreImage

nonisolated enum SegmentEffect: Hashable, Sendable {
    case faceTracking
    case particles
}

/// A named CIFilter with its parameters, applied per-frame in the compositor.
/// When `endParameters` is provided, numeric values are interpolated from
/// `parameters` → `endParameters` over the segment's duration using the
/// chosen easing curve.
struct CIFilterConfig {
    enum Easing {
        case linear
        case easeIn
        case easeOut
        case easeInOut

        func apply(_ t: Double) -> Double {
            switch self {
            case .linear:    return t
            case .easeIn:    return 1 - cos(t * .pi / 2)
            case .easeOut:   return sin(t * .pi / 2)
            case .easeInOut: return -(cos(.pi * t) - 1) / 2
            }
        }
    }

    let name: String
    let parameters: [String: Any]
    let endParameters: [String: Any]?
    let easing: Easing

    init(name: String, parameters: [String: Any], endParameters: [String: Any]? = nil, easing: Easing = .easeInOut) {
        self.name = name
        self.parameters = parameters
        self.endParameters = endParameters
        self.easing = easing
    }

    /// - Parameter progress: 0…1 fraction through the segment duration.
    func makeFilter(progress: Double = 0) -> CIFilter? {
        guard let filter = CIFilter(name: name) else { return nil }
        filter.setDefaults()

        let t = easing.apply(min(max(progress, 0), 1))

        for (key, startValue) in parameters {
            if let endParams = endParameters,
               let startNum = startValue as? Double,
               let endNum = endParams[key] as? Double {
                filter.setValue(startNum + (endNum - startNum) * t, forKey: key)
            } else {
                filter.setValue(startValue, forKey: key)
            }
        }
        return filter
    }
}

/// Carries per-segment metadata through to the custom `VideoCompositor`.
final class CompositionInstruction: NSObject, AVVideoCompositionInstructionProtocol {
    var containsTweening: Bool = true
    

    // MARK: AVVideoCompositionInstructionProtocol

    var timeRange: CMTimeRange
    var enablePostProcessing: Bool = false
    var containsTweenedVideoInstruction: Bool = true
    var passthroughTrackID: CMPersistentTrackID = kCMPersistentTrackID_Invalid
    var requiredSourceTrackIDs: [NSValue]?

    // MARK: Custom Payload

    struct Segment {
        let trackID: CMPersistentTrackID
        /// Where this segment sits in the composition timeline.
        let timeRange: CMTimeRange
        let name: String?
        let effects: Set<SegmentEffect>
        /// CIFilters applied to the video frame in order before rendering.
        let ciFilters: [CIFilterConfig]
    }

    let segments: [Segment]
    let transitionDuration: CMTime
    let renderSize: CGSize

    init(
        timeRange: CMTimeRange,
        segments: [Segment],
        transitionDuration: CMTime,
        renderSize: CGSize,
        requiredTrackIDs: [CMPersistentTrackID]
    ) {
        self.timeRange = timeRange
        self.segments = segments
        self.transitionDuration = transitionDuration
        self.renderSize = renderSize
        self.requiredSourceTrackIDs = requiredTrackIDs.map { NSNumber(value: $0) }
        super.init()
    }
}
