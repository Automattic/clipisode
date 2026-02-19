# @clipisode/react-native-video-composer

A react-native library for comopsing videos.

```json
{
  "videos": [
    {
      "type": "clip",
      "clipId": "123abc",
      "filePath": "/absolute/path/to/file.mp4"
    }
  ]
}
```

# Manifest

```json
{
  "width": 720,
  "height": 1280,
  "videos": [
    { "key": "clip:1", "filePath": "/absolute/path/to/file1.mp4" },
    { "key": "clip:2", "filePath": "/absolute/path/to/file2.mp4" }
  ],
  "elements": [
    ...
  ]
}
```

## Video Frame

```json
{
  "type": "videoFrame",
  "source": "clip:123abc",
  "sourceTime": 27.2,
  "startAt": "12:22",
  "endAt": "12:26"
}
```

## Video

```json
{
  "type": "video",
  "source": "clip:123abc",
  "startAt": 12.5,
  "endAt": 13
}
```
