import Foundation
import AVFoundation
import CoreMedia
import UIKit
import CoreGraphics

@objc
public class CompositionManager : NSObject {
  private let manifest: Dictionary<String, Any>
  private let assetLoader: AssetLoader
  
  @objc public private(set) var composition: AVComposition?
  @objc public private(set) var videoComposition: AVVideoComposition?
  @objc public private(set) var quietAudioTrackID: CMPersistentTrackID = kCMPersistentTrackID_Invalid
  
  private var videoTrackIdMap: [String:CMPersistentTrackID] = [:]
  private var frameMap: [String:CGImage] = [:]

  @objc
  public init(manifest: [String:Any], minDuration: CMTime = .invalid) {
    self.manifest = manifest
    self.assetLoader = AssetLoader()
    
    super.init()
    
    let videos = manifest["videos"] as? Array<[String:Any]> ?? []
    let elements = manifest["elements"] as? Array<[String:Any]> ?? []
      
    if minDuration == .invalid {
      load(videos: videos, elements: elements, minDuration: nil)
    } else {
      load(videos: videos, elements: elements, minDuration: minDuration)
    }
  }
  
  func videoTrackId(elementName: String) -> CMPersistentTrackID? {
    return videoTrackIdMap[elementName]
  }
  
  private func assetByKey(videoKey: String) -> AVAsset? {
    if let videos = manifest["videos"] as? [[String:Any]], let video = videos.first(where: { v in v["key"] as? String == videoKey }), let path = video["path"] as? String {
      return assetLoader.load(key: videoKey, filePath: path)
    }
    
    return nil
  }
  
  func frame(elementName: String) -> CGImage? {
    return frameMap[elementName]
  }
  
  private func assetFrameAtTime(asset: AVAsset, at: CMTime) -> CGImage? {
    let imageGenerator = AVAssetImageGenerator(asset: asset)

    imageGenerator.appliesPreferredTrackTransform = true
    imageGenerator.requestedTimeToleranceAfter = .zero
    imageGenerator.requestedTimeToleranceBefore = .zero

    do {
      var actualTime: CMTime = .invalid
      let copiedImage = try imageGenerator.copyCGImage(at: at, actualTime: &actualTime)

      if CMTimeCompare(at, actualTime) != 0 {
        print("Requested \(at) but got \(actualTime)")
      }

      return copiedImage
    } catch {
      print("Unexpected error: \(error).")
    }
    
    return nil
  }
  
  private func assetFrame(videoKey: String, position: CMTime) -> CGImage? {
    if let asset = assetByKey(videoKey: videoKey) {
      return assetFrameAtTime(asset: asset, at: position)
    }
    
    return nil
  }
  
  private func assetFrame(videoKey: String, position: String) -> CGImage? {
    if let asset = assetByKey(videoKey: videoKey) {
      if position == "first" {
        return assetFrameAtTime(asset: asset, at: .zero)
      } else if position == "last" {
        let minFrameDuration = asset.tracks(withMediaType: .video).first?.minFrameDuration ?? CMTime(value: 1, timescale: 30)
        
        return assetFrameAtTime(asset: asset, at: asset.duration - minFrameDuration)
      }
    }
    
    return nil
  }
  
  private func addQuietAudio(duration: CMTime, composition: AVMutableComposition) {
    if let audioAssetUrl = Bundle.main.url(forResource: "q10", withExtension: "m4a") {
      let audioAsset = AVURLAsset(url: audioAssetUrl)
      
      if let firstAudioSourceTrack = audioAsset.tracks(withMediaType: .audio).first {
        if let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
          quietAudioTrackID = audioTrack.trackID
          
          while !audioTrack.timeRange.isValid || audioTrack.timeRange.end < duration {
            try? audioTrack.insertTimeRange(firstAudioSourceTrack.timeRange, of: firstAudioSourceTrack, at: .zero)
          }
          
          // remove extra audio time if there is any
          if audioTrack.timeRange.end > duration {
            audioTrack.removeTimeRange(CMTimeRange(start: duration, end: audioTrack.timeRange.end ))
          }
          
          audioTrack.removeTimeRange(
            CMTimeRange(start: duration, end: audioTrack.timeRange.end)
          )
        }
      }
    }
  }
  
  @objc
  public func createTeaserExportSession(teaserDuration: CMTime, teaserVideoDuration: CMTime) -> AVAssetExportSession? {
    if let composition = composition {
      let audioMix = AVMutableAudioMix()
      var params: [AVMutableAudioMixInputParameters] = []
      
      for audioTrack in composition.tracks(withMediaType: .audio) {
        if audioTrack.trackID != quietAudioTrackID {
          let param = AVMutableAudioMixInputParameters(track: audioTrack)
          param.setVolume(0, at: teaserVideoDuration)
          params.append(param)
        }
      }
      
      let singleFrame = CMTime(value: 1, timescale: 30)

      let videoTracks = composition.tracks(withMediaType: .video)
      
      for videoTrack in videoTracks {
        if let track = videoTrack as? AVMutableCompositionTrack {
          let lastFrame = CMTimeRange(
            start: CMTimeSubtract(CMTimeMinimum(teaserVideoDuration, track.timeRange.end), singleFrame),
            duration: singleFrame
          )
          
          track.scaleTimeRange(lastFrame, toDuration: CMTimeAdd(CMTimeSubtract(teaserDuration, teaserVideoDuration), singleFrame))
        }
      }
      
      if let exportSession = AVAssetExportSession(asset: composition, presetName: AVAssetExportPreset1280x720) {
        audioMix.inputParameters = params
        exportSession.audioMix = audioMix
        
        exportSession.videoComposition = videoComposition
        exportSession.timeRange = CMTimeRange(start: .zero, duration: teaserDuration)
        
        return exportSession
      }
    }
    
    return nil
  }
  
  private func load(videos: Array<[String:Any]>, elements: Array<[String:Any]>, minDuration: CMTime?) {
    let composition = AVMutableComposition()
    let videoComposition = AVMutableVideoComposition()
    
    self.composition = composition
    self.videoComposition = videoComposition
    
    var videoLayerInstructions = Array<AVMutableVideoCompositionLayerInstruction>()
    
    var extendTo: CMTime? = nil
    if let maxEndAt = elements.map({ $0["endAt"] as? Double ?? 0 }).max() {
      extendTo = CMTime(seconds: maxEndAt, preferredTimescale: 1000)
      
      if let min = minDuration, let et = extendTo {
        extendTo = CMTimeMaximum(et, min)
      }
    }
    
    for element in elements.filter(isFrameElement) {
      if let props = element["props"] as? Props, let elementName = element["name"] as? String, let videoKey = props["videoKey"] as? String {
        if let position = props["position"] as? String {
          if let frameImage = assetFrame(videoKey: videoKey, position: position) {
            frameMap[elementName] = frameImage
          }
        } else if let position = props["position"] as? Double {
          let time = CMTime(seconds: position, preferredTimescale: 1000)
          
          if let frameImage = assetFrame(videoKey: videoKey, position: time) {
            frameMap[elementName] = frameImage
          }
        }
      }
    }
    
    if let duration = extendTo {
      if let min = minDuration {
        addQuietAudio(duration: CMTimeMaximum(min, duration), composition: composition)
      } else {
        addQuietAudio(duration: duration, composition: composition)
      }
    }
    
    for element in elements.filter(isVideoElement) {
      if let key = element["videoKey"] as? String, let video = videos.first(where: { v in v["key"] as? String == key }), let path = video["path"] as? String {
        let asset: AVAsset = assetLoader.load(key: key, filePath: path)
        
        let startAt = element["startAt"] as? Double ?? 0
        let endAt = element["endAt"] as? Double ?? 0
        
        let startAtTime = CMTimeMake(value: Int64(startAt * 1000), timescale: 1000)
        
        if let firstVideoTrack = asset.tracks(withMediaType: AVMediaType.video).first {
          let endAtTime = CMTimeSubtract(CMTimeMake(value: Int64(endAt * 1000), timescale: 1000), startAtTime)
          let videoDuration = endAt == 0 ? firstVideoTrack.timeRange.duration : endAtTime
          
          if let videoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid) {
            // store the track ID 3in the name->trackID map for use by the compositor
            if let name = element["name"] as? String {
              videoTrackIdMap[name] = videoTrack.trackID
            }
            
            try? videoTrack.insertTimeRange(CMTimeRange(start: .zero, duration: videoDuration), of: firstVideoTrack, at: startAtTime)
            
            let layerInstruction = AVMutableVideoCompositionLayerInstruction(assetTrack: videoTrack)
            layerInstruction.setTransform(firstVideoTrack.preferredTransform, at: startAtTime)
            // This is necessary to extend the last frame of the video out to the end
            if let dur = extendTo {
              layerInstruction.setOpacity(0, at: dur)
            }
            videoLayerInstructions.append(layerInstruction)
          }
        }
        
        if let firstAudioTrack = asset.tracks(withMediaType: AVMediaType.audio).first {
          let audioDuration = endAt == 0 ? firstAudioTrack.timeRange.duration : CMTimeSubtract(CMTimeMake(value: Int64(endAt * 1000), timescale: 1000), startAtTime)
          if let audioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
            try? audioTrack.insertTimeRange(
              CMTimeRange(start: .zero, duration: audioDuration),
              of: firstAudioTrack,
              at: CMTimeAdd(startAtTime, CMTime(value: 1, timescale: 30))
            )
          }
        }
      }
    }
    
    let videoCompositionInstruction = AVMutableVideoCompositionInstruction()
    
    videoCompositionInstruction.timeRange = CMTimeRange(start: .zero, duration: .positiveInfinity)
    videoCompositionInstruction.layerInstructions = videoLayerInstructions;

    videoComposition.customVideoCompositorClass = ThemeCompositor.self
    
    videoComposition.renderSize = CGSize(width: 720, height: 1280)
    
    videoComposition.instructions = [videoCompositionInstruction];
    videoComposition.frameDuration = CMTime(value: 1, timescale: 30)
    
//    for track in composition.tracks {
//      print(track.mediaType)
//      print(track.timeRange)
//
//      for seg in track.segments {
//        print("**  \(seg.timeMapping.source)")
//        print("**  \(seg.timeMapping.target)")
//      }
//      print("--------------")
//    }
  }
  
  // predicate for filtering the elements list
  private func isVideoElement(_ element: [String:Any]) -> Bool {
    return element["type"] as? String == "video"
  }
  
  // predicate for filtering the elements list
  private func isFrameElement(_ element: [String:Any]) -> Bool {
    return element["type"] as? String == "frame"
  }
}
