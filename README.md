# Nexus Chat Hub - Android App

A React-based chat application wrapped as an Android app using Capacitor.

## Features
- Real-time chat functionality
- User authentication
- Job management
- AI-powered features

## Security
- Code minification enabled
- Backup disabled
- ProGuard obfuscation applied

## Download APK
Download `NexusChatHub.apk` from this repository and install on your Android device.

## Build from Source

### Prerequisites
- Node.js 18+
- Java 21
- Android SDK

### Build
```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleRelease
```

## For iOS
See: https://github.com/Aryan-verma-star/nexus-chat-ios-native
