//
//  ThemeCompositionInstruction.swift
//  Clipisode
//
//  Instruction that carries theme elements and assets for ThemeCompositor.
//

import AVFoundation
import CoreGraphics

final class ThemeCompositionInstruction: NSObject, AVVideoCompositionInstructionProtocol {
    var containsTweening: Bool = true
    var enablePostProcessing: Bool = false
    var containsTweenedVideoInstruction: Bool = true
    var passthroughTrackID: CMPersistentTrackID = kCMPersistentTrackID_Invalid
    var requiredSourceTrackIDs: [NSValue]?

    let elements: [[String: Any]]
    let videoTrackIdMap: [String: CMPersistentTrackID]
    let videoPreferredTransforms: [String: CGAffineTransform]
    let frameMap: [String: CGImage]
    let files: [String: String]
    let renderSize: CGSize
    let timeRange: CMTimeRange

    init(
        elements: [[String: Any]],
        videoTrackIdMap: [String: CMPersistentTrackID],
        videoPreferredTransforms: [String: CGAffineTransform],
        frameMap: [String: CGImage],
        files: [String: String],
        renderSize: CGSize,
        timeRange: CMTimeRange,
        requiredTrackIDs: [CMPersistentTrackID]
    ) {
        self.elements = elements
        self.videoTrackIdMap = videoTrackIdMap
        self.videoPreferredTransforms = videoPreferredTransforms
        self.frameMap = frameMap
        self.files = files
        self.renderSize = renderSize
        self.timeRange = timeRange
        self.requiredSourceTrackIDs = requiredTrackIDs.map { NSNumber(value: $0) }
        super.init()
    }
}
