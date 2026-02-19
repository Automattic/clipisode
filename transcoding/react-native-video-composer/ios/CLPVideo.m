#import <AVFoundation/AVFoundation.h>
#import <AVKit/AVKit.h>
#import <React/RCTComponent.h>
#import <React/RCTBridgeModule.h>
#import <React/RCTComponent.h>
#import <Photos/Photos.h>
#import "ReactNativeVideoComposer-Swift.h"

@interface CLPVideo : UIView <AVPlayerViewControllerDelegate>

@property (nonatomic, copy) RCTDirectEventBlock onVideoProgress;
@property (nonatomic, copy) RCTDirectEventBlock onVideoLoad;
@property (nonatomic, copy) RCTDirectEventBlock onExportProgress;

@end

@implementation CLPVideo
{
  AVPlayerLayer *_playerLayer;
  AVPlayer *_player;
  AVPlayerItem *_playerItem;
  NSDictionary *_composition;
  AVAssetExportSession *_exportSession;
  CompositionManager *_manager;
  AVSynchronizedLayer *_syncLayer;
  id _memoryPressureNotificationSubscription;
  
  id _timeObserver;
  
  BOOL _paused;
  float _rate;
}

static NSString *const statusKeyPath = @"status";

- (instancetype)init
{
  if (self = [super init]) {
    _rate = 1.0;
    _exportSession = nil;
  }
  
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];

  _syncLayer.frame = self.bounds;
  self.layer.anchorPoint = CGPointMake(0.0, 0.0);
  self.layer.transform = CATransform3DConcat(CATransform3DMakeScale(self.bounds.size.width / 720.0, self.bounds.size.height / 1280.0, 1), CATransform3DMakeTranslation(-self.bounds.size.width / 2, -self.bounds.size.height / 2, 0.0));
}


- (void)removeFromSuperview
{
  [self cancelExport];

  if (_playerLayer.player != nil) {
    [_playerLayer.player pause];
    _playerLayer.player = nil;
  }
  
  [_playerLayer removeFromSuperlayer];
  [self removePlayerItemObservers];
  [self removePlayerTimeObserver];
  _playerLayer = nil;
  _composition = nil;
  _manager = nil;
  _syncLayer = nil;
  _exportSession = nil;
  _playerItem = nil;
  
  if (_memoryPressureNotificationSubscription) {
    [[NSNotificationCenter defaultCenter] removeObserver:_memoryPressureNotificationSubscription];
  }
  
  [super removeFromSuperview];
}

-(void)addPlayerTimeObserver
{
  const Float64 progressUpdateIntervalMS = 250.0 / 1000;
  // @see endScrubbing in AVPlayerDemoPlaybackViewController.m
  // of https://developer.apple.com/library/ios/samplecode/AVPlayerDemo/Introduction/Intro.html
  __weak CLPVideo *weakSelf = self;
  _timeObserver = [_player addPeriodicTimeObserverForInterval:CMTimeMakeWithSeconds(progressUpdateIntervalMS, NSEC_PER_SEC)
                                                        queue:NULL
                                                   usingBlock:^(CMTime time) { [weakSelf sendProgressUpdate]; }
                   ];
}

/* Cancels the previously registered time observer. */
-(void)removePlayerTimeObserver
{
  if (_timeObserver)
  {
    [_player removeTimeObserver:_timeObserver];
    _timeObserver = nil;
  }
}

- (void)sendProgressUpdate
{
  AVPlayerItem *video = [_player currentItem];
  
  if (video == nil || video.status != AVPlayerItemStatusReadyToPlay) {
    return;
  }
  
  CMTime currentTime = _player.currentTime;
//  const Float64 duration = CMTimeGetSeconds(playerDuration);
  const Float64 currentTimeSecs = CMTimeGetSeconds(currentTime);
//
//  [[NSNotificationCenter defaultCenter] postNotificationName:@"RCTVideo_progress" object:nil userInfo:@{@"progress": [NSNumber numberWithDouble: currentTimeSecs / duration]}];
  
  if( currentTimeSecs >= 0 && self.onVideoProgress) {
    self.onVideoProgress(@{
      @"currentTime": [NSNumber numberWithFloat:CMTimeGetSeconds(currentTime)],
      @"atValue": [NSNumber numberWithLongLong:currentTime.value],
      @"atTimescale": [NSNumber numberWithInt:currentTime.timescale],
//      @"target": self.reactTag,
    });
  }
}

- (NSAttributedString *)createBasicString:(NSString *)text
{
  NSMutableAttributedString *str = [[NSMutableAttributedString alloc] initWithString:@"firstsecondthird"];
  [str addAttribute:NSForegroundColorAttributeName value:[UIColor redColor] range:NSMakeRange(0,5)];
  [str addAttribute:NSForegroundColorAttributeName value:[UIColor greenColor] range:NSMakeRange(5,6)];
  [str addAttribute:NSForegroundColorAttributeName value:[UIColor blueColor] range:NSMakeRange(11,5)];
  
  return str;
}

- (void)addPlayerItemObservers
{
  [_playerItem addObserver:self forKeyPath:statusKeyPath options:0 context:nil];
//  [_playerItem addObserver:self forKeyPath:playbackBufferEmptyKeyPath options:0 context:nil];
//  [_playerItem addObserver:self forKeyPath:playbackLikelyToKeepUpKeyPath options:0 context:nil];
//  [_playerItem addObserver:self forKeyPath:timedMetadata options:NSKeyValueObservingOptionNew context:nil];
}

- (void)removePlayerItemObservers
{
  [_playerItem removeObserver:self forKeyPath:statusKeyPath];
//  [_playerItem removeObserver:self forKeyPath:playbackBufferEmptyKeyPath];
//  [_playerItem removeObserver:self forKeyPath:playbackLikelyToKeepUpKeyPath];
//  [_playerItem removeObserver:self forKeyPath:timedMetadata];
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary *)change context:(void *)context
{
  if (object != _playerItem) {
    return;
  }
  
  // handle status change
  if ([keyPath isEqualToString:statusKeyPath]) {
    if (_playerItem.status == AVPlayerItemStatusReadyToPlay) {
      float duration = CMTimeGetSeconds(_playerItem.asset.duration);
      
      if (isnan(duration)) {
        duration = 0.0;
      }
      
      if (self.onVideoLoad != nil) {
        self.onVideoLoad(@{ @"duration": [NSNumber numberWithFloat:duration] });
      }
    }
  }
}

- (void)setComposition:(NSDictionary *)composition
{
  _composition = composition;

  if (_manager == nil) {
    _manager = [[CompositionManager alloc] initWithManifest:composition minDuration:kCMTimeInvalid];

    AVComposition *avcomp = _manager.composition;

    _playerItem = [AVPlayerItem playerItemWithAsset:avcomp];

    _player = [AVPlayer playerWithPlayerItem:_playerItem];
    _player.actionAtItemEnd = AVPlayerActionAtItemEndPause;
    _playerLayer = [AVPlayerLayer playerLayerWithPlayer:_player];

    [self addPlayerItemObservers];

    _playerLayer.needsDisplayOnBoundsChange = YES;
    _playerLayer.videoGravity = AVLayerVideoGravityResizeAspectFill;

    _syncLayer = [AVSynchronizedLayer synchronizedLayerWithPlayerItem:_playerItem];
    [self.layer addSublayer:_syncLayer];

    [self addPlayerTimeObserver];

    CALayer *parentLayer = [self createParentLayer:_playerLayer overlay:[CALayer layer]];

    [_syncLayer addSublayer:parentLayer];
  }

  _playerItem.videoComposition = _manager.videoComposition;

  if (_playerItem.customVideoCompositor) {
    if ([_playerItem.customVideoCompositor isKindOfClass:[ThemeCompositor class]]) {
      ThemeCompositor *themeCompositor = (id)_playerItem.customVideoCompositor;
      [themeCompositor setManifest:_composition];
      [themeCompositor setManager:_manager];
    }
  }
}

- (CALayer *)createParentLayer:(CALayer *)videoLayer overlay:(CALayer *)overlayLayer
{
  CALayer *parentLayer = [CALayer layer];

  parentLayer.drawsAsynchronously = NO;
  parentLayer.frame = CGRectMake(0.0, 0.0, 720.0, 1280.0);
  
  videoLayer.frame = parentLayer.frame;
  
  [parentLayer addSublayer:videoLayer];
  
  return parentLayer;
}

- (void)setPaused:(BOOL)paused {
  _paused = paused;
  
  if (paused) {
    [_player pause];
  } else {
    [_player play];
  }
}

- (void)setSeek:(NSDictionary *)info
{
  NSNumber *seekTime = info[@"time"];
  
  int timeScale = 1000;

  if (_playerItem && _playerItem.status == AVPlayerItemStatusReadyToPlay) {
    CMTime to = CMTimeMakeWithSeconds([seekTime floatValue], timeScale);
    CMTime tolerance = kCMTimeZero; // CMTimeMakeWithSeconds(0.05, timeScale);
    
    if (!_paused) {
      [_player pause];
    }
    
    [_player seekToTime:to toleranceBefore:tolerance toleranceAfter:tolerance completionHandler:^(BOOL finished) {
      if (!self->_paused) {
        [self->_player play];
      }
    }];
  }
}

- (void)setRate:(float)rate
{
  _rate = rate;

  [_player setRate:rate];
}

- (void)dealloc {
  _memoryPressureNotificationSubscription = nil;
}

- (void)cancelExport {
  if (self->_exportSession != nil) {
    [self->_exportSession cancelExport];
  }
}

- (void)save:(NSString *)outPath resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  _exportSession = [AVAssetExportSession exportSessionWithAsset:_manager.composition presetName:AVAssetExportPreset1280x720];
  
  __weak AVAssetExportSession *weakExportSession = _exportSession;
  _memoryPressureNotificationSubscription = [[NSNotificationCenter defaultCenter] addObserverForName:UIApplicationDidReceiveMemoryWarningNotification object:nil queue:nil usingBlock:^(NSNotification *note) {
    if (weakExportSession != nil) {
      [weakExportSession cancelExport];
    }
  }];

  _exportSession.outputURL = [NSURL URLWithString:outPath];
  _exportSession.outputFileType = AVFileTypeMPEG4;
  
  _exportSession.videoComposition = _manager.videoComposition;
  
  if (_exportSession.customVideoCompositor) {
    if ([_exportSession.customVideoCompositor isKindOfClass:[ThemeCompositor class]]) {
      ThemeCompositor *themeCompositor = (id)_exportSession.customVideoCompositor;
      
      [themeCompositor setManifest:_composition];
      [themeCompositor setManager:_manager];
    }
  }
  
  if (_manager.composition.isExportable) {
    if (self.onExportProgress) {
      [NSTimer scheduledTimerWithTimeInterval:0.25 repeats:YES block:^(NSTimer * _Nonnull timer) {
        if (self->_exportSession == nil) {
          [timer invalidate];
        } else {
          if (self->_exportSession.status == AVAssetExportSessionStatusExporting) {
            dispatch_async(dispatch_get_main_queue(), ^{
              self.onExportProgress(@{@"progress": [NSNumber numberWithFloat:self->_exportSession.progress]});
            });
          } else if (self->_exportSession.status == AVAssetExportSessionStatusCompleted) {
            [timer invalidate];
          } else if (self->_exportSession.status == AVAssetExportSessionStatusCancelled) {
            [timer invalidate];
          }
        }
      }];
    }
    
    [_exportSession exportAsynchronouslyWithCompletionHandler:^{
      if (self->_exportSession.status == AVAssetExportSessionStatusCompleted) {
        dispatch_async(dispatch_get_main_queue(), ^{
          resolve(NULL);
        });
      } else if (self->_exportSession.status == AVAssetExportSessionStatusFailed) {
        dispatch_async(dispatch_get_main_queue(), ^{
          if (self->_exportSession.error) {
            reject(@"ExportError", self->_exportSession.error.localizedDescription, self->_exportSession.error);
          } else {
            reject(@"ExportError", @"Unknown", self->_exportSession.error);
          }
        });
      } else if (self->_exportSession.status == AVAssetExportSessionStatusCancelled) {
        self->_exportSession = nil;
        reject(@"ExportError", @"Cancelled", nil);
      }
    }];
  } else {
    reject(@"ExportError", @"Not exportable", nil);
  }
}

@end
