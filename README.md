# LinkSmash

LinkSmash is a mobile application that allows you to save, organize, and manage links shared from other apps. It automatically fetches rich metadata (titles, descriptions, images) for saved links and provides a clean interface to browse and organize them with tags.

## Features

- **Share Links**: Share links from any app on your device directly to LinkSmash
- **Rich Metadata**: Automatically fetches titles, descriptions, and images for saved links
- **Platform Support**: Special handling for popular platforms (Instagram, Twitter, YouTube, etc.)
- **Tag Organization**: Organize links with custom tags and filter by tags
- **Edit Links**: Edit link metadata, tags, and descriptions
- **Dark Mode**: Full support for light and dark themes
- **Offline Storage**: All links are stored locally on your device

## Architecture

LinkSmash is a React Native mobile application built with Expo:

- **`apps/expo`**: React Native mobile app built with Expo

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Expo CLI** (installed globally or via npx)
- **For iOS development**: Xcode and CocoaPods
- **For Android development**: Android Studio and Android SDK
- **Redis** (optional, for API caching - defaults to localhost:6379)

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd LinkSmash
```

2. Install dependencies:

```bash
npm install
```

## Environment Setup

### Expo App

The Expo app requires an API URL to fetch metadata. Set up your environment:

1. Navigate to the Expo app directory:

```bash
cd apps/expo
```

2. Run the setup script (recommended):

```bash
npm run setup:env
```

This interactive script will help you configure the API URL for development or production.

3. Or manually create a `.env` file:

```bash
touch .env
```

Add the following (replace with your actual API URL):

```env
EXPO_PUBLIC_API_URL=http://YOUR_LOCAL_IP:8080
```

**Note**: For development on physical devices, use your machine's local IP address instead of `localhost`. See `apps/expo/ENV_SETUP.md` for detailed instructions.

## Running the Project

### Development Mode

**Start Expo app:**

```bash
npm start
# or
cd apps/expo && npm start
```

### Running on Devices

**Android:**

```bash
npm run android
```

**iOS:**

```bash
npm run ios
```

**Web:**

```bash
npm run web
```

## Project Structure

```
LinkSmash/
├── apps/
│   └── expo/                # React Native mobile app
│       ├── components/      # React components
│       ├── screens/         # App screens
│       ├── services/        # App services (storage, metadata, etc.)
│       ├── types/           # TypeScript types
│       └── package.json
├── package.json             # Root package.json with scripts
└── tsconfig.base.json       # TypeScript base configuration
```

## Building

### Build Expo App

**Production build (Android):**

```bash
npm run build-local
```

**Preview build:**

```bash
npm run build-local:preview
```

**Development build:**

```bash
npm run build-local:dev
```

## Development Scripts

### Root Level Scripts

- `npm start` - Start Expo app
- `npm run android` - Run on Android
- `npm run ios` - Run on iOS
- `npm run web` - Run on web
- `npm run prebuild` - Generate native code for Expo
- `npm run prebuild:clean` - Clean prebuild

### Expo App Scripts

- `npm run setup:env` - Interactive environment setup
- `npm run prebuild` - Generate native code
- `npm run fix:manifest` - Fix Android manifest

## Technologies

### Frontend

- **React Native** - Mobile framework
- **Expo** - Development platform
- **TypeScript** - Type safety
- **React Navigation** - Navigation
- **AsyncStorage** - Local storage

### Infrastructure

- **AWS App Runner** - Deployment (see `DEPLOYMENT.md`)

## Troubleshooting

### Environment Issues

1. **Check API URL**: Ensure `EXPO_PUBLIC_API_URL` is set correctly in `apps/expo/.env` if using an external API
2. **Restart Expo**: Always restart Expo after changing `.env` files

### Build Issues

1. **Clean prebuild**: Run `npm run prebuild:clean` to regenerate native code
2. **Clear cache**: Clear Expo cache with `expo start -c`
3. **Reinstall dependencies**: Delete `node_modules` and reinstall

### Platform-Specific Issues

**iOS:**

- Run `cd apps/expo/ios && pod install` if CocoaPods dependencies are missing

**Android:**

- Ensure Android SDK is properly configured
- Check that `ANDROID_HOME` environment variable is set

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly on both iOS and Android
4. Submit a pull request

## License

MIT
