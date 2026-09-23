/**
 * Public API for channel authors. Import from "../../core" inside src/channels/<your-channel>/.
 */
export { defineChannel, reactMount } from './channel';
export type { BannerProps, ChannelContext, ChannelDefinition, ChannelInstance } from './channel';
export type { Wiimote } from './input/Wiimote';
export { WII_BUTTONS } from './input/types';
export type { WiiButton, PointerState, MotionSample, SwingEvent, Vec3, Orientation } from './input/types';
export type { InputManager, InputEvents } from './input/InputManager';
export type { AudioEngine, SfxName, SongName, ToneOptions, NoiseOptions, MusicRequest, LoopHandle, LoopOptions, SfxOptions } from './audio/AudioEngine';
export { MENU_MUSIC } from './audio/AudioEngine';
export { loadImage, loadImages, useImages, assetMap, frames, drawSprite, drawCover, assetExists, useAssetExists } from './assets';
export type { ImageMap } from './assets';
export type { MessageBoardApi, BoardMessage } from './messageBoard';
export { useHot, useRemotes, usePlayers, useInputEvent, useButton, useElementSize, useAnimationFrame } from './hooks';
export { clamp } from './input/pointerMath';
export { Pill } from '../console/components/Pill';
export { PLAYER_COLORS } from '../console/components/Cursors';
