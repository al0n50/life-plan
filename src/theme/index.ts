import { useColorScheme } from 'react-native';

import type { BucketColor } from '@/engine/model';

const light = {
  bg: '#F3F5F8',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F5',
  text: '#162033',
  muted: '#5D6779',
  border: '#E2E6ED',
  primary: '#17654F',
  primaryText: '#FFFFFF',
  primarySoft: '#E3F2EC',
  positive: '#17654F',
  warning: '#8A5A00',
  warningSoft: '#FFF4DB',
  danger: '#B4231A',
  dangerSoft: '#FBE9E7',
  bucket: {
    mins: '#6E7789',
    emergency: '#14866A',
    debt: '#DD5B43',
    goals: '#D49A1F',
    invest: '#4B5AD2',
    fun: '#B9479A',
    tax: '#8B6F4E',
  } as Record<BucketColor, string>,
};

const dark: typeof light = {
  bg: '#0E131B',
  surface: '#161D28',
  surfaceAlt: '#1D2532',
  text: '#E7EBF1',
  muted: '#97A1B2',
  border: '#273143',
  primary: '#3DB08B',
  primaryText: '#06150F',
  primarySoft: '#143128',
  positive: '#3DB08B',
  warning: '#F2C46B',
  warningSoft: '#3A2E14',
  danger: '#F07B6E',
  dangerSoft: '#3A1D1A',
  bucket: {
    mins: '#8590A3',
    emergency: '#2FAE88',
    debt: '#EE7A63',
    goals: '#E5B24A',
    invest: '#7D89EA',
    fun: '#D877BD',
    tax: '#C1A37E',
  },
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 8, md: 12, lg: 14, pill: 999 };
