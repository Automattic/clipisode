import { NativeModules } from "react-native";

export async function getDuration(assetPath: string): Promise<number> {
  return await NativeModules.CLPVideoUtil.getDuration(assetPath);
}

type ImageInfo = {
  key: string;
  uri: string;
};

type ElementInfo = {};

export interface StickerComposition {
  images: ImageInfo[];
  elements: ElementInfo[];
}

export async function generateSticker(
  outputPath: string,
  composition: StickerComposition
) {
  return await NativeModules.CLPVideoUtil.generateSticker(
    outputPath,
    composition
  );
}
