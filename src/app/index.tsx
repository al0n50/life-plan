import { Redirect } from 'expo-router';

import { useLifeState } from '@/store/useLifePlan';

export default function Index() {
  const onboarded = useLifeState().onboarded;
  return <Redirect href={onboarded ? '/home' : '/onboarding'} />;
}
