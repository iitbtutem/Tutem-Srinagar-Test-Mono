export default {
  expo: {
    name: "driver-app",
    slug: "driver-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "driver-app",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yameenfarooq.driverapp",
      infoPlist: {
        NSCameraUsageDescription: "This app uses the camera to scan barcodes on event tickets.",
        NSLocationWhenInUseUsageDescription: "This app needs to access your location to track your ride.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "This app needs to access your location to track your ride."
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    },
    android: {
      softwareKeyboardLayoutMode: "pan",
      edgeToEdgeEnabled: true,
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.yameenfarooq.driverapp",
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
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
        projectId: "7526ac0c-3fc5-4948-b8a3-9de609c43630"
      },
      GOOGLE_MAPS_API_KEY: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
    }
  }
};
