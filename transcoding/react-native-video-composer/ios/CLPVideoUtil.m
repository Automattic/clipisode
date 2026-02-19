#import <AVKit/AVKit.h>
#import <React/RCTViewManager.h>
#import <React/RCTUIManager.h>
#import <AVFoundation/AVFoundation.h>
#import <AVKit/AVKit.h>
#import "ReactNativeVideoComposer-Swift.h"

@interface CLPVideoUtil : RCTViewManager <RCTBridgeModule>
@end

@implementation CLPVideoUtil
{
  AVAssetExportSession *_exportSession;
}

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(getDuration:(NSString *)videoUri
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *url = [NSURL URLWithString:videoUri];
  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:@{AVURLAssetPreferPreciseDurationAndTimingKey:@YES}];
  
  double seconds = CMTimeGetSeconds(asset.duration);
  NSNumber *duration = [NSNumber numberWithDouble:seconds];
  
  resolve(duration);
}

RCT_EXPORT_METHOD(shareInstagramStory:(NSString *)videoFileUri
                  stickerPath:(NSString *)stickerPath
                  url:(NSString *)attributionURL
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *urlScheme = [NSURL URLWithString:@"instagram-stories://share"];
  
  dispatch_async(dispatch_get_main_queue(), ^{
    if ([[UIApplication sharedApplication] canOpenURL:urlScheme]) {
      NSURL *videoUrl = [NSURL URLWithString:videoFileUri];
      NSData *backgroundVideo = [NSData dataWithContentsOfURL:videoUrl];
      NSData *stickerImage = NULL;
      
      
          // Assign background image asset and attribution link URL to pasteboard
      NSMutableDictionary *items = [NSMutableDictionary dictionaryWithDictionary:@{@"com.instagram.sharedSticker.backgroundVideo" : backgroundVideo,
                                         @"com.instagram.sharedSticker.contentURL" : attributionURL }];
      
      if (stickerPath != nil) {
        stickerImage = [NSData dataWithContentsOfURL:[NSURL URLWithString:stickerPath]];
        items[@"com.instagram.sharedSticker.stickerImage"] = stickerImage;
      }

      NSArray *pasteboardItems = @[items];

      NSDictionary *pasteboardOptions = @{UIPasteboardOptionExpirationDate : [[NSDate date] dateByAddingTimeInterval:60 * 5]};
      // This call is iOS 10+, can use 'setItems' depending on what versions you support
      [[UIPasteboard generalPasteboard] setItems:pasteboardItems options:pasteboardOptions];

      [[UIApplication sharedApplication] openURL:urlScheme options:@{} completionHandler:^(BOOL success) {
        if (success) {
          resolve(nil);
        } else {
          reject(@"Unknown Error", @"Unknown Error", nil);
        }
      }];
    } else {
        reject(@"Unknown Error", @"Unknown Error", nil);
    }
  });
}

RCT_EXPORT_METHOD(cancelTeaserExport:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  if (_exportSession != nil) {
    [_exportSession cancelExport];
    
    resolve(nil);
  }
}

RCT_EXPORT_METHOD(exportTeaser:(NSString *)outputPath
                  manifest:(NSDictionary *)manifest
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSNumber *teaserDurationConfig = manifest[@"teaserDuration"];
  // this is the point in the teaser where the video will freeze
  NSNumber *teaserVideoDurationConfig = manifest[@"teaserVideoDuration"];
  
  
  if (teaserDurationConfig == nil) {
    teaserDurationConfig = @10;
  }
  
  if (teaserVideoDurationConfig == nil) {
    teaserVideoDurationConfig = @6;
  }
  
  CMTime teaserDuration = CMTimeMakeWithSeconds([teaserDurationConfig floatValue], 1000);
  
  CMTime preferredVideoDuration = CMTimeMakeWithSeconds([teaserVideoDurationConfig floatValue], 1000);
  // TODO: Get real original composition duration to use actual video duration in export session
    
  CompositionManager *manager = [[CompositionManager alloc] initWithManifest:manifest minDuration:teaserDuration];
  
  _exportSession = [manager createTeaserExportSessionWithTeaserDuration:teaserDuration teaserVideoDuration:preferredVideoDuration];

  _exportSession.outputURL = [NSURL URLWithString:outputPath];
  _exportSession.outputFileType = AVFileTypeMPEG4;

  _exportSession.videoComposition = manager.videoComposition;

  if (_exportSession.customVideoCompositor) {
    if ([_exportSession.customVideoCompositor isKindOfClass:[ThemeCompositor class]]) {
      ThemeCompositor *themeCompositor = (id)_exportSession.customVideoCompositor;

      [themeCompositor setManifest:manifest];
      [themeCompositor setManager:manager];
    }
  }

  [_exportSession exportAsynchronouslyWithCompletionHandler:^{
    if (self->_exportSession.status == AVAssetExportSessionStatusCompleted) {
      resolve(nil);
    } else if (self->_exportSession.status == AVAssetExportSessionStatusFailed) {
      reject(@"Unknown", @"Unknown", self->_exportSession.error);
    } else if (self->_exportSession.status == AVAssetExportSessionStatusCancelled) {
      reject(@"Cancelled", @"The export was cancelled.", nil);
    } else {
      reject(@"Unknown", @"Unknown", nil);
    }
  }];
}

RCT_EXPORT_METHOD(generateSticker:(NSString *)outputPath
                  composition:(NSDictionary *)composition
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  // Passing a NULL data parameter causes CGBitmapContextCreate to allocate and manage the memory automatically
  void *data = NULL;
  NSNumber *stickerWidth = (NSNumber *)composition[@"width"];
  NSNumber *stickerHeight = (NSNumber *)composition[@"height"];
  
  if (stickerWidth == nil) stickerWidth = @1000;
  if (stickerHeight == nil) stickerHeight = @500;

  size_t bitsPerComponent = 8;
  // The number of bytes of memory to use per row of the bitmap.
  // If the data parameter is NULL, passing a value of 0 causes the value to be calculated automatically.
  // https://developer.apple.com/documentation/coregraphics/1455939-cgbitmapcontextcreate
  size_t bytesPerRow = 0;
  CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
  // From https://stackoverflow.com/a/51021149
  uint32_t bitmapInfo = kCGBitmapByteOrder32Little | kCGImageAlphaPremultipliedFirst;;
  
  CGContextRef context = CGBitmapContextCreate(data, [stickerWidth intValue], [stickerHeight intValue], bitsPerComponent, bytesPerRow, colorSpace, bitmapInfo);
  UIGraphicsPushContext(context);


  ElementPainter *painter = [[ElementPainter alloc] initWithContext:context
                                                             height:[stickerHeight longValue]
                                                            manager:nil
                                                              files:@{}];

  if (composition != nil) {
    NSArray *elements = composition[@"elements"];

    for (NSDictionary* element in elements) {
      NSString *type = (NSString *)element[@"type"];
      NSDictionary *props = (NSDictionary *)element[@"props"];

      [painter drawElementWithType:type element:element props:props at:kCMTimeZero compositionRequest:nil];
    }
  }
  UIGraphicsPopContext();

  CGImageRef bitmapImage = CGBitmapContextCreateImage(context);
  UIImage *image = [UIImage imageWithCGImage:bitmapImage];
  CGImageRelease(bitmapImage);

  NSData *imageData = UIImagePNGRepresentation(image);
  BOOL success = [imageData writeToFile:outputPath atomically:NO];

  CGColorSpaceRelease(colorSpace);
  CGContextRelease(context);

  if (success) {
    resolve(NULL);
  } else {
    reject(@"Unknown", @"Unknown", nil);
  }
}


@end
