import { ThemeElement, VideoData } from "@clipisode/theme";
import { ForegroundMetaData } from ".";

export function combinationIcon(
  video: VideoData,
  meta: ForegroundMetaData
): ThemeElement {
  const durationOfAllClips = video.clips.reduce(
    (totalDuration, clip) => totalDuration + clip.duration,
    0
  );

  const iconWidth = 220;
  const iconHeight = 88;
  const iconX = meta.width - meta.spacing - iconWidth;
  const gradientTop = meta.height - 210;
  const iconY = gradientTop + (210 - iconHeight) / 2;

  const firstClipShort = video.clips[0].duration < meta.yoyoMin;
  const finalClipShort =
    video.clips[video.clips.length - 1].duration < meta.yoyoMin;

  const startAt = meta.titleDuration + (firstClipShort ? 0 : 0.2);
  const endAt =
    meta.titleDuration + durationOfAllClips - (finalClipShort ? 0 : 0.2);

  return {
    type: "image",
    name: "combination.icon",
    startAt,
    endAt,
    props: {
      imageKey: "icon.png",
      alpha: 1,
      x: iconX,
      y: iconY,
      width: iconWidth,
      height: iconHeight,
    },
    animations: [
      {
        startAt,
        endAt: startAt + (firstClipShort ? 0.3 : 0.6),
        field: "alpha",
        from: 0,
        to: 1,
      },
      {
        startAt: endAt - (finalClipShort ? 0.3 : 0.6),
        endAt,
        field: "alpha",
        from: 1,
        to: 0,
      },
    ],
  };
}
