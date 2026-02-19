import Foundation
import UIKit

class ColorHelper {
  static func getUIColorObjectFromHexString(color: String, alpha: Double) -> UIColor {
    // Convert hex string to an integer
    let rgbValue = intFromHexString(hexStr: color)

    // Create a color object, specifying alpha as well
    return UIColor(
      red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255.0,
      green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255.0,
      blue: CGFloat(rgbValue & 0x0000FF) / 255.0,
      alpha: CGFloat(alpha)
    )
  }
  
  private static func intFromHexString(hexStr: String) -> UInt64 {
    var hexInt: UInt64 = 0
    
    // Create scanner
    let scanner = Scanner(string: hexStr)
    
    // Tell scanner to skip the # character
    scanner.charactersToBeSkipped = CharacterSet(charactersIn: "#")
    
    // Scan hex value
    scanner.scanHexInt64(&hexInt)
    
    return hexInt;
  }
}
