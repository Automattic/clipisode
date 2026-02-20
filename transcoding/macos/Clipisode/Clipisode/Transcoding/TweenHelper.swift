//
//  TweenHelper.swift
//  Clipisode
//

import Foundation
import CoreMedia

enum TweenHelper {

    static func tween(time: CMTime, fromValue: Double, toValue: Double, startTime: CMTime, endTime: CMTime) -> Double {
        let animationDuration = CMTimeSubtract(endTime, startTime)
        let animationProgress = CMTimeSubtract(time, startTime)
        let progress = CMTimeGetSeconds(animationProgress) / CMTimeGetSeconds(animationDuration)
        return fromValue + ((toValue - fromValue) * progress)
    }

    static func tweenAll(props: [String: Any], animations: [[String: Any]]?, time: CMTime) -> [String: Any] {
        guard let animations else { return props }

        var finalProps = props

        for (field, _) in props {
            for animation in animations where animation["field"] as? String == field {
                guard let startAt = animation["startAt"] as? Double,
                      let endAt = animation["endAt"] as? Double,
                      let fromValue = animation["from"] as? Double,
                      let toValue = animation["to"] as? Double else { continue }

                let animFromTime = CMTimeMake(value: Int64(startAt * 1000), timescale: 1000)
                let animToTime = CMTimeMake(value: Int64(endAt * 1000), timescale: 1000)

                if isTimeInRange(time: time, from: animFromTime, to: animToTime) {
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

        return finalProps
    }

    static func isTimeInRange(time: CMTime, from: CMTime, to: CMTime) -> Bool {
        CMTimeCompare(time, from) >= 0 && CMTimeCompare(time, to) <= 0
    }
}
