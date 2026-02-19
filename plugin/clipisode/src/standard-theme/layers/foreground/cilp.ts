import { OriginY, TextAlign, ThemeElement, VideoData } from "@clipisode/theme";
import { ForegroundMetaData } from ".";

export function clip(
  video: VideoData,
  index: number,
  meta: ForegroundMetaData
): ThemeElement {
  const clipStartAt =
    video.clips
      .slice(0, index)
      .reduce((total, clip) => total + clip.duration, 0) + meta.titleDuration;

  const displayNameTextProps = {
    fontName: "OpenSans-Regular",
    fontSize: 44,
    lineHeight: 48,
    textAlign: TextAlign.Center,
    x: meta.spacing,
    y: 1150,
    originY: OriginY.Center,
    width: meta.width - meta.spacing * 2,
    height: 100,
    color: "#FFFFFF",
  };

  const clip = video.clips[index];

  const short = (value: number, shortValue: number) =>
    clip.duration < meta.yoyoMin ? shortValue : value;

  return {
    type: "text",
    name: "question.name",
    startAt: clipStartAt,
    endAt: clipStartAt + clip.duration,
    props: {
      alpha: 0,
      value: clip.displayName,
      ...displayNameTextProps,
    },
    animations: [
      {
        startAt: clipStartAt + short(0.2, 0),
        endAt: clipStartAt + short(1.4, 0.2),
        field: "alpha",
        from: 0,
        to: 1,
      },
      {
        startAt: clipStartAt + short(1.4, 0.2),
        endAt: clipStartAt + clip.duration - short(1.4, 0.2),
        field: "alpha",
        from: 1,
        to: 1,
      },
      {
        startAt: clipStartAt + clip.duration - short(1.4, 0.2),
        endAt: clipStartAt + clip.duration - short(0, 0.2),
        field: "alpha",
        from: 1,
        to: 0,
      },
    ],
  };
}