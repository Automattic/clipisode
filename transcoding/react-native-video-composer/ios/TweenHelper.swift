import Foundation
import CoreMedia

@objc
class TweenHelper : NSObject {
  @objc
  static func tween(time: CMTime, fromValue: Double, toValue: Double, startTime: CMTime, endTime: CMTime) -> Double {
    let animationDuration = CMTimeSubtract(endTime, startTime)
    let animationProgress = CMTimeSubtract(time, startTime)
    
    let progress = CMTimeGetSeconds(animationProgress) / CMTimeGetSeconds(animationDuration)

    return fromValue + ((toValue - fromValue) * progress);
  }
  
  @objc
  static func tweenAll(props: [String:Any], animations: Array<[String:Any]>?, time: CMTime) -> [String:Any] {
    if (animations == nil) {
        return props;
    }
    
    var finalProps: [String:Any] = [String:Any]();
    
    for (field, value) in props {
      finalProps[field] = value;
      
      animations?.filter { anim in anim["field"] as? String == field }.forEach { animation in
        let startAt = animation["startAt"] as! Double
        let endAt = animation["endAt"] as! Double
        
        let animFromTime: CMTime = CMTimeMake(value: Int64(startAt * 1000), timescale: 1000)
        let animToTime: CMTime = CMTimeMake(value: Int64(endAt * 1000), timescale: 1000)
        
        if isTimeInRange(time:time, from:animFromTime, to:animToTime) {
          let fromValue = animation["from"] as! Double
          let toValue = animation["to"] as! Double
          
          finalProps[field] = tween(
            time: time,
            fromValue: fromValue,
            toValue: toValue,
            startTime: animFromTime,
            endTime: animToTime
          )
        }
      }
    }
    
    return finalProps;
  }
  
  @objc
  static func isTimeInRange(time: CMTime, from: CMTime, to: CMTime) -> Bool {
    return CMTimeCompare(time, from) >= 0 && CMTimeCompare(time, to) <= 0;
  }
}
