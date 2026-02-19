import { ThemeElement, VideoData, VideoSource } from "@clipisode/theme";

type BackgroundMetaData = {
  titleDuration: number;
  endingDuration: number;
  width: number;
  height: number;
};

export function background(
  video: VideoData,
  meta: BackgroundMetaData
): ThemeElement[] {
  const cover = { x: 0, y: 0, width: meta.width, height: meta.height };

  const titleClip = video.clips[0];
  const endingClip = video.clips[video.clips.length - 1];
  const durationOfAllClips = video.clips.reduce(
    (totalDuration, clip) => totalDuration + clip.duration,
    0
  );

  const elements: ThemeElement[] = [];

  elements.push({
    type: "rect",
    name: "background",
    startAt: 0,
    endAt: meta.titleDuration + durationOfAllClips + meta.endingDuration + 1,
    props: { color: "#000000", alpha: 1, ...cover },
  });

  elements.push({
    type: "frame",
    name: "titleFrame",
    startAt: 0,
    endAt: meta.titleDuration,
    props: { videoKey: titleClip.id, position: "first", ...cover },
  });

  let position = meta.titleDuration;

  for (let clip of video.clips) {
    elements.push({
      // ending "dark frame" fix
      type: "frame",
      name: `clipFrame:${clip.id}`,
      startAt: position + clip.duration - 0.5,
      endAt: position + clip.duration,
      props: {
        videoKey: clip.id,
        position: "last",
        ...cover,
      },
    });
    elements.push({
      type: "video",
      name: `video:${clip.id}`,
      videoKey: clip.id,
      source: VideoSource.Clip,
      startAt: position,
      endAt: position + clip.duration,
      props: { ...cover },
    });

    position += clip.duration;
  }

  elements.push({
    type: "frame",
    name: "endingFrame",
    startAt: meta.titleDuration + durationOfAllClips,
    endAt: meta.titleDuration + durationOfAllClips + meta.endingDuration,
    props: { videoKey: endingClip.id, position: "last", ...cover },
  });

  return elements;
}