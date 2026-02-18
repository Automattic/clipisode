//
//  CompositionInstruction.swift
//  Clipisode
//

import AVFoundation

enum SegmentEffect: Hashable {
    case faceTracking
    case particles
}

/// Carries per-segment metadata through to the custom `VideoCompositor`.
/// A single instruction covers the entire composition timeline; the compositor
/// determines which segments are active at each frame time.
final class CompositionInstruction: NSObject, AVVideoCompositionInstructionProtocol {
    var containsTweening: Bool = false
    

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
