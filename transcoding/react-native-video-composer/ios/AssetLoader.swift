import Foundation
import AVFoundation

@objc
class AssetLoader : NSObject {
  var assets: Dictionary<String, AVAsset> = [:];
  
  @objc
  func load(key: String, filePath: String) -> AVAsset {
    var asset: AVAsset? = assets[key];
    
    var url: URL? = nil
    
    if filePath.contains("://") {
      url = URL(string: filePath)
    } else {
      url = URL(fileURLWithPath: filePath)
    }
    
    if asset == nil, let u = url {
      asset = AVURLAsset(
        url: u,
        options: [AVURLAssetPreferPreciseDurationAndTimingKey:true]
      )
      assets[key] = asset;
    }

    let composition = AVMutableComposition()
    let compositionVideoTrack = composition.addMutableTrack(withMediaType: .video, preferredTrackID: CMPersistentTrackID(kCMPersistentTrackID_Invalid))
    let compositionAudioTrack = composition.addMutableTrack(withMediaType: .audio, preferredTrackID:  CMPersistentTrackID(kCMPersistentTrackID_Invalid))

    if let a = asset {
      let sourceVideoTrack = a.tracks(withMediaType: .video).first!
      let sourceAudioTrack = a.tracks(withMediaType: .audio).first!
    
      compositionVideoTrack?.preferredTransform = sourceVideoTrack.preferredTransform

      do {
        try compositionVideoTrack?.insertTimeRange(CMTimeRange(start: .zero, duration: a.duration), of: sourceVideoTrack, at: .zero)
        try compositionAudioTrack?.insertTimeRange(CMTimeRange(start: .zero, duration: a.duration), of: sourceAudioTrack, at: .zero)
      } catch {
      }
    }

    return composition;
  }
}
