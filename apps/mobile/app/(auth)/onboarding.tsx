import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSignIn, useSignUp } from '@clerk/clerk-expo';

type Step = 'landing' | 'email' | 'otp';
type Flow = 'signin' | 'signup';

export default function Onboarding() {
  const router = useRouter();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [step, setStep] = useState<Step>('landing');
  const [flow, setFlow] = useState<Flow>('signin');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isLoaded = signInLoaded && signUpLoaded;

  // --- Step 1: Submit email, attempt sign-in, fall through to sign-up ---
  async function handleEmailSubmit() {
    if (!isLoaded || !email.trim()) return;
    setLoading(true);
    setError('');

    try {
      // Try sign-in first
      const { supportedFirstFactors } = await signIn!.create({
        identifier: email.trim(),
      });

      const emailFactor = supportedFirstFactors?.find(
        (f: any) => f.strategy === 'email_code'
      );

      if (emailFactor) {
        await signIn!.prepareFirstFactor({
          strategy: 'email_code',
          emailAddressId: (emailFactor as any).emailAddressId,
        });
        setFlow('signin');
        setStep('otp');
      } else {
        setError('Email sign-in not available. Please try again.');
      }
    } catch (err: any) {
      // User doesn't exist — attempt sign-up
      if (err?.errors?.[0]?.code === 'form_identifier_not_found') {
        try {
          await signUp!.create({ emailAddress: email.trim() });
          await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
          setFlow('signup');
          setStep('otp');
        } catch (signUpErr: any) {
          setError(signUpErr?.errors?.[0]?.message ?? 'Sign up failed. Try again.');
        }
      } else {
        setError(err?.errors?.[0]?.message ?? 'Something went wrong. Try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  // --- Step 2: Verify OTP ---
  async function handleOTPSubmit() {
    if (!isLoaded || !code.trim()) return;
    setLoading(true);
    setError('');

    try {
      if (flow === 'signin') {
        const result = await signIn!.attemptFirstFactor({
          strategy: 'email_code',
          code: code.trim(),
        });
        if (result.status === 'complete') {
          await setSignInActive!({ session: result.createdSessionId });
          router.replace('/(app)/map');
        } else {
          setError(`Sign-in incomplete (status: ${result.status}). Please try again.`);
        }
      } else {
        const result = await signUp!.attemptEmailAddressVerification({ code: code.trim() });
        if (result.status === 'complete') {
          await setSignUpActive!({ session: result.createdSessionId });
          router.replace('/(app)/map');
        } else if (result.status === 'missing_requirements') {
          const missing = (result as any).missingFields?.join(', ') ?? 'unknown fields';
          setError(`Account setup incomplete — missing: ${missing}. Check Clerk dashboard settings.`);
        } else {
          setError(`Verification incomplete (status: ${result.status}). Please try again.`);
        }
      }
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? 'Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // --- Render ---
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {step === 'landing' && (
        <View style={styles.center}>
          <Text style={styles.title}>CityWhispers</Text>
          <Text style={styles.subtitle}>
            Every street has a secret.{'\n'}Listen closer.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={() => setStep('email')}>
            <Text style={styles.btnText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'email' && (
        <View style={styles.center}>
          <Text style={styles.title}>Enter your email</Text>
          <Text style={styles.subtitle}>We'll send you a sign-in code.</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#5c5650"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus
            onSubmitEditing={handleEmailSubmit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleEmailSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0f0e0c" />
            ) : (
              <Text style={styles.btnText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {step === 'otp' && (
        <View style={styles.center}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code{'\n'}sent to {email}
          </Text>
          <TextInput
            style={[styles.input, styles.otpInput]}
            value={code}
            onChangeText={setCode}
            placeholder="000000"
            placeholderTextColor="#5c5650"
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            onSubmitEditing={handleOTPSubmit}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleOTPSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0f0e0c" />
            ) : (
              <Text style={styles.btnText}>Verify</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { setStep('email'); setFlow('signin'); setCode(''); setError(''); }}
          >
            <Text style={styles.backBtnText}>← Use a different email</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0f0e0c',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#e8e4dc',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#a09890',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 22,
  },
  input: {
    width: '100%',
    backgroundColor: '#171613',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: '#e8e4dc',
    fontSize: 16,
    marginBottom: 16,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
  },
  btn: {
    width: '100%',
    backgroundColor: '#c8a96e',
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#0f0e0c',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#c06060',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 20,
  },
  backBtnText: {
    color: '#5c5650',
    fontSize: 13,
  },
});
