export default {
  expo: {
    name: "user-app",
    slug: "user-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "user-app",
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
      bundleIdentifier: "com.rayees.userapp",
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
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.rayees.userapp",
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
      "@clerk/expo",
      "expo-secure-store",
      "expo-font",
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
        projectId: "b41c7a4d-64c0-49e6-b87a-470f6ddfdae5"
      },
    },
    owner: "rayeesone1"
  }
};
