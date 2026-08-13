export default {
  expo: {
    name: "tutem-rider",
    slug: "tutem-rider",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "tutem-rider",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.rider.tutem",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "This app needs to access your location to pick you up and track your ride.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs to access your location to pick you up and track your ride."
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_TESTING
      }
    },
    android: {
      edgeToEdgeEnabled: true,
      // Required to allow HTTP requests to the local Next.js dev server
      // (Pusher auth endpoint). Android 9+ blocks cleartext HTTP by default.
      usesCleartextTraffic: true,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.rider.tutem",
      googleServicesFile: "./rider-google-services.json",
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_TESTING
        }
      }
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "@react-native-community/datetimepicker",
      "expo-secure-store",
      "expo-font",
      "expo-notifications",
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location."
        }
      ]
    ],
    experiments: {
      "typedRoutes": true
    },
    extra: {
      router: {},
      eas: {
        projectId: "10149e7f-e9a1-4520-b5e7-3cd5776cc65c"
      },
    }
  }
};
