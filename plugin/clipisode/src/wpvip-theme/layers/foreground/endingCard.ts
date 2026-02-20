import { TextAlign, ThemeElement, VideoData } from "@clipisode/theme";
import { ForegroundMetaData } from ".";

export function endingCard(
  video: VideoData,
  meta: ForegroundMetaData
): ThemeElement[] {
  const cover = { x: 0, y: 0, width: meta.width, height: meta.height };

  const durationOfAllClips = video.clips.reduce(
    (totalDuration, clip) => totalDuration + clip.duration,
    0
  );

  const finalClip = video.clips[video.clips.length - 1];

  const endingTextProps = {
    fontName: "OpenSans-Regular",
    textAlign: TextAlign.Center,
    x: meta.spacing,
    width: meta.width - meta.spacing * 2,
    color: "#FFFFFF",
  };

  return [
    {
      type: "rect",
      name: "ending.shade",
      startAt: meta.titleDuration + durationOfAllClips - 0.25,
      endAt: meta.titleDuration + durationOfAllClips + meta.endingDuration,
      props: { color: "#13191E", alpha: 0.8, ...cover },
      animations: [
        {
          startAt: meta.titleDuration + durationOfAllClips - 0.25,
          endAt: meta.titleDuration + durationOfAllClips + 0.25,
          field: "alpha",
          from: 0,
          to: 0.8,
        },
      ],
    },
    {
      type: "text",
      name: "ending.name",
      startAt: meta.titleDuration + durationOfAllClips + 0.4,
      endAt: meta.titleDuration + durationOfAllClips + meta.endingDuration,
      props: {
        alpha: 1,
        value: finalClip.displayName,
        fontSize: 54,
        lineHeight: 54,
        y: 480,
        height: 80,
        ...endingTextProps,
        color: "#D8A45F",
      },
      animations: [
        {
          startAt: meta.titleDuration + durationOfAllClips + 0.4,
          endAt: meta.titleDuration + durationOfAllClips + 1.0,
          field: "alpha",
          from: 0,
          to: 1,
        },
      ],
    },
    {
      type: "text",
      name: "ending.promo",
      startAt: meta.titleDuration + durationOfAllClips,
      endAt: meta.titleDuration + durationOfAllClips + meta.endingDuration,
      props: {
        alpha: 1,
        value: video.topic?.host?.promoText ?? "wpvip.com",
        fontSize: 32,
        lineHeight: 45,
        y: 570,
        height: 225,
        ...endingTextProps,
      },
      animations: [
        {
          startAt: meta.titleDuration + durationOfAllClips + 0.0,
          endAt: meta.titleDuration + durationOfAllClips + 0.8,
          field: "alpha",
          from: 0,
          to: 0,
        },
        {
          startAt: meta.titleDuration + durationOfAllClips + 0.8,
          endAt: meta.titleDuration + durationOfAllClips + 1.6,
          field: "alpha",
          from: 0,
          to: 1,
        },
      ],
    },
    {
      type: "image",
      name: "ending.icon",
      startAt: meta.titleDuration + durationOfAllClips,
      endAt: meta.titleDuration + durationOfAllClips + meta.endingDuration,
      props: {
        imageKey: "icon.png",
        x: 140,
        y: 210,
        width: 440,
        height: 176,
        alpha: 1,
      },
      animations: [
        {
          startAt: meta.titleDuration + durationOfAllClips + 0.0,
          endAt: meta.titleDuration + durationOfAllClips + 0.2,
          field: "alpha",
          from: 0,
          to: 0,
        },
        {
          startAt: meta.titleDuration + durationOfAllClips + 0.2,
          endAt: meta.titleDuration + durationOfAllClips + 1.0,
          field: "alpha",
          from: 0,
          to: 1,
        },
      ],
    },
  ];
}
