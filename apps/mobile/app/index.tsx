import { Redirect } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { View, ActivityIndicator } from 'react-native';

export default function Index() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0e0c' }}>
        <ActivityIndicator color="#c8a96e" />
      </View>
    );
  }

  return <Redirect href={isSignedIn ? '/(app)/map' : '/(auth)/onboarding'} />;
}
