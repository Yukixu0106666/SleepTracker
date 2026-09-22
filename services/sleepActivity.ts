import { NativeModules, Platform } from 'react-native';

export type ActiveSleep = { start: string };
export type CompletedSleep = { start: string; end: string; duration: number };

type SleepActivityModule = {
  start(): Promise<ActiveSleep>;
  stop(): Promise<CompletedSleep | null>;
  current(): Promise<ActiveSleep | null>;
  takeCompletedSession(): Promise<CompletedSleep | null>;
};

const nativeModule = NativeModules.SleepActivity as SleepActivityModule | undefined;

function requireNativeModule(): SleepActivityModule {
  if (Platform.OS !== 'ios' || !nativeModule) {
    throw new Error('Native sleep controls are available in the iOS development build.');
  }
  return nativeModule;
}

export function startSleepActivity() {
  return requireNativeModule().start();
}

export function stopSleepActivity() {
  return requireNativeModule().stop();
}

export function getActiveSleep() {
  return requireNativeModule().current();
}

export function takeCompletedSleep() {
  return requireNativeModule().takeCompletedSession();
}

export function hasNativeSleepActivity() {
  return Platform.OS === 'ios' && Boolean(nativeModule);
}
