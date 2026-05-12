import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Baseline dimensions: Pixel 5 / iPhone 13 equivalent
const BASE_WIDTH = 390;
const BASE_HEIGHT = 844;

/**
 * Scale a size horizontally relative to screen width.
 * Use for: paddingHorizontal, marginHorizontal, widths, icon sizes.
 */
export const scale = (size: number): number => {
  return Math.round(PixelRatio.roundToNearestPixel((SCREEN_WIDTH / BASE_WIDTH) * size));
};

/**
 * Scale a size vertically relative to screen height.
 * Use for: paddingVertical, marginVertical, heights.
 */
export const verticalScale = (size: number): number => {
  return Math.round(PixelRatio.roundToNearestPixel((SCREEN_HEIGHT / BASE_HEIGHT) * size));
};

/**
 * Scale a size moderately — great for font sizes and avatar dimensions.
 * Factor 0 = no scaling, Factor 1 = full scaling.
 * Default factor 0.4 prevents text from becoming too huge on large screens.
 */
export const moderateScale = (size: number, factor: number = 0.4): number => {
  return Math.round(PixelRatio.roundToNearestPixel(size + (scale(size) - size) * factor));
};

/**
 * Returns screen width & height for percentage-based layouts.
 */
export const { width: SW, height: SH } = Dimensions.get('window');
